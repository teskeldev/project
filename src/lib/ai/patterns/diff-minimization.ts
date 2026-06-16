/**
 * Diff Minimization — ensures AI generates minimal, targeted changes.
 * Uses the SEARCH/REPLACE format to prevent full-file rewrites.
 *
 * Strategy:
 * - Prompt the model with strict SEARCH/REPLACE format instructions
 * - Include the FULL file content so the model can reference exact lines
 * - Validate that SEARCH blocks exist in the file
 * - Check minimality: if the replace text contains unchanged lines, flag as non-minimal
 * - Retry with "make your change more minimal" if too many lines changed
 */

import { chat, type AIMessage } from "@/lib/ai/provider";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DiffMinOptions = {
  task: string;
  filePath: string;
  fileContent: string;
  context?: string;
  modelId?: string;
  provider?: string;
  workspaceId?: string;
  signal?: AbortSignal;
};

export type DiffBlock = {
  search: string;
  replace: string;
};

export type DiffMinResult = {
  blocks: DiffBlock[];
  explanation: string;
  linesChanged: number;
  isMinimal: boolean;
};

export type MinimalityAssessment = {
  isMinimal: boolean;
  unnecessaryChanges: string[];
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SEARCH_MARKER = "<<<<<<< SEARCH";
const REPLACE_MARKER = "=======";
const END_MARKER = ">>>>>>> REPLACE";

const MAX_RETRY_ATTEMPTS = 2;
const MINIMALITY_THRESHOLD = 0.3; // If >30% of lines in a block are unchanged, flag it

// ---------------------------------------------------------------------------
// Prompts
// ---------------------------------------------------------------------------

/** Get the SEARCH/REPLACE instruction prompt */
export function getSearchReplaceInstruction(): string {
  return `When making changes to files, use the SEARCH/REPLACE block format.
Each block specifies an exact search string to find and its replacement.

Format:
${SEARCH_MARKER}
[exact lines to find in the file]
${REPLACE_MARKER}
[replacement lines]
${END_MARKER}

Rules:
1. The SEARCH section must contain EXACT text from the file (including whitespace and indentation).
2. Include only the MINIMUM lines needed to uniquely identify the location.
3. Keep changes as small as possible — do NOT rewrite entire functions when only one line needs to change.
4. Each SEARCH/REPLACE block should make ONE logical change.
5. If multiple changes are needed, use multiple blocks.
6. Do NOT include unchanged lines in the SEARCH block unless they are needed for context to uniquely identify the location.
7. The SEARCH text must appear exactly once in the file.`;
}

function buildDiffPrompt(
  task: string,
  filePath: string,
  fileContent: string,
  context?: string
): AIMessage[] {
  return [
    {
      role: "system",
      content: `You are a precise code editor. Make MINIMAL changes to accomplish the task.

${getSearchReplaceInstruction()}

After all SEARCH/REPLACE blocks, provide a brief explanation of what you changed and why.

Format your response as:
1. One or more SEARCH/REPLACE blocks
2. A line starting with "Explanation:" followed by your explanation

IMPORTANT: Be as minimal as possible. Change ONLY what is necessary. Do NOT reformat, rename, or restructure code that doesn't need to change.`,
    },
    {
      role: "user",
      content: `File: ${filePath}
${context ? `\nContext: ${context}\n` : ""}
Task: ${task}

File content:
\`\`\`
${fileContent}
\`\`\`

Generate the minimal SEARCH/REPLACE blocks to accomplish this task:`,
    },
  ];
}

function buildRetryPrompt(
  task: string,
  filePath: string,
  fileContent: string,
  previousBlocks: DiffBlock[],
  issues: string[]
): AIMessage[] {
  const previousOutput = previousBlocks
    .map(
      (b) =>
        `${SEARCH_MARKER}\n${b.search}\n${REPLACE_MARKER}\n${b.replace}\n${END_MARKER}`
    )
    .join("\n\n");

  return [
    {
      role: "system",
      content: `You are a precise code editor. Your previous edit was NOT minimal enough. Make it more targeted.

${getSearchReplaceInstruction()}

After all SEARCH/REPLACE blocks, provide a brief explanation.`,
    },
    {
      role: "user",
      content: `File: ${filePath}

Task: ${task}

File content:
\`\`\`
${fileContent}
\`\`\`

Your previous attempt:
${previousOutput}

Issues with your previous attempt:
${issues.map((i) => `- ${i}`).join("\n")}

Please make your changes MORE MINIMAL. Only change what is absolutely necessary:`,
    },
  ];
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

/**
 * Parse SEARCH/REPLACE blocks from LLM output.
 */
function parseSearchReplaceBlocks(output: string): {
  blocks: DiffBlock[];
  explanation: string;
} {
  const blocks: DiffBlock[] = [];
  let explanation = "";

  // Extract explanation (text after last REPLACE marker or "Explanation:" prefix)
  const explMatch = output.match(/(?:^|\n)Explanation:\s*([\s\S]*?)$/m);
  if (explMatch) {
    explanation = explMatch[1].trim();
  }

  // Parse blocks
  const blockPattern = new RegExp(
    `${escapeRegex(SEARCH_MARKER)}\\n([\\s\\S]*?)\\n${escapeRegex(REPLACE_MARKER)}\\n([\\s\\S]*?)\\n${escapeRegex(END_MARKER)}`,
    "g"
  );

  let match: RegExpExecArray | null;
  while ((match = blockPattern.exec(output)) !== null) {
    blocks.push({
      search: match[1],
      replace: match[2],
    });
  }

  // Fallback: try without trailing newline before markers
  if (blocks.length === 0) {
    const loosePattern = new RegExp(
      `${escapeRegex(SEARCH_MARKER)}\\s*\\n([\\s\\S]*?)\\n?${escapeRegex(REPLACE_MARKER)}\\s*\\n([\\s\\S]*?)\\n?${escapeRegex(END_MARKER)}`,
      "g"
    );

    while ((match = loosePattern.exec(output)) !== null) {
      blocks.push({
        search: match[1],
        replace: match[2],
      });
    }
  }

  return { blocks, explanation };
}

/**
 * Validate that all SEARCH blocks exist in the file content.
 */
function validateBlocks(
  fileContent: string,
  blocks: DiffBlock[]
): { valid: DiffBlock[]; invalid: DiffBlock[] } {
  const valid: DiffBlock[] = [];
  const invalid: DiffBlock[] = [];

  for (const block of blocks) {
    if (fileContent.includes(block.search)) {
      valid.push(block);
    } else {
      // Try with normalized whitespace (trim trailing spaces per line)
      const normalizedContent = fileContent
        .split("\n")
        .map((l) => l.trimEnd())
        .join("\n");
      const normalizedSearch = block.search
        .split("\n")
        .map((l) => l.trimEnd())
        .join("\n");

      if (normalizedContent.includes(normalizedSearch)) {
        // Adjust the search to match the actual content
        valid.push({
          search: findActualMatch(fileContent, block.search) ?? block.search,
          replace: block.replace,
        });
      } else {
        invalid.push(block);
      }
    }
  }

  return { valid, invalid };
}

/**
 * Find the actual matching text in the file for a search string,
 * accounting for minor whitespace differences.
 */
function findActualMatch(fileContent: string, search: string): string | null {
  const searchLines = search.split("\n");
  const contentLines = fileContent.split("\n");

  // Try to find the first line of search in the content
  for (let i = 0; i <= contentLines.length - searchLines.length; i++) {
    let matches = true;
    for (let j = 0; j < searchLines.length; j++) {
      if (contentLines[i + j].trimEnd() !== searchLines[j].trimEnd()) {
        matches = false;
        break;
      }
    }
    if (matches) {
      return contentLines.slice(i, i + searchLines.length).join("\n");
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Minimality assessment
// ---------------------------------------------------------------------------

/** Check if a diff is truly minimal (no unnecessary changes) */
export function assessMinimality(
  original: string,
  blocks: DiffBlock[]
): MinimalityAssessment {
  const unnecessaryChanges: string[] = [];

  for (const block of blocks) {
    const searchLines = block.search.split("\n");
    const replaceLines = block.replace.split("\n");

    // Check for unchanged lines in the block
    let unchangedCount = 0;
    const minLen = Math.min(searchLines.length, replaceLines.length);

    for (let i = 0; i < minLen; i++) {
      if (searchLines[i] === replaceLines[i]) {
        unchangedCount++;
      }
    }

    // If too many lines are unchanged, the block is not minimal
    if (searchLines.length > 2 && unchangedCount / searchLines.length > MINIMALITY_THRESHOLD) {
      unnecessaryChanges.push(
        `Block contains ${unchangedCount}/${searchLines.length} unchanged lines — ` +
          `narrow the SEARCH to only include lines that actually change or are needed for unique identification`
      );
    }

    // Check for whitespace-only changes
    const hasOnlyWhitespaceChanges = searchLines.every((line, idx) => {
      if (idx >= replaceLines.length) return false;
      return line.trim() === replaceLines[idx].trim();
    });

    if (hasOnlyWhitespaceChanges && searchLines.length === replaceLines.length) {
      unnecessaryChanges.push(
        `Block appears to only change whitespace/formatting — this may not be necessary`
      );
    }

    // Check if the search block appears multiple times (ambiguous)
    const occurrences = original.split(block.search).length - 1;
    if (occurrences > 1) {
      unnecessaryChanges.push(
        `SEARCH block "${block.search.slice(0, 50)}..." appears ${occurrences} times in the file — ` +
          `add more context lines to make it unique`
      );
    } else if (occurrences === 0) {
      unnecessaryChanges.push(
        `SEARCH block "${block.search.slice(0, 50)}..." not found in file`
      );
    }
  }

  return {
    isMinimal: unnecessaryChanges.length === 0,
    unnecessaryChanges,
  };
}

/**
 * Count the total number of lines changed across all blocks.
 */
function countLinesChanged(blocks: DiffBlock[]): number {
  let total = 0;

  for (const block of blocks) {
    const searchLines = block.search.split("\n");
    const replaceLines = block.replace.split("\n");

    // Count lines that are different
    const maxLen = Math.max(searchLines.length, replaceLines.length);
    for (let i = 0; i < maxLen; i++) {
      const s = searchLines[i] ?? "";
      const r = replaceLines[i] ?? "";
      if (s !== r) total++;
    }
  }

  return total;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Generate minimal diff for a file modification */
export async function generateMinimalDiff(
  options: DiffMinOptions
): Promise<DiffMinResult> {
  const { task, filePath, fileContent, context, modelId, provider, workspaceId, signal } =
    options;

  const chatOpts = {
    model: modelId,
    provider,
    workspaceId,
    signal,
    temperature: 0.1, // Low temperature for precise edits
  };

  // -------------------------------------------------------------------------
  // Initial generation
  // -------------------------------------------------------------------------
  const messages = buildDiffPrompt(task, filePath, fileContent, context);
  const response = await chat(messages, chatOpts);

  let { blocks, explanation } = parseSearchReplaceBlocks(response);

  // Validate blocks exist in file
  const { valid, invalid } = validateBlocks(fileContent, blocks);

  if (valid.length === 0 && invalid.length > 0) {
    // All blocks are invalid — retry with explicit file content emphasis
    const retryMessages: AIMessage[] = [
      ...messages,
      { role: "assistant", content: response },
      {
        role: "user",
        content:
          "None of your SEARCH blocks matched the file content exactly. " +
          "Remember: the SEARCH section must contain EXACT text from the file, " +
          "including all whitespace and indentation. Try again with exact matches:",
      },
    ];

    const retryResponse = await chat(retryMessages, chatOpts);
    const retryParsed = parseSearchReplaceBlocks(retryResponse);
    const retryValidation = validateBlocks(fileContent, retryParsed.blocks);

    blocks = retryValidation.valid;
    if (retryParsed.explanation) explanation = retryParsed.explanation;
  } else {
    blocks = valid;
  }

  // -------------------------------------------------------------------------
  // Minimality check and retry
  // -------------------------------------------------------------------------
  let assessment = assessMinimality(fileContent, blocks);
  let attempts = 0;

  while (!assessment.isMinimal && attempts < MAX_RETRY_ATTEMPTS) {
    attempts++;

    const retryMessages = buildRetryPrompt(
      task,
      filePath,
      fileContent,
      blocks,
      assessment.unnecessaryChanges
    );

    const retryResponse = await chat(retryMessages, chatOpts);
    const retryParsed = parseSearchReplaceBlocks(retryResponse);
    const retryValidation = validateBlocks(fileContent, retryParsed.blocks);

    if (retryValidation.valid.length > 0) {
      blocks = retryValidation.valid;
      if (retryParsed.explanation) explanation = retryParsed.explanation;
      assessment = assessMinimality(fileContent, blocks);
    } else {
      // Retry produced invalid blocks — keep the previous valid ones
      break;
    }
  }

  const linesChanged = countLinesChanged(blocks);

  return {
    blocks,
    explanation,
    linesChanged,
    isMinimal: assessment.isMinimal,
  };
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

/** Escape special regex characters */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
