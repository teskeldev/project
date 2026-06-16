/**
 * Edit Format Abstraction — supports multiple code change formats.
 * Phase 4.5: Different models work better with different edit formats.
 * Provides parsing, normalization, and conversion between formats.
 */

export type EditFormat = 'search_replace' | 'whole_file' | 'unified_diff' | 'line_edit';

export type EditBlock = {
  filePath: string;
  format: EditFormat;
  content: string;
};

export type NormalizedEdit = {
  filePath: string;
  search: string;
  replace: string;
};

/**
 * Model family to preferred edit format mapping.
 * Based on empirical performance of each model with different formats.
 */
const MODEL_FORMAT_MAP: Record<string, EditFormat> = {
  claude: 'search_replace',
  gpt4: 'search_replace',
  'gpt-4': 'search_replace',
  'gpt-3.5': 'whole_file',
  gemini: 'unified_diff',
  'gemini-pro': 'unified_diff',
  codellama: 'whole_file',
  deepseek: 'unified_diff',
  mistral: 'whole_file',
  llama: 'whole_file',
};

/**
 * Task type overrides — some tasks work better with specific formats
 * regardless of model.
 */
const TASK_FORMAT_OVERRIDES: Record<string, EditFormat> = {
  'small-fix': 'line_edit',
  refactor: 'search_replace',
  'new-file': 'whole_file',
  'large-change': 'unified_diff',
};

/**
 * Get the best edit format for a model family and optional task type.
 */
export function selectEditFormat(modelFamily: string, taskType?: string): EditFormat {
  // Task type overrides model preference
  if (taskType && TASK_FORMAT_OVERRIDES[taskType]) {
    return TASK_FORMAT_OVERRIDES[taskType];
  }

  const normalized = modelFamily.toLowerCase().replace(/[_\s]/g, '-');

  // Check exact match first
  if (MODEL_FORMAT_MAP[normalized]) {
    return MODEL_FORMAT_MAP[normalized];
  }

  // Check prefix match
  for (const [key, format] of Object.entries(MODEL_FORMAT_MAP)) {
    if (normalized.startsWith(key) || normalized.includes(key)) {
      return format;
    }
  }

  // Default to search_replace as the most universal format
  return 'search_replace';
}

/**
 * Get format-specific instructions for the AI to follow when generating edits.
 */
export function getEditFormatInstruction(format: EditFormat): string {
  switch (format) {
    case 'search_replace':
      return [
        'Use SEARCH/REPLACE blocks to make changes. Format:',
        '',
        '<<<<<<< SEARCH',
        'exact lines to find in the file',
        '=======',
        'replacement lines',
        '>>>>>>> REPLACE',
        '',
        'Rules:',
        '- The SEARCH block must match EXACTLY (including whitespace)',
        '- Include enough context lines to uniquely identify the location',
        '- Each block changes one contiguous section',
        '- Use multiple blocks for multiple changes in the same file',
      ].join('\n');

    case 'whole_file':
      return [
        'Provide the complete updated file content. Format:',
        '',
        '```filepath.ext',
        '// entire file content here',
        '```',
        '',
        'Rules:',
        '- Include ALL lines of the file, not just changed parts',
        '- Do not truncate or use "..." to skip sections',
        '- The file path goes after the opening backticks',
      ].join('\n');

    case 'unified_diff':
      return [
        'Use unified diff format to show changes. Format:',
        '',
        '```diff',
        '--- a/filepath.ext',
        '+++ b/filepath.ext',
        '@@ -start,count +start,count @@',
        ' context line',
        '-removed line',
        '+added line',
        ' context line',
        '```',
        '',
        'Rules:',
        '- Include 3 lines of context around each change',
        '- Use correct line numbers in the @@ header',
        '- Prefix unchanged lines with a space',
      ].join('\n');

    case 'line_edit':
      return [
        'Use line-number based edits. Format:',
        '',
        'FILE: filepath.ext',
        'LINE 10: new content for line 10',
        'INSERT AFTER 15: new line to insert after line 15',
        'DELETE 20-25',
        '',
        'Rules:',
        '- Use exact line numbers from the current file',
        '- LINE replaces a single line',
        '- INSERT AFTER adds new lines after the specified line',
        '- DELETE removes a range of lines (inclusive)',
      ].join('\n');
  }
}

/**
 * Parse search/replace format into normalized edits.
 */
function parseSearchReplace(raw: string): NormalizedEdit[] {
  const edits: NormalizedEdit[] = [];
  const blockRegex =
    /(?:^|\n)(?:FILE:\s*(.+?)\n)?<<<<<<< SEARCH\n([\s\S]*?)\n=======\n([\s\S]*?)\n>>>>>>> REPLACE/g;

  let match: RegExpExecArray | null;
  let currentFile = '';

  // Also try to detect file path from preceding context
  const fileHeaderRegex = /(?:^|\n)(?:#+\s*)?(?:File|file|FILE):\s*`?([^\n`]+)`?\s*\n/g;
  let fileMatch: RegExpExecArray | null;
  const filePositions: { path: string; pos: number }[] = [];

  while ((fileMatch = fileHeaderRegex.exec(raw)) !== null) {
    filePositions.push({ path: fileMatch[1].trim(), pos: fileMatch.index });
  }

  while ((match = blockRegex.exec(raw)) !== null) {
    const explicitFile = match[1]?.trim();
    if (explicitFile) {
      currentFile = explicitFile;
    } else {
      // Find the most recent file header before this position
      const pos = match.index;
      for (const fp of filePositions) {
        if (fp.pos < pos) {
          currentFile = fp.path;
        }
      }
    }

    edits.push({
      filePath: currentFile,
      search: match[2],
      replace: match[3],
    });
  }

  return edits;
}

/**
 * Parse whole-file format into normalized edits.
 * Whole file is treated as search="" (meaning replace entire file), replace=content.
 */
function parseWholeFile(raw: string): NormalizedEdit[] {
  const edits: NormalizedEdit[] = [];
  const blockRegex = /```([^\n]+)\n([\s\S]*?)```/g;

  let match: RegExpExecArray | null;
  while ((match = blockRegex.exec(raw)) !== null) {
    const filePath = match[1].trim();
    const content = match[2];

    // Skip if the "file path" looks like a language identifier only
    if (filePath.includes('/') || filePath.includes('.')) {
      edits.push({
        filePath,
        search: '', // Empty search means replace entire file
        replace: content,
      });
    }
  }

  return edits;
}

/**
 * Parse unified diff format into normalized edits.
 */
function parseUnifiedDiff(raw: string): NormalizedEdit[] {
  const edits: NormalizedEdit[] = [];
  const diffBlockRegex = /(?:```diff\n)?(---\s+a\/(.+?)\n\+\+\+\s+b\/(.+?)\n([\s\S]*?))(?:```|\n---\s|$)/g;

  let match: RegExpExecArray | null;
  while ((match = diffBlockRegex.exec(raw)) !== null) {
    const filePath = match[3] || match[2];
    const hunks = match[4];

    // Parse each hunk
    const hunkRegex = /@@ -\d+(?:,\d+)? \+\d+(?:,\d+)? @@[^\n]*\n([\s\S]*?)(?=@@ |\s*$)/g;
    let hunkMatch: RegExpExecArray | null;

    while ((hunkMatch = hunkRegex.exec(hunks)) !== null) {
      const lines = hunkMatch[1].split('\n');
      const searchLines: string[] = [];
      const replaceLines: string[] = [];

      for (const line of lines) {
        if (line.startsWith('-')) {
          searchLines.push(line.slice(1));
        } else if (line.startsWith('+')) {
          replaceLines.push(line.slice(1));
        } else if (line.startsWith(' ')) {
          searchLines.push(line.slice(1));
          replaceLines.push(line.slice(1));
        }
        // Skip lines that don't start with -, +, or space
      }

      if (searchLines.length > 0 || replaceLines.length > 0) {
        edits.push({
          filePath,
          search: searchLines.join('\n'),
          replace: replaceLines.join('\n'),
        });
      }
    }
  }

  return edits;
}

/**
 * Parse line-edit format into normalized edits.
 */
function parseLineEdit(raw: string): NormalizedEdit[] {
  const edits: NormalizedEdit[] = [];
  let currentFile = '';

  const lines = raw.split('\n');
  for (const line of lines) {
    const fileMatch = line.match(/^FILE:\s*(.+)/);
    if (fileMatch) {
      currentFile = fileMatch[1].trim();
      continue;
    }

    const lineEditMatch = line.match(/^LINE\s+(\d+):\s*(.*)/);
    if (lineEditMatch) {
      // Line replacement — we use a placeholder pattern
      // The actual line content must be resolved against the file
      edits.push({
        filePath: currentFile,
        search: `__LINE_${lineEditMatch[1]}__`,
        replace: lineEditMatch[2],
      });
      continue;
    }

    const insertMatch = line.match(/^INSERT AFTER\s+(\d+):\s*(.*)/);
    if (insertMatch) {
      edits.push({
        filePath: currentFile,
        search: `__AFTER_LINE_${insertMatch[1]}__`,
        replace: insertMatch[2],
      });
      continue;
    }

    const deleteMatch = line.match(/^DELETE\s+(\d+)(?:-(\d+))?/);
    if (deleteMatch) {
      const start = parseInt(deleteMatch[1], 10);
      const end = deleteMatch[2] ? parseInt(deleteMatch[2], 10) : start;
      edits.push({
        filePath: currentFile,
        search: `__DELETE_LINES_${start}_${end}__`,
        replace: '',
      });
    }
  }

  return edits;
}

/**
 * Parse any edit format into normalized search/replace blocks.
 */
export function parseEditBlocks(raw: string, format: EditFormat): NormalizedEdit[] {
  switch (format) {
    case 'search_replace':
      return parseSearchReplace(raw);
    case 'whole_file':
      return parseWholeFile(raw);
    case 'unified_diff':
      return parseUnifiedDiff(raw);
    case 'line_edit':
      return parseLineEdit(raw);
  }
}

/**
 * Convert a normalized edit to a specific target format.
 */
export function convertFormat(
  edit: NormalizedEdit,
  targetFormat: EditFormat,
  originalContent?: string
): string {
  switch (targetFormat) {
    case 'search_replace':
      return [
        `FILE: ${edit.filePath}`,
        '<<<<<<< SEARCH',
        edit.search,
        '=======',
        edit.replace,
        '>>>>>>> REPLACE',
      ].join('\n');

    case 'whole_file': {
      if (originalContent && edit.search) {
        const updated = originalContent.replace(edit.search, edit.replace);
        return `\`\`\`${edit.filePath}\n${updated}\`\`\``;
      }
      return `\`\`\`${edit.filePath}\n${edit.replace}\`\`\``;
    }

    case 'unified_diff': {
      const searchLines = edit.search.split('\n');
      const replaceLines = edit.replace.split('\n');
      const diffLines = [
        `--- a/${edit.filePath}`,
        `+++ b/${edit.filePath}`,
        `@@ -1,${searchLines.length} +1,${replaceLines.length} @@`,
      ];

      for (const line of searchLines) {
        diffLines.push(`-${line}`);
      }
      for (const line of replaceLines) {
        diffLines.push(`+${line}`);
      }

      return diffLines.join('\n');
    }

    case 'line_edit': {
      // Without knowing exact line numbers, we provide a best-effort conversion
      const lines: string[] = [`FILE: ${edit.filePath}`];
      if (edit.search === '') {
        // Whole file replacement
        lines.push(`LINE 1: ${edit.replace.split('\n')[0]}`);
        lines.push('// (whole file replacement - use whole_file format instead)');
      } else {
        lines.push(`// Replace the following:`);
        lines.push(`// ${edit.search.split('\n')[0]}...`);
        lines.push(`LINE 1: ${edit.replace.split('\n')[0]}`);
      }
      return lines.join('\n');
    }
  }
}
