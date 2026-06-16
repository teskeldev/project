/**
 * Hybrid search combining BM25 keyword search + semantic vector search.
 * Uses Reciprocal Rank Fusion (RRF) to merge ranked results.
 *
 * Phase 1.3 — Quality Amplification: Hybrid Search Module
 */

import { runSearch, type SearchMatch } from "@/lib/search/engine";
import { vectorStore } from "@/lib/search/vector-store";
import { readFile } from "@/lib/storage";

/* ================================ Types ================================== */

export type HybridSearchResult = {
  filePath: string;
  content: string;
  startLine: number;
  endLine: number;
  score: number;
  scores: {
    bm25?: number;
    semantic?: number;
    keyword?: number;
  };
  matchType: "keyword" | "semantic" | "both";
};

export type HybridSearchOptions = {
  /** Total results to return (default 10) */
  topK?: number;
  /** Weight for semantic results in RRF (default 0.6) */
  semanticWeight?: number;
  /** Weight for keyword results in RRF (default 0.4) */
  keywordWeight?: number;
  /** Minimum score threshold (default 0.01) */
  minScore?: number;
  /** Include full chunk content (default true) */
  includeContent?: boolean;
  /** Only search these files */
  fileFilter?: string[];
  /** Exclude files matching these patterns */
  excludePatterns?: string[];
};

/* ============================== Constants ================================ */

const DEFAULT_TOP_K = 10;
const DEFAULT_SEMANTIC_WEIGHT = 0.6;
const DEFAULT_KEYWORD_WEIGHT = 0.4;
const DEFAULT_MIN_SCORE = 0.01;
const DEFAULT_RRF_K = 60;
const DEFAULT_BM25_K1 = 1.5;
const DEFAULT_BM25_B = 0.75;

/** Max lines of context around a keyword match to include as a chunk. */
const CONTEXT_LINES = 5;

/* ============================= Tokenizer ================================= */

/**
 * Tokenize text for BM25 scoring. Handles code-specific patterns:
 * - camelCase splitting (getUserById → get, user, by, id)
 * - snake_case splitting (get_user_by_id → get, user, by, id)
 * - Whitespace and punctuation splitting
 * - Lowercasing
 *
 * @param text - The text to tokenize
 * @returns Array of lowercase tokens
 */
export function tokenize(text: string): string[] {
  if (!text) return [];

  // Step 1: Split camelCase boundaries (insert space before uppercase letters
  // that follow lowercase letters or before uppercase followed by lowercase)
  let expanded = text
    // camelCase: aB → a B
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    // ABCDef → ABC Def (acronym followed by word)
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2");

  // Step 2: Replace underscores, hyphens, dots, slashes, and other separators with spaces
  expanded = expanded.replace(/[_\-./\\:@#$%^&*()+=\[\]{}<>|~`"';,!?]/g, " ");

  // Step 3: Split on whitespace, filter empty, lowercase
  const tokens = expanded
    .split(/\s+/)
    .filter((t) => t.length > 0)
    .map((t) => t.toLowerCase());

  return tokens;
}

/* ============================== BM25 ===================================== */

/**
 * Compute BM25 scores for a set of documents against a query.
 *
 * BM25 formula:
 *   score = Σ IDF(qi) * (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * dl/avgdl))
 *
 * Where:
 *   - tf = term frequency of query term in document
 *   - dl = document length (in tokens)
 *   - avgdl = average document length across corpus
 *   - IDF(qi) = log((N - n(qi) + 0.5) / (n(qi) + 0.5) + 1)
 *   - N = total number of documents
 *   - n(qi) = number of documents containing term qi
 *
 * @param query - The search query string
 * @param documents - Array of documents with id and content
 * @param options - BM25 parameters (k1, b)
 * @returns Sorted array of document scores (descending)
 */
export function bm25Score(
  query: string,
  documents: { id: string; content: string }[],
  options?: { k1?: number; b?: number }
): { id: string; score: number }[] {
  const k1 = options?.k1 ?? DEFAULT_BM25_K1;
  const b = options?.b ?? DEFAULT_BM25_B;

  if (documents.length === 0) return [];

  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return [];

  // Tokenize all documents
  const docTokens: string[][] = documents.map((d) => tokenize(d.content));
  const docLengths: number[] = docTokens.map((t) => t.length);
  const N = documents.length;

  // Average document length
  const avgdl =
    docLengths.reduce((sum, len) => sum + len, 0) / N || 1;

  // Build term frequency maps per document
  const docTfMaps: Map<string, number>[] = docTokens.map((tokens) => {
    const tf = new Map<string, number>();
    for (const token of tokens) {
      tf.set(token, (tf.get(token) ?? 0) + 1);
    }
    return tf;
  });

  // Compute document frequency for each query term
  const df = new Map<string, number>();
  for (const qt of queryTokens) {
    if (df.has(qt)) continue;
    let count = 0;
    for (const tfMap of docTfMaps) {
      if (tfMap.has(qt)) count++;
    }
    df.set(qt, count);
  }

  // Score each document
  const results: { id: string; score: number }[] = [];

  for (let i = 0; i < N; i++) {
    let score = 0;
    const dl = docLengths[i];
    const tfMap = docTfMaps[i];

    for (const qt of queryTokens) {
      const tf = tfMap.get(qt) ?? 0;
      if (tf === 0) continue;

      const n = df.get(qt) ?? 0;
      // IDF with smoothing (BM25 variant that avoids negative IDF)
      const idf = Math.log((N - n + 0.5) / (n + 0.5) + 1);

      // BM25 term score
      const numerator = tf * (k1 + 1);
      const denominator = tf + k1 * (1 - b + b * (dl / avgdl));
      score += idf * (numerator / denominator);
    }

    if (score > 0) {
      results.push({ id: documents[i].id, score });
    }
  }

  // Sort descending by score
  results.sort((a, b) => b.score - a.score);
  return results;
}

/* ======================== Reciprocal Rank Fusion ========================= */

/**
 * Merge multiple ranked result lists using Reciprocal Rank Fusion.
 *
 * For each item in each ranked list:
 *   rrf_score = weight / (k + rank)
 *
 * Scores are summed across all lists for each unique item, then sorted
 * descending by combined score.
 *
 * @param rankedLists - Array of ranked lists, each containing {id, score} pairs
 *                      (assumed sorted descending by score within each list)
 * @param weights - Optional weight for each list (default: equal weights of 1.0)
 * @param k - RRF constant (default 60). Higher k reduces the impact of high ranks.
 * @returns Merged and sorted results
 */
export function reciprocalRankFusion(
  rankedLists: { id: string; score: number }[][],
  weights?: number[],
  k?: number
): { id: string; score: number }[] {
  const rrfK = k ?? DEFAULT_RRF_K;
  const listWeights = weights ?? rankedLists.map(() => 1.0);

  if (rankedLists.length === 0) return [];

  const combined = new Map<string, number>();

  for (let listIdx = 0; listIdx < rankedLists.length; listIdx++) {
    const list = rankedLists[listIdx];
    const weight = listWeights[listIdx] ?? 1.0;

    for (let rank = 0; rank < list.length; rank++) {
      const item = list[rank];
      // rank is 0-based, RRF uses 1-based rank
      const rrfScore = weight / (rrfK + rank + 1);
      combined.set(item.id, (combined.get(item.id) ?? 0) + rrfScore);
    }
  }

  const results: { id: string; score: number }[] = [];
  for (const [id, score] of combined) {
    results.push({ id, score });
  }

  results.sort((a, b) => b.score - a.score);
  return results;
}

/* ========================== Hybrid Search ================================ */

/**
 * Perform hybrid search combining keyword (BM25) + semantic (vector) search.
 *
 * Flow:
 *  1. Run keyword search (existing engine) → get file:line matches
 *  2. Run BM25 on the matched file contents → re-rank keyword results
 *  3. Run semantic search (vector store) → get chunk matches
 *  4. Merge using RRF with configurable weights
 *  5. Deduplicate (same file + overlapping line ranges)
 *  6. Return top-K results
 *
 * @param projectId - The project identifier
 * @param storageKey - The storage key for file access
 * @param query - The search query string
 * @param options - Search configuration options
 * @returns Array of hybrid search results sorted by combined score
 */
export async function hybridSearch(
  projectId: string,
  storageKey: string,
  query: string,
  options?: HybridSearchOptions
): Promise<HybridSearchResult[]> {
  const topK = options?.topK ?? DEFAULT_TOP_K;
  const semanticWeight = options?.semanticWeight ?? DEFAULT_SEMANTIC_WEIGHT;
  const keywordWeight = options?.keywordWeight ?? DEFAULT_KEYWORD_WEIGHT;
  const minScore = options?.minScore ?? DEFAULT_MIN_SCORE;
  const includeContent = options?.includeContent ?? true;
  const fileFilter = options?.fileFilter;
  const excludePatterns = options?.excludePatterns;

  // Run keyword and semantic searches in parallel
  const [keywordResults, semanticResults] = await Promise.all([
    runKeywordSearch(projectId, storageKey, query, fileFilter, excludePatterns),
    runSemanticSearch(projectId, query, fileFilter, excludePatterns),
  ]);

  // Build intermediate result maps keyed by "filePath:startLine-endLine"
  const keywordItems = await buildKeywordItems(
    keywordResults,
    storageKey,
    query,
    includeContent
  );
  const semanticItems = buildSemanticItems(semanticResults, includeContent);

  // Create ranked lists for RRF
  const keywordRanked = keywordItems.map((item) => ({
    id: item.key,
    score: item.bm25Score,
  }));
  const semanticRanked = semanticItems.map((item) => ({
    id: item.key,
    score: item.semanticScore,
  }));

  // Apply RRF
  const fused = reciprocalRankFusion(
    [keywordRanked, semanticRanked],
    [keywordWeight, semanticWeight]
  );

  // Build a lookup of all intermediate items
  const itemLookup = new Map<string, IntermediateResult>();
  for (const item of keywordItems) {
    itemLookup.set(item.key, item);
  }
  for (const item of semanticItems) {
    const existing = itemLookup.get(item.key);
    if (existing) {
      // Merge: both keyword and semantic matched this region
      existing.semanticScore = item.semanticScore;
      existing.content = existing.content || item.content;
      existing.matchType = "both";
    } else {
      itemLookup.set(item.key, item);
    }
  }

  // Convert fused results to HybridSearchResult
  const results: HybridSearchResult[] = [];
  for (const fItem of fused) {
    if (fItem.score < minScore) break;

    const item = itemLookup.get(fItem.id);
    if (!item) continue;

    results.push({
      filePath: item.filePath,
      content: item.content,
      startLine: item.startLine,
      endLine: item.endLine,
      score: fItem.score,
      scores: {
        bm25: item.bm25Score > 0 ? item.bm25Score : undefined,
        semantic: item.semanticScore > 0 ? item.semanticScore : undefined,
        keyword: item.keywordScore > 0 ? item.keywordScore : undefined,
      },
      matchType: item.matchType,
    });
  }

  // Deduplicate overlapping results
  const deduped = deduplicateResults(results);

  return deduped.slice(0, topK);
}

/* ========================= Internal Types ================================ */

type IntermediateResult = {
  key: string;
  filePath: string;
  content: string;
  startLine: number;
  endLine: number;
  bm25Score: number;
  semanticScore: number;
  keywordScore: number;
  matchType: "keyword" | "semantic" | "both";
};

type SemanticChunk = {
  filePath: string;
  content: string;
  startLine: number;
  endLine: number;
  score: number;
};

/* ========================= Internal Helpers ============================== */

/**
 * Run the existing keyword search engine and return matches.
 */
async function runKeywordSearch(
  projectId: string,
  storageKey: string,
  query: string,
  fileFilter?: string[],
  excludePatterns?: string[]
): Promise<SearchMatch[]> {
  try {
    const response = await runSearch(projectId, storageKey, {
      q: query,
      type: "code",
      caseSensitive: false,
      regex: false,
      maxResults: 100,
    });

    let results = response.results;

    // Apply file filter
    if (fileFilter && fileFilter.length > 0) {
      const filterSet = new Set(fileFilter);
      results = results.filter((r) => filterSet.has(r.file));
    }

    // Apply exclude patterns
    if (excludePatterns && excludePatterns.length > 0) {
      results = results.filter(
        (r) => !excludePatterns.some((pattern) => matchesPattern(r.file, pattern))
      );
    }

    return results;
  } catch {
    // If keyword search fails, return empty (semantic may still work)
    return [];
  }
}

/**
 * Run semantic/vector search and return chunk matches.
 */
async function runSemanticSearch(
  projectId: string,
  query: string,
  fileFilter?: string[],
  excludePatterns?: string[]
): Promise<SemanticChunk[]> {
  try {
    const results = await vectorStore.search(projectId, query, 50);

    // Filter by file paths if specified
    const filtered = fileFilter && fileFilter.length > 0
      ? results.filter((r) => fileFilter.some((f) => r.chunk.filePath.includes(f)))
      : results;

    let chunks: SemanticChunk[] = filtered.map((r) => ({
      filePath: r.chunk.filePath,
      content: r.chunk.content,
      startLine: r.chunk.startLine,
      endLine: r.chunk.endLine,
      score: r.score,
    }));













    // Apply exclude patterns
    if (excludePatterns && excludePatterns.length > 0) {
      chunks = chunks.filter(
        (c) =>
          !excludePatterns.some((pattern) => matchesPattern(c.filePath, pattern))
      );
    }

    return chunks;
  } catch {
    // If vector search fails (e.g., not indexed yet), return empty
    return [];
  }
}

/**
 * Build intermediate results from keyword matches, applying BM25 re-ranking.
 * Groups matches by file, reads file content, and scores chunks with BM25.
 */
async function buildKeywordItems(
  matches: SearchMatch[],
  storageKey: string,
  query: string,
  includeContent: boolean
): Promise<IntermediateResult[]> {
  if (matches.length === 0) return [];

  // Group matches by file
  const byFile = new Map<string, SearchMatch[]>();
  for (const match of matches) {
    const existing = byFile.get(match.file);
    if (existing) {
      existing.push(match);
    } else {
      byFile.set(match.file, [match]);
    }
  }

  // Read file contents and build chunks for BM25
  const chunks: { key: string; item: Omit<IntermediateResult, "bm25Score"> }[] =
    [];
  const bm25Docs: { id: string; content: string }[] = [];

  for (const [filePath, fileMatches] of byFile) {
    let fileContent: string | null = null;

    if (includeContent) {
      try {
        fileContent = await readFile(storageKey, filePath);
      } catch {
        // File may have been deleted; skip
        continue;
      }
    }

    const lines = fileContent?.split("\n") ?? [];

    // Merge nearby matches into chunks
    const mergedRanges = mergeLineRanges(
      fileMatches.map((m) => m.line),
      CONTEXT_LINES,
      lines.length
    );

    for (const range of mergedRanges) {
      const chunkContent = includeContent
        ? lines.slice(range.start - 1, range.end).join("\n")
        : "";
      const key = `${filePath}:${range.start}-${range.end}`;

      // Compute a basic keyword relevance score from match density
      const matchesInRange = fileMatches.filter(
        (m) => m.line >= range.start && m.line <= range.end
      ).length;
      const keywordScore = matchesInRange / (range.end - range.start + 1);

      chunks.push({
        key,
        item: {
          key,
          filePath,
          content: chunkContent,
          startLine: range.start,
          endLine: range.end,
          semanticScore: 0,
          keywordScore,
          matchType: "keyword",
        },
      });

      bm25Docs.push({ id: key, content: chunkContent });
    }
  }

  // Apply BM25 scoring to the chunks
  const bm25Results = bm25Score(query, bm25Docs);
  const bm25Map = new Map(bm25Results.map((r) => [r.id, r.score]));

  // Build final items with BM25 scores
  const items: IntermediateResult[] = chunks.map(({ key, item }) => ({
    ...item,
    bm25Score: bm25Map.get(key) ?? 0,
  }));

  // Sort by BM25 score descending
  items.sort((a, b) => b.bm25Score - a.bm25Score);
  return items;
}

/**
 * Build intermediate results from semantic search chunks.
 */
function buildSemanticItems(
  chunks: SemanticChunk[],
  includeContent: boolean
): IntermediateResult[] {
  return chunks.map((chunk) => {
    const key = `${chunk.filePath}:${chunk.startLine}-${chunk.endLine}`;
    return {
      key,
      filePath: chunk.filePath,
      content: includeContent ? chunk.content : "",
      startLine: chunk.startLine,
      endLine: chunk.endLine,
      bm25Score: 0,
      semanticScore: chunk.score,
      keywordScore: 0,
      matchType: "semantic" as const,
    };
  });
}

/**
 * Merge nearby line numbers into ranges with context padding.
 *
 * @param lines - Array of 1-based line numbers where matches occurred
 * @param contextLines - Number of context lines to add above/below each match
 * @param totalLines - Total number of lines in the file
 * @returns Array of merged {start, end} ranges (1-based, inclusive)
 */
function mergeLineRanges(
  lines: number[],
  contextLines: number,
  totalLines: number
): { start: number; end: number }[] {
  if (lines.length === 0) return [];

  const sorted = [...lines].sort((a, b) => a - b);
  const ranges: { start: number; end: number }[] = [];

  let currentStart = Math.max(1, sorted[0] - contextLines);
  let currentEnd = Math.min(totalLines, sorted[0] + contextLines);

  for (let i = 1; i < sorted.length; i++) {
    const rangeStart = Math.max(1, sorted[i] - contextLines);
    const rangeEnd = Math.min(totalLines, sorted[i] + contextLines);

    if (rangeStart <= currentEnd + 1) {
      // Overlapping or adjacent — merge
      currentEnd = Math.max(currentEnd, rangeEnd);
    } else {
      // Gap — push current and start new
      ranges.push({ start: currentStart, end: currentEnd });
      currentStart = rangeStart;
      currentEnd = rangeEnd;
    }
  }

  ranges.push({ start: currentStart, end: currentEnd });
  return ranges;
}

/**
 * Deduplicate results that refer to the same file with overlapping line ranges.
 * Keeps the higher-scored result and merges score information when both
 * keyword and semantic matched the same region.
 */
function deduplicateResults(
  results: HybridSearchResult[]
): HybridSearchResult[] {
  if (results.length <= 1) return results;

  const deduped: HybridSearchResult[] = [];

  for (const result of results) {
    let merged = false;

    for (let i = 0; i < deduped.length; i++) {
      const existing = deduped[i];

      if (
        existing.filePath === result.filePath &&
        rangesOverlap(
          existing.startLine,
          existing.endLine,
          result.startLine,
          result.endLine
        )
      ) {
        // Merge: keep the higher-scored one, combine score info
        if (result.score > existing.score) {
          deduped[i] = {
            ...result,
            scores: {
              bm25: result.scores.bm25 ?? existing.scores.bm25,
              semantic: result.scores.semantic ?? existing.scores.semantic,
              keyword: result.scores.keyword ?? existing.scores.keyword,
            },
            matchType:
              (result.scores.bm25 || result.scores.keyword) &&
              (result.scores.semantic || existing.scores.semantic)
                ? "both"
                : result.matchType,
          };
        } else {
          deduped[i] = {
            ...existing,
            scores: {
              bm25: existing.scores.bm25 ?? result.scores.bm25,
              semantic: existing.scores.semantic ?? result.scores.semantic,
              keyword: existing.scores.keyword ?? result.scores.keyword,
            },
            matchType:
              (existing.scores.bm25 || existing.scores.keyword) &&
              (existing.scores.semantic || result.scores.semantic)
                ? "both"
                : existing.matchType,
          };
        }
        merged = true;
        break;
      }
    }

    if (!merged) {
      deduped.push(result);
    }
  }

  return deduped;
}

/**
 * Check if two line ranges overlap (1-based, inclusive).
 */
function rangesOverlap(
  startA: number,
  endA: number,
  startB: number,
  endB: number
): boolean {
  return startA <= endB && startB <= endA;
}

/**
 * Simple glob-like pattern matching for file paths.
 * Supports * (any chars except /) and ** (any chars including /).
 */
function matchesPattern(filePath: string, pattern: string): boolean {
  // Escape regex special chars except * and ?
  let regexStr = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    // ** matches anything including path separators
    .replace(/\*\*/g, "§DOUBLESTAR§")
    // * matches anything except path separators
    .replace(/\*/g, "[^/]*")
    .replace(/§DOUBLESTAR§/g, ".*")
    // ? matches single char
    .replace(/\?/g, ".");

  // Anchor the pattern
  regexStr = `^${regexStr}$`;

  try {
    return new RegExp(regexStr).test(filePath);
  } catch {
    return false;
  }
}
