/**
 * Shared (isomorphic) diff helpers for Teskel changesets.
 *
 * The server stores a unified-diff string on each FileChange (see
 * `src/lib/ai/changeset.ts#unifiedDiff`). These helpers parse that string for
 * display and summary stats, and build a side-by-side model from
 * oldContent/newContent. No Node-only APIs here so it is safe in the browser.
 */

export type DiffLineType = "added" | "removed" | "context" | "meta";

export type ParsedDiffLine = {
  type: DiffLineType;
  content: string;
  /** 1-based line number in the OLD file (null for added/meta). */
  oldLine: number | null;
  /** 1-based line number in the NEW file (null for removed/meta). */
  newLine: number | null;
};

export type DiffStat = { additions: number; deletions: number };

/** Maximum number of lines for O(n²) LCS computation. */
const MAX_LINES = 2000;

/**
 * Count additions/deletions from a unified diff string. Lines beginning with a
 * single "+" are additions, "-" deletions; the "---"/"+++" file headers are
 * ignored.
 */
export function diffStat(diff: string | null | undefined): DiffStat {
  if (!diff) return { additions: 0, deletions: 0 };
  let additions = 0;
  let deletions = 0;
  for (const line of diff.split("\n")) {
    if (line.startsWith("+++") || line.startsWith("---")) continue;
    if (line.startsWith("+")) additions++;
    else if (line.startsWith("-")) deletions++;
  }
  return { additions, deletions };
}

/**
 * Parse a unified diff (as produced by unifiedDiff) into renderable lines with
 * old/new line numbers tracked. Recognizes the leading "---"/"+++" headers as
 * meta lines.
 */
export function parseUnifiedDiff(diff: string | null | undefined): ParsedDiffLine[] {
  if (!diff) return [];
  const out: ParsedDiffLine[] = [];
  let oldNo = 1;
  let newNo = 1;

  for (const raw of diff.split("\n")) {
    if (raw.startsWith("+++") || raw.startsWith("---")) {
      out.push({ type: "meta", content: raw, oldLine: null, newLine: null });
      continue;
    }
    const marker = raw[0];
    const content = raw.slice(1);
    if (marker === "+") {
      out.push({ type: "added", content, oldLine: null, newLine: newNo++ });
    } else if (marker === "-") {
      out.push({ type: "removed", content, oldLine: oldNo++, newLine: null });
    } else {
      // Context line (leading space) or empty trailing line.
      out.push({
        type: "context",
        content,
        oldLine: oldNo++,
        newLine: newNo++,
      });
    }
  }
  return out;
}

export type SideBySideRow = {
  left: { lineNumber: number | null; content: string | null };
  right: { lineNumber: number | null; content: string | null };
  type: "added" | "removed" | "context" | "changed";
};

/**
 * Build a simplified side-by-side diff without LCS alignment.
 * Used as a fallback when files exceed MAX_LINES.
 */
function buildSimplifiedSideBySide(
  a: string[],
  b: string[]
): SideBySideRow[] {
  const rows: SideBySideRow[] = [];
  let oldNo = 1;
  let newNo = 1;

  // Show all old lines as removed, then all new lines as added
  for (let i = 0; i < a.length; i++) {
    rows.push({
      left: { lineNumber: oldNo++, content: a[i] },
      right: { lineNumber: null, content: null },
      type: "removed",
    });
  }
  for (let j = 0; j < b.length; j++) {
    rows.push({
      left: { lineNumber: null, content: null },
      right: { lineNumber: newNo++, content: b[j] },
      type: "added",
    });
  }

  return rows;
}

/**
 * Build a side-by-side model from old/new file contents using a simple LCS
 * alignment. Mirrors the server's unifiedDiff semantics so the two views agree.
 *
 * For files exceeding MAX_LINES (2000), skips the O(n²) LCS computation and
 * returns a simplified diff instead.
 */
export function buildSideBySide(
  oldText: string | null | undefined,
  newText: string | null | undefined
): SideBySideRow[] {
  const a = (oldText ?? "").split("\n");
  const b = (newText ?? "").split("\n");

  const m = a.length;
  const n = b.length;

  // Size guard: skip O(n²) LCS for large files
  if (m > MAX_LINES || n > MAX_LINES) {
    return buildSimplifiedSideBySide(a, b);
  }

  const lcs = new Int32Array((m + 1) * (n + 1));
  const idx = (i: number, j: number) => i * (n + 1) + j;
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      lcs[idx(i, j)] =
        a[i] === b[j]
          ? lcs[idx(i + 1, j + 1)] + 1
          : Math.max(lcs[idx(i + 1, j)], lcs[idx(i, j + 1)]);
    }
  }

  const rows: SideBySideRow[] = [];
  let i = 0;
  let j = 0;
  let oldNo = 1;
  let newNo = 1;

  const pushRemoved = () => {
    rows.push({
      left: { lineNumber: oldNo++, content: a[i++] },
      right: { lineNumber: null, content: null },
      type: "removed",
    });
  };
  const pushAdded = () => {
    rows.push({
      left: { lineNumber: null, content: null },
      right: { lineNumber: newNo++, content: b[j++] },
      type: "added",
    });
  };

  while (i < m && j < n) {
    if (a[i] === b[j]) {
      rows.push({
        left: { lineNumber: oldNo++, content: a[i] },
        right: { lineNumber: newNo++, content: b[j] },
        type: "context",
      });
      i++;
      j++;
    } else if (lcs[idx(i + 1, j)] >= lcs[idx(i, j + 1)]) {
      pushRemoved();
    } else {
      pushAdded();
    }
  }
  while (i < m) pushRemoved();
  while (j < n) pushAdded();

  return rows;
}
