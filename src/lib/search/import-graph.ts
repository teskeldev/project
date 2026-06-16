import { prisma } from "@/lib/db";
import { readFile } from "@/lib/storage";
import path from "node:path";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Directed import graph for a project. Both forward (imports) and reverse
 * (importedBy) adjacency lists are maintained for efficient traversal.
 */
export type ImportGraph = {
  /** Map from file path to list of files it imports */
  imports: Map<string, string[]>;
  /** Map from file path to list of files that import it (reverse graph) */
  importedBy: Map<string, string[]>;
};

export type RelatedFile = {
  file: string;
  depth: number;
  direction: "imports" | "importedBy";
};

export type MostImportedFile = {
  file: string;
  importCount: number;
};

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/** Cache TTL in milliseconds (5 minutes). */
const CACHE_TTL_MS = 5 * 60 * 1000;

/** Extensions to try when resolving bare imports (in priority order). */
const TS_JS_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx"];

/** Index file basenames to try when importing a directory. */
const INDEX_FILES = ["index.ts", "index.tsx", "index.js", "index.jsx"];

/** File extensions considered parseable for imports. */
const PARSEABLE_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".py",
]);

/** Directories to skip entirely. */
const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "build", ".next"]);

/** Max file size (bytes) to parse — skip large generated/bundled files. */
const MAX_PARSE_SIZE = 256 * 1024;

// ─────────────────────────────────────────────────────────────────────────────
// Import parsing regexes
// ─────────────────────────────────────────────────────────────────────────────

/**
 * TypeScript/JavaScript import patterns.
 *
 * Matches:
 *   import { x } from 'path'
 *   import x from 'path'
 *   import * as x from 'path'
 *   import 'path'  (side-effect)
 *   export { x } from 'path'
 *   require('path')
 */
const TS_IMPORT_RE =
  /(?:import\s+(?:(?:[\w*{}\s,]+)\s+from\s+)?|export\s+\{[^}]*\}\s+from\s+|require\s*\(\s*)['"]([^'"]+)['"]\s*\)?/g;

/**
 * Python import patterns.
 *
 * Matches:
 *   from module import x
 *   from .module import x
 *   from ..module import x
 *   import module
 *   import module.submodule
 */
const PY_FROM_IMPORT_RE = /^from\s+(\.{0,3}[\w.]*)\s+import\s+/gm;
const PY_IMPORT_RE = /^import\s+([\w.]+(?:\s*,\s*[\w.]+)*)/gm;

// ─────────────────────────────────────────────────────────────────────────────
// In-memory cache
// ─────────────────────────────────────────────────────────────────────────────

interface CacheEntry {
  graph: ImportGraph;
  createdAt: number;
}

const graphCache = new Map<string, CacheEntry>();

/**
 * Returns a cached graph if still valid, otherwise null.
 */
function getCached(cacheKey: string): ImportGraph | null {
  const entry = graphCache.get(cacheKey);
  if (!entry) return null;
  if (Date.now() - entry.createdAt > CACHE_TTL_MS) {
    graphCache.delete(cacheKey);
    return null;
  }
  return entry.graph;
}

/**
 * Store a graph in the cache.
 */
function setCache(cacheKey: string, graph: ImportGraph): void {
  graphCache.set(cacheKey, { graph, createdAt: Date.now() });
}

// ─────────────────────────────────────────────────────────────────────────────
// Path resolution helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resolve a path alias. Currently supports `@/*` → `src/*`.
 * Returns the unaliased specifier, or null if no alias matched.
 */
function resolveAlias(specifier: string): string | null {
  if (specifier.startsWith("@/")) {
    return "src/" + specifier.slice(2);
  }
  return null;
}

/**
 * Check if a specifier looks like a relative or aliased path (not a bare
 * package name like "react" or "lodash").
 */
function isResolvableSpecifier(specifier: string): boolean {
  return (
    specifier.startsWith(".") ||
    specifier.startsWith("@/") ||
    specifier.startsWith("/")
  );
}

/**
 * Given a set of known project file paths, resolve an import specifier to an
 * actual file path. Handles extension resolution and index file resolution.
 *
 * @param specifier - The resolved (non-aliased) relative path from project root
 * @param fileSet - Set of all known file paths in the project
 * @returns The resolved file path, or null if not found
 */
function resolveToFile(specifier: string, fileSet: Set<string>): string | null {
  // Normalize: remove leading slash if present
  const normalized = specifier.startsWith("/")
    ? specifier.slice(1)
    : specifier;

  // Direct match
  if (fileSet.has(normalized)) {
    return normalized;
  }

  // Try adding extensions
  for (const ext of TS_JS_EXTENSIONS) {
    const withExt = normalized + ext;
    if (fileSet.has(withExt)) {
      return withExt;
    }
  }

  // Try as directory with index file
  for (const indexFile of INDEX_FILES) {
    const withIndex = normalized + "/" + indexFile;
    if (fileSet.has(withIndex)) {
      return withIndex;
    }
  }

  return null;
}

/**
 * Resolve a TS/JS import specifier relative to the importing file.
 *
 * @param specifier - Raw import specifier from source code
 * @param importerPath - Project-relative path of the importing file
 * @param fileSet - Set of all known file paths in the project
 * @returns Resolved project-relative file path, or null
 */
function resolveImportSpecifier(
  specifier: string,
  importerPath: string,
  fileSet: Set<string>
): string | null {
  // Try alias resolution first
  const aliased = resolveAlias(specifier);
  if (aliased) {
    return resolveToFile(aliased, fileSet);
  }

  // Skip bare package specifiers (e.g. "react", "lodash/fp")
  if (!isResolvableSpecifier(specifier)) {
    return null;
  }

  // Resolve relative path against the importer's directory
  const importerDir = path.posix.dirname(importerPath);
  const resolved = path.posix.normalize(
    path.posix.join(importerDir, specifier)
  );

  return resolveToFile(resolved, fileSet);
}

/**
 * Resolve a Python import to a project file path.
 *
 * @param modulePath - Dot-separated module path (e.g. "utils.helpers")
 * @param importerPath - Project-relative path of the importing file
 * @param isRelative - Whether this is a relative import (starts with dots)
 * @param dotCount - Number of leading dots for relative imports
 * @param fileSet - Set of all known file paths in the project
 * @returns Resolved project-relative file path, or null
 */
function resolvePythonImport(
  modulePath: string,
  importerPath: string,
  isRelative: boolean,
  dotCount: number,
  fileSet: Set<string>
): string | null {
  let basePath: string;

  if (isRelative) {
    // Relative import: go up `dotCount - 1` directories from the importer
    let dir = path.posix.dirname(importerPath);
    for (let i = 1; i < dotCount; i++) {
      dir = path.posix.dirname(dir);
    }
    basePath = modulePath
      ? path.posix.join(dir, modulePath.replace(/\./g, "/"))
      : dir;
  } else {
    // Absolute import: resolve from project root
    basePath = modulePath.replace(/\./g, "/");
  }

  // Try as a .py file
  const asPy = basePath + ".py";
  if (fileSet.has(asPy)) {
    return asPy;
  }

  // Try as a package (__init__.py)
  const asInit = basePath + "/__init__.py";
  if (fileSet.has(asInit)) {
    return asInit;
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Import extraction
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extract import specifiers from a TypeScript/JavaScript file.
 */
function extractTsImports(
  content: string,
  filePath: string,
  fileSet: Set<string>
): string[] {
  const resolved: string[] = [];
  let match: RegExpExecArray | null;

  // Reset regex state
  TS_IMPORT_RE.lastIndex = 0;

  while ((match = TS_IMPORT_RE.exec(content)) !== null) {
    const specifier = match[1];
    if (!specifier) continue;

    const target = resolveImportSpecifier(specifier, filePath, fileSet);
    if (target && target !== filePath) {
      resolved.push(target);
    }
  }

  return resolved;
}

/**
 * Extract import targets from a Python file.
 */
function extractPyImports(
  content: string,
  filePath: string,
  fileSet: Set<string>
): string[] {
  const resolved: string[] = [];

  // from X import Y
  PY_FROM_IMPORT_RE.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = PY_FROM_IMPORT_RE.exec(content)) !== null) {
    const raw = match[1];
    if (!raw) continue;

    // Count leading dots
    const dotMatch = raw.match(/^(\.+)/);
    const dotCount = dotMatch ? dotMatch[1].length : 0;
    const isRelative = dotCount > 0;
    const modulePath = raw.slice(dotCount);

    const target = resolvePythonImport(
      modulePath,
      filePath,
      isRelative,
      dotCount,
      fileSet
    );
    if (target && target !== filePath) {
      resolved.push(target);
    }
  }

  // import X
  PY_IMPORT_RE.lastIndex = 0;
  while ((match = PY_IMPORT_RE.exec(content)) !== null) {
    const modules = match[1];
    if (!modules) continue;

    for (const mod of modules.split(/\s*,\s*/)) {
      const trimmed = mod.trim();
      if (!trimmed) continue;

      const target = resolvePythonImport(
        trimmed,
        filePath,
        false,
        0,
        fileSet
      );
      if (target && target !== filePath) {
        resolved.push(target);
      }
    }
  }

  return resolved;
}

// ─────────────────────────────────────────────────────────────────────────────
// Utility
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Check if a file path should be skipped (binary, node_modules, etc.).
 */
function shouldSkipFile(filePath: string): boolean {
  const segments = filePath.split("/");
  for (const seg of segments) {
    if (SKIP_DIRS.has(seg)) return true;
  }

  const ext = path.posix.extname(filePath).toLowerCase();
  return !PARSEABLE_EXTENSIONS.has(ext);
}

/**
 * Deduplicate an array of strings while preserving order.
 */
function dedupe(arr: string[]): string[] {
  return [...new Set(arr)];
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build the full import graph for a project.
 *
 * Reads all file nodes from the database, parses their imports, and constructs
 * both forward (imports) and reverse (importedBy) adjacency lists.
 *
 * Results are cached in memory with a 5-minute TTL.
 *
 * @param projectId - The project's database ID
 * @param storageKey - The project's storage key for file access
 * @returns The complete import graph
 */
export async function buildImportGraph(
  projectId: string,
  storageKey: string
): Promise<ImportGraph> {
  const cacheKey = `${projectId}:${storageKey}`;

  // Check cache first
  const cached = getCached(cacheKey);
  if (cached) return cached;

  // Fetch all file nodes for the project
  const fileNodes = await prisma.fileNode.findMany({
    where: { projectId, type: "FILE" },
    select: { path: true },
  });

  const allPaths = fileNodes.map((n) => n.path);
  const fileSet = new Set(allPaths);

  // Initialize graph
  const imports = new Map<string, string[]>();
  const importedBy = new Map<string, string[]>();

  // Initialize all nodes in both maps
  for (const filePath of allPaths) {
    imports.set(filePath, []);
    importedBy.set(filePath, []);
  }

  // Parse each file for imports
  for (const filePath of allPaths) {
    if (shouldSkipFile(filePath)) continue;

    let content: string;
    try {
      content = await readFile(storageKey, filePath);
    } catch {
      // File may have been deleted or be unreadable — skip gracefully
      continue;
    }

    // Skip overly large files (likely generated/bundled)
    if (content.length > MAX_PARSE_SIZE) continue;

    const ext = path.posix.extname(filePath).toLowerCase();
    let resolved: string[];

    if (ext === ".py") {
      resolved = extractPyImports(content, filePath, fileSet);
    } else {
      resolved = extractTsImports(content, filePath, fileSet);
    }

    // Deduplicate and store
    const uniqueImports = dedupe(resolved);
    imports.set(filePath, uniqueImports);

    // Build reverse graph
    for (const target of uniqueImports) {
      const existing = importedBy.get(target);
      if (existing) {
        existing.push(filePath);
      } else {
        importedBy.set(target, [filePath]);
      }
    }
  }

  const graph: ImportGraph = { imports, importedBy };
  setCache(cacheKey, graph);
  return graph;
}

/**
 * Get files within N hops of a target file in both directions.
 *
 * Performs a BFS traversal from the target file, following both import and
 * importedBy edges up to `maxDepth` hops. Handles circular imports gracefully
 * by tracking visited nodes.
 *
 * @param graph - The import graph to traverse
 * @param targetFile - The starting file path
 * @param maxDepth - Maximum number of hops to traverse (default: 2)
 * @returns Array of related files with their depth and relationship direction
 */
export function getRelatedFiles(
  graph: ImportGraph,
  targetFile: string,
  maxDepth: number = 2
): RelatedFile[] {
  const results: RelatedFile[] = [];
  const visited = new Set<string>();
  visited.add(targetFile);

  // BFS in the "imports" direction (files that targetFile depends on)
  const importsQueue: { file: string; depth: number }[] = [];
  const directImports = graph.imports.get(targetFile) ?? [];
  for (const f of directImports) {
    if (!visited.has(f)) {
      importsQueue.push({ file: f, depth: 1 });
      visited.add(f);
    }
  }

  let idx = 0;
  while (idx < importsQueue.length) {
    const { file, depth } = importsQueue[idx++];
    results.push({ file, depth, direction: "imports" });

    if (depth < maxDepth) {
      const next = graph.imports.get(file) ?? [];
      for (const f of next) {
        if (!visited.has(f)) {
          importsQueue.push({ file: f, depth: depth + 1 });
          visited.add(f);
        }
      }
    }
  }

  // BFS in the "importedBy" direction (files that depend on targetFile)
  const importedByQueue: { file: string; depth: number }[] = [];
  const directImporters = graph.importedBy.get(targetFile) ?? [];
  for (const f of directImporters) {
    if (!visited.has(f)) {
      importedByQueue.push({ file: f, depth: 1 });
      visited.add(f);
    }
  }

  idx = 0;
  while (idx < importedByQueue.length) {
    const { file, depth } = importedByQueue[idx++];
    results.push({ file, depth, direction: "importedBy" });

    if (depth < maxDepth) {
      const next = graph.importedBy.get(file) ?? [];
      for (const f of next) {
        if (!visited.has(f)) {
          importedByQueue.push({ file: f, depth: depth + 1 });
          visited.add(f);
        }
      }
    }
  }

  return results;
}

/**
 * Get the most "central" files in the project — those imported by the most
 * other files. Useful for identifying core utilities, shared types, and
 * foundational modules.
 *
 * @param graph - The import graph to analyze
 * @param topN - Number of top files to return (default: 20)
 * @returns Array of files sorted by import count (descending)
 */
export function getMostImportedFiles(
  graph: ImportGraph,
  topN: number = 20
): MostImportedFile[] {
  const entries: MostImportedFile[] = [];

  for (const [file, importers] of graph.importedBy) {
    if (importers.length > 0) {
      entries.push({ file, importCount: importers.length });
    }
  }

  // Sort descending by import count, then alphabetically for stability
  entries.sort((a, b) => {
    if (b.importCount !== a.importCount) return b.importCount - a.importCount;
    return a.file.localeCompare(b.file);
  });

  return entries.slice(0, topN);
}

/**
 * Invalidate the cached graph for a project. Call this when files are
 * added, removed, or modified.
 *
 * @param projectId - The project's database ID
 * @param storageKey - The project's storage key
 */
export function invalidateGraphCache(
  projectId: string,
  storageKey: string
): void {
  const cacheKey = `${projectId}:${storageKey}`;
  graphCache.delete(cacheKey);
}
