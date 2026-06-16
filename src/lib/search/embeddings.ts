/**
 * Embedding generation and management for semantic code search.
 *
 * Uses OpenAI-compatible embedding APIs (text-embedding-3-small by default).
 * Chunks source files into semantic units (functions, classes, blocks) for
 * fine-grained retrieval. Works with any OpenAI-compatible endpoint.
 *
 * @module search/embeddings
 */

/* ─────────────────────────────── Types ─────────────────────────────── */

export type EmbeddingChunk = {
  /** Unique chunk identifier (projectId:filePath:startLine) */
  id: string;
  /** Source file path (project-relative) */
  filePath: string;
  /** Chunk text content */
  content: string;
  /** Start line in file (1-based) */
  startLine: number;
  /** End line in file (1-based) */
  endLine: number;
  /** Semantic type of the chunk */
  type: "function" | "class" | "interface" | "type" | "block" | "file_summary";
  /** Function/class/interface name if applicable */
  name?: string;
  /** The embedding vector (1536 dimensions for text-embedding-3-small) */
  embedding?: number[];
};

export type ChunkOptions = {
  /** Max characters per chunk (default 1500) */
  maxChunkSize?: number;
  /** Overlap between sliding-window chunks in characters (default 200) */
  overlapSize?: number;
  /** Language hint (auto-detected from extension if omitted) */
  language?: string;
};

export type EmbeddingApiOptions = {
  /** Model name (default: text-embedding-3-small) */
  model?: string;
  /** OpenAI API key (falls back to OPENAI_API_KEY env) */
  apiKey?: string;
  /** Base URL for the embeddings API (falls back to OPENAI_BASE_URL env) */
  baseUrl?: string;
};

/* ─────────────────────────── Constants ─────────────────────────────── */

const DEFAULT_MAX_CHUNK_SIZE = 1500;
const DEFAULT_OVERLAP_SIZE = 200;
const DEFAULT_MODEL = "text-embedding-3-small";
const DEFAULT_BASE_URL = "https://api.openai.com/v1";
const MAX_BATCH_SIZE = 100;
const MAX_RETRIES = 5;
const INITIAL_BACKOFF_MS = 1000;

/** Context lines to include before/after each chunk boundary */
const CONTEXT_LINES = 2;

/* ─────────────────────── Language Detection ────────────────────────── */

const EXTENSION_TO_LANGUAGE: Record<string, string> = {
  ts: "typescript",
  tsx: "typescript",
  mts: "typescript",
  cts: "typescript",
  js: "javascript",
  jsx: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  py: "python",
  rb: "ruby",
  rs: "rust",
  go: "go",
  java: "java",
  kt: "kotlin",
  c: "c",
  cpp: "cpp",
  cc: "cpp",
  h: "c",
  hpp: "cpp",
  cs: "csharp",
  php: "php",
  swift: "swift",
  dart: "dart",
};

/**
 * Detect language from file extension.
 */
function detectLanguage(filePath: string): string | null {
  const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
  return EXTENSION_TO_LANGUAGE[ext] ?? null;
}

/* ─────────────────────── Chunking: TS/JS ───────────────────────────── */

/**
 * Regex patterns for TypeScript/JavaScript semantic boundaries.
 * Matches function declarations, arrow functions, class declarations,
 * interface declarations, type aliases, and enum declarations.
 */
const TS_PATTERNS = {
  function:
    /^(?:export\s+)?(?:async\s+)?function\s+(\w+)/,
  arrowConst:
    /^(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\(/,
  arrowConstFn:
    /^(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[^=])*=>/,
  class:
    /^(?:export\s+)?(?:abstract\s+)?class\s+(\w+)/,
  interface:
    /^(?:export\s+)?interface\s+(\w+)/,
  type:
    /^(?:export\s+)?type\s+(\w+)/,
  enum:
    /^(?:export\s+)?(?:const\s+)?enum\s+(\w+)/,
};

type BoundaryMatch = {
  line: number;
  type: EmbeddingChunk["type"];
  name: string;
};

/**
 * Find semantic boundaries in TypeScript/JavaScript source.
 */
function findTsBoundaries(lines: string[]): BoundaryMatch[] {
  const boundaries: BoundaryMatch[] = [];

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trimStart();

    let match: RegExpMatchArray | null;

    if ((match = trimmed.match(TS_PATTERNS.class))) {
      boundaries.push({ line: i, type: "class", name: match[1] });
    } else if ((match = trimmed.match(TS_PATTERNS.interface))) {
      boundaries.push({ line: i, type: "interface", name: match[1] });
    } else if ((match = trimmed.match(TS_PATTERNS.type))) {
      boundaries.push({ line: i, type: "type", name: match[1] });
    } else if ((match = trimmed.match(TS_PATTERNS.enum))) {
      boundaries.push({ line: i, type: "class", name: match[1] });
    } else if ((match = trimmed.match(TS_PATTERNS.function))) {
      boundaries.push({ line: i, type: "function", name: match[1] });
    } else if ((match = trimmed.match(TS_PATTERNS.arrowConst))) {
      boundaries.push({ line: i, type: "function", name: match[1] });
    } else if ((match = trimmed.match(TS_PATTERNS.arrowConstFn))) {
      boundaries.push({ line: i, type: "function", name: match[1] });
    }
  }

  return boundaries;
}

/* ─────────────────────── Chunking: Python ──────────────────────────── */

const PY_PATTERNS = {
  function: /^(?:async\s+)?def\s+(\w+)/,
  class: /^class\s+(\w+)/,
};

/**
 * Find semantic boundaries in Python source.
 */
function findPyBoundaries(lines: string[]): BoundaryMatch[] {
  const boundaries: BoundaryMatch[] = [];

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trimStart();
    let match: RegExpMatchArray | null;

    if ((match = trimmed.match(PY_PATTERNS.class))) {
      boundaries.push({ line: i, type: "class", name: match[1] });
    } else if ((match = trimmed.match(PY_PATTERNS.function))) {
      boundaries.push({ line: i, type: "function", name: match[1] });
    }
  }

  return boundaries;
}

/* ─────────────────── Chunking: File Summary ────────────────────────── */

/**
 * Extract imports and exports to create a file summary chunk.
 */
function extractFileSummary(
  filePath: string,
  lines: string[],
  language: string | null
): string {
  const summaryLines: string[] = [`// File: ${filePath}`];

  const importPattern =
    language === "python"
      ? /^(?:from\s+\S+\s+)?import\s+/
      : /^(?:import|export)\s+/;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trimStart();
    if (importPattern.test(trimmed)) {
      summaryLines.push(trimmed);
    }
  }

  // Also include exported declarations (first line only)
  if (language === "typescript" || language === "javascript") {
    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trimStart();
      if (/^export\s+(?!.*from)/.test(trimmed) && !trimmed.startsWith("import")) {
        // Avoid duplicating pure re-exports already captured above
        if (!summaryLines.includes(trimmed)) {
          summaryLines.push(trimmed);
        }
      }
    }
  }

  return summaryLines.join("\n");
}

/* ─────────────────── Chunking: Sliding Window ──────────────────────── */

/**
 * Chunk content using a sliding window approach (for unsupported languages).
 */
function slidingWindowChunks(
  filePath: string,
  lines: string[],
  maxChunkSize: number,
  overlapSize: number
): Omit<EmbeddingChunk, "id" | "embedding">[] {
  const chunks: Omit<EmbeddingChunk, "id" | "embedding">[] = [];
  let currentStart = 0;

  while (currentStart < lines.length) {
    let charCount = 0;
    let currentEnd = currentStart;

    // Accumulate lines until we hit the max chunk size
    while (currentEnd < lines.length && charCount + lines[currentEnd].length + 1 <= maxChunkSize) {
      charCount += lines[currentEnd].length + 1; // +1 for newline
      currentEnd++;
    }

    // Ensure we make progress (at least one line per chunk)
    if (currentEnd === currentStart) {
      currentEnd = currentStart + 1;
    }

    const chunkContent = lines.slice(currentStart, currentEnd).join("\n");

    chunks.push({
      filePath,
      content: chunkContent,
      startLine: currentStart + 1,
      endLine: currentEnd,
      type: "block",
    });

    // Advance with overlap
    const overlapLines = Math.max(1, Math.floor(overlapSize / 80)); // ~80 chars per line estimate
    currentStart = Math.max(currentStart + 1, currentEnd - overlapLines);
  }

  return chunks;
}

/* ─────────────────── Chunking: Boundary-Based ──────────────────────── */

/**
 * Create chunks from detected boundaries, with context lines.
 */
function boundaryChunks(
  filePath: string,
  lines: string[],
  boundaries: BoundaryMatch[],
  maxChunkSize: number,
  overlapSize: number
): Omit<EmbeddingChunk, "id" | "embedding">[] {
  const chunks: Omit<EmbeddingChunk, "id" | "embedding">[] = [];

  if (boundaries.length === 0) {
    // No boundaries found — fall back to sliding window
    return slidingWindowChunks(filePath, lines, maxChunkSize, overlapSize);
  }

  for (let i = 0; i < boundaries.length; i++) {
    const boundary = boundaries[i];
    const nextBoundary = boundaries[i + 1];

    // Start: boundary line minus context, clamped to 0
    const startLine = Math.max(0, boundary.line - CONTEXT_LINES);
    // End: next boundary start (or EOF), plus context
    const endLine = nextBoundary
      ? Math.min(lines.length, nextBoundary.line + CONTEXT_LINES)
      : lines.length;

    let chunkContent = lines.slice(startLine, endLine).join("\n");

    // If the chunk exceeds max size, truncate it
    if (chunkContent.length > maxChunkSize) {
      chunkContent = chunkContent.slice(0, maxChunkSize);
    }

    chunks.push({
      filePath,
      content: chunkContent,
      startLine: startLine + 1,
      endLine,
      type: boundary.type,
      name: boundary.name,
    });
  }

  // Handle content before the first boundary (if any)
  if (boundaries[0].line > CONTEXT_LINES) {
    const prefixEnd = Math.min(boundaries[0].line + CONTEXT_LINES, lines.length);
    const prefixContent = lines.slice(0, prefixEnd).join("\n");

    if (prefixContent.length > 50) {
      // Only add if there's meaningful content
      if (prefixContent.length <= maxChunkSize) {
        chunks.unshift({
          filePath,
          content: prefixContent,
          startLine: 1,
          endLine: prefixEnd,
          type: "block",
        });
      } else {
        // Split the prefix with sliding window
        const prefixChunks = slidingWindowChunks(
          filePath,
          lines.slice(0, prefixEnd),
          maxChunkSize,
          overlapSize
        );
        chunks.unshift(...prefixChunks);
      }
    }
  }

  return chunks;
}

/* ─────────────────────── Public: chunkFile ─────────────────────────── */

/**
 * Chunk a source file into semantic units for embedding.
 *
 * For TypeScript/JavaScript: splits at function, class, interface, and type
 * boundaries using regex-based detection.
 *
 * For Python: splits at def/class boundaries.
 *
 * For other languages: uses a sliding window with configurable overlap.
 *
 * Always generates a "file_summary" chunk containing imports/exports.
 *
 * @param filePath - Project-relative file path
 * @param content - File content as UTF-8 string
 * @param options - Chunking configuration
 * @returns Array of chunks (without id or embedding — those are added later)
 */
export function chunkFile(
  filePath: string,
  content: string,
  options?: ChunkOptions
): Omit<EmbeddingChunk, "id" | "embedding">[] {
  const maxChunkSize = options?.maxChunkSize ?? DEFAULT_MAX_CHUNK_SIZE;
  const overlapSize = options?.overlapSize ?? DEFAULT_OVERLAP_SIZE;
  const language = options?.language ?? detectLanguage(filePath);

  const lines = content.split(/\r\n|\r|\n/);

  // Skip empty or trivially small files
  if (lines.length === 0 || content.trim().length < 20) {
    return [];
  }

  const chunks: Omit<EmbeddingChunk, "id" | "embedding">[] = [];

  // 1. Generate file summary chunk (imports/exports)
  const summary = extractFileSummary(filePath, lines, language);
  if (summary.split("\n").length > 2) {
    // Only include if there's more than just the file path header
    chunks.push({
      filePath,
      content: summary.slice(0, maxChunkSize),
      startLine: 1,
      endLine: lines.length,
      type: "file_summary",
      name: filePath.split("/").pop() ?? filePath,
    });
  }

  // 2. Generate semantic chunks based on language
  let semanticChunks: Omit<EmbeddingChunk, "id" | "embedding">[];

  switch (language) {
    case "typescript":
    case "javascript": {
      const boundaries = findTsBoundaries(lines);
      semanticChunks = boundaryChunks(filePath, lines, boundaries, maxChunkSize, overlapSize);
      break;
    }
    case "python": {
      const boundaries = findPyBoundaries(lines);
      semanticChunks = boundaryChunks(filePath, lines, boundaries, maxChunkSize, overlapSize);
      break;
    }
    default: {
      semanticChunks = slidingWindowChunks(filePath, lines, maxChunkSize, overlapSize);
      break;
    }
  }

  chunks.push(...semanticChunks);

  return chunks;
}

/* ─────────────────── Public: cosineSimilarity ──────────────────────── */

/**
 * Compute cosine similarity between two vectors.
 *
 * Returns a value between -1 and 1, where 1 means identical direction,
 * 0 means orthogonal, and -1 means opposite direction.
 *
 * @param a - First vector
 * @param b - Second vector
 * @returns Cosine similarity score
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(
      `Vector dimension mismatch: ${a.length} vs ${b.length}`
    );
  }

  if (a.length === 0) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;

  return dotProduct / denominator;
}

/* ─────────────────── Public: generateEmbeddings ────────────────────── */

/**
 * Generate embeddings for an array of text chunks using an OpenAI-compatible API.
 *
 * Features:
 * - Batches requests (max 100 texts per API call)
 * - Exponential backoff on rate limit (429) and server errors (5xx)
 * - Configurable model, API key, and base URL
 *
 * @param texts - Array of text strings to embed
 * @param options - API configuration
 * @returns Array of embedding vectors (same order as input texts)
 * @throws Error if API key is not configured or API returns a non-retryable error
 */
export async function generateEmbeddings(
  texts: string[],
  options?: EmbeddingApiOptions
): Promise<number[][]> {
  const apiKey = options?.apiKey ?? process.env.OPENAI_API_KEY;
  const baseUrl = (options?.baseUrl ?? process.env.OPENAI_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
  const model = options?.model ?? DEFAULT_MODEL;

  if (!apiKey) {
    throw new Error(
      "Embeddings API key not configured. Set OPENAI_API_KEY environment variable or pass apiKey option."
    );
  }

  if (texts.length === 0) return [];

  const allEmbeddings: number[][] = [];

  // Process in batches of MAX_BATCH_SIZE
  for (let batchStart = 0; batchStart < texts.length; batchStart += MAX_BATCH_SIZE) {
    const batch = texts.slice(batchStart, batchStart + MAX_BATCH_SIZE);
    const embeddings = await fetchEmbeddingsBatch(batch, {
      apiKey,
      baseUrl,
      model,
    });
    allEmbeddings.push(...embeddings);
  }

  return allEmbeddings;
}

/* ─────────────────── Internal: API Request ─────────────────────────── */

type FetchOptions = {
  apiKey: string;
  baseUrl: string;
  model: string;
};

/**
 * Fetch embeddings for a single batch with exponential backoff retry.
 */
async function fetchEmbeddingsBatch(
  texts: string[],
  options: FetchOptions
): Promise<number[][]> {
  const url = `${options.baseUrl}/embeddings`;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${options.apiKey}`,
        },
        body: JSON.stringify({
          input: texts,
          model: options.model,
          encoding_format: "float",
        }),
      });

      // Rate limited or server error — retry with backoff
      if (response.status === 429 || response.status >= 500) {
        if (attempt === MAX_RETRIES) {
          const errorBody = await response.text().catch(() => "");
          throw new Error(
            `Embeddings API error after ${MAX_RETRIES} retries: ${response.status} ${response.statusText}. Body: ${errorBody.slice(0, 500)}`
          );
        }

        const backoff = INITIAL_BACKOFF_MS * Math.pow(2, attempt);
        const jitter = Math.random() * backoff * 0.1;
        await sleep(backoff + jitter);
        continue;
      }

      // Non-retryable client error
      if (!response.ok) {
        const errorBody = await response.text().catch(() => "");
        throw new Error(
          `Embeddings API error: ${response.status} ${response.statusText}. Body: ${errorBody.slice(0, 500)}`
        );
      }

      const data = (await response.json()) as {
        data: Array<{ embedding: number[]; index: number }>;
      };

      // Sort by index to maintain input order (API may return out of order)
      const sorted = data.data.sort((a, b) => a.index - b.index);
      return sorted.map((item) => item.embedding);
    } catch (error) {
      // Network errors — retry with backoff
      if (
        error instanceof TypeError &&
        attempt < MAX_RETRIES
      ) {
        const backoff = INITIAL_BACKOFF_MS * Math.pow(2, attempt);
        await sleep(backoff);
        continue;
      }
      throw error;
    }
  }

  // Should not reach here, but TypeScript needs it
  throw new Error("Embeddings request failed: exhausted retries");
}

/**
 * Sleep for a given number of milliseconds.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
