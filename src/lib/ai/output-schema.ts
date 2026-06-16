/**
 * Structured Output Enforcer — Phase 2.3
 *
 * Ensures AI outputs conform to expected formats. Provides schemas, validation,
 * and repair for AI-generated structured output. Handles multiple delimiter
 * styles and performs fuzzy matching for SEARCH/REPLACE block validation.
 */

export type OutputFormat =
  | 'search_replace'    // SEARCH/REPLACE blocks for code changes
  | 'json_changeset'    // JSON array of file changes
  | 'plan'             // Structured plan with steps
  | 'review'           // Code review with comments
  | 'completion'       // Code completion (raw code)
  | 'explanation'      // Structured explanation
  | 'test'            // Test code
  | 'freeform';       // No structure enforced

export type ParsedOutput<T = unknown> = {
  success: boolean;
  data: T | null;
  raw: string;
  errors: string[];
  repaired: boolean;
};

export type SearchReplaceBlock = {
  filePath?: string;
  search: string;
  replace: string;
};

export type JsonChangeset = {
  files: {
    path: string;
    action: 'create' | 'modify' | 'delete';
    content?: string;
    changes?: SearchReplaceBlock[];
  }[];
  summary: string;
};

export type PlanOutput = {
  summary: string;
  steps: { order: number; description: string; files?: string[] }[];
};

export type ReviewOutput = {
  comments: {
    file: string;
    line: number;
    severity: 'info' | 'warning' | 'error' | 'security';
    message: string;
    suggestion?: string;
  }[];
  summary: string;
  approved: boolean;
};

// ---------------------------------------------------------------------------
// Output format instructions
// ---------------------------------------------------------------------------

const FORMAT_INSTRUCTIONS: Record<OutputFormat, string> = {
  search_replace: `Output your changes as SEARCH/REPLACE blocks. Use this exact format for each change:

<<<<<<< SEARCH
[exact existing code to find]
=======
[replacement code]
>>>>>>> REPLACE

If changing multiple files, prefix each block with the file path:
--- path/to/file.ts
<<<<<<< SEARCH
...
=======
...
>>>>>>> REPLACE

Rules:
- The SEARCH section must match the existing code EXACTLY (including whitespace)
- Include enough context lines to uniquely identify the location
- Each block should be a self-contained change`,

  json_changeset: `Output your changes as a JSON object with this structure:
{
  "files": [
    {
      "path": "relative/path/to/file.ts",
      "action": "create" | "modify" | "delete",
      "content": "full file content (for create)",
      "changes": [
        { "search": "exact text to find", "replace": "replacement text" }
      ]
    }
  ],
  "summary": "Brief description of all changes"
}

Rules:
- Use "content" for new files, "changes" for modifications
- Each search string must match exactly
- Wrap the JSON in a \`\`\`json code fence`,

  plan: `Output a structured plan as JSON:
{
  "summary": "One-line summary of the plan",
  "steps": [
    { "order": 1, "description": "What to do", "files": ["affected/files.ts"] }
  ]
}

Rules:
- Steps should be ordered and actionable
- Include affected files where known
- Wrap in a \`\`\`json code fence`,

  review: `Output a code review as JSON:
{
  "comments": [
    {
      "file": "path/to/file.ts",
      "line": 42,
      "severity": "info" | "warning" | "error" | "security",
      "message": "Description of the issue",
      "suggestion": "Optional suggested fix"
    }
  ],
  "summary": "Overall assessment",
  "approved": true | false
}

Rules:
- Be specific about file and line number
- Use appropriate severity levels
- Wrap in a \`\`\`json code fence`,

  completion: `Output ONLY the code completion. Do not include explanations, markdown fences, or any other text. Output raw code only.`,

  explanation: `Structure your explanation with clear sections:

## Summary
One paragraph overview.

## Details
Detailed explanation with code references.

## Key Points
- Bullet point 1
- Bullet point 2`,

  test: `Output the complete test code. Wrap in a code fence with the appropriate language:
\`\`\`typescript
// test code here
\`\`\`

Include all necessary imports and describe what each test verifies.`,

  freeform: '',
};

/** Get the instruction text that tells the AI how to format its output */
export function getOutputInstruction(format: OutputFormat): string {
  return FORMAT_INSTRUCTIONS[format];
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

/** Parse and validate AI output according to expected format */
export function parseOutput<T>(raw: string, format: OutputFormat): ParsedOutput<T> {
  const result: ParsedOutput<T> = {
    success: false,
    data: null,
    raw,
    errors: [],
    repaired: false,
  };

  if (!raw || !raw.trim()) {
    result.errors.push('Empty output');
    return result;
  }

  switch (format) {
    case 'search_replace':
      return parseSearchReplace<T>(raw, result);
    case 'json_changeset':
      return parseJsonFormat<T>(raw, result, validateChangeset);
    case 'plan':
      return parseJsonFormat<T>(raw, result, validatePlan);
    case 'review':
      return parseJsonFormat<T>(raw, result, validateReview);
    case 'completion':
      return parseCompletion<T>(raw, result);
    case 'explanation':
      return parseExplanation<T>(raw, result);
    case 'test':
      return parseTestOutput<T>(raw, result);
    case 'freeform':
      result.success = true;
      result.data = raw as unknown as T;
      return result;
    default:
      result.errors.push(`Unknown format: ${format}`);
      return result;
  }
}

function parseSearchReplace<T>(raw: string, result: ParsedOutput<T>): ParsedOutput<T> {
  const blocks = parseSearchReplaceBlocks(raw);
  if (blocks.length === 0) {
    result.errors.push('No SEARCH/REPLACE blocks found');
    // Attempt repair
    const repaired = repairOutput(raw, 'search_replace');
    const repairedBlocks = parseSearchReplaceBlocks(repaired);
    if (repairedBlocks.length > 0) {
      result.data = repairedBlocks as unknown as T;
      result.success = true;
      result.repaired = true;
    }
    return result;
  }
  result.data = blocks as unknown as T;
  result.success = true;
  return result;
}

function parseJsonFormat<T>(
  raw: string,
  result: ParsedOutput<T>,
  validator: (data: unknown) => string[]
): ParsedOutput<T> {
  const jsonStr = extractJson(raw);
  if (!jsonStr) {
    result.errors.push('No JSON block found in output');
    const repaired = repairOutput(raw, 'json_changeset');
    const repairedJson = extractJson(repaired);
    if (repairedJson) {
      try {
        const data = JSON.parse(repairedJson);
        const validationErrors = validator(data);
        if (validationErrors.length === 0) {
          result.data = data as T;
          result.success = true;
          result.repaired = true;
        } else {
          result.errors.push(...validationErrors);
        }
      } catch {
        result.errors.push('Repaired JSON is still invalid');
      }
    }
    return result;
  }

  try {
    const data = JSON.parse(jsonStr);
    const validationErrors = validator(data);
    if (validationErrors.length > 0) {
      result.errors.push(...validationErrors);
      return result;
    }
    result.data = data as T;
    result.success = true;
  } catch (e) {
    result.errors.push(`JSON parse error: ${e instanceof Error ? e.message : String(e)}`);
    // Attempt repair
    const repaired = repairJson(jsonStr);
    try {
      const data = JSON.parse(repaired);
      const validationErrors = validator(data);
      if (validationErrors.length === 0) {
        result.data = data as T;
        result.success = true;
        result.repaired = true;
      } else {
        result.errors.push(...validationErrors);
      }
    } catch {
      result.errors.push('JSON repair failed');
    }
  }
  return result;
}

function parseCompletion<T>(raw: string, result: ParsedOutput<T>): ParsedOutput<T> {
  // Strip code fences if present
  const code = stripCodeFences(raw);
  result.data = code as unknown as T;
  result.success = true;
  return result;
}

function parseExplanation<T>(raw: string, result: ParsedOutput<T>): ParsedOutput<T> {
  // Explanation is valid as long as it has content
  result.data = raw.trim() as unknown as T;
  result.success = raw.trim().length > 0;
  if (!result.success) {
    result.errors.push('Empty explanation');
  }
  return result;
}

function parseTestOutput<T>(raw: string, result: ParsedOutput<T>): ParsedOutput<T> {
  const code = stripCodeFences(raw);
  if (!code.trim()) {
    result.errors.push('No test code found');
    return result;
  }
  result.data = code as unknown as T;
  result.success = true;
  return result;
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

function validateChangeset(data: unknown): string[] {
  const errors: string[] = [];
  if (!data || typeof data !== 'object') {
    errors.push('Changeset must be an object');
    return errors;
  }
  const obj = data as Record<string, unknown>;
  if (!Array.isArray(obj.files)) {
    errors.push('Changeset must have a "files" array');
    return errors;
  }
  for (let i = 0; i < obj.files.length; i++) {
    const file = obj.files[i] as Record<string, unknown>;
    if (!file.path || typeof file.path !== 'string') {
      errors.push(`files[${i}]: missing or invalid "path"`);
    }
    if (!['create', 'modify', 'delete'].includes(file.action as string)) {
      errors.push(`files[${i}]: invalid "action" (must be create/modify/delete)`);
    }
    if (file.action === 'create' && !file.content) {
      errors.push(`files[${i}]: "create" action requires "content"`);
    }
    if (file.action === 'modify' && !file.changes && !file.content) {
      errors.push(`files[${i}]: "modify" action requires "changes" or "content"`);
    }
  }
  if (typeof obj.summary !== 'string') {
    errors.push('Changeset must have a "summary" string');
  }
  return errors;
}

function validatePlan(data: unknown): string[] {
  const errors: string[] = [];
  if (!data || typeof data !== 'object') {
    errors.push('Plan must be an object');
    return errors;
  }
  const obj = data as Record<string, unknown>;
  if (typeof obj.summary !== 'string') {
    errors.push('Plan must have a "summary" string');
  }
  if (!Array.isArray(obj.steps)) {
    errors.push('Plan must have a "steps" array');
    return errors;
  }
  for (let i = 0; i < obj.steps.length; i++) {
    const step = obj.steps[i] as Record<string, unknown>;
    if (typeof step.order !== 'number') {
      errors.push(`steps[${i}]: missing "order" number`);
    }
    if (typeof step.description !== 'string') {
      errors.push(`steps[${i}]: missing "description" string`);
    }
  }
  return errors;
}

function validateReview(data: unknown): string[] {
  const errors: string[] = [];
  if (!data || typeof data !== 'object') {
    errors.push('Review must be an object');
    return errors;
  }
  const obj = data as Record<string, unknown>;
  if (!Array.isArray(obj.comments)) {
    errors.push('Review must have a "comments" array');
    return errors;
  }
  for (let i = 0; i < obj.comments.length; i++) {
    const comment = obj.comments[i] as Record<string, unknown>;
    if (typeof comment.file !== 'string') {
      errors.push(`comments[${i}]: missing "file" string`);
    }
    if (typeof comment.line !== 'number') {
      errors.push(`comments[${i}]: missing "line" number`);
    }
    if (!['info', 'warning', 'error', 'security'].includes(comment.severity as string)) {
      errors.push(`comments[${i}]: invalid "severity"`);
    }
    if (typeof comment.message !== 'string') {
      errors.push(`comments[${i}]: missing "message" string`);
    }
  }
  if (typeof obj.summary !== 'string') {
    errors.push('Review must have a "summary" string');
  }
  if (typeof obj.approved !== 'boolean') {
    errors.push('Review must have an "approved" boolean');
  }
  return errors;
}

// ---------------------------------------------------------------------------
// Repair
// ---------------------------------------------------------------------------

/** Attempt to repair malformed output */
export function repairOutput(raw: string, format: OutputFormat): string {
  switch (format) {
    case 'search_replace':
      return repairSearchReplace(raw);
    case 'json_changeset':
    case 'plan':
    case 'review':
      return repairJsonOutput(raw);
    default:
      return raw;
  }
}

function repairSearchReplace(raw: string): string {
  let repaired = raw;

  // Fix common delimiter typos
  repaired = repaired.replace(/<<<<<<\s*SEARCH/g, '<<<<<<< SEARCH');
  repaired = repaired.replace(/>>>>>>>\s*REPLACE/g, '>>>>>>> REPLACE');
  repaired = repaired.replace(/={5,}/g, '=======');

  // If we see code diff markers without proper labels, add them
  repaired = repaired.replace(/^<<<<<<<\s*$/gm, '<<<<<<< SEARCH');
  repaired = repaired.replace(/^>>>>>>>\s*$/gm, '>>>>>>> REPLACE');

  // Handle ``` SEARCH / ``` REPLACE style
  repaired = repaired.replace(/```\s*SEARCH\s*\n/g, '<<<<<<< SEARCH\n');
  repaired = repaired.replace(/```\s*REPLACE\s*\n/g, '>>>>>>> REPLACE\n');
  repaired = repaired.replace(/```\s*DIVIDER\s*\n/g, '=======\n');

  // If there's an unclosed block (SEARCH without REPLACE), try to close it
  const searchCount = (repaired.match(/<<<<<<< SEARCH/g) || []).length;
  const replaceCount = (repaired.match(/>>>>>>> REPLACE/g) || []).length;
  const dividerCount = (repaired.match(/^=======$/gm) || []).length;

  if (searchCount > replaceCount) {
    // Missing REPLACE closer — add it at the end
    if (dividerCount >= searchCount) {
      repaired = repaired.trimEnd() + '\n>>>>>>> REPLACE\n';
    } else {
      repaired = repaired.trimEnd() + '\n=======\n>>>>>>> REPLACE\n';
    }
  }

  return repaired;
}

function repairJsonOutput(raw: string): string {
  const jsonStr = extractJson(raw) || raw;
  return repairJson(jsonStr);
}

function repairJson(jsonStr: string): string {
  let repaired = jsonStr.trim();

  // Remove trailing commas before closing braces/brackets
  repaired = repaired.replace(/,\s*([}\]])/g, '$1');

  // Fix unescaped newlines in strings (common AI mistake)
  repaired = repaired.replace(/(?<=": "(?:[^"\\]|\\.)*)(?<!\\)\n(?=(?:[^"\\]|\\.)*")/g, '\\n');

  // Balance braces
  const openBraces = (repaired.match(/{/g) || []).length;
  const closeBraces = (repaired.match(/}/g) || []).length;
  const openBrackets = (repaired.match(/\[/g) || []).length;
  const closeBrackets = (repaired.match(/]/g) || []).length;

  // Add missing closing braces/brackets
  for (let i = 0; i < openBrackets - closeBrackets; i++) {
    repaired += ']';
  }
  for (let i = 0; i < openBraces - closeBraces; i++) {
    repaired += '}';
  }

  // Remove any text after the last valid closing brace/bracket
  const lastClose = Math.max(repaired.lastIndexOf('}'), repaired.lastIndexOf(']'));
  if (lastClose > 0) {
    const afterClose = repaired.slice(lastClose + 1).trim();
    if (afterClose && !afterClose.startsWith(',') && !afterClose.startsWith('}') && !afterClose.startsWith(']')) {
      repaired = repaired.slice(0, lastClose + 1);
    }
  }

  return repaired;
}

// ---------------------------------------------------------------------------
// SEARCH/REPLACE block parsing
// ---------------------------------------------------------------------------

/** Parse SEARCH/REPLACE blocks from AI output, handling multiple delimiter styles */
export function parseSearchReplaceBlocks(raw: string): SearchReplaceBlock[] {
  const blocks: SearchReplaceBlock[] = [];

  // Style 1: <<<<<<< SEARCH / ======= / >>>>>>> REPLACE
  const style1Regex = /(?:---\s*(.+?)\s*\n)?<<<<<<< SEARCH\n([\s\S]*?)\n=======\n([\s\S]*?)\n>>>>>>> REPLACE/g;
  let match: RegExpExecArray | null;

  match = style1Regex.exec(raw);
  while (match !== null) {
    blocks.push({
      filePath: match[1]?.trim() || undefined,
      search: match[2],
      replace: match[3],
    });
    match = style1Regex.exec(raw);
  }

  if (blocks.length > 0) return blocks;

  // Style 2: ```SEARCH / ``` / ```REPLACE / ```
  const style2Regex = /(?:---\s*(.+?)\s*\n)?```\s*(?:SEARCH|search)\s*\n([\s\S]*?)\n```\s*\n```\s*(?:REPLACE|replace)\s*\n([\s\S]*?)\n```/g;

  match = style2Regex.exec(raw);
  while (match !== null) {
    blocks.push({
      filePath: match[1]?.trim() || undefined,
      search: match[2],
      replace: match[3],
    });
    match = style2Regex.exec(raw);
  }

  if (blocks.length > 0) return blocks;

  // Style 3: [SEARCH] / [/SEARCH] / [REPLACE] / [/REPLACE]
  const style3Regex = /(?:\[FILE:\s*(.+?)\]\s*\n)?\[SEARCH\]\s*\n([\s\S]*?)\n\[\/SEARCH\]\s*\n\[REPLACE\]\s*\n([\s\S]*?)\n\[\/REPLACE\]/g;

  match = style3Regex.exec(raw);
  while (match !== null) {
    blocks.push({
      filePath: match[1]?.trim() || undefined,
      search: match[2],
      replace: match[3],
    });
    match = style3Regex.exec(raw);
  }

  if (blocks.length > 0) return blocks;

  // Style 4: <SEARCH> / </SEARCH> / <REPLACE> / </REPLACE>
  const style4Regex = /(?:<FILE>(.+?)<\/FILE>\s*\n)?<SEARCH>\s*\n([\s\S]*?)\n<\/SEARCH>\s*\n<REPLACE>\s*\n([\s\S]*?)\n<\/REPLACE>/g;

  match = style4Regex.exec(raw);
  while (match !== null) {
    blocks.push({
      filePath: match[1]?.trim() || undefined,
      search: match[2],
      replace: match[3],
    });
    match = style4Regex.exec(raw);
  }

  return blocks;
}

/** Validate that SEARCH blocks actually exist in the target file content */
export function validateSearchBlocks(
  blocks: SearchReplaceBlock[],
  fileContents: Map<string, string>
): { valid: SearchReplaceBlock[]; invalid: { block: SearchReplaceBlock; reason: string }[] } {
  const valid: SearchReplaceBlock[] = [];
  const invalid: { block: SearchReplaceBlock; reason: string }[] = [];

  for (const block of blocks) {
    if (!block.filePath) {
      // If no file path, we can't validate — assume valid
      valid.push(block);
      continue;
    }

    const content = fileContents.get(block.filePath);
    if (content === undefined) {
      invalid.push({ block, reason: `File not found: ${block.filePath}` });
      continue;
    }

    // Exact match
    if (content.includes(block.search)) {
      valid.push(block);
      continue;
    }

    // Fuzzy match: normalize whitespace
    if (normalizedIncludes(content, block.search)) {
      valid.push(block);
      continue;
    }

    // Fuzzy match: trimmed lines
    if (trimmedLinesMatch(content, block.search)) {
      valid.push(block);
      continue;
    }

    invalid.push({
      block,
      reason: `SEARCH text not found in ${block.filePath} (even with whitespace normalization)`,
    });
  }

  return { valid, invalid };
}

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------

function extractJson(raw: string): string | null {
  // Try to find JSON in code fences first
  const fenceMatch = raw.match(/```(?:json)?\s*\n([\s\S]*?)\n```/);
  if (fenceMatch) return fenceMatch[1].trim();

  // Try to find a top-level JSON object or array
  const objectMatch = raw.match(/(\{[\s\S]*\})/);
  if (objectMatch) return objectMatch[1].trim();

  const arrayMatch = raw.match(/(\[[\s\S]*\])/);
  if (arrayMatch) return arrayMatch[1].trim();

  return null;
}

function stripCodeFences(raw: string): string {
  const match = raw.match(/```(?:\w+)?\s*\n([\s\S]*?)\n```/);
  if (match) return match[1];
  // If no fences, return as-is (might be raw code)
  return raw.trim();
}

function normalizeWhitespace(str: string): string {
  return str.replace(/[ \t]+/g, ' ').replace(/\r\n/g, '\n').trim();
}

function normalizedIncludes(content: string, search: string): boolean {
  return normalizeWhitespace(content).includes(normalizeWhitespace(search));
}

function trimmedLinesMatch(content: string, search: string): boolean {
  const contentLines = content.split('\n').map((l) => l.trim());
  const searchLines = search.split('\n').map((l) => l.trim());

  if (searchLines.length === 0) return false;

  // Sliding window match
  for (let i = 0; i <= contentLines.length - searchLines.length; i++) {
    let matches = true;
    for (let j = 0; j < searchLines.length; j++) {
      if (contentLines[i + j] !== searchLines[j]) {
        matches = false;
        break;
      }
    }
    if (matches) return true;
  }
  return false;
}
