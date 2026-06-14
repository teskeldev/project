/**
 * Smart Context Builder — Enhanced context assembly for AI interactions.
 *
 * Integrates:
 * - Relevance scoring (auto-discovers relevant files)
 * - Repo map (structural codebase summary)
 * - Context compression (fits more info in less tokens)
 * - Token budget management (model-aware allocation)
 * - Import graph awareness
 * - Test file association
 *
 * This is the PRIMARY context builder for all AI interactions in Teskel.
 * It wraps the original buildProjectContext and adds intelligence layers.
 *
 * Phase 1.9 of the quality amplification system.
 */

import { prisma } from "@/lib/db";
import { readFile } from "@/lib/storage";
import { loadActiveSkills } from "@/lib/skills";
import { buildRepoMap } from "@/lib/search/repo-map";
import { scoreFileRelevance, type ScoredFile } from "@/lib/ai/relevance-scorer";
import {
  compressFile,
  compressFilesForContext,
  type CompressionLevel,
} from "@/lib/ai/context-compressor";
import { allocateBudget } from "@/lib/ai/token-budget";
import { findTestFiles } from "@/lib/search/test-discovery";
import { TESKEL_PERSONA } from "@/lib/ai/context";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type SmartContextOptions = {
  /** What the user is asking/doing */
  query?: string;

  /** Files explicitly selected/open by the user */
  selectedPaths?: string[];

  /** Model being used (for budget allocation) */
  modelId?: string;
  provider?: string;

  /** Task type (affects budget allocation) */
  taskType?: "chat" | "completion" | "agent" | "review";

  /** Override max chars (otherwise calculated from model) */
  maxChars?: number;

  /** Include repo map in context? Default: true */
  includeRepoMap?: boolean;

  /** Include auto-discovered relevant files? Default: true */
  includeRelevantFiles?: boolean;

  /** Max number of auto-discovered files. Default: 10 */
  maxRelevantFiles?: number;

  /** Include test files for relevant sources? Default: false */
  includeTestFiles?: boolean;

  /** Conversation history (for context about what user has been discussing) */
  conversationContext?: string;
};

export type SmartContextResult = {
  /** The full system prompt (ready to use) */
  system: string;

  /** Breakdown of what was included */
  contextBlocks: { label: string; content: string; chars: number }[];

  /** Files that were auto-discovered as relevant */
  relevantFiles: { path: string; score: number; reason: string }[];

  /** Budget usage */
  budget: {
    total: number;
    used: number;
    remaining: number;
    breakdown: Record<string, number>;
  };

  /** Metadata for display to user */
  metadata: {
    modelId: string;
    filesIncluded: number;
    repoMapIncluded: boolean;
    compressionLevel: string;
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/** Maximum number of knowledge items to include. */
const MAX_KNOWLEDGE_ITEMS = 20;

/** Maximum file tree entries when budget is tight. */
const MAX_TREE_PATHS = 300;

/** Minimum budget (chars) below which we skip optional sections. */
const MIN_BUDGET_FOR_REPO_MAP = 2_000;
const MIN_BUDGET_FOR_RELEVANT_FILES = 1_500;
const MIN_BUDGET_FOR_TREE = 500;

/** Default model when none specified. */
const DEFAULT_MODEL = "gpt-4o";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Truncate text to a max length, appending a marker when cut. */
function clip(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, Math.max(0, max - 20)) + "\n... [truncated]";
}

/**
 * Determine the compression level for a file based on its relevance rank
 * and the available budget.
 */
function determineCompressionLevel(
  rank: number,
  fileSize: number,
  budgetPerFile: number
): CompressionLevel {
  // If the file fits comfortably in its budget share, use full
  if (fileSize <= budgetPerFile * 0.8) return "full";
  // Top-ranked files get skeleton
  if (rank < 3) return "skeleton";
  // Mid-ranked files get signatures
  if (rank < 8) return "signatures";
  // Lower-ranked files get summary
  return "summary";
}

/**
 * Determine the dominant compression level used across files for metadata.
 */
function dominantCompressionLevel(
  levels: CompressionLevel[]
): string {
  if (levels.length === 0) return "none";
  const counts: Record<string, number> = {};
  for (const l of levels) {
    counts[l] = (counts[l] ?? 0) + 1;
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Implementation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build smart context with all intelligence layers.
 *
 * This is the primary entry point for assembling AI context in Teskel.
 * It orchestrates relevance scoring, repo map generation, context compression,
 * and token budget management to produce an optimized system prompt.
 *
 * @param projectId - The project database ID
 * @param options - Configuration for context assembly
 * @returns A SmartContextResult with the system prompt and metadata
 */
export async function buildSmartContext(
  projectId: string,
  options?: SmartContextOptions
): Promise<SmartContextResult> {
  const opts: Required<SmartContextOptions> = {
    query: options?.query ?? "",
    selectedPaths: (options?.selectedPaths ?? []).filter(Boolean),
    modelId: options?.modelId ?? DEFAULT_MODEL,
    provider: options?.provider ?? "",
    taskType: options?.taskType ?? "chat",
    maxChars: options?.maxChars ?? 0, // 0 means "auto from model"
    includeRepoMap: options?.includeRepoMap ?? true,
    includeRelevantFiles: options?.includeRelevantFiles ?? true,
    maxRelevantFiles: options?.maxRelevantFiles ?? 10,
    includeTestFiles: options?.includeTestFiles ?? false,
    conversationContext: options?.conversationContext ?? "",
  };

  // ─── Step 1: Determine token budget ──────────────────────────────────────
  const budgetAllocation = allocateBudget({
    modelId: opts.modelId,
    provider: opts.provider,
    taskType: opts.taskType,
    includeRepoMap: opts.includeRepoMap,
    conversationLength: opts.conversationContext ? 1 : 0,
  });

  const totalBudget = opts.maxChars > 0 ? opts.maxChars : budgetAllocation.total;

  // Track budget usage per section
  const budgetBreakdown: Record<string, number> = {};
  let budgetUsed = 0;

  const blocks: { label: string; content: string; chars: number }[] = [];

  /** Push a context block, respecting remaining budget. Returns chars used. */
  function pushBlock(label: string, content: string, maxAlloc?: number): number {
    const remaining = totalBudget - budgetUsed;
    if (remaining <= 0 || !content.trim()) return 0;

    const limit = maxAlloc ? Math.min(maxAlloc, remaining) : remaining;
    const clipped = clip(content, limit);
    const chars = clipped.length;

    blocks.push({ label, content: clipped, chars });
    budgetUsed += chars;
    budgetBreakdown[label] = chars;
    return chars;
  }

  // ─── Step 2: Fetch project metadata ──────────────────────────────────────
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      name: true,
      description: true,
      storageKey: true,
      workspaceId: true,
    },
  });

  if (!project) {
    // No project found — return minimal context with persona only
    return {
      system: TESKEL_PERSONA,
      contextBlocks: [],
      relevantFiles: [],
      budget: {
        total: totalBudget,
        used: 0,
        remaining: totalBudget,
        breakdown: {},
      },
      metadata: {
        modelId: opts.modelId,
        filesIncluded: 0,
        repoMapIncluded: false,
        compressionLevel: "none",
      },
    };
  }

  // ─── Step 3: Fetch rules, skills, knowledge, file tree in parallel ───────
  const [rules, skills, knowledge, fileNodes] = await Promise.all([
    prisma.rule.findMany({
      where: {
        enabled: true,
        OR: [
          { scope: "GLOBAL" },
          { scope: "WORKSPACE", workspaceId: project.workspaceId },
          { scope: "PROJECT", projectId },
        ],
      },
      select: { scope: true, title: true, content: true, filePattern: true },
      orderBy: { createdAt: "asc" },
    }),
    loadActiveSkills(project.workspaceId, projectId),
    prisma.knowledgeItem.findMany({
      where: {
        OR: [
          { workspaceId: project.workspaceId, projectId: null },
          { projectId },
        ],
      },
      select: { title: true, type: true, content: true },
      orderBy: { createdAt: "asc" },
      take: MAX_KNOWLEDGE_ITEMS,
    }),
    prisma.fileNode.findMany({
      where: { projectId },
      select: { path: true, type: true },
      orderBy: { path: "asc" },
    }),
  ]);

  const allFilePaths = fileNodes
    .filter((f) => f.type === "FILE")
    .map((f) => f.path);

  // ─── Step 4: Relevance scoring (if query provided) ───────────────────────
  let scoredFiles: ScoredFile[] = [];

  if (opts.query && opts.includeRelevantFiles && allFilePaths.length > 0) {
    try {
      scoredFiles = await scoreFileRelevance({
        query: opts.query,
        targetFiles: opts.selectedPaths,
        projectId,
        storageKey: project.storageKey,
        maxResults: opts.maxRelevantFiles,
      });
    } catch (err) {
      // Relevance scoring failed (e.g., embeddings not configured).
      // Continue without auto-discovered files — selected files still work.
      console.warn(
        "[smart-context] Relevance scoring failed, continuing without:",
        err instanceof Error ? err.message : err
      );
    }
  }

  // ─── Step 5: Find associated test files (if enabled) ─────────────────────
  const testFilePaths: string[] = [];

  if (opts.includeTestFiles && scoredFiles.length > 0) {
    const topRelevant = scoredFiles.slice(0, 5);
    for (const sf of topRelevant) {
      const association = findTestFiles(sf.path, allFilePaths);
      if (association.testFiles.length > 0 && association.confidence > 0.5) {
        // Add the best test file if not already in the list
        const bestTest = association.testFiles[0];
        if (
          !testFilePaths.includes(bestTest) &&
          !opts.selectedPaths.includes(bestTest)
        ) {
          testFilePaths.push(bestTest);
        }
      }
    }
  }

  // ─── Step 6: Build repo map ──────────────────────────────────────────────
  let repoMapContent = "";
  const repoMapBudget = Math.min(
    budgetAllocation.repoMap,
    Math.floor(totalBudget * 0.15)
  );

  if (
    opts.includeRepoMap &&
    allFilePaths.length > 0 &&
    totalBudget - budgetUsed > MIN_BUDGET_FOR_REPO_MAP
  ) {
    try {
      repoMapContent = await buildRepoMap(projectId, project.storageKey, {
        maxChars: repoMapBudget,
      });
    } catch (err) {
      console.warn(
        "[smart-context] Repo map generation failed:",
        err instanceof Error ? err.message : err
      );
    }
  }

  // ─── Step 7: Read and compress files ─────────────────────────────────────
  const compressionLevels: CompressionLevel[] = [];

  // 7a. Selected files (highest priority — full or skeleton)
  const selectedFileContents: { path: string; content: string }[] = [];
  for (const p of opts.selectedPaths) {
    try {
      const raw = await readFile(project.storageKey, p);
      selectedFileContents.push({ path: p, content: raw });
    } catch {
      selectedFileContents.push({ path: p, content: "[unavailable]" });
    }
  }

  // 7b. Relevant files (compressed based on budget)
  const relevantFileContents: {
    path: string;
    content: string;
    relevance: number;
  }[] = [];

  if (scoredFiles.length > 0) {
    // Read content for top relevant files
    const filesToRead = scoredFiles.slice(0, opts.maxRelevantFiles);
    await Promise.all(
      filesToRead.map(async (sf) => {
        try {
          const raw = await readFile(project.storageKey, sf.path);
          relevantFileContents.push({
            path: sf.path,
            content: raw,
            relevance: sf.score,
          });
        } catch {
          // Skip unreadable files silently
        }
      })
    );
  }

  // 7c. Test files (skeleton compression)
  const testFileContents: { path: string; content: string }[] = [];
  for (const tp of testFilePaths) {
    try {
      const raw = await readFile(project.storageKey, tp);
      testFileContents.push({ path: tp, content: raw });
    } catch {
      // Skip unreadable test files
    }
  }

  // ─── Step 8: Assemble system prompt with priority ordering ───────────────

  // 8a. Project metadata (always included, very cheap)
  const meta = [
    `Project: ${project.name}`,
    project.description ? `Description: ${project.description}` : null,
  ]
    .filter(Boolean)
    .join("\n");
  pushBlock("PROJECT", meta, budgetAllocation.systemPrompt);

  // 8b. Rules (high priority)
  if (rules.length > 0) {
    const rulesText = rules
      .map((r) => {
        const scopeTag =
          r.scope === "FILE" && r.filePattern
            ? `${r.scope}:${r.filePattern}`
            : r.scope;
        return `- [${scopeTag}] ${r.title}\n${r.content}`;
      })
      .join("\n\n");
    pushBlock("RULES", rulesText, budgetAllocation.rules);
  }

  // 8c. Skills (between rules and context files in priority)
  if (skills) {
    pushBlock("SKILLS", skills, budgetAllocation.rules);
  }

  // 8d. Repo map (structural overview)
  if (repoMapContent) {
    pushBlock("REPO MAP", repoMapContent, repoMapBudget);
  }

  // 8e. Selected file contents (high priority — full or skeleton)
  if (selectedFileContents.length > 0) {
    const selectedBudget = Math.min(
      budgetAllocation.contextFiles,
      totalBudget - budgetUsed
    );
    const perFileBudget = Math.floor(
      selectedBudget / selectedFileContents.length
    );

    const fileSections: string[] = [];
    for (let i = 0; i < selectedFileContents.length; i++) {
      const { path: filePath, content } = selectedFileContents[i];
      if (content === "[unavailable]") {
        fileSections.push(`FILE: ${filePath}\n[unavailable]`);
        continue;
      }

      const level = determineCompressionLevel(i, content.length, perFileBudget);
      compressionLevels.push(level);

      if (level === "full") {
        const clipped = clip(content, perFileBudget);
        fileSections.push(`FILE: ${filePath}\n\`\`\`\n${clipped}\n\`\`\``);
      } else {
        const compressed = compressFile(content, filePath, {
          level,
          maxChars: perFileBudget,
        });
        fileSections.push(
          `FILE: ${filePath} [${level}]\n\`\`\`\n${compressed.content}\n\`\`\``
        );
      }
    }
    pushBlock("SELECTED FILES", fileSections.join("\n\n"));
  }

  // 8f. Auto-discovered relevant files (compressed)
  if (
    relevantFileContents.length > 0 &&
    totalBudget - budgetUsed > MIN_BUDGET_FOR_RELEVANT_FILES
  ) {
    const relevantBudget = Math.min(
      Math.floor(budgetAllocation.contextFiles * 0.6),
      totalBudget - budgetUsed
    );

    const compressed = compressFilesForContext(
      relevantFileContents,
      relevantBudget,
      { defaultLevel: "skeleton" }
    );

    if (compressed.length > 0) {
      const sections = compressed.map(({ path: filePath, compressed: c }) => {
        const levelLabel =
          c.compressionRatio >= 0.9
            ? "full"
            : c.compressionRatio >= 0.5
              ? "skeleton"
              : "signatures";
        compressionLevels.push(levelLabel as CompressionLevel);
        return `FILE: ${filePath} [auto-discovered, ${levelLabel}]\n\`\`\`\n${c.content}\n\`\`\``;
      });
      pushBlock("RELEVANT FILES", sections.join("\n\n"));
    }
  }

  // 8g. Test files (if included)
  if (testFileContents.length > 0 && totalBudget - budgetUsed > 1_000) {
    const testBudget = Math.min(
      Math.floor((totalBudget - budgetUsed) * 0.5),
      4_000
    );
    const perTestBudget = Math.floor(testBudget / testFileContents.length);

    const testSections = testFileContents.map(({ path: filePath, content }) => {
      const compressed = compressFile(content, filePath, {
        level: "skeleton",
        maxChars: perTestBudget,
      });
      compressionLevels.push("skeleton");
      return `TEST: ${filePath}\n\`\`\`\n${compressed.content}\n\`\`\``;
    });
    pushBlock("TEST FILES", testSections.join("\n\n"));
  }

  // 8h. Knowledge items (medium priority)
  if (knowledge.length > 0 && totalBudget - budgetUsed > 500) {
    const kText = knowledge
      .map((k) => `- ${k.title} (${k.type})\n${k.content}`)
      .join("\n\n");
    pushBlock("KNOWLEDGE", kText);
  }

  // 8i. Conversation context (if provided)
  if (opts.conversationContext && totalBudget - budgetUsed > 500) {
    pushBlock(
      "CONVERSATION CONTEXT",
      opts.conversationContext,
      budgetAllocation.conversationHistory
    );
  }

  // 8j. File tree (lowest priority — only if budget remains)
  if (fileNodes.length > 0 && totalBudget - budgetUsed > MIN_BUDGET_FOR_TREE) {
    const capped = fileNodes.slice(0, MAX_TREE_PATHS);
    const treeText = capped
      .map((f) => (f.type === "FOLDER" ? `${f.path}/` : f.path))
      .join("\n");
    const suffix =
      fileNodes.length > MAX_TREE_PATHS ? "\n... [more files omitted]" : "";
    pushBlock("FILE TREE", treeText + suffix);
  }

  // ─── Step 9: Assemble final system prompt ────────────────────────────────
  const system =
    TESKEL_PERSONA +
    "\n\n" +
    blocks.map((b) => `## ${b.label}\n${b.content}`).join("\n\n");

  // ─── Step 10: Build result ───────────────────────────────────────────────
  const totalFilesIncluded =
    selectedFileContents.filter((f) => f.content !== "[unavailable]").length +
    relevantFileContents.length +
    testFileContents.length;

  const result: SmartContextResult = {
    system,
    contextBlocks: blocks,
    relevantFiles: scoredFiles.map((sf) => ({
      path: sf.path,
      score: sf.score,
      reason: sf.reason,
    })),
    budget: {
      total: totalBudget,
      used: budgetUsed,
      remaining: totalBudget - budgetUsed,
      breakdown: budgetBreakdown,
    },
    metadata: {
      modelId: opts.modelId,
      filesIncluded: totalFilesIncluded,
      repoMapIncluded: repoMapContent.length > 0,
      compressionLevel: dominantCompressionLevel(compressionLevels),
    },
  };

  return result;
}
