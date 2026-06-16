/**
 * Parallel Sub-Agent Execution — spawn multiple agents working on independent sub-tasks.
 * Uses the task graph to identify parallelizable work and executes concurrently.
 *
 * Phase 4.6 of the quality amplification system.
 */

import { runAgentlessPipeline } from "@/lib/ai/pipelines/agentless";
import { runAgentLoop } from "@/lib/ai/pipelines/agent-loop";
import { multiPassExecute } from "@/lib/ai/multi-pass";
import { buildSmartContext } from "@/lib/ai/smart-context";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type SubAgentConfig = {
  id: string;
  task: string;
  files: string[]; // Files this agent is responsible for
  pipeline: "agentless" | "agent_loop" | "multi_pass";
  modelId?: string;
  priority: number; // Higher = execute first
};

export type ParallelExecutionOptions = {
  agents: SubAgentConfig[];
  projectId: string;
  storageKey: string;

  // Concurrency
  maxConcurrent?: number; // Max parallel agents (default 3)

  // Model config
  modelId?: string;
  provider?: string;
  workspaceId?: string;

  // Callbacks
  onAgentStart?: (agentId: string) => void;
  onAgentComplete?: (agentId: string, success: boolean) => void;
  onAllComplete?: (results: SubAgentResult[]) => void;

  signal?: AbortSignal;
};

export type SubAgentResult = {
  agentId: string;
  success: boolean;
  patches: { filePath: string; search: string; replace: string }[];
  error?: string;
  durationMs: number;
};

export type ParallelExecutionResult = {
  success: boolean;
  results: SubAgentResult[];
  totalDurationMs: number;
  conflicts: FileConflict[]; // Agents that tried to modify same file
};

export type FileConflict = {
  file: string;
  agents: string[];
  resolution: "first_wins" | "merged" | "unresolved";
};

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_MAX_CONCURRENT = 3;
const AGENT_TIMEOUT_MS = 120_000; // 2 minutes per agent

// ─────────────────────────────────────────────────────────────────────────────
// Semaphore — concurrency limiter
// ─────────────────────────────────────────────────────────────────────────────

class Semaphore {
  private queue: (() => void)[] = [];
  private active = 0;

  constructor(private readonly maxConcurrent: number) {}

  async acquire(): Promise<void> {
    if (this.active < this.maxConcurrent) {
      this.active++;
      return;
    }
    return new Promise<void>((resolve) => {
      this.queue.push(resolve);
    });
  }

  release(): void {
    this.active--;
    const next = this.queue.shift();
    if (next) {
      this.active++;
      next();
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Execution
// ─────────────────────────────────────────────────────────────────────────────

/** Execute multiple sub-agents in parallel */
export async function executeParallel(
  options: ParallelExecutionOptions
): Promise<ParallelExecutionResult> {
  const startTime = Date.now();
  const {
    agents,
    projectId,
    storageKey,
    maxConcurrent = DEFAULT_MAX_CONCURRENT,
    modelId,
    provider,
    workspaceId,
    onAgentStart,
    onAgentComplete,
    onAllComplete,
    signal,
  } = options;

  // Sort agents by priority (higher first)
  const sortedAgents = [...agents].sort((a, b) => b.priority - a.priority);

  // Create semaphore for concurrency control
  const semaphore = new Semaphore(maxConcurrent);

  // Execute all agents with concurrency limiting
  const results = await Promise.allSettled(
    sortedAgents.map(async (agent) => {
      // Check abort before acquiring semaphore
      if (signal?.aborted) {
        return createAbortedResult(agent.id);
      }

      await semaphore.acquire();

      try {
        // Check abort after acquiring semaphore
        if (signal?.aborted) {
          return createAbortedResult(agent.id);
        }

        onAgentStart?.(agent.id);

        const result = await executeSubAgent(agent, {
          projectId,
          storageKey,
          modelId: agent.modelId ?? modelId,
          provider,
          workspaceId,
          signal,
        });

        onAgentComplete?.(agent.id, result.success);
        return result;
      } finally {
        semaphore.release();
      }
    })
  );

  // Collect results, handling rejected promises
  const agentResults: SubAgentResult[] = results.map((settled, index) => {
    if (settled.status === "fulfilled") {
      return settled.value;
    }
    return {
      agentId: sortedAgents[index].id,
      success: false,
      patches: [],
      error:
        settled.reason instanceof Error
          ? settled.reason.message
          : String(settled.reason),
      durationMs: 0,
    };
  });

  // Detect conflicts
  const conflicts = detectConflicts(agentResults);

  // Notify completion
  onAllComplete?.(agentResults);

  const totalDurationMs = Date.now() - startTime;
  const anySucceeded = agentResults.some((r) => r.success);

  return {
    success:
      anySucceeded && conflicts.every((c) => c.resolution !== "unresolved"),
    results: agentResults,
    totalDurationMs,
    conflicts,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-Agent Execution
// ─────────────────────────────────────────────────────────────────────────────

type SubAgentExecutionContext = {
  projectId: string;
  storageKey: string;
  modelId?: string;
  provider?: string;
  workspaceId?: string;
  signal?: AbortSignal;
};

/** Execute a single sub-agent using its configured pipeline */
async function executeSubAgent(
  agent: SubAgentConfig,
  ctx: SubAgentExecutionContext
): Promise<SubAgentResult> {
  const startTime = Date.now();

  try {
    const result = await runWithTimeout(
      () => dispatchPipeline(agent, ctx),
      AGENT_TIMEOUT_MS,
      ctx.signal
    );

    return {
      agentId: agent.id,
      success: result.success,
      patches: result.patches,
      durationMs: Date.now() - startTime,
    };
  } catch (error) {
    return {
      agentId: agent.id,
      success: false,
      patches: [],
      error: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - startTime,
    };
  }
}

type PipelineResult = {
  success: boolean;
  patches: { filePath: string; search: string; replace: string }[];
};

/** Dispatch to the appropriate pipeline based on agent config */
async function dispatchPipeline(
  agent: SubAgentConfig,
  ctx: SubAgentExecutionContext
): Promise<PipelineResult> {
  switch (agent.pipeline) {
    case "agentless": {
      const result = await runAgentlessPipeline({
        task: agent.task,
        projectId: ctx.projectId,
        storageKey: ctx.storageKey,
        modelId: ctx.modelId,
        provider: ctx.provider,
        workspaceId: ctx.workspaceId,
      });

      if (!result.success || !result.patch) {
        return { success: false, patches: [] };
      }

      return {
        success: true,
        patches: result.patch.map((block) => ({
          filePath: block.filePath ?? agent.files[0] ?? "unknown",
          search: block.search,
          replace: block.replace,
        })),
      };
    }

    case "agent_loop": {
      const result = await runAgentLoop({
        task: agent.task,
        projectId: ctx.projectId,
        storageKey: ctx.storageKey,
        modelId: ctx.modelId,
        provider: ctx.provider,
        workspaceId: ctx.workspaceId,
        signal: ctx.signal,
      });

      return {
        success: result.success,
        patches: result.patches.map((block) => ({
          filePath: block.filePath ?? agent.files[0] ?? "unknown",
          search: block.search,
          replace: block.replace,
        })),
      };
    }

    case "multi_pass": {
      // Build context for the multi-pass pipeline
      const context = await buildSmartContext(ctx.projectId, {
        query: agent.task,
        modelId: ctx.modelId,
        provider: ctx.provider,
        taskType: "agent",
      });

      const result = await multiPassExecute({
        task: agent.task,
        context: context.system,
        modelId: ctx.modelId,
        provider: ctx.provider,
        workspaceId: ctx.workspaceId,
        outputFormat:
          "Respond with SEARCH/REPLACE blocks for each file change needed.",
        signal: ctx.signal,
      });

      // Parse patches from multi-pass output
      const patches = parseMultiPassPatches(result.finalOutput, agent.files);
      return {
        success: patches.length > 0,
        patches,
      };
    }

    default: {
      const _exhaustive: never = agent.pipeline;
      throw new Error(`Unknown pipeline: ${agent.pipeline}`);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Conflict Detection & Resolution
// ─────────────────────────────────────────────────────────────────────────────

/** Detect conflicts between agent results */
export function detectConflicts(results: SubAgentResult[]): FileConflict[] {
  // Build a map of file -> agents that modified it
  const fileToAgents = new Map<string, string[]>();

  for (const result of results) {
    if (!result.success) continue;

    const filesModified = new Set<string>();
    for (const patch of result.patches) {
      filesModified.add(patch.filePath);
    }

    filesModified.forEach((file) => {
      const existing = fileToAgents.get(file) ?? [];
      existing.push(result.agentId);
      fileToAgents.set(file, existing);
    });
  }

  // Find files modified by multiple agents
  const conflicts: FileConflict[] = [];

  fileToAgents.forEach((agents, file) => {
    if (agents.length <= 1) return;

    // Attempt to determine resolution
    const resolution = resolveConflict(file, agents, results);
    conflicts.push({ file, agents, resolution });
  });

  return conflicts;
}

/** Determine how to resolve a file conflict */
function resolveConflict(
  file: string,
  agentIds: string[],
  results: SubAgentResult[]
): FileConflict["resolution"] {
  // Get patches for this file from each agent
  const patchesByAgent = new Map<
    string,
    { search: string; replace: string }[]
  >();

  for (const agentId of agentIds) {
    const result = results.find((r) => r.agentId === agentId);
    if (!result) continue;

    const patches = result.patches.filter((p) => p.filePath === file);
    patchesByAgent.set(agentId, patches);
  }

  // Check if patches touch different regions (non-overlapping search strings)
  const allSearchStrings: string[] = [];
  let hasOverlap = false;

  patchesByAgent.forEach((patches) => {
    for (const patch of patches) {
      // Check if this search string overlaps with any existing one
      for (const existing of allSearchStrings) {
        if (
          existing.includes(patch.search) ||
          patch.search.includes(existing) ||
          stringsOverlap(existing, patch.search)
        ) {
          hasOverlap = true;
          break;
        }
      }
      allSearchStrings.push(patch.search);
    }
  });

  if (!hasOverlap) {
    return "merged";
  }

  // If patches overlap, use priority-based resolution (first_wins)
  // The results are already sorted by priority from executeParallel
  return "first_wins";
}

/** Check if two strings have overlapping content (share a common substring > threshold) */
function stringsOverlap(a: string, b: string, minOverlap = 20): boolean {
  if (a.length < minOverlap || b.length < minOverlap) return false;

  // Check for significant shared lines
  const shorter = a.length < b.length ? a : b;
  const longer = a.length >= b.length ? a : b;

  const shorterLines = shorter.split("\n").filter((l) => l.trim().length > 0);

  let sharedLines = 0;
  for (const line of shorterLines) {
    if (line.trim().length >= 10 && longer.includes(line)) {
      sharedLines++;
    }
  }

  // If more than 30% of non-empty lines are shared, consider it overlapping
  return shorterLines.length > 0 && sharedLines / shorterLines.length > 0.3;
}

// ─────────────────────────────────────────────────────────────────────────────
// Patch Merging
// ─────────────────────────────────────────────────────────────────────────────

/** Merge non-conflicting patches from multiple agents */
export function mergePatches(
  results: SubAgentResult[]
): { filePath: string; search: string; replace: string }[] {
  const conflicts = detectConflicts(results);
  const conflictedFiles = new Set(
    conflicts.map((c) => c.file)
  );

  // Collect all patches, handling conflicts
  const mergedPatches: { filePath: string; search: string; replace: string }[] =
    [];

  // First, add all patches from non-conflicted files
  for (const result of results) {
    if (!result.success) continue;

    for (const patch of result.patches) {
      if (!conflictedFiles.has(patch.filePath)) {
        mergedPatches.push(patch);
      }
    }
  }

  // For conflicted files, apply resolution strategy
  for (const conflict of conflicts) {
    const patchesForFile = getConflictedPatches(conflict, results);
    mergedPatches.push(...patchesForFile);
  }

  // Deduplicate patches (same file + same search + same replace)
  return deduplicatePatches(mergedPatches);
}

/** Get patches for a conflicted file based on resolution strategy */
function getConflictedPatches(
  conflict: FileConflict,
  results: SubAgentResult[]
): { filePath: string; search: string; replace: string }[] {
  switch (conflict.resolution) {
    case "merged": {
      // Non-overlapping patches — include all of them
      const allPatches: {
        filePath: string;
        search: string;
        replace: string;
      }[] = [];
      for (const agentId of conflict.agents) {
        const result = results.find((r) => r.agentId === agentId);
        if (!result) continue;
        const patches = result.patches.filter(
          (p) => p.filePath === conflict.file
        );
        allPatches.push(...patches);
      }
      return allPatches;
    }

    case "first_wins": {
      // Use patches from the first agent (highest priority, since results are sorted)
      const firstAgentId = conflict.agents[0];
      const result = results.find((r) => r.agentId === firstAgentId);
      if (!result) return [];
      return result.patches.filter((p) => p.filePath === conflict.file);
    }

    case "unresolved": {
      // Cannot merge — skip these patches
      return [];
    }

    default:
      return [];
  }
}

/** Remove duplicate patches */
function deduplicatePatches(
  patches: { filePath: string; search: string; replace: string }[]
): { filePath: string; search: string; replace: string }[] {
  const seen = new Set<string>();
  const unique: { filePath: string; search: string; replace: string }[] = [];

  for (const patch of patches) {
    const key = `${patch.filePath}::${patch.search}::${patch.replace}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(patch);
    }
  }

  return unique;
}

// ─────────────────────────────────────────────────────────────────────────────
// Graph → Agent Config
// ─────────────────────────────────────────────────────────────────────────────

export type TaskGraphNode = {
  id: string;
  description: string;
  files: string[];
  complexity: number;
};

export type TaskGraph = {
  nodes: TaskGraphNode[];
};

/** Create sub-agent configs from a task graph */
export function createAgentsFromGraph(
  graph: TaskGraph,
  modelTier: "weak" | "medium" | "strong"
): SubAgentConfig[] {
  return graph.nodes.map((node) => {
    const pipeline = selectPipeline(node.complexity, modelTier);
    const priority = computePriority(node, graph.nodes);

    return {
      id: `agent-${node.id}`,
      task: node.description,
      files: node.files,
      pipeline,
      priority,
    };
  });
}

/** Select pipeline based on task complexity and model tier */
function selectPipeline(
  complexity: number,
  modelTier: "weak" | "medium" | "strong"
): SubAgentConfig["pipeline"] {
  // Strong models use agent_loop for complex tasks
  if (modelTier === "strong") {
    return complexity > 5 ? "agent_loop" : "multi_pass";
  }

  // Medium models use multi_pass for moderate complexity
  if (modelTier === "medium") {
    if (complexity > 7) return "agent_loop";
    if (complexity > 3) return "multi_pass";
    return "agentless";
  }

  // Weak models always use agentless (structured pipeline)
  return "agentless";
}

/** Compute priority based on node characteristics */
function computePriority(
  node: TaskGraphNode,
  allNodes: TaskGraphNode[]
): number {
  let priority = 0;

  // Higher complexity = higher priority (tackle hard problems first)
  priority += node.complexity * 10;

  // More files = higher priority (broader impact)
  priority += node.files.length * 5;

  // Nodes whose files are depended on by other nodes get higher priority
  const dependedOnCount = allNodes.filter(
    (other) =>
      other.id !== node.id && other.files.some((f) => node.files.includes(f))
  ).length;
  priority += dependedOnCount * 15;

  return priority;
}

// ─────────────────────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────────────────────

/** Run a function with a timeout */
async function runWithTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number,
  signal?: AbortSignal
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let settled = false;

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        reject(new Error(`Agent timed out after ${timeoutMs}ms`));
      }
    }, timeoutMs);

    // Listen for abort signal
    const abortHandler = () => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        reject(new Error("Agent execution aborted"));
      }
    };

    signal?.addEventListener("abort", abortHandler, { once: true });

    fn()
      .then((result) => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          signal?.removeEventListener("abort", abortHandler);
          resolve(result);
        }
      })
      .catch((error) => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          signal?.removeEventListener("abort", abortHandler);
          reject(error);
        }
      });
  });
}

/** Create a result for an aborted agent */
function createAbortedResult(agentId: string): SubAgentResult {
  return {
    agentId,
    success: false,
    patches: [],
    error: "Execution aborted",
    durationMs: 0,
  };
}

/** Parse SEARCH/REPLACE blocks from multi-pass output */
function parseMultiPassPatches(
  output: string,
  defaultFiles: string[]
): { filePath: string; search: string; replace: string }[] {
  const patches: { filePath: string; search: string; replace: string }[] = [];

  // Match patterns like:
  // <<<<<<< SEARCH
  // ...content...
  // =======
  // ...replacement...
  // >>>>>>> REPLACE
  //
  // Or with file header:
  // ```filepath.ts
  // <<<<<<< SEARCH
  // ...
  const blockRegex =
    /(?:```(\S+)\n)?<<<<<<< SEARCH\n([\s\S]*?)\n=======\n([\s\S]*?)\n>>>>>>> REPLACE/g;

  let match: RegExpExecArray | null;
  let fileIndex = 0;

  while ((match = blockRegex.exec(output)) !== null) {
    const filePath =
      match[1] ?? defaultFiles[fileIndex] ?? defaultFiles[0] ?? "unknown";
    const search = match[2];
    const replace = match[3];

    if (search !== undefined && replace !== undefined) {
      patches.push({ filePath, search, replace });
    }

    // Cycle through default files if no explicit file path
    if (!match[1] && defaultFiles.length > 1) {
      fileIndex = (fileIndex + 1) % defaultFiles.length;
    }
  }

  // Also try the alternative format:
  // File: path/to/file.ts
  // SEARCH:
  // ```
  // ...
  // ```
  // REPLACE:
  // ```
  // ...
  // ```
  const altRegex =
    /File:\s*(\S+)\s*\nSEARCH:\s*\n```[^\n]*\n([\s\S]*?)\n```\s*\nREPLACE:\s*\n```[^\n]*\n([\s\S]*?)\n```/g;

  while ((match = altRegex.exec(output)) !== null) {
    const filePath = match[1] ?? defaultFiles[0] ?? "unknown";
    const search = match[2];
    const replace = match[3];

    if (search !== undefined && replace !== undefined) {
      patches.push({ filePath, search, replace });
    }
  }

  return patches;
}
