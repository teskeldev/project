import { prisma } from "@/lib/db";
import { readFile } from "@/lib/storage";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Structural summary of a single file extracted via regex-based parsing.
 */
export type FileStructure = {
  path: string;
  exports: string[];
  types: string[];
  imports: string[];
  classes: string[];
  functions: string[];
};

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/** Default character budget for the generated repo map. */
const DEFAULT_MAX_CHARS = 8000;

/** Default maximum number of files to consider. */
const DEFAULT_MAX_FILES = 500;

/** Cache TTL in milliseconds (5 minutes). */
const CACHE_TTL_MS = 5 * 60 * 1000;

/** Extensions considered binary or non-parseable for structure extraction. */
const SKIP_EXTENSIONS = new Set([
  "png", "jpg", "jpeg", "gif", "webp", "ico", "bmp", "tiff", "svg",
  "woff", "woff2", "ttf", "otf", "eot",
  "mp3", "mp4", "wav", "ogg", "webm", "mov", "avi",
  "zip", "gz", "tar", "rar", "7z",
  "pdf", "exe", "dll", "so", "dylib", "bin", "wasm",
  "lock", "map", "min.js", "min.css",
]);

/** Path segments that indicate files we should skip. */
const SKIP_PATH_SEGMENTS = [
  "node_modules",
  ".git",
  ".next",
  "dist",
  "build",
  "__pycache__",
  ".cache",
  "coverage",
  ".turbo",
];

/** Languages we can parse for structure. */
const PARSEABLE_LANGUAGES = new Set([
  "typescript", "javascript", "python",
]);

// ─────────────────────────────────────────────────────────────────────────────
// In-memory cache
// ─────────────────────────────────────────────────────────────────────────────

type CacheEntry = { result: string; timestamp: number };
const cache = new Map<string, CacheEntry>();

function getCached(key: string): string | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry.result;
}

function setCache(key: string, result: string): void {
  cache.set(key, { result, timestamp: Date.now() });
  // Evict old entries if cache grows too large (simple LRU-ish).
  if (cache.size > 200) {
    const oldest = [...cache.entries()].sort((a, b) => a[1].timestamp - b[1].timestamp);
    for (let i = 0; i < 50; i++) {
      cache.delete(oldest[i][0]);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Regex-based parsers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parse a TypeScript/JavaScript file to extract structural information using
 * regex patterns. This is intentionally approximate — it captures the most
 * common declaration patterns without requiring a full AST parser.
 */
function parseTSFile(content: string): Omit<FileStructure, "path"> {
  const exports: string[] = [];
  const types: string[] = [];
  const imports: string[] = [];
  const classes: string[] = [];
  const functions: string[] = [];

  const lines = content.split(/\r?\n/);

  // ── Imports ──────────────────────────────────────────────────────────────
  // Match: import { X } from "module"  |  import X from "module"
  const importRegex = /^\s*import\s+(?:(?:type\s+)?(?:\{[^}]*\}|[\w*]+(?:\s+as\s+\w+)?|\*\s+as\s+\w+)(?:\s*,\s*(?:\{[^}]*\}|[\w*]+(?:\s+as\s+\w+)?|\*\s+as\s+\w+))*\s+from\s+)?["']([^"']+)["']/;
  // Also match: import "module" (side-effect imports)
  const sideEffectImportRegex = /^\s*import\s+["']([^"']+)["']/;

  for (const line of lines) {
    const m = importRegex.exec(line);
    if (m && m[1]) {
      if (!imports.includes(m[1])) imports.push(m[1]);
    } else {
      const sm = sideEffectImportRegex.exec(line);
      if (sm && sm[1] && !imports.includes(sm[1])) {
        imports.push(sm[1]);
      }
    }
  }

  // ── Exported functions ───────────────────────────────────────────────────
  // export function name(params): ReturnType
  // export async function name(params): ReturnType
  // export const name = (params): ReturnType =>
  // export const name = async (params): ReturnType =>
  const exportFnRegex = /^\s*export\s+(?:async\s+)?function\s+(\w+)\s*(?:<[^>]*>)?\s*\(([^)]*)\)(?:\s*:\s*([^\s{]+))?/;
  const exportConstFnRegex = /^\s*export\s+(?:const|let)\s+(\w+)\s*=\s*(?:async\s+)?(?:\([^)]*\)|[^=]*)=>/;
  const exportConstFnWithParamsRegex = /^\s*export\s+(?:const|let)\s+(\w+)\s*=\s*(?:async\s+)?\(([^)]*)\)(?:\s*:\s*([^\s=]+))?\s*=>/;

  for (const line of lines) {
    const fnMatch = exportFnRegex.exec(line);
    if (fnMatch) {
      const name = fnMatch[1];
      const params = summarizeParams(fnMatch[2]);
      functions.push(name);
      exports.push(`${name}(${params})`);
      continue;
    }

    const constFnMatch = exportConstFnWithParamsRegex.exec(line);
    if (constFnMatch) {
      const name = constFnMatch[1];
      const params = summarizeParams(constFnMatch[2]);
      functions.push(name);
      exports.push(`${name}(${params})`);
      continue;
    }
  }

  // ── Exported classes ─────────────────────────────────────────────────────
  // export class Name { ... }
  const exportClassRegex = /^\s*export\s+(?:abstract\s+)?class\s+(\w+)/;
  // Method inside a class (heuristic: indented, not a comment)
  const methodRegex = /^\s+(?:(?:public|private|protected|static|async|abstract|override|readonly)\s+)*(\w+)\s*(?:<[^>]*>)?\s*\(/;

  let currentClass: string | null = null;
  let classMethods: string[] = [];
  let braceDepth = 0;
  let inClass = false;

  for (const line of lines) {
    const classMatch = exportClassRegex.exec(line);
    if (classMatch && !inClass) {
      currentClass = classMatch[1];
      classes.push(currentClass);
      classMethods = [];
      inClass = true;
      braceDepth = 0;
    }

    if (inClass) {
      braceDepth += (line.match(/\{/g) || []).length;
      braceDepth -= (line.match(/\}/g) || []).length;

      if (!classMatch) {
        const mMethod = methodRegex.exec(line);
        if (mMethod && mMethod[1] !== "constructor" && !line.trim().startsWith("//") && !line.trim().startsWith("*")) {
          classMethods.push(mMethod[1]);
        }
      }

      if (braceDepth <= 0 && currentClass) {
        const methodSummary = classMethods.length > 0 ? ` { ${classMethods.join(", ")} }` : "";
        exports.push(`class ${currentClass}${methodSummary}`);
        inClass = false;
        currentClass = null;
      }
    }
  }

  // If class was never closed (e.g., partial file), still record it.
  if (inClass && currentClass) {
    const methodSummary = classMethods.length > 0 ? ` { ${classMethods.join(", ")} }` : "";
    exports.push(`class ${currentClass}${methodSummary}`);
  }

  // ── Exported types/interfaces ────────────────────────────────────────────
  const exportTypeRegex = /^\s*export\s+(?:type|interface)\s+(\w+)/;

  for (const line of lines) {
    const typeMatch = exportTypeRegex.exec(line);
    if (typeMatch) {
      types.push(typeMatch[1]);
    }
  }

  // ── Exported enums ───────────────────────────────────────────────────────
  const exportEnumRegex = /^\s*export\s+(?:const\s+)?enum\s+(\w+)/;

  for (const line of lines) {
    const enumMatch = exportEnumRegex.exec(line);
    if (enumMatch) {
      types.push(enumMatch[1]);
    }
  }

  // ── Exported constants/variables (non-function) ──────────────────────────
  const exportConstRegex = /^\s*export\s+(?:const|let|var)\s+(\w+)\s*(?::\s*[^=]+)?\s*=/;

  for (const line of lines) {
    // Skip if already captured as a function export.
    if (exportConstFnRegex.test(line)) continue;
    const constMatch = exportConstRegex.exec(line);
    if (constMatch) {
      const name = constMatch[1];
      if (!exports.some((e) => e.startsWith(name))) {
        exports.push(name);
      }
    }
  }

  // ── Default exports ──────────────────────────────────────────────────────
  const defaultExportRegex = /^\s*export\s+default\s+(?:function\s+)?(\w+)/;
  for (const line of lines) {
    const defMatch = defaultExportRegex.exec(line);
    if (defMatch && defMatch[1] !== "function") {
      const name = defMatch[1];
      if (!exports.includes(name) && !exports.some((e) => e.startsWith(name + "("))) {
        exports.push(name);
      }
    }
  }

  return { exports, types, imports, classes, functions };
}

/**
 * Parse a Python file to extract structural information using regex patterns.
 */
function parsePythonFile(content: string): Omit<FileStructure, "path"> {
  const exports: string[] = [];
  const types: string[] = [];
  const imports: string[] = [];
  const classes: string[] = [];
  const functions: string[] = [];

  const lines = content.split(/\r?\n/);

  // ── Imports ──────────────────────────────────────────────────────────────
  // import module | from module import X
  const importRegex = /^\s*import\s+([\w.]+)/;
  const fromImportRegex = /^\s*from\s+([\w.]+)\s+import/;

  for (const line of lines) {
    const im = importRegex.exec(line);
    if (im && !imports.includes(im[1])) {
      imports.push(im[1]);
      continue;
    }
    const fim = fromImportRegex.exec(line);
    if (fim && !imports.includes(fim[1])) {
      imports.push(fim[1]);
    }
  }

  // ── Top-level functions ──────────────────────────────────────────────────
  // def name(params):
  const defRegex = /^def\s+(\w+)\s*\(([^)]*)\)/;

  for (const line of lines) {
    const defMatch = defRegex.exec(line);
    if (defMatch) {
      const name = defMatch[1];
      if (!name.startsWith("_")) {
        const params = summarizePythonParams(defMatch[2]);
        functions.push(name);
        exports.push(`${name}(${params})`);
      }
    }
  }

  // ── Classes ──────────────────────────────────────────────────────────────
  // class Name(Base):
  const classRegex = /^class\s+(\w+)(?:\([^)]*\))?\s*:/;
  const classMethodRegex = /^\s{4}def\s+(\w+)\s*\(/;

  let currentClass: string | null = null;
  let classMethods: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const classMatch = classRegex.exec(line);

    if (classMatch) {
      // Flush previous class.
      if (currentClass) {
        classes.push(currentClass);
        const methodSummary = classMethods.length > 0 ? ` { ${classMethods.join(", ")} }` : "";
        exports.push(`class ${currentClass}${methodSummary}`);
      }
      currentClass = classMatch[1];
      classMethods = [];
      continue;
    }

    if (currentClass) {
      const methodMatch = classMethodRegex.exec(line);
      if (methodMatch) {
        const methodName = methodMatch[1];
        if (!methodName.startsWith("_") || methodName === "__init__") {
          classMethods.push(methodName === "__init__" ? "__init__" : methodName);
        }
      }
      // If we hit a non-indented, non-empty line that isn't a decorator, class ends.
      if (line.length > 0 && !line.startsWith(" ") && !line.startsWith("\t") && !line.startsWith("@") && !classRegex.test(line)) {
        classes.push(currentClass);
        const methodSummary = classMethods.length > 0 ? ` { ${classMethods.join(", ")} }` : "";
        exports.push(`class ${currentClass}${methodSummary}`);
        currentClass = null;
        classMethods = [];
      }
    }
  }

  // Flush last class.
  if (currentClass) {
    classes.push(currentClass);
    const methodSummary = classMethods.length > 0 ? ` { ${classMethods.join(", ")} }` : "";
    exports.push(`class ${currentClass}${methodSummary}`);
  }

  return { exports, types, imports, classes, functions };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Summarize a TypeScript/JavaScript parameter list into a compact form.
 * E.g., "messages: AIMessage[], opts?: ChatOptions" → "messages, opts?"
 */
function summarizeParams(raw: string): string {
  if (!raw.trim()) return "";

  const params: string[] = [];
  // Split on commas that are not inside angle brackets or parens.
  let depth = 0;
  let current = "";

  for (const ch of raw) {
    if (ch === "<" || ch === "(" || ch === "[" || ch === "{") depth++;
    else if (ch === ">" || ch === ")" || ch === "]" || ch === "}") depth--;
    else if (ch === "," && depth === 0) {
      params.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }
  if (current.trim()) params.push(current.trim());

  return params
    .map((p) => {
      // Extract just the parameter name (with optional ? marker).
      const nameMatch = /^(\.{3})?(\w+)(\?)?/.exec(p.trim());
      if (!nameMatch) return p.trim();
      const spread = nameMatch[1] || "";
      const name = nameMatch[2];
      const optional = nameMatch[3] || "";
      return `${spread}${name}${optional}`;
    })
    .join(", ");
}

/**
 * Summarize Python parameters into a compact form.
 * E.g., "self, name: str, age: int = 0" → "name, age"
 */
function summarizePythonParams(raw: string): string {
  if (!raw.trim()) return "";

  const params = raw.split(",").map((p) => p.trim());
  return params
    .filter((p) => p !== "self" && p !== "cls" && !p.startsWith("*"))
    .map((p) => {
      const nameMatch = /^(\w+)/.exec(p);
      return nameMatch ? nameMatch[1] : p;
    })
    .join(", ");
}

/**
 * Determine the language category from a file path.
 */
function getLanguage(filePath: string): string {
  const ext = filePath.includes(".")
    ? filePath.slice(filePath.lastIndexOf(".") + 1).toLowerCase()
    : "";

  switch (ext) {
    case "ts":
    case "tsx":
    case "mts":
    case "cts":
      return "typescript";
    case "js":
    case "jsx":
    case "mjs":
    case "cjs":
      return "javascript";
    case "py":
      return "python";
    default:
      return ext;
  }
}

/**
 * Get the file extension from a path.
 */
function extOf(p: string): string {
  const base = p.toLowerCase().split("/").pop() ?? "";
  return base.includes(".") ? base.slice(base.lastIndexOf(".") + 1) : "";
}

/**
 * Check if a file path should be skipped based on extension or path segments.
 */
function shouldSkip(filePath: string): boolean {
  const ext = extOf(filePath);
  if (SKIP_EXTENSIONS.has(ext)) return true;

  const segments = filePath.split("/");
  return segments.some((seg) => SKIP_PATH_SEGMENTS.includes(seg));
}

/**
 * Score a file's importance based on its structural content.
 * Higher score = more important to include in the repo map.
 */
function scoreFile(structure: Omit<FileStructure, "path">): number {
  let score = 0;
  score += structure.exports.length * 3;
  score += structure.types.length * 2;
  score += structure.classes.length * 4;
  score += structure.functions.length * 2;
  // Files with imports but no exports are less interesting (likely leaf files).
  if (structure.exports.length === 0 && structure.imports.length > 0) {
    score -= 1;
  }
  return Math.max(0, score);
}

/**
 * Format a single file's structure into a compact string representation.
 */
function formatFileEntry(file: FileStructure): string {
  const lines: string[] = [`${file.path}:`];

  if (file.exports.length > 0) {
    lines.push(`  exports: ${file.exports.join(", ")}`);
  }
  if (file.types.length > 0) {
    lines.push(`  types: ${file.types.join(", ")}`);
  }
  if (file.imports.length > 0) {
    lines.push(`  imports: ${file.imports.join(", ")}`);
  }

  return lines.join("\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parse a file's content to extract structural information (exports, types,
 * imports, classes, functions) using regex-based heuristics.
 *
 * Supports TypeScript, JavaScript, and Python. For unsupported languages,
 * returns empty arrays.
 *
 * @param content - The file's text content.
 * @param language - The language identifier (e.g., "typescript", "python").
 * @returns Structural summary of the file (without the path field).
 *
 * @example
 * ```ts
 * const structure = parseFileStructure(fileContent, "typescript");
 * console.log(structure.exports); // ["buildRepoMap(projectId, storageKey, options?)"]
 * ```
 */
export function parseFileStructure(
  content: string,
  language: string
): Omit<FileStructure, "path"> {
  switch (language) {
    case "typescript":
    case "javascript":
      return parseTSFile(content);
    case "python":
      return parsePythonFile(content);
    default:
      return { exports: [], types: [], imports: [], classes: [], functions: [] };
  }
}

/**
 * Build a compact structural summary ("repo map") of a project's codebase.
 *
 * The repo map provides an LLM with a high-level overview of the codebase
 * structure — exported symbols, types, and dependency relationships — in
 * minimal tokens. Files are prioritized by structural importance (more
 * exports/types = higher priority) and the output is truncated to fit within
 * a character budget.
 *
 * @param projectId - The project's database ID.
 * @param storageKey - The project's storage key for filesystem access.
 * @param options - Optional configuration.
 * @param options.maxFiles - Maximum number of files to consider (default: 500).
 * @param options.maxChars - Character budget for the output (default: 8000).
 * @returns A formatted string summarizing the codebase structure.
 *
 * @example
 * ```ts
 * const map = await buildRepoMap(projectId, storageKey, { maxChars: 6000 });
 * // Returns:
 * // src/lib/ai/provider.ts:
 * //   exports: streamChat(messages, opts), chat(messages, opts)
 * //   types: ChatRole, AIMessage, ChatOptions
 * //   imports: @/lib/api, ./providers
 * ```
 */
export async function buildRepoMap(
  projectId: string,
  storageKey: string,
  options?: { maxFiles?: number; maxChars?: number }
): Promise<string> {
  const maxFiles = options?.maxFiles ?? DEFAULT_MAX_FILES;
  const maxChars = options?.maxChars ?? DEFAULT_MAX_CHARS;

  // Check cache first.
  const cacheKey = `${projectId}:${maxFiles}:${maxChars}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  // Fetch file metadata from the database.
  const fileNodes = await prisma.fileNode.findMany({
    where: {
      projectId,
      type: "FILE",
    },
    select: {
      path: true,
      content: true,
      language: true,
    },
    orderBy: { path: "asc" },
    take: maxFiles * 2, // Fetch extra to account for skipped files.
  });

  // Parse each file's structure.
  const structures: FileStructure[] = [];
  let filesProcessed = 0;

  for (const node of fileNodes) {
    if (filesProcessed >= maxFiles) break;
    if (shouldSkip(node.path)) continue;

    const language = node.language ?? getLanguage(node.path);
    if (!PARSEABLE_LANGUAGES.has(language)) continue;

    // Resolve content: prefer cached DB content, else read from disk.
    let content = node.content;
    if (content == null) {
      try {
        content = await readFile(storageKey, node.path);
      } catch {
        // File unreadable — skip silently.
        continue;
      }
    }

    // Skip very large files (likely generated).
    if (content.length > 256 * 1024) continue;

    const parsed = parseFileStructure(content, language);

    // Only include files that have meaningful structure.
    if (
      parsed.exports.length === 0 &&
      parsed.types.length === 0 &&
      parsed.classes.length === 0
    ) {
      continue;
    }

    structures.push({ path: node.path, ...parsed });
    filesProcessed++;
  }

  // Sort by importance (most exports/types first).
  structures.sort((a, b) => {
    const scoreA = scoreFile(a);
    const scoreB = scoreFile(b);
    if (scoreB !== scoreA) return scoreB - scoreA;
    // Tie-break: shorter paths first (likely more central).
    return a.path.length - b.path.length;
  });

  // Build the output string within the character budget.
  const entries: string[] = [];
  let totalChars = 0;

  for (const file of structures) {
    const entry = formatFileEntry(file);
    const entryLen = entry.length + 1; // +1 for the newline separator

    if (totalChars + entryLen > maxChars) {
      // Try to fit a truncated version (just the path and exports).
      const minimal = `${file.path}:\n  exports: ${file.exports.join(", ")}`;
      if (totalChars + minimal.length + 1 <= maxChars) {
        entries.push(minimal);
        totalChars += minimal.length + 1;
      }
      // If even the minimal version doesn't fit, stop.
      break;
    }

    entries.push(entry);
    totalChars += entryLen;
  }

  const result = entries.join("\n\n");

  // Cache the result.
  setCache(cacheKey, result);

  return result;
}
