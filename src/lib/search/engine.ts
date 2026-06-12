import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/api";
import { readFile } from "@/lib/storage";
import type { SearchQuery, SearchType } from "@/lib/search/schema";

/**
 * Phase 7a real search engine.
 *
 * Searches a project''s files for filename and content matches. Content is read
 * from the FileNode.content cache when present, otherwise lazily from disk via
 * the SAFE storage layer (readFile -> resolveSafe). Hard caps bound the work to
 * keep a single request cheap and to avoid ReDoS / runaway scans.
 */

/* ------------------------------- caps ------------------------------------ */

/** Max FileNode rows pulled from the DB for a single search. */
const MAX_FILES_SCANNED = 1500;
/** Max bytes of a single file we will scan for content matches. */
const MAX_FILE_BYTES = 512 * 1024; // 512KB — skip large/generated files.
/** Hard ceiling on returned results regardless of requested maxResults. */
const RESULT_HARD_CAP = 200;
/** Truncate the stored/echoed matching line to keep payloads small. */
const MAX_LINE_LENGTH = 400;
/**
 * Regex patterns longer than this are rejected. A pragmatic ReDoS guard: we
 * cannot fully prove a user regex is safe, so we cap the pattern length and
 * yield to the event loop between files (see scan loop). NOTE: ReDoS risk for
 * pathological-but-short patterns remains — real mitigation would need a
 * timeout-capable regex engine (e.g. RE2). Acceptable for Phase 7a.
 */
const MAX_REGEX_PATTERN_LENGTH = 200;

/* ------------------------------- types ----------------------------------- */

export type SearchMatch = {
  file: string;
  line: number;
  column: number;
  content: string;
  type: Exclude<SearchType, "all">;
};

export type SearchResponse = {
  results: SearchMatch[];
  truncated: boolean;
  count: number;
};

/* --------------------------- file filtering ------------------------------ */

const BINARY_EXTENSIONS = new Set([
  "png", "jpg", "jpeg", "gif", "webp", "ico", "bmp", "tiff", "svg",
  "woff", "woff2", "ttf", "otf", "eot",
  "mp3", "mp4", "wav", "ogg", "webm", "mov", "avi",
  "zip", "gz", "tar", "rar", "7z",
  "pdf", "exe", "dll", "so", "dylib", "bin", "wasm",
  "lock", "map",
]);

function extOf(p: string): string {
  const base = p.toLowerCase().split("/").pop() ?? "";
  return base.includes(".") ? base.slice(base.lastIndexOf(".") + 1) : "";
}

function isLikelyBinary(p: string): boolean {
  return BINARY_EXTENSIONS.has(extOf(p));
}

/** Heuristic: NUL byte presence strongly implies binary content. */
function looksBinaryContent(content: string): boolean {
  return content.includes("\u0000");
}

/* ----------------------------- matchers ---------------------------------- */

type LineMatcher = (line: string) => { column: number } | null;

/**
 * Build a per-line matcher. Returns the 1-based column of the first match, or
 * null. For regex mode the pattern is compiled once with try/catch -> 400.
 */
function buildMatcher(q: SearchQuery): LineMatcher {
  if (q.regex) {
    if (q.q.length > MAX_REGEX_PATTERN_LENGTH) {
      throw new ApiError(
        `Regex pattern too long (max ${MAX_REGEX_PATTERN_LENGTH} chars)`,
        400,
        "INVALID_REGEX"
      );
    }
    let re: RegExp;
    try {
      re = new RegExp(q.q, q.caseSensitive ? "" : "i");
    } catch {
      throw new ApiError("Invalid regular expression", 400, "INVALID_REGEX");
    }
    return (line: string) => {
      // Use a fresh search per line; pattern is not /g so no lastIndex state.
      const m = re.exec(line);
      return m ? { column: m.index + 1 } : null;
    };
  }

  const needle = q.caseSensitive ? q.q : q.q.toLowerCase();
  return (line: string) => {
    const hay = q.caseSensitive ? line : line.toLowerCase();
    const idx = hay.indexOf(needle);
    return idx === -1 ? null : { column: idx + 1 };
  };
}

/** Filename matcher (matches against the relative path). */
function pathMatches(path: string, matcher: LineMatcher): boolean {
  return matcher(path) !== null;
}

/**
 * Symbol heuristic: a line is a "symbol declaration" when it declares a
 * function / const / let / var / class / interface / type / enum / export and
 * the query also appears on that line. Pragmatic, language-agnostic-ish.
 */
const SYMBOL_DECL =
  /\b(function|const|let|var|class|interface|type|enum|export|def|fn|struct|impl|trait)\b/;

function isSymbolLine(line: string): boolean {
  return SYMBOL_DECL.test(line);
}

/* ------------------------------ content ---------------------------------- */

function clampLine(line: string): string {
  return line.length > MAX_LINE_LENGTH ? line.slice(0, MAX_LINE_LENGTH) : line;
}

/** Yield control to the event loop, bounding sync work between files. */
function yieldTick(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

/* ------------------------------- search ---------------------------------- */

export async function runSearch(
  projectId: string,
  storageKey: string,
  q: SearchQuery
): Promise<SearchResponse> {
  const limit = Math.min(q.maxResults, RESULT_HARD_CAP);
  const matcher = buildMatcher(q);
  const results: SearchMatch[] = [];
  let truncated = false;

  // Pull file (not folder) metadata, capped. content may be null (disk-only).
  const files = await prisma.fileNode.findMany({
    where: { projectId, type: "FILE" },
    select: { path: true, content: true },
    orderBy: { path: "asc" },
    take: MAX_FILES_SCANNED,
  });

  const wantFile = q.type === "all" || q.type === "file";
  const wantContent = q.type === "all" || q.type === "code" || q.type === "symbol";

  const pushResult = (m: SearchMatch): boolean => {
    results.push(m);
    if (results.length >= limit) {
      truncated = true;
      return false; // signal: stop
    }
    return true;
  };

  outer: for (let i = 0; i < files.length; i++) {
    const node = files[i];
    const path = node.path;

    // Filename matches (type=file or all).
    if (wantFile && pathMatches(path, matcher)) {
      if (!pushResult({ file: path, line: 1, column: 1, content: path, type: "file" })) {
        break;
      }
    }

    if (!wantContent || isLikelyBinary(path)) {
      if (i % 25 === 24) await yieldTick();
      continue;
    }

    // Resolve content: prefer cache, else read from disk (SAFE layer).
    let content = node.content;
    if (content == null) {
      try {
        content = await readFile(storageKey, path);
      } catch {
        // Missing/unreadable on disk -> skip silently.
        continue;
      }
    }

    if (content.length > MAX_FILE_BYTES || looksBinaryContent(content)) {
      continue;
    }

    const lines = content.split(/\r\n|\r|\n/);
    for (let ln = 0; ln < lines.length; ln++) {
      const raw = lines[ln];
      const hit = matcher(raw);
      if (!hit) continue;

      const isSym = isSymbolLine(raw);

      // type=symbol -> only symbol-declaration lines.
      if (q.type === "symbol" && !isSym) continue;

      // Classify: for type=all, symbol lines are tagged "symbol", others "code".
      const resultType: SearchMatch["type"] =
        q.type === "symbol" ? "symbol" : q.type === "code" ? "code" : isSym ? "symbol" : "code";

      if (
        !pushResult({
          file: path,
          line: ln + 1,
          column: hit.column,
          content: clampLine(raw),
          type: resultType,
        })
      ) {
        break outer;
      }
    }

    // Cooperative yield every few files so a big project can''t block the loop.
    if (i % 10 === 9) await yieldTick();
  }

  return { results, truncated, count: results.length };
}


