/**
 * Diff Validation — Phase 3.6
 *
 * Ensures generated diffs/patches (search/replace blocks) are valid and safe
 * before applying them to the filesystem. Provides fuzzy matching for
 * whitespace-insensitive search and dry-run application.
 */
import { validateSyntax } from "./ast-validator";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DiffValidationResult = {
  valid: boolean;
  errors: DiffError[];
  warnings: DiffWarning[];
  stats: {
    filesModified: number;
    linesAdded: number;
    linesRemoved: number;
    netChange: number;
  };
};

export type DiffError = {
  message: string;
  file?: string;
  type:
    | "search_not_found"
    | "ambiguous_match"
    | "invalid_format"
    | "file_not_found"
    | "destructive_change"
    | "syntax_broken";
};

export type DiffWarning = {
  message: string;
  file?: string;
  type: "large_deletion" | "new_file_large" | "many_files_changed";
};

export type DiffBlock = {
  filePath?: string;
  search: string;
  replace: string;
};

export type FuzzyMatchResult = {
  found: boolean;
  startLine: number;
  endLine: number;
  exactMatch: boolean;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const LARGE_DELETION_THRESHOLD = 0.5; // >50% of file deleted
const LARGE_FILE_THRESHOLD = 500; // >500 lines added
const MANY_FILES_THRESHOLD = 5; // >5 files changed

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Validate search/replace blocks against actual file contents */
export function validateDiff(
  blocks: DiffBlock[],
  fileContents: Map<string, string>
): DiffValidationResult {
  const errors: DiffError[] = [];
  const warnings: DiffWarning[] = [];
  const modifiedFiles = new Set<string>();
  let totalLinesAdded = 0;
  let totalLinesRemoved = 0;

  for (const block of blocks) {
    const { filePath, search, replace } = block;

    // Validate format
    if (!search && !replace) {
      errors.push({
        message: "Empty search and replace block",
        file: filePath,
        type: "invalid_format",
      });
      continue;
    }

    // If no file path, we can't validate against file contents
    if (!filePath) {
      if (search) {
        errors.push({
          message: "Search/replace block missing file path",
          type: "invalid_format",
        });
      }
      continue;
    }

    const content = fileContents.get(filePath);

    // New file creation (empty search, non-empty replace)
    if (!search && replace) {
      modifiedFiles.add(filePath);
      const newLines = replace.split("\n").length;
      totalLinesAdded += newLines;

      if (newLines > LARGE_FILE_THRESHOLD) {
        warnings.push({
          message: `New file has ${newLines} lines (>${LARGE_FILE_THRESHOLD})`,
          file: filePath,
          type: "new_file_large",
        });
      }
      continue;
    }

    // File must exist for search/replace
    if (content === undefined) {
      errors.push({
        message: `File not found: ${filePath}`,
        file: filePath,
        type: "file_not_found",
      });
      continue;
    }

    // Check if search text can be found
    const matchResult = fuzzyFindInContent(search, content);
    if (!matchResult || !matchResult.found) {
      errors.push({
        message: `Search text not found in ${filePath}`,
        file: filePath,
        type: "search_not_found",
      });
      continue;
    }

    // Check for ambiguous matches (search text appears multiple times)
    const occurrences = countOccurrences(content, search);
    if (occurrences > 1) {
      errors.push({
        message: `Search text matches ${occurrences} locations in ${filePath} — ambiguous`,
        file: filePath,
        type: "ambiguous_match",
      });
      continue;
    }

    modifiedFiles.add(filePath);

    // Calculate line changes
    const searchLines = search.split("\n").length;
    const replaceLines = replace.split("\n").length;
    totalLinesRemoved += searchLines;
    totalLinesAdded += replaceLines;

    // Check for destructive changes (replacing entire file with empty or near-empty)
    if (!replace.trim() && search.split("\n").length > 10) {
      const fileLines = content.split("\n").length;
      const deletionRatio = searchLines / fileLines;
      if (deletionRatio > LARGE_DELETION_THRESHOLD) {
        warnings.push({
          message: `Deleting ${Math.round(deletionRatio * 100)}% of ${filePath}`,
          file: filePath,
          type: "large_deletion",
        });
      }
    }
  }

  // Check for many files changed
  if (modifiedFiles.size > MANY_FILES_THRESHOLD) {
    warnings.push({
      message: `${modifiedFiles.size} files modified (>${MANY_FILES_THRESHOLD})`,
      type: "many_files_changed",
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    stats: {
      filesModified: modifiedFiles.size,
      linesAdded: totalLinesAdded,
      linesRemoved: totalLinesRemoved,
      netChange: totalLinesAdded - totalLinesRemoved,
    },
  };
}

/** Check if applying a diff would break syntax */
export function checkDiffSafety(
  originalContent: string,
  search: string,
  replace: string,
  language?: string
): { safe: boolean; error?: string } {
  // Apply the change
  const newContent = applySearchReplace(originalContent, search, replace);
  if (newContent === null) {
    return { safe: false, error: "Search text not found in content" };
  }

  // Validate syntax of the result
  const lang = language ?? detectLanguage(originalContent);
  if (!lang) {
    // Can't validate syntax for unknown language — assume safe
    return { safe: true };
  }

  try {
    const result = validateSyntax(newContent, lang);
    if (!result.valid) {
      const errorMsg = result.errors?.map((e: { message: string }) => e.message).join("; ") ?? "Syntax error";
      return { safe: false, error: `Applying diff would break syntax: ${errorMsg}` };
    }
    return { safe: true };
  } catch {
    // Validator not available for this language — assume safe
    return { safe: true };
  }
}

/** Apply search/replace blocks to file contents (dry run) */
export function applyDiffDryRun(
  blocks: DiffBlock[],
  fileContents: Map<string, string>
): { success: boolean; results: Map<string, string>; errors: string[] } {
  const results = new Map<string, string>(fileContents);
  const errors: string[] = [];

  for (const block of blocks) {
    const { filePath, search, replace } = block;

    if (!filePath) {
      errors.push("Block missing file path");
      continue;
    }

    // New file creation
    if (!search && replace) {
      results.set(filePath, replace);
      continue;
    }

    const content = results.get(filePath);
    if (content === undefined) {
      errors.push(`File not found: ${filePath}`);
      continue;
    }

    const newContent = applySearchReplace(content, search, replace);
    if (newContent === null) {
      // Try fuzzy match
      const fuzzyResult = fuzzyFindInContent(search, content);
      if (fuzzyResult && fuzzyResult.found) {
        const lines = content.split("\n");
        const before = lines.slice(0, fuzzyResult.startLine).join("\n");
        const after = lines.slice(fuzzyResult.endLine + 1).join("\n");
        const reconstructed = [before, replace, after]
          .filter(Boolean)
          .join("\n");
        results.set(filePath, reconstructed);
      } else {
        errors.push(`Search text not found in ${filePath}`);
      }
      continue;
    }

    results.set(filePath, newContent);
  }

  return {
    success: errors.length === 0,
    results,
    errors,
  };
}

/** Fuzzy match search text in file content (handles whitespace differences) */
export function fuzzyFindInContent(
  search: string,
  content: string
): FuzzyMatchResult | null {
  if (!search || !content) return null;

  // Strategy 1: Exact match
  const exactIndex = content.indexOf(search);
  if (exactIndex !== -1) {
    const startLine = content.slice(0, exactIndex).split("\n").length - 1;
    const endLine = startLine + search.split("\n").length - 1;
    return { found: true, startLine, endLine, exactMatch: true };
  }

  // Strategy 2: Whitespace-normalized match
  const normalizedSearch = normalizeWhitespace(search);
  const normalizedContent = normalizeWhitespace(content);
  const normalizedIndex = normalizedContent.indexOf(normalizedSearch);
  if (normalizedIndex !== -1) {
    // Map back to original line numbers
    const lineMapping = buildLineMapping(content);
    const startLine = findOriginalLine(normalizedIndex, normalizedContent, lineMapping);
    const endLine = startLine + search.split("\n").length - 1;
    return { found: true, startLine, endLine, exactMatch: false };
  }

  // Strategy 3: Trimmed line-by-line match
  const searchLines = search.split("\n").map((l) => l.trim());
  const contentLines = content.split("\n").map((l) => l.trim());
  const lineMatch = findSubsequence(searchLines, contentLines);
  if (lineMatch !== -1) {
    return {
      found: true,
      startLine: lineMatch,
      endLine: lineMatch + searchLines.length - 1,
      exactMatch: false,
    };
  }

  // Strategy 4: Partial match — first and last lines
  if (searchLines.length >= 3) {
    const firstLine = searchLines[0];
    const lastLine = searchLines[searchLines.length - 1];

    for (let i = 0; i < contentLines.length; i++) {
      if (contentLines[i] === firstLine) {
        const expectedEnd = i + searchLines.length - 1;
        if (
          expectedEnd < contentLines.length &&
          contentLines[expectedEnd] === lastLine
        ) {
          return {
            found: true,
            startLine: i,
            endLine: expectedEnd,
            exactMatch: false,
          };
        }
      }
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function applySearchReplace(
  content: string,
  search: string,
  replace: string
): string | null {
  const index = content.indexOf(search);
  if (index === -1) return null;

  return content.slice(0, index) + replace + content.slice(index + search.length);
}

function countOccurrences(content: string, search: string): number {
  if (!search) return 0;
  let count = 0;
  let pos = 0;
  while ((pos = content.indexOf(search, pos)) !== -1) {
    count++;
    pos += 1; // Move past to find overlapping matches
  }
  return count;
}

function normalizeWhitespace(text: string): string {
  return text
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .join("\n");
}

function buildLineMapping(content: string): number[] {
  // Maps character index to line number
  const mapping: number[] = [];
  let line = 0;
  for (let i = 0; i < content.length; i++) {
    mapping.push(line);
    if (content[i] === "\n") line++;
  }
  return mapping;
}

function findOriginalLine(
  normalizedIndex: number,
  normalizedContent: string,
  _lineMapping: number[]
): number {
  // Count newlines before the normalized index to find the line
  const beforeIndex = normalizedContent.slice(0, normalizedIndex);
  return beforeIndex.split("\n").length - 1;
}

function findSubsequence(
  searchLines: string[],
  contentLines: string[]
): number {
  if (searchLines.length === 0) return -1;
  if (searchLines.length > contentLines.length) return -1;

  for (let i = 0; i <= contentLines.length - searchLines.length; i++) {
    let match = true;
    for (let j = 0; j < searchLines.length; j++) {
      if (contentLines[i + j] !== searchLines[j]) {
        match = false;
        break;
      }
    }
    if (match) return i;
  }
  return -1;
}

function detectLanguage(content: string): string | undefined {
  // Simple heuristic based on content patterns
  if (/import\s+.*from\s+['"]|export\s+(default\s+)?(?:function|class|const|interface|type)/.test(content)) {
    return "typescript";
  }
  if (/^#!.*python|^import\s+\w+$|^from\s+\w+\s+import/m.test(content)) {
    return "python";
  }
  if (/^package\s+\w+|func\s+\w+\(|:=/.test(content)) {
    return "go";
  }
  if (/^use\s+\w+|fn\s+\w+\(|let\s+mut\s+/.test(content)) {
    return "rust";
  }
  return undefined;
}
