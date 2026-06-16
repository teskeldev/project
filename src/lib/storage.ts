import { promises as fs } from "node:fs";
import path from "node:path";
import { ApiError } from "@/lib/api";

/**
 * SAFE filesystem storage layer for Teskel projects.
 *
 * Each project owns a directory under PROJECT_STORAGE_DIR/<storageKey>.
 * The storage layer is the SOURCE OF TRUTH for file CONTENT; FileNode rows
 * mirror metadata (and small content for fast tree/preview).
 *
 * SECURITY: every client-supplied path MUST pass through resolveSafe(), which
 * guarantees the resolved absolute path stays inside the project root. Never
 * touch the filesystem with a raw client path.
 */

const STORAGE_DIR = process.env.PROJECT_STORAGE_DIR ?? "./.teskel-storage";
const MAX_FILE_SIZE_MB = Number(process.env.MAX_FILE_SIZE_MB ?? "2");
const MAX_FILE_SIZE_BYTES = Math.max(1, MAX_FILE_SIZE_MB) * 1024 * 1024;

/** Absolute path to the root that contains every project directory. */
const STORAGE_ROOT = path.resolve(STORAGE_DIR);

/**
 * Returns the absolute filesystem root for a single project.
 */
export function getProjectRoot(storageKey: string): string {
  if (!storageKey || /[\\/]|\0|\.\./.test(storageKey)) {
    throw new ApiError("Invalid project storage key", 400, "INVALID_PATH");
  }
  return path.resolve(/*turbopackIgnore: true*/ STORAGE_ROOT, storageKey);
}

/**
 * Normalize a client-supplied path to a project-relative POSIX path:
 *  - convert Windows backslashes to forward slashes
 *  - strip leading slashes / drive letters
 *  - collapse redundant separators and "." segments
 *  - return WITHOUT a leading slash (e.g. "src/index.ts")
 *
 * Returns "" for the project root.
 */
export function normalizeRelPath(relPath: string): string {
  if (relPath == null) {
    return "";
  }
  if (relPath.includes("\0")) {
    throw new ApiError("Invalid path", 400, "INVALID_PATH");
  }

  // Unify separators, then use POSIX normalization semantics.
  let p = String(relPath).replace(/\\/g, "/").trim();

  // Drop Windows drive prefixes like "C:" that may sneak in.
  p = p.replace(/^[a-zA-Z]:/, "");

  // Remove all leading slashes so path.posix.normalize treats it as relative.
  p = p.replace(/^\/+/, "");

  // Normalize "." and ".." segments and duplicate slashes.
  const normalized = path.posix.normalize(p);

  // After normalization a leading "../" (or just "..") means traversal.
  if (
    normalized === ".." ||
    normalized.startsWith("../") ||
    normalized.startsWith("/")
  ) {
    throw new ApiError("Path escapes project root", 400, "INVALID_PATH");
  }

  if (normalized === "." || normalized === "") {
    return "";
  }

  // Strip any trailing slash for consistency.
  return normalized.replace(/\/+$/, "");
}

/**
 * Resolve a client-supplied relative path against the project root and verify
 * the result stays inside that root. THROWS ApiError(400,"INVALID_PATH") on any
 * traversal attempt. This is the single security checkpoint for disk access.
 */
export function resolveSafe(storageKey: string, relPath: string): string {
  const root = getProjectRoot(storageKey);
  const rel = normalizeRelPath(relPath);

  const abs = path.resolve(/*turbopackIgnore: true*/ root, rel);

  // Containment check: abs must equal root or live beneath it. Compare with a
  // trailing separator to avoid sibling-prefix false positives
  // (e.g. "/srv/app" vs "/srv/app-evil").
  const rootWithSep = root.endsWith(path.sep) ? root : root + path.sep;
  if (abs !== root && !abs.startsWith(rootWithSep)) {
    throw new ApiError("Path escapes project root", 400, "INVALID_PATH");
  }

  return abs;
}

/** Ensure the project root directory exists. */
export async function ensureProjectDir(storageKey: string): Promise<string> {
  const root = getProjectRoot(storageKey);
  await fs.mkdir(root, { recursive: true });
  return root;
}

/** Read a file's UTF-8 content. THROWS ApiError(404) if missing/not a file. */
export async function readFile(
  storageKey: string,
  relPath: string
): Promise<string> {
  const abs = resolveSafe(storageKey, relPath);
  try {
    const stat = await fs.stat(abs);
    if (!stat.isFile()) {
      throw new ApiError("Not a file", 404, "NOT_A_FILE");
    }
    return await fs.readFile(abs, "utf8");
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      throw new ApiError("File not found", 404, "NOT_FOUND");
    }
    throw err;
  }
}

/**
 * Write a file, creating parent directories as needed. Enforces
 * MAX_FILE_SIZE_MB -> throws ApiError(413) when exceeded.
 */
export async function writeFile(
  storageKey: string,
  relPath: string,
  content: string
): Promise<{ size: number }> {
  const abs = resolveSafe(storageKey, relPath);

  const size = Buffer.byteLength(content ?? "", "utf8");
  if (size > MAX_FILE_SIZE_BYTES) {
    throw new ApiError(
      `File exceeds maximum size of ${MAX_FILE_SIZE_MB}MB`,
      413,
      "FILE_TOO_LARGE"
    );
  }

  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, content ?? "", "utf8");
  return { size };
}

/** Create a directory (recursively). */
export async function createDir(
  storageKey: string,
  relPath: string
): Promise<string> {
  const abs = resolveSafe(storageKey, relPath);
  await fs.mkdir(abs, { recursive: true });
  return abs;
}

/** Delete a file or directory (recursive for dirs). Idempotent. */
export async function deletePath(
  storageKey: string,
  relPath: string
): Promise<void> {
  const abs = resolveSafe(storageKey, relPath);
  await fs.rm(abs, { recursive: true, force: true });
}

/** Rename/move a path within the project. Both ends are validated. */
export async function renamePath(
  storageKey: string,
  oldRel: string,
  newRel: string
): Promise<void> {
  const absOld = resolveSafe(storageKey, oldRel);
  const absNew = resolveSafe(storageKey, newRel);
  await fs.mkdir(path.dirname(absNew), { recursive: true });
  await fs.rename(absOld, absNew);
}

/** Whether a path exists on disk. */
export async function pathExists(
  storageKey: string,
  relPath: string
): Promise<boolean> {
  const abs = resolveSafe(storageKey, relPath);
  try {
    await fs.stat(abs);
    return true;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return false;
    }
    throw err;
  }
}

/**
 * Map a filename/extension to a Monaco language id, or null when unknown.
 */
export function detectLanguage(filename: string): string | null {
  const base = filename.toLowerCase().split("/").pop() ?? filename.toLowerCase();

  // Special-case well-known filenames without a conventional extension.
  const byName: Record<string, string> = {
    dockerfile: "dockerfile",
    makefile: "makefile",
    ".gitignore": "ignore",
    ".dockerignore": "ignore",
    ".env": "ini",
  };
  if (byName[base]) return byName[base];

  const ext = base.includes(".") ? base.slice(base.lastIndexOf(".") + 1) : "";

  const map: Record<string, string> = {
    ts: "typescript",
    tsx: "typescript",
    mts: "typescript",
    cts: "typescript",
    js: "javascript",
    jsx: "javascript",
    mjs: "javascript",
    cjs: "javascript",
    json: "json",
    jsonc: "json",
    css: "css",
    scss: "scss",
    sass: "scss",
    less: "less",
    html: "html",
    htm: "html",
    xml: "xml",
    svg: "xml",
    md: "markdown",
    markdown: "markdown",
    mdx: "markdown",
    py: "python",
    rb: "ruby",
    rs: "rust",
    go: "go",
    java: "java",
    kt: "kotlin",
    kts: "kotlin",
    c: "c",
    h: "c",
    cpp: "cpp",
    cc: "cpp",
    cxx: "cpp",
    hpp: "cpp",
    cs: "csharp",
    php: "php",
    swift: "swift",
    sh: "shell",
    bash: "shell",
    zsh: "shell",
    yaml: "yaml",
    yml: "yaml",
    toml: "ini",
    ini: "ini",
    sql: "sql",
    graphql: "graphql",
    gql: "graphql",
    vue: "vue",
    svelte: "html",
    dart: "dart",
    lua: "lua",
    r: "r",
    pl: "perl",
    txt: "plaintext",
    text: "plaintext",
    log: "plaintext",
    env: "ini",
    prisma: "prisma",
    proto: "proto",
    bat: "bat",
    ps1: "powershell",
  };

  return map[ext] ?? null;
}

const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;
const WINDOWS_RESERVED = /[<>:"/\\|?*]/;

/**
 * Validate a single file/folder "name" (NOT a path). Rejects path separators,
 * control characters, reserved characters, "." / "..", and overly long names.
 * THROWS ApiError(400,"INVALID_NAME") on failure.
 */
export function assertValidName(name: string): string {
  const trimmed = (name ?? "").trim();
  if (!trimmed) {
    throw new ApiError("Name is required", 400, "INVALID_NAME");
  }
  if (trimmed.length > 255) {
    throw new ApiError("Name is too long", 400, "INVALID_NAME");
  }
  if (trimmed === "." || trimmed === "..") {
    throw new ApiError("Invalid name", 400, "INVALID_NAME");
  }
  if (CONTROL_CHARS.test(trimmed) || WINDOWS_RESERVED.test(trimmed)) {
    throw new ApiError(
      "Name contains invalid characters",
      400,
      "INVALID_NAME"
    );
  }
  return trimmed;
}

/** Join a parent (project-relative) dir with a validated child name. */
export function joinRelPath(parent: string, name: string): string {
  const np = normalizeRelPath(parent);
  return np ? `${np}/${name}` : name;
}
