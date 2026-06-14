/**
 * Hierarchical Task Decomposition (DAG) — breaks complex tasks into a
 * directed acyclic graph of sub-tasks with dependencies.
 *
 * Two tasks that touch the same file MUST be sequential (dependency edge).
 * Tasks touching different files CAN be parallel.
 */

import { chat, type AIMessage } from "@/lib/ai/provider";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TaskNode = {
  id: string;
  description: string;
  files: string[];
  dependencies: string[];
  complexity: number;
  status: "pending" | "running" | "completed" | "failed";
  result?: string;
};

export type TaskGraph = {
  nodes: TaskNode[];
  edges: { from: string; to: string }[];
  rootTask: string;
};

export type DecomposeToGraphOptions = {
  task: string;
  projectId: string;
  storageKey: string;
  modelId?: string;
  provider?: string;
  workspaceId?: string;
  maxNodes?: number;
  signal?: AbortSignal;
};

// ---------------------------------------------------------------------------
// Prompts
// ---------------------------------------------------------------------------

function buildDecomposePrompt(task: string, maxNodes: number): AIMessage[] {
  return [
    {
      role: "system",
      content: `You are a task decomposition engine. Break complex software engineering tasks into smaller, independent sub-tasks.

Rules:
- Each sub-task should be completable independently (given its dependencies are met).
- List the specific files each sub-task will touch.
- Keep the number of sub-tasks between 2 and ${maxNodes}.
- Assign a complexity score (0-1) to each sub-task.
- Use short, descriptive IDs like "task-1", "task-2", etc.

Respond ONLY with valid JSON in this exact format:
{
  "tasks": [
    {
      "id": "task-1",
      "description": "Description of what this sub-task does",
      "files": ["src/path/to/file.ts", "src/other/file.ts"],
      "complexity": 0.4
    }
  ]
}

Do NOT include any text outside the JSON block.`,
    },
    {
      role: "user",
      content: `Decompose this task into sub-tasks:\n\n${task}`,
    },
  ];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Parse the LLM response into raw task data.
 * Handles both clean JSON and JSON wrapped in markdown code fences.
 */
function parseLLMResponse(
  raw: string
): { id: string; description: string; files: string[]; complexity: number }[] {
  let cleaned = raw.trim();

  // Strip markdown code fences if present
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    cleaned = fenceMatch[1].trim();
  }

  const parsed = JSON.parse(cleaned);

  if (!parsed.tasks || !Array.isArray(parsed.tasks)) {
    throw new Error("LLM response missing 'tasks' array");
  }

  return parsed.tasks.map(
    (t: { id?: string; description?: string; files?: string[]; complexity?: number }, i: number) => ({
      id: t.id ?? `task-${i + 1}`,
      description: t.description ?? "Unnamed task",
      files: Array.isArray(t.files) ? t.files : [],
      complexity: typeof t.complexity === "number" ? Math.max(0, Math.min(1, t.complexity)) : 0.5,
    })
  );
}

/**
 * Compute dependency edges based on file overlap.
 * If task B touches a file that task A also touches, and A comes before B
 * in the original ordering, then B depends on A.
 */
function computeFileOverlapDependencies(
  tasks: { id: string; files: string[] }[]
): { edges: { from: string; to: string }[]; deps: Map<string, string[]> } {
  const edges: { from: string; to: string }[] = [];
  const deps = new Map<string, string[]>();

  for (let i = 0; i < tasks.length; i++) {
    const taskDeps: string[] = [];

    for (let j = 0; j < i; j++) {
      const overlap = tasks[i].files.some((f) => tasks[j].files.includes(f));
      if (overlap) {
        edges.push({ from: tasks[j].id, to: tasks[i].id });
        taskDeps.push(tasks[j].id);
      }
    }

    deps.set(tasks[i].id, taskDeps);
  }

  return { edges, deps };
}

/**
 * Remove transitive edges to keep the graph minimal.
 * If A→B and B→C, we don't need A→C.
 */
function removeTransitiveEdges(
  edges: { from: string; to: string }[],
  nodes: { id: string }[]
): { from: string; to: string }[] {
  // Build adjacency for reachability
  const adj = new Map<string, Set<string>>();
  for (const n of nodes) adj.set(n.id, new Set());
  for (const e of edges) adj.get(e.from)?.add(e.to);

  // Compute transitive closure via BFS for each node
  const reachable = new Map<string, Set<string>>();
  for (const n of nodes) {
    const visited = new Set<string>();
    const queue = [...(adj.get(n.id) ?? [])];
    while (queue.length > 0) {
      const curr = queue.shift()!;
      if (visited.has(curr)) continue;
      visited.add(curr);
      for (const next of adj.get(curr) ?? []) {
        queue.push(next);
      }
    }
    reachable.set(n.id, visited);
  }

  // An edge A→C is transitive if there exists B such that A→B and B can reach C
  return edges.filter((edge) => {
    const directNeighbors = adj.get(edge.from);
    if (!directNeighbors) return true;

    for (const mid of directNeighbors) {
      if (mid === edge.to) continue;
      if (reachable.get(mid)?.has(edge.to)) {
        return false; // Transitive — remove
      }
    }
    return true;
  });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Decompose a complex task into a DAG of sub-tasks */
export async function decomposeToGraph(
  options: DecomposeToGraphOptions
): Promise<TaskGraph> {
  const maxNodes = options.maxNodes ?? 6;

  const messages = buildDecomposePrompt(options.task, maxNodes);

  const response = await chat(messages, {
    model: options.modelId,
    provider: options.provider,
    workspaceId: options.workspaceId,
    signal: options.signal,
    temperature: 0.2,
  });

  const rawTasks = parseLLMResponse(response);

  // Limit to maxNodes
  const limitedTasks = rawTasks.slice(0, maxNodes);

  // Compute dependencies from file overlap
  const { edges, deps } = computeFileOverlapDependencies(limitedTasks);

  // Build nodes
  const nodes: TaskNode[] = limitedTasks.map((t) => ({
    id: t.id,
    description: t.description,
    files: t.files,
    dependencies: deps.get(t.id) ?? [],
    complexity: t.complexity,
    status: "pending" as const,
  }));

  // Minimize edges (remove transitive)
  const minimalEdges = removeTransitiveEdges(edges, nodes);

  return {
    nodes,
    edges: minimalEdges,
    rootTask: options.task,
  };
}

/** Get the next executable tasks (no unmet dependencies) */
export function getReadyTasks(graph: TaskGraph): TaskNode[] {
  const completedIds = new Set(
    graph.nodes.filter((n) => n.status === "completed").map((n) => n.id)
  );

  return graph.nodes.filter((node) => {
    if (node.status !== "pending") return false;
    return node.dependencies.every((dep) => completedIds.has(dep));
  });
}

/** Mark a task as completed and return newly unblocked tasks */
export function completeTask(
  graph: TaskGraph,
  taskId: string,
  result: string
): TaskNode[] {
  const node = graph.nodes.find((n) => n.id === taskId);
  if (!node) {
    throw new Error(`Task "${taskId}" not found in graph`);
  }

  node.status = "completed";
  node.result = result;

  // Find tasks that were blocked only by this task
  const completedIds = new Set(
    graph.nodes.filter((n) => n.status === "completed").map((n) => n.id)
  );

  return graph.nodes.filter((n) => {
    if (n.status !== "pending") return false;
    // Must have had taskId as a dependency
    if (!n.dependencies.includes(taskId)) return false;
    // All dependencies must now be met
    return n.dependencies.every((dep) => completedIds.has(dep));
  });
}

/** Check if all tasks are completed */
export function isGraphComplete(graph: TaskGraph): boolean {
  return graph.nodes.every(
    (n) => n.status === "completed" || n.status === "failed"
  );
}

/** Get tasks that can run in parallel (independent of each other) */
export function getParallelGroups(graph: TaskGraph): TaskNode[][] {
  const sorted = topologicalSort(graph);
  const groups: TaskNode[][] = [];

  // Assign each node to the earliest possible group (level)
  const levels = new Map<string, number>();

  for (const node of sorted) {
    let maxDepLevel = -1;
    for (const dep of node.dependencies) {
      const depLevel = levels.get(dep) ?? 0;
      maxDepLevel = Math.max(maxDepLevel, depLevel);
    }
    const nodeLevel = maxDepLevel + 1;
    levels.set(node.id, nodeLevel);

    while (groups.length <= nodeLevel) {
      groups.push([]);
    }
    groups[nodeLevel].push(node);
  }

  return groups;
}

/** Topological sort of the graph (Kahn's algorithm) */
export function topologicalSort(graph: TaskGraph): TaskNode[] {
  const inDegree = new Map<string, number>();
  const adj = new Map<string, string[]>();

  // Initialize
  for (const node of graph.nodes) {
    inDegree.set(node.id, 0);
    adj.set(node.id, []);
  }

  // Build adjacency and in-degree
  for (const edge of graph.edges) {
    adj.get(edge.from)?.push(edge.to);
    inDegree.set(edge.to, (inDegree.get(edge.to) ?? 0) + 1);
  }

  // Start with nodes that have no incoming edges
  const queue: string[] = [];
  for (const [id, degree] of inDegree) {
    if (degree === 0) queue.push(id);
  }

  const sorted: TaskNode[] = [];
  const nodeMap = new Map(graph.nodes.map((n) => [n.id, n]));

  while (queue.length > 0) {
    const current = queue.shift()!;
    const node = nodeMap.get(current);
    if (node) sorted.push(node);

    for (const neighbor of adj.get(current) ?? []) {
      const newDegree = (inDegree.get(neighbor) ?? 1) - 1;
      inDegree.set(neighbor, newDegree);
      if (newDegree === 0) {
        queue.push(neighbor);
      }
    }
  }

  // If sorted doesn't contain all nodes, there's a cycle (shouldn't happen with DAG)
  if (sorted.length !== graph.nodes.length) {
    throw new Error(
      "Cycle detected in task graph — this should not happen with file-overlap dependencies"
    );
  }

  return sorted;
}
