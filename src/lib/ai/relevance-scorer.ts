/**
 * Multi-signal file relevance scoring for AI context selection.
 *
 * Combines semantic similarity, import graph proximity, git co-change frequency,
 * test associations, and directory proximity to rank files by relevance to a
 * given task/query.
 *
 * Phase 1.5 of the quality amplification system.
 */

import { prisma } from "@/lib/db";
import {
  buildImportGraph,
  getRelatedFiles,
  getMostImportedFiles,
  type ImportGraph,
} from "@/lib/search/import-graph";
import {
  findTestFiles,
  isTestFile,
  findSourceFile,
} from "@/lib/search/test-discovery";
import path from "node:path";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Individual signal scores contributing to overall file relevance.
 * Each signal is normalized to the range [0, 1].
 */
export type RelevanceSignal = {
  /** Embedding cosine similarity to query (or keyword overlap fallback) */
  semanticSimilarity: number;
  /** Proximity in import graph (1 = direct import of target) */
  importGraphDistance: number;
  /** Closeness in directory structure to target files */
  directoryProximity: number;
  /** Association with test/source counterpart of relevant files */
  testAssociation: number;
  /** File/function name matches query terms */
  nameRelevance: number;
  /** Recently modified files score higher */
  recency: number;
  /** How many files import this one (normalized centrality) */
  centrality: number;
};

/**
 * A file scored and ranked by relevance to a query.
 */
export type ScoredFile = {
  /** Project-relative file path */
  path: string;
  /** Combined weighted score (0-1) */
  score: number;
  /** Individual signal breakdown */
  signals: RelevanceSignal;
  /** Human-readable explanation of why this file is relevant */
  reason: string;
};

/**
 * Options for the scoring function.
 */
export type ScoringOptions = {
  /** The user's task/question */
  query: string;
  /** Files explicitly mentioned or currently open */
  targetFiles?: string[];
  /** Project database ID */
  projectId: string;
  /** Project storage key for file access */
  storageKey: string;
  /** Maximum number of results to return (default: 15) */
  maxResults?: number;
  /** Custom signal weights (partial override of defaults) */
  weights?: Partial<Record<keyof RelevanceSignal, number>>;
};

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/** Default signal weights — sum to 1.0 */
export const DEFAULT_WEIGHTS: Record<keyof RelevanceSignal, number> = {
  semanticSimilarity: 0.30,
  importGraphDistance: 0.20,
  directoryProximity: 0.15,
  testAssociation: 0.10,
  nameRelevance: 0.15,
  recency: 0.05,
  centrality: 0.05,
};

/** Maximum number of files to scan from the database */
const MAX_FILES_TO_SCAN = 2000;

/** Recency decay: files older than this many days get score 0 */
const RECENCY_DECAY_DAYS = 30;

/** Stop words excluded from query tokenization */
const STOP_WORDS = new Set([
  "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
  "have", "has", "had", "do", "does", "did", "will", "would", "could",
  "should", "may", "might", "shall", "can", "need", "dare", "ought",
  "used", "to", "of", "in", "for", "on", "with", "at", "by", "from",
  "as", "into", "through", "during", "before", "after", "above", "below",
  "between", "out", "off", "over", "under", "again", "further", "then",
  "once", "here", "there", "when", "where", "why", "how", "all", "each",
  "every", "both", "few", "more", "most", "other", "some", "such", "no",
  "nor", "not", "only", "own", "same", "so", "than", "too", "very",
  "just", "because", "but", "and", "or", "if", "while", "about", "this",
  "that", "these", "those", "what", "which", "who", "whom", "it", "its",
  "i", "me", "my", "we", "our", "you", "your", "he", "him", "his",
  "she", "her", "they", "them", "their", "file", "files", "code",
]);

// ─────────────────────────────────────────────────────────────────────────────
// Query tokenization
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Tokenize a query string into meaningful keywords.
 * Splits on non-alphanumeric boundaries, lowercases, removes stop words,
 * and handles camelCase/PascalCase splitting.
 */
function tokenizeQuery(query: string): string[] {
  // Split camelCase/PascalCase into separate tokens
  const expanded = query.replace(/([a-z])([A-Z])/g, "$1 $2");

  const raw = expanded
    .toLowerCase()
    .split(/[^a-z0-9_]+/)
    .filter((t) => t.length > 1 && !STOP_WORDS.has(t));

  // Deduplicate while preserving order
  return [...new Set(raw)];
}

/**
 * Tokenize a file path into meaningful segments.
 * Splits on path separators, dots, dashes, underscores, and camelCase.
 */
function tokenizePath(filePath: string): string[] {
  const expanded = filePath.replace(/([a-z])([A-Z])/g, "$1 $2");
  return expanded
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1 && !STOP_WORDS.has(t));
}

// ─────────────────────────────────────────────────────────────────────────────
// Signal computation helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute semantic similarity using keyword overlap (Jaccard similarity).
 * This is the fallback when no vector store / embeddings are available.
 *
 * @param queryTokens - Tokenized query
 * @param fileContent - File content (or null if unavailable)
 * @param filePath - File path for path-based matching
 * @returns Score in [0, 1]
 */
function computeSemanticSimilarity(
  queryTokens: string[],
  fileContent: string | null,
  filePath: string
): number {
  if (queryTokens.length === 0) return 0;

  // Combine path tokens and content tokens
  const pathTokens = tokenizePath(filePath);

  let contentTokens: string[] = [];
  if (fileContent) {
    // Sample content tokens (first 5000 chars to keep it fast)
    const sample = fileContent.slice(0, 5000);
    contentTokens = sample
      .toLowerCase()
      .split(/[^a-z0-9_]+/)
      .filter((t) => t.length > 2);
  }

  const fileTokenSet = new Set([...pathTokens, ...contentTokens]);

  // Jaccard-like: intersection / query size (weighted toward recall of query terms)
  let matchCount = 0;
  for (const qt of queryTokens) {
    // Check exact match
    if (fileTokenSet.has(qt)) {
      matchCount += 1;
      continue;
    }
    // Check substring match in file tokens (partial matching)
    let partialMatch = false;
    for (const ft of fileTokenSet) {
      if (ft.length >= 4 && qt.length >= 4) {
        if (ft.includes(qt) || qt.includes(ft)) {
          partialMatch = true;
          break;
        }
      }
    }
    if (partialMatch) {
      matchCount += 0.5;
    }
  }

  return Math.min(1, matchCount / queryTokens.length);
}

/**
 * Compute import graph distance score for a file relative to target files.
 *
 * @param filePath - The file to score
 * @param targetFiles - Files the user is focused on
 * @param graph - The project's import graph
 * @returns Score in [0, 1]
 */
function computeImportGraphDistance(
  filePath: string,
  targetFiles: string[],
  graph: ImportGraph
): number {
  if (targetFiles.length === 0) return 0;

  let bestScore = 0;

  for (const target of targetFiles) {
    // Check if filePath is directly imported by or imports the target
    const directImports = graph.imports.get(target) ?? [];
    if (directImports.includes(filePath)) {
      return 1.0; // Direct dependency
    }

    const directImporters = graph.importedBy.get(target) ?? [];
    if (directImporters.includes(filePath)) {
      return 1.0; // Direct dependent
    }

    // BFS to find distance
    const related = getRelatedFiles(graph, target, 3);
    for (const rel of related) {
      if (rel.file === filePath) {
        const score = rel.depth === 1 ? 1.0 : rel.depth === 2 ? 0.5 : 0.25;
        bestScore = Math.max(bestScore, score);
        break;
      }
    }
  }

  return bestScore;
}

/**
 * Compute directory proximity score between a file and target files.
 *
 * @param filePath - The file to score
 * @param targetFiles - Files the user is focused on
 * @returns Score in [0, 1]
 */
function computeDirectoryProximity(
  filePath: string,
  targetFiles: string[]
): number {
  if (targetFiles.length === 0) return 0;

  let bestScore = 0;

  const fileDir = path.posix.dirname(filePath);
  const fileParts = filePath.split("/");

  for (const target of targetFiles) {
    if (target === filePath) continue;

    const targetDir = path.posix.dirname(target);
    const targetParts = target.split("/");

    // Same directory
    if (fileDir === targetDir) {
      bestScore = Math.max(bestScore, 1.0);
      continue;
    }

    // Parent/child relationship
    if (fileDir.startsWith(targetDir + "/") || targetDir.startsWith(fileDir + "/")) {
      const depthDiff = Math.abs(
        fileDir.split("/").length - targetDir.split("/").length
      );
      if (depthDiff === 1) {
        bestScore = Math.max(bestScore, 0.7);
      } else {
        bestScore = Math.max(bestScore, 0.5);
      }
      continue;
    }

    // Sibling directories (same parent)
    const fileParent = path.posix.dirname(fileDir);
    const targetParent = path.posix.dirname(targetDir);
    if (fileParent === targetParent) {
      bestScore = Math.max(bestScore, 0.5);
      continue;
    }

    // Same top-level module (share first path segment after root)
    if (
      fileParts.length > 1 &&
      targetParts.length > 1 &&
      fileParts[0] === targetParts[0]
    ) {
      // Share at least the first directory
      if (fileParts.length > 2 && targetParts.length > 2 && fileParts[1] === targetParts[1]) {
        bestScore = Math.max(bestScore, 0.4);
      } else {
        bestScore = Math.max(bestScore, 0.3);
      }
      continue;
    }
  }

  return bestScore;
}

/**
 * Compute test association score.
 *
 * @param filePath - The file to score
 * @param targetFiles - Files the user is focused on
 * @param allFiles - All project file paths
 * @returns Score in [0, 1]
 */
function computeTestAssociation(
  filePath: string,
  targetFiles: string[],
  allFiles: string[]
): number {
  if (targetFiles.length === 0) return 0;

  for (const target of targetFiles) {
    // If target is a source file, check if filePath is its test
    if (!isTestFile(target)) {
      const association = findTestFiles(target, allFiles);
      if (association.testFiles.includes(filePath)) {
        return 1.0;
      }
    }

    // If target is a test file, check if filePath is its source
    if (isTestFile(target)) {
      const sourceResult = findSourceFile(target, allFiles);
      if (sourceResult && sourceResult.sourcePath === filePath) {
        return 0.8;
      }
    }

    // If filePath is a test file, check if it tests any target
    if (isTestFile(filePath)) {
      const sourceResult = findSourceFile(filePath, allFiles);
      if (sourceResult && targetFiles.includes(sourceResult.sourcePath)) {
        return 1.0;
      }
    }

    // If filePath is a source file, check if any target is its test
    if (!isTestFile(filePath)) {
      const association = findTestFiles(filePath, allFiles);
      if (association.testFiles.some((t) => targetFiles.includes(t))) {
        return 0.8;
      }
    }
  }

  return 0;
}

/**
 * Compute name relevance score based on query token matches in file path.
 *
 * @param filePath - The file path to score
 * @param queryTokens - Tokenized query
 * @returns Score in [0, 1]
 */
function computeNameRelevance(filePath: string, queryTokens: string[]): number {
  if (queryTokens.length === 0) return 0;

  const pathTokens = tokenizePath(filePath);
  const pathStr = filePath.toLowerCase();

  let matchCount = 0;

  for (const qt of queryTokens) {
    // Exact token match in path segments
    if (pathTokens.includes(qt)) {
      matchCount += 1;
      continue;
    }

    // Substring match in the full path string
    if (pathStr.includes(qt)) {
      matchCount += 0.7;
      continue;
    }

    // Partial token overlap (e.g., "relevance" matches "relevant")
    for (const pt of pathTokens) {
      if (pt.length >= 4 && qt.length >= 4) {
        // Check if they share a common prefix of at least 4 chars
        const minLen = Math.min(pt.length, qt.length);
        let shared = 0;
        for (let i = 0; i < minLen; i++) {
          if (pt[i] === qt[i]) shared++;
          else break;
        }
        if (shared >= 4) {
          matchCount += 0.4;
          break;
        }
      }
    }
  }

  return Math.min(1, matchCount / queryTokens.length);
}

/**
 * Compute recency score based on file modification time.
 * Score decays linearly from 1.0 (modified today) to 0.0 (30+ days ago).
 *
 * @param updatedAt - File's last modification timestamp
 * @returns Score in [0, 1]
 */
function computeRecency(updatedAt: Date): number {
  const now = Date.now();
  const fileTime = updatedAt.getTime();
  const ageMs = now - fileTime;
  const ageDays = ageMs / (1000 * 60 * 60 * 24);

  if (ageDays <= 0) return 1.0;
  if (ageDays >= RECENCY_DECAY_DAYS) return 0.0;

  return 1.0 - ageDays / RECENCY_DECAY_DAYS;
}

/**
 * Compute centrality score for a file based on how many other files import it.
 *
 * @param filePath - The file to score
 * @param graph - The import graph
 * @param maxImportCount - The highest import count in the project (for normalization)
 * @returns Score in [0, 1]
 */
function computeCentrality(
  filePath: string,
  graph: ImportGraph,
  maxImportCount: number
): number {
  if (maxImportCount === 0) return 0;

  const importers = graph.importedBy.get(filePath) ?? [];
  return Math.min(1, importers.length / maxImportCount);
}

// ─────────────────────────────────────────────────────────────────────────────
// Reason generation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate a human-readable explanation of why a file scored highly.
 * Highlights the top contributing signals.
 */
function generateReason(signals: RelevanceSignal, weights: Record<keyof RelevanceSignal, number>): string {
  // Compute weighted contribution of each signal
  const contributions: { signal: keyof RelevanceSignal; contribution: number; raw: number }[] = [];

  for (const [key, value] of Object.entries(signals) as [keyof RelevanceSignal, number][]) {
    const weight = weights[key];
    contributions.push({ signal: key, contribution: value * weight, raw: value });
  }

  // Sort by contribution descending
  contributions.sort((a, b) => b.contribution - a.contribution);

  // Take top signals that actually contributed
  const topSignals = contributions.filter((c) => c.raw > 0.1).slice(0, 3);

  if (topSignals.length === 0) {
    return "Low relevance across all signals";
  }

  const descriptions: Record<keyof RelevanceSignal, (raw: number) => string> = {
    semanticSimilarity: (v) =>
      v >= 0.7 ? "High semantic match" : "Moderate semantic match",
    importGraphDistance: (v) =>
      v >= 1.0
        ? "Direct import of target file"
        : v >= 0.5
          ? "Close in import graph (2 hops)"
          : "Connected in import graph",
    directoryProximity: (v) =>
      v >= 1.0
        ? "Same directory as target"
        : v >= 0.7
          ? "Adjacent directory"
          : "Nearby in project structure",
    testAssociation: (v) =>
      v >= 1.0
        ? "Test file for relevant source"
        : "Source file for relevant test",
    nameRelevance: (v) =>
      v >= 0.8
        ? "Strong name match with query"
        : "Name partially matches query",
    recency: (v) =>
      v >= 0.8 ? "Recently modified" : "Modified within last few weeks",
    centrality: (v) =>
      v >= 0.7
        ? "Highly imported core module"
        : "Moderately imported module",
  };

  const parts = topSignals.map((s) => descriptions[s.signal](s.raw));
  return parts.join(", ");
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Score and rank all project files by relevance to a query.
 *
 * Combines multiple signals (semantic similarity, import graph proximity,
 * directory proximity, test associations, name relevance, recency, and
 * centrality) into a single weighted score per file.
 *
 * @param options - Scoring configuration
 * @returns Array of scored files, sorted by relevance (descending)
 */
export async function scoreFileRelevance(options: ScoringOptions): Promise<ScoredFile[]> {
  const {
    query,
    targetFiles = [],
    projectId,
    storageKey,
    maxResults = 15,
    weights: customWeights,
  } = options;

  // Merge custom weights with defaults
  const weights: Record<keyof RelevanceSignal, number> = {
    ...DEFAULT_WEIGHTS,
    ...customWeights,
  };

  // Normalize weights to sum to 1.0
  const weightSum = Object.values(weights).reduce((sum, w) => sum + w, 0);
  if (weightSum > 0 && Math.abs(weightSum - 1.0) > 0.001) {
    for (const key of Object.keys(weights) as (keyof RelevanceSignal)[]) {
      weights[key] = weights[key] / weightSum;
    }
  }

  // Tokenize query
  const queryTokens = tokenizeQuery(query);

  // Fetch all file nodes with metadata
  const fileNodes = await prisma.fileNode.findMany({
    where: { projectId, type: "FILE" },
    select: { path: true, content: true, updatedAt: true },
    orderBy: { updatedAt: "desc" },
    take: MAX_FILES_TO_SCAN,
  });

  if (fileNodes.length === 0) {
    return [];
  }

  const allFilePaths = fileNodes.map((n) => n.path);

  // Build import graph (cached internally)
  const graph = await buildImportGraph(projectId, storageKey);

  // Compute max import count for centrality normalization
  const mostImported = getMostImportedFiles(graph, 1);
  const maxImportCount = mostImported.length > 0 ? mostImported[0].importCount : 1;

  // Score each file
  const scoredFiles: ScoredFile[] = [];

  for (const node of fileNodes) {
    // Skip target files themselves (they're already in context)
    if (targetFiles.includes(node.path)) continue;

    const signals: RelevanceSignal = {
      semanticSimilarity: computeSemanticSimilarity(
        queryTokens,
        node.content,
        node.path
      ),
      importGraphDistance: computeImportGraphDistance(
        node.path,
        targetFiles,
        graph
      ),
      directoryProximity: computeDirectoryProximity(node.path, targetFiles),
      testAssociation: computeTestAssociation(
        node.path,
        targetFiles,
        allFilePaths
      ),
      nameRelevance: computeNameRelevance(node.path, queryTokens),
      recency: computeRecency(node.updatedAt),
      centrality: computeCentrality(node.path, graph, maxImportCount),
    };

    // Compute weighted score
    let score = 0;
    for (const [key, value] of Object.entries(signals) as [keyof RelevanceSignal, number][]) {
      score += value * weights[key];
    }

    // Clamp to [0, 1]
    score = Math.max(0, Math.min(1, score));

    const reason = generateReason(signals, weights);

    scoredFiles.push({
      path: node.path,
      score,
      signals,
      reason,
    });
  }

  // Sort by score descending
  scoredFiles.sort((a, b) => b.score - a.score);

  // Return top N results
  return scoredFiles.slice(0, maxResults);
}

/**
 * Quick relevance check — fast heuristic using only path matching and
 * directory proximity. No async operations, no embeddings, no database calls.
 *
 * Useful for pre-filtering before expensive scoring operations.
 *
 * @param filePath - The file path to check
 * @param query - The user's query
 * @param targetFiles - Files explicitly mentioned or currently open
 * @returns Quick relevance score in [0, 1]
 */
export function quickRelevanceCheck(
  filePath: string,
  query: string,
  targetFiles?: string[]
): number {
  const queryTokens = tokenizeQuery(query);

  // Signal 1: Name relevance (weight 0.6 for quick check)
  const nameScore = computeNameRelevance(filePath, queryTokens);

  // Signal 2: Directory proximity (weight 0.4 for quick check)
  const dirScore = targetFiles
    ? computeDirectoryProximity(filePath, targetFiles)
    : 0;

  return nameScore * 0.6 + dirScore * 0.4;
}
