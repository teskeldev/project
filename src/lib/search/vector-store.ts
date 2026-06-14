/**
 * In-memory vector store for semantic search.
 *
 * Stores embeddings in memory with project-level isolation. Designed to work
 * WITHOUT pgvector initially (pure in-memory cosine similarity), with a clear
 * upgrade path to pgvector when needed.
 *
 * Architecture:
 * - Embeddings are stored in a Map<projectId, EmbeddingChunk[]>
 * - Search uses brute-force cosine similarity (fast enough for <10k chunks)
 * - Memory is bounded: max 10,000 chunks/project, max 50 projects
 * - Indexing is debounced (5-minute cooldown unless force=true)
 *
 * @module search/vector-store
 */

import { prisma } from "@/lib/db";
import { readFile } from "@/lib/storage";
import {
  type EmbeddingChunk,
  chunkFile,
  generateEmbeddings,
  cosineSimilarity,
} from "@/lib/search/embeddings";

/* ─────────────────────────────── Types ─────────────────────────────── */

export type VectorSearchResult = {
  /** The matched chunk with its metadata */
  chunk: EmbeddingChunk;
  /** Cosine similarity score (0-1 range, higher is more similar) */
  score: number;
};

export type IndexStatus = {
  /** Project identifier */
  projectId: string;
  /** Total number of indexed chunks */
  totalChunks: number;
  /** Number of files that have been indexed */
  indexedFiles: number;
  /** Timestamp of last successful indexing */
  lastIndexedAt: Date | null;
  /** Whether indexing is currently in progress */
  isIndexing: boolean;
};

/* ─────────────────────────── Constants ─────────────────────────────── */

/** Maximum chunks stored per project */
const MAX_CHUNKS_PER_PROJECT = 10_000;

/** Maximum number of projects kept in memory simultaneously */
const MAX_PROJECTS_IN_MEMORY = 50;

/** Minimum interval between re-indexing (milliseconds) */
const REINDEX_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

/** Default number of results returned by search */
const DEFAULT_TOP_K = 10;

/** Maximum number of results that can be requested */
const MAX_TOP_K = 50;

/** Batch size for embedding generation */
const EMBEDDING_BATCH_SIZE = 50;

/** File extensions to skip during indexing */
const SKIP_EXTENSIONS = new Set([
  "png", "jpg", "jpeg", "gif", "webp", "ico", "bmp", "tiff", "svg",
  "woff", "woff2", "ttf", "otf", "eot",
  "mp3", "mp4", "wav", "ogg", "webm", "mov", "avi",
  "zip", "gz", "tar", "rar", "7z",
  "pdf", "exe", "dll", "so", "dylib", "bin", "wasm",
  "lock", "map",
]);

/** Maximum file size to index (bytes) */
const MAX_FILE_SIZE_BYTES = 256 * 1024; // 256KB

/* ─────────────────────── Internal State ────────────────────────────── */

type ProjectIndex = {
  chunks: EmbeddingChunk[];
  indexedFiles: Set<string>;
  lastIndexedAt: Date | null;
  isIndexing: boolean;
};

/* ─────────────────────── VectorStore Class ─────────────────────────── */

/**
 * In-memory vector store with project-level isolation.
 *
 * Provides semantic search over project files by:
 * 1. Chunking files into semantic units (functions, classes, blocks)
 * 2. Generating embeddings via OpenAI-compatible API
 * 3. Computing cosine similarity for search queries
 *
 * Memory-bounded and designed for single-instance deployment.
 * Can be replaced with pgvector-backed implementation later.
 */
export class VectorStore {
  private projects: Map<string, ProjectIndex> = new Map();
  private accessOrder: string[] = []; // LRU tracking

  /* ─────────────────── Private Helpers ──────────────────────────────── */

  /**
   * Get or create the index for a project.
   */
  private getOrCreateIndex(projectId: string): ProjectIndex {
    let index = this.projects.get(projectId);
    if (!index) {
      index = {
        chunks: [],
        indexedFiles: new Set(),
        lastIndexedAt: null,
        isIndexing: false,
      };
      this.projects.set(projectId, index);
    }

    // Update LRU access order
    this.touchProject(projectId);

    return index;
  }

  /**
   * Update LRU tracking for a project.
   */
  private touchProject(projectId: string): void {
    const idx = this.accessOrder.indexOf(projectId);
    if (idx !== -1) {
      this.accessOrder.splice(idx, 1);
    }
    this.accessOrder.push(projectId);

    // Evict least-recently-used projects if over limit
    while (this.accessOrder.length > MAX_PROJECTS_IN_MEMORY) {
      const evictId = this.accessOrder.shift();
      if (evictId) {
        this.projects.delete(evictId);
      }
    }
  }

  /**
   * Check if the embeddings API is configured and available.
   */
  private isEmbeddingsConfigured(): boolean {
    return Boolean(process.env.OPENAI_API_KEY);
  }

  /**
   * Determine if a file should be indexed based on extension and path.
   */
  private shouldIndexFile(filePath: string): boolean {
    const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
    if (SKIP_EXTENSIONS.has(ext)) return false;

    // Skip common non-source directories
    const skipDirs = ["node_modules/", ".git/", "dist/", "build/", ".next/", "coverage/"];
    if (skipDirs.some((dir) => filePath.includes(dir))) return false;

    return true;
  }

  /**
   * Generate a unique chunk ID.
   */
  private makeChunkId(projectId: string, filePath: string, startLine: number): string {
    return `${projectId}:${filePath}:${startLine}`;
  }

  /* ─────────────────── Public API ──────────────────────────────────── */

  /**
   * Index a single file: chunk its content, generate embeddings, and store.
   *
   * If the file was previously indexed, its old chunks are replaced.
   * Gracefully returns without error if embeddings API is not configured.
   *
   * @param projectId - Project identifier
   * @param filePath - Project-relative file path
   * @param content - File content as UTF-8 string
   */
  async indexFile(projectId: string, filePath: string, content: string): Promise<void> {
    if (!this.isEmbeddingsConfigured()) return;
    if (!this.shouldIndexFile(filePath)) return;
    if (content.length > MAX_FILE_SIZE_BYTES) return;

    const index = this.getOrCreateIndex(projectId);

    // Remove existing chunks for this file
    index.chunks = index.chunks.filter((c) => c.filePath !== filePath);

    // Chunk the file
    const rawChunks = chunkFile(filePath, content);
    if (rawChunks.length === 0) return;

    // Generate embeddings in batches
    const texts = rawChunks.map((c) => c.content);
    let embeddings: number[][];

    try {
      embeddings = await generateEmbeddings(texts);
    } catch (error) {
      // Log but don't throw — indexing failure shouldn't break the app
      console.warn(
        `[VectorStore] Failed to generate embeddings for ${filePath}:`,
        error instanceof Error ? error.message : error
      );
      return;
    }

    // Create full EmbeddingChunk objects
    const chunks: EmbeddingChunk[] = rawChunks.map((raw, i) => ({
      ...raw,
      id: this.makeChunkId(projectId, filePath, raw.startLine),
      embedding: embeddings[i],
    }));

    // Enforce per-project chunk limit
    const availableSlots = MAX_CHUNKS_PER_PROJECT - index.chunks.length;
    const chunksToAdd = chunks.slice(0, Math.max(0, availableSlots));

    index.chunks.push(...chunksToAdd);
    index.indexedFiles.add(filePath);
  }

  /**
   * Remove all chunks for a file from the index.
   *
   * @param projectId - Project identifier
   * @param filePath - Project-relative file path
   */
  removeFile(projectId: string, filePath: string): void {
    const index = this.projects.get(projectId);
    if (!index) return;

    index.chunks = index.chunks.filter((c) => c.filePath !== filePath);
    index.indexedFiles.delete(filePath);
  }

  /**
   * Index all files in a project by reading from the database and storage.
   *
   * Reads file metadata from Prisma FileNode table, fetches content from
   * storage, chunks each file, and generates embeddings in batches.
   *
   * Respects a 5-minute cooldown between re-indexing unless force=true.
   *
   * @param projectId - Project identifier
   * @param storageKey - Storage key for reading file content
   * @param options - Indexing options
   * @returns Current index status after indexing
   */
  async indexProject(
    projectId: string,
    storageKey: string,
    options?: { force?: boolean }
  ): Promise<IndexStatus> {
    if (!this.isEmbeddingsConfigured()) {
      return this.getStatus(projectId);
    }

    const index = this.getOrCreateIndex(projectId);

    // Check cooldown
    if (!options?.force && index.lastIndexedAt) {
      const elapsed = Date.now() - index.lastIndexedAt.getTime();
      if (elapsed < REINDEX_COOLDOWN_MS) {
        return this.getStatus(projectId);
      }
    }

    // Prevent concurrent indexing
    if (index.isIndexing) {
      return this.getStatus(projectId);
    }

    index.isIndexing = true;

    try {
      // Fetch all file nodes from the database
      const fileNodes = await prisma.fileNode.findMany({
        where: { projectId, type: "FILE" },
        select: { path: true, content: true, size: true },
        orderBy: { path: "asc" },
      });

      // Clear existing index for a full re-index
      index.chunks = [];
      index.indexedFiles.clear();

      // Collect all chunks first, then batch-embed
      const allRawChunks: Array<{
        chunk: Omit<EmbeddingChunk, "id" | "embedding">;
        projectId: string;
      }> = [];

      for (const node of fileNodes) {
        if (!this.shouldIndexFile(node.path)) continue;
        if (node.size > MAX_FILE_SIZE_BYTES) continue;

        // Get file content: prefer cached content, fall back to storage
        let content = node.content;
        if (content == null) {
          try {
            content = await readFile(storageKey, node.path);
          } catch {
            // File unreadable — skip silently
            continue;
          }
        }

        if (!content || content.length > MAX_FILE_SIZE_BYTES) continue;

        const rawChunks = chunkFile(node.path, content);
        for (const chunk of rawChunks) {
          allRawChunks.push({ chunk, projectId });
        }

        index.indexedFiles.add(node.path);

        // Enforce chunk limit
        if (allRawChunks.length >= MAX_CHUNKS_PER_PROJECT) {
          allRawChunks.length = MAX_CHUNKS_PER_PROJECT;
          break;
        }
      }

      // Generate embeddings in batches
      for (let i = 0; i < allRawChunks.length; i += EMBEDDING_BATCH_SIZE) {
        const batch = allRawChunks.slice(i, i + EMBEDDING_BATCH_SIZE);
        const texts = batch.map((item) => item.chunk.content);

        let embeddings: number[][];
        try {
          embeddings = await generateEmbeddings(texts);
        } catch (error) {
          console.warn(
            `[VectorStore] Embedding batch failed at offset ${i}:`,
            error instanceof Error ? error.message : error
          );
          // Skip this batch but continue with the rest
          continue;
        }

        for (let j = 0; j < batch.length; j++) {
          const { chunk } = batch[j];
          const embedding = embeddings[j];
          if (!embedding) continue;

          index.chunks.push({
            ...chunk,
            id: this.makeChunkId(projectId, chunk.filePath, chunk.startLine),
            embedding,
          });
        }
      }

      index.lastIndexedAt = new Date();
    } catch (error) {
      console.error(
        `[VectorStore] Project indexing failed for ${projectId}:`,
        error instanceof Error ? error.message : error
      );
    } finally {
      index.isIndexing = false;
    }

    return this.getStatus(projectId);
  }

  /**
   * Search for chunks semantically similar to the query.
   *
   * Embeds the query text, then computes cosine similarity against all
   * indexed chunks for the project. Returns top-K results sorted by score.
   *
   * Returns empty results gracefully if:
   * - Embeddings API is not configured
   * - Project has no indexed chunks
   * - Query embedding fails
   *
   * @param projectId - Project identifier
   * @param query - Natural language search query
   * @param topK - Number of results to return (default 10, max 50)
   * @returns Array of search results sorted by descending similarity score
   */
  async search(
    projectId: string,
    query: string,
    topK?: number
  ): Promise<VectorSearchResult[]> {
    const k = Math.min(Math.max(1, topK ?? DEFAULT_TOP_K), MAX_TOP_K);

    if (!this.isEmbeddingsConfigured()) return [];

    const index = this.projects.get(projectId);
    if (!index || index.chunks.length === 0) return [];

    // Embed the query
    let queryEmbedding: number[];
    try {
      const embeddings = await generateEmbeddings([query]);
      queryEmbedding = embeddings[0];
      if (!queryEmbedding) return [];
    } catch (error) {
      console.warn(
        `[VectorStore] Query embedding failed:`,
        error instanceof Error ? error.message : error
      );
      return [];
    }

    // Compute cosine similarity against all chunks
    const scored: VectorSearchResult[] = [];

    for (const chunk of index.chunks) {
      if (!chunk.embedding) continue;

      const score = cosineSimilarity(queryEmbedding, chunk.embedding);
      scored.push({ chunk, score });
    }

    // Sort by score descending and return top-K
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, k);
  }

  /**
   * Get the current indexing status for a project.
   *
   * @param projectId - Project identifier
   * @returns Index status including chunk count, file count, and timing
   */
  getStatus(projectId: string): IndexStatus {
    const index = this.projects.get(projectId);

    if (!index) {
      return {
        projectId,
        totalChunks: 0,
        indexedFiles: 0,
        lastIndexedAt: null,
        isIndexing: false,
      };
    }

    return {
      projectId,
      totalChunks: index.chunks.length,
      indexedFiles: index.indexedFiles.size,
      lastIndexedAt: index.lastIndexedAt,
      isIndexing: index.isIndexing,
    };
  }

  /**
   * Clear all indexed data for a project, freeing memory.
   *
   * @param projectId - Project identifier
   */
  clear(projectId: string): void {
    this.projects.delete(projectId);
    const idx = this.accessOrder.indexOf(projectId);
    if (idx !== -1) {
      this.accessOrder.splice(idx, 1);
    }
  }
}

/* ─────────────────── Singleton Instance ────────────────────────────── */

/**
 * Singleton vector store instance.
 *
 * Uses the same global-singleton pattern as Prisma to survive HMR in
 * development without losing the in-memory index.
 */
const globalForVectorStore = globalThis as unknown as {
  vectorStore: VectorStore | undefined;
};

export const vectorStore: VectorStore =
  globalForVectorStore.vectorStore ?? new VectorStore();

if (process.env.NODE_ENV !== "production") {
  globalForVectorStore.vectorStore = vectorStore;
}
