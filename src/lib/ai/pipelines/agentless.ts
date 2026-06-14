/**
 * Agentless Pipeline — fixed-step pipeline for weaker models.
 *
 * Based on the Agentless paper (UIUC): achieves competitive results WITHOUT
 * an agent loop by using a structured 3-phase pipeline:
 * 1. LOCALIZE: Find relevant files/functions
 * 2. REPAIR: Generate multiple candidate patches
 * 3. VALIDATE: Filter patches using automated checks
 *
 * This is optimal for models that struggle with multi-turn reasoning
 * (GPT-4o-mini, Llama 8B, Phi-4, etc.)
 *
 * Phase 3.8 of the quality amplification system.
 */

import { chat, type AIMessage, type ChatOptions } from "@/lib/ai/provider";
import { buildRepoMap } from "@/lib/search/repo-map";
import {
  parseSearchReplaceBlocks,
  validateSearchBlocks,
  type SearchReplaceBlock,
} from "@/lib/ai/output-schema";
import { compressFile } from "@/lib/ai/context-compressor";
import { readFile } from "@/lib/storage";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type AgentlessOptions = {
  task: string;
  projectId: string;
  storageKey: string;

  // Model config
  modelId?: string;
  provider?: string;
  workspaceId?: string;

  // Pipeline config
  candidates?: number;
  maxLocalizationDepth?: number;
  validateWithTests?: boolean;
  testCommand?: string;

  // Callbacks
  onPhase?: (phase: "localize" | "repair" | "validate", detail: string) => void;
  signal?: AbortSignal;
};

export type AgentlessResult = {
  success: boolean;
  patch: SearchReplaceBlock[] | null;
  candidates: CandidateResult[];
  localization: LocalizationResult;
  phases: PhaseRecord[];
};

export type CandidateResult = {
  patch: SearchReplaceBlock[];
  score: number;
  validationResult: string;
};

export type LocalizationResult = {
  files: string[];
  functions: string[];
  lines: { file: string; start: number; end: number }[];
};

type PhaseRecord = {
  name: string;
  durationMs: number;
  output: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_CANDIDATES = 3;
const DEFAULT_MAX_LOCALIZATION_DEPTH = 3;
const CANDIDATE_TEMPERATURES = [0.2, 0.4, 0.6, 0.8, 1.0];
const MAX_FILES_LEVEL1 = 10;
const MAX_FUNCTIONS_LEVEL2 = 15;

// ─────────────────────────────────────────────────────────────────────────────
// Main Pipeline
// ─────────────────────────────────────────────────────────────────────────────

/** Run the agentless pipeline */
export async function runAgentlessPipeline(
  options: AgentlessOptions
): Promise<AgentlessResult> {
  const {
    task,
    projectId,
    storageKey,
    modelId,
    provider,
    workspaceId,
    candidates: numCandidates = DEFAULT_CANDIDATES,
    maxLocalizationDepth = DEFAULT_MAX_LOCALIZATION_DEPTH,
    validateWithTests = false,
    testCommand,
    onPhase,
    signal,
  } = options;

  const phases: PhaseRecord[] = [];
  const chatOpts: ChatOptions = {
    model: modelId,
    provider,
    workspaceId,
    signal,
  };

  // ─── Phase 1: LOCALIZE ──────────────────────────────────────────────────
  onPhase?.("localize", "Starting localization phase");
  const localizeStart = Date.now();

  const localization = await runLocalization({
    task,
    projectId,
    storageKey,
    chatOpts,
    maxDepth: maxLocalizationDepth,
    signal,
    onPhase,
  });

  phases.push({
    name: "localize",
    durationMs: Date.now() - localizeStart,
    output: `Found ${localization.files.length} files, ${localization.functions.length} functions, ${localization.lines.length} line ranges`,
  });

  // ─── Phase 2: REPAIR ───────────────────────────────────────────────────
  onPhase?.("repair", `Generating ${numCandidates} candidate patches`);
  const repairStart = Date.now();

  const rawCandidates = await runRepair({
    task,
    storageKey,
    localization,
    chatOpts,
    numCandidates,
    signal,
  });

  phases.push({
    name: "repair",
    durationMs: Date.now() - repairStart,
    output: `Generated ${rawCandidates.length} candidate patches`,
  });

  // ─── Phase 3: VALIDATE ─────────────────────────────────────────────────
  onPhase?.("validate", "Validating and ranking candidates");
  const validateStart = Date.now();

  const validatedCandidates = await runValidation({
    candidates: rawCandidates,
    storageKey,
    validateWithTests,
    testCommand,
    signal,
  });

  // Sort by score descending
  validatedCandidates.sort((a, b) => b.score - a.score);

  phases.push({
    name: "validate",
    durationMs: Date.now() - validateStart,
    output: `Best score: ${validatedCandidates[0]?.score.toFixed(2) ?? "N/A"}`,
  });

  // ─── Select best candidate ─────────────────────────────────────────────
  const bestCandidate = validatedCandidates.find((c) => c.score > 0) ?? null;

  return {
    success: bestCandidate !== null && bestCandidate.score >= 0.3,
    patch: bestCandidate?.patch ?? null,
    candidates: validatedCandidates,
    localization,
    phases,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 1: LOCALIZE
// ─────────────────────────────────────────────────────────────────────────────

type LocalizationInput = {
  task: string;
  projectId: string;
  storageKey: string;
  chatOpts: ChatOptions;
  maxDepth: number;
  signal?: AbortSignal;
  onPhase?: AgentlessOptions["onPhase"];
};

async function runLocalization(input: LocalizationInput): Promise<LocalizationResult> {
  const { task, projectId, storageKey, chatOpts, maxDepth, onPhase } = input;

  // ─── Level 1: File-level localization ─────────────────────────────────
  onPhase?.("localize", "Level 1: Identifying relevant files");

  const repoMap = await buildRepoMap(projectId, storageKey);

  const level1Messages: AIMessage[] = [
    {
      role: "system",
      content: LOCALIZE_LEVEL1_SYSTEM,
    },
    {
      role: "user",
      content: buildLevel1Prompt(task, repoMap),
    },
  ];

  const level1Response = await chat(level1Messages, {
    ...chatOpts,
    temperature: 0.1,
  });

  const files = parseFileList(level1Response, MAX_FILES_LEVEL1);

  if (maxDepth < 2 || files.length === 0) {
    return { files, functions: [], lines: [] };
  }

  // ─── Level 2: Function-level localization ─────────────────────────────
  onPhase?.("localize", "Level 2: Identifying relevant functions/classes");

  const fileContents = await loadFileContents(storageKey, files);
  const compressedFiles = compressFilesForLevel2(fileContents);

  const level2Messages: AIMessage[] = [
    {
      role: "system",
      content: LOCALIZE_LEVEL2_SYSTEM,
    },
    {
      role: "user",
      content: buildLevel2Prompt(task, compressedFiles),
    },
  ];

  const level2Response = await chat(level2Messages, {
    ...chatOpts,
    temperature: 0.1,
  });

  const functions = parseFunctionList(level2Response, MAX_FUNCTIONS_LEVEL2);

  if (maxDepth < 3 || functions.length === 0) {
    return { files, functions, lines: [] };
  }

  // ─── Level 3: Line-level localization ─────────────────────────────────
  onPhase?.("localize", "Level 3: Identifying specific line ranges");

  const relevantCode = extractFunctionCode(fileContents, functions);

  const level3Messages: AIMessage[] = [
    {
      role: "system",
      content: LOCALIZE_LEVEL3_SYSTEM,
    },
    {
      role: "user",
      content: buildLevel3Prompt(task, relevantCode),
    },
  ];

  const level3Response = await chat(level3Messages, {
    ...chatOpts,
    temperature: 0.1,
  });

  const lines = parseLineRanges(level3Response);

  return { files, functions, lines };
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 2: REPAIR
// ─────────────────────────────────────────────────────────────────────────────

type RepairInput = {
  task: string;
  storageKey: string;
  localization: LocalizationResult;
  chatOpts: ChatOptions;
  numCandidates: number;
  signal?: AbortSignal;
};

async function runRepair(input: RepairInput): Promise<SearchReplaceBlock[][]> {
  const { task, storageKey, localization, chatOpts, numCandidates, signal } = input;

  // Load the localized code for the repair prompt
  const fileContents = await loadFileContents(storageKey, localization.files);
  const localizedCode = buildLocalizedContext(fileContents, localization);

  // Generate N candidates with different temperatures
  const candidatePromises: Promise<SearchReplaceBlock[]>[] = [];

  for (let i = 0; i < numCandidates; i++) {
    const temperature = CANDIDATE_TEMPERATURES[i % CANDIDATE_TEMPERATURES.length];

    candidatePromises.push(
      generateCandidate({
        task,
        localizedCode,
        chatOpts,
        temperature,
        candidateIndex: i,
        signal,
      })
    );
  }

  // Run candidates in parallel (they're independent)
  const results = await Promise.allSettled(candidatePromises);

  return results
    .filter(
      (r): r is PromiseFulfilledResult<SearchReplaceBlock[]> => r.status === "fulfilled"
    )
    .map((r) => r.value)
    .filter((blocks) => blocks.length > 0);
}

type CandidateInput = {
  task: string;
  localizedCode: string;
  chatOpts: ChatOptions;
  temperature: number;
  candidateIndex: number;
  signal?: AbortSignal;
};

async function generateCandidate(input: CandidateInput): Promise<SearchReplaceBlock[]> {
  const { task, localizedCode, chatOpts, temperature, candidateIndex, signal } = input;

  const messages: AIMessage[] = [
    {
      role: "system",
      content: REPAIR_SYSTEM_PROMPT,
    },
    {
      role: "user",
      content: buildRepairPrompt(task, localizedCode, candidateIndex),
    },
  ];

  const response = await chat(messages, {
    ...chatOpts,
    temperature,
    signal,
  });

  return parseSearchReplaceBlocks(response);
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 3: VALIDATE
// ─────────────────────────────────────────────────────────────────────────────

type ValidationInput = {
  candidates: SearchReplaceBlock[][];
  storageKey: string;
  validateWithTests: boolean;
  testCommand?: string;
  signal?: AbortSignal;
};

async function runValidation(input: ValidationInput): Promise<CandidateResult[]> {
  const { candidates, storageKey, validateWithTests, testCommand } = input;

  const results: CandidateResult[] = [];

  for (const candidateBlocks of candidates) {
    const result = await validateCandidate(candidateBlocks, storageKey, {
      validateWithTests,
      testCommand,
    });
    results.push(result);
  }

  return results;
}

async function validateCandidate(
  blocks: SearchReplaceBlock[],
  storageKey: string,
  opts: { validateWithTests: boolean; testCommand?: string }
): Promise<CandidateResult> {
  if (blocks.length === 0) {
    return {
      patch: blocks,
      score: 0,
      validationResult: "Empty patch — no SEARCH/REPLACE blocks generated",
    };
  }

  const validationDetails: string[] = [];
  let searchFoundScore = 0;
  let syntaxValidScore = 0;
  let testsPassScore = 0;

  // ─── Step 1: Validate SEARCH text exists in files ─────────────────────
  const filePathSet = new Set<string>();
  for (const b of blocks) {
    if (b.filePath) filePathSet.add(b.filePath);
  }
  const filePaths = Array.from(filePathSet);
  const fileContents = new Map<string, string>();

  for (const fp of filePaths) {
    try {
      const content = await readFile(storageKey, fp);
      if (content !== null) {
        fileContents.set(fp, content);
      }
    } catch {
      // File not found — will be caught by validation
    }
  }

  const { valid, invalid } = validateSearchBlocks(blocks, fileContents);

  if (blocks.length > 0) {
    searchFoundScore = valid.length / blocks.length;
  }

  if (invalid.length > 0) {
    validationDetails.push(
      `SEARCH validation: ${valid.length}/${blocks.length} blocks matched. ` +
        `Failed: ${invalid.map((i) => i.reason).join("; ")}`
    );
  } else {
    validationDetails.push(`SEARCH validation: All ${blocks.length} blocks matched`);
  }

  // ─── Step 2: Apply patch (dry run) and check syntax ───────────────────
  const patchResults = applyPatchDryRun(valid, fileContents);

  if (patchResults.allValid) {
    syntaxValidScore = 1.0;
    validationDetails.push("Syntax validation: All patched files have valid syntax");
  } else {
    syntaxValidScore = patchResults.validCount / Math.max(patchResults.totalCount, 1);
    validationDetails.push(
      `Syntax validation: ${patchResults.validCount}/${patchResults.totalCount} files valid. ` +
        `Errors: ${patchResults.errors.join("; ")}`
    );
  }

  // ─── Step 3: Run tests (optional) ────────────────────────────────────
  if (opts.validateWithTests && opts.testCommand) {
    // Test execution is deferred to the caller's environment
    // For now, we give a neutral score if tests aren't run
    testsPassScore = 0.5;
    validationDetails.push("Test validation: Deferred (test execution not available in pipeline)");
  } else {
    // No tests configured — use neutral weight
    testsPassScore = 0.5;
    validationDetails.push("Test validation: Skipped (not configured)");
  }

  // ─── Compute final score ──────────────────────────────────────────────
  const score =
    searchFoundScore * 0.3 + syntaxValidScore * 0.3 + testsPassScore * 0.4;

  return {
    patch: blocks,
    score,
    validationResult: validationDetails.join("\n"),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Dry-run patch application
// ─────────────────────────────────────────────────────────────────────────────

type PatchDryRunResult = {
  allValid: boolean;
  validCount: number;
  totalCount: number;
  errors: string[];
  patchedContents: Map<string, string>;
};

function applyPatchDryRun(
  blocks: SearchReplaceBlock[],
  fileContents: Map<string, string>
): PatchDryRunResult {
  const patchedContents = new Map<string, string>();
  const errors: string[] = [];
  let validCount = 0;

  // Group blocks by file
  const blocksByFile = new Map<string, SearchReplaceBlock[]>();
  for (const block of blocks) {
    const fp = block.filePath ?? "";
    const existing = blocksByFile.get(fp);
    if (existing) {
      existing.push(block);
    } else {
      blocksByFile.set(fp, [block]);
    }
  }

  const entries = Array.from(blocksByFile.entries());
  for (const [filePath, fileBlocks] of entries) {
    let content = fileContents.get(filePath);
    if (content === undefined) {
      errors.push(`File not found: ${filePath}`);
      continue;
    }

    // Apply each block sequentially
    let applyFailed = false;
    for (const block of fileBlocks) {
      const idx = content.indexOf(block.search);
      if (idx === -1) {
        // Try normalized match
        const normalizedIdx = fuzzyFindInContent(content, block.search);
        if (normalizedIdx === -1) {
          errors.push(`Cannot apply block in ${filePath}: SEARCH text not found`);
          applyFailed = true;
          break;
        }
        // Apply with fuzzy match — use the length of the matched region
        const matchLen = findMatchLength(content, normalizedIdx, block.search);
        content = content.slice(0, normalizedIdx) + block.replace + content.slice(normalizedIdx + matchLen);
      } else {
        content = content.slice(0, idx) + block.replace + content.slice(idx + block.search.length);
      }
    }

    if (!applyFailed) {
      // Basic syntax validation: check for balanced braces/brackets
      const syntaxOk = basicSyntaxCheck(content, filePath);
      if (syntaxOk) {
        validCount++;
        patchedContents.set(filePath, content);
      } else {
        errors.push(`Syntax error in patched ${filePath}`);
      }
    }
  }

  const totalCount = blocksByFile.size;

  return {
    allValid: validCount === totalCount && errors.length === 0,
    validCount,
    totalCount,
    errors,
    patchedContents,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: Fuzzy content matching
// ─────────────────────────────────────────────────────────────────────────────

function fuzzyFindInContent(content: string, search: string): number {
  // Normalize whitespace for comparison
  const normalizeWs = (s: string) => s.replace(/\s+/g, " ").trim();
  const normalizedContent = normalizeWs(content);
  const normalizedSearch = normalizeWs(search);

  const idx = normalizedContent.indexOf(normalizedSearch);
  if (idx === -1) return -1;

  // Map back to original content position
  let normalizedPos = 0;
  let originalPos = 0;

  while (normalizedPos < idx && originalPos < content.length) {
    const ch = content[originalPos];
    if (/\s/.test(ch)) {
      // Skip consecutive whitespace (counts as single space in normalized)
      while (originalPos < content.length && /\s/.test(content[originalPos])) {
        originalPos++;
      }
      normalizedPos++; // One space in normalized
    } else {
      originalPos++;
      normalizedPos++;
    }
  }

  return originalPos;
}

function findMatchLength(content: string, startIdx: number, search: string): number {
  // Find how many characters in the original content correspond to the search text
  const normalizeWs = (s: string) => s.replace(/\s+/g, " ").trim();
  const normalizedSearch = normalizeWs(search);
  const targetLen = normalizedSearch.length;

  let normalizedPos = 0;
  let originalPos = startIdx;

  while (normalizedPos < targetLen && originalPos < content.length) {
    const ch = content[originalPos];
    if (/\s/.test(ch)) {
      while (originalPos < content.length && /\s/.test(content[originalPos])) {
        originalPos++;
      }
      normalizedPos++;
    } else {
      originalPos++;
      normalizedPos++;
    }
  }

  return originalPos - startIdx;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: Basic syntax validation
// ─────────────────────────────────────────────────────────────────────────────

function basicSyntaxCheck(content: string, filePath: string): boolean {
  const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
  const bracketLanguages = ["ts", "tsx", "js", "jsx", "java", "c", "cpp", "cs", "go", "rs"];

  if (!bracketLanguages.includes(ext)) {
    // For non-bracket languages, just check it's not empty
    return content.trim().length > 0;
  }

  // Check balanced braces, brackets, and parentheses
  const stack: string[] = [];
  const pairs: Record<string, string> = { "}": "{", "]": "[", ")": "(" };
  const openers = new Set(["{", "[", "("]);
  const closers = new Set(["}", "]", ")"]);

  let inString = false;
  let stringChar = "";
  let inLineComment = false;
  let inBlockComment = false;
  let prevChar = "";

  for (let i = 0; i < content.length; i++) {
    const ch = content[i];
    const nextCh = i + 1 < content.length ? content[i + 1] : "";

    // Handle comments
    if (!inString && !inBlockComment && ch === "/" && nextCh === "/") {
      inLineComment = true;
      continue;
    }
    if (inLineComment && ch === "\n") {
      inLineComment = false;
      continue;
    }
    if (inLineComment) continue;

    if (!inString && !inLineComment && ch === "/" && nextCh === "*") {
      inBlockComment = true;
      i++;
      continue;
    }
    if (inBlockComment && ch === "*" && nextCh === "/") {
      inBlockComment = false;
      i++;
      continue;
    }
    if (inBlockComment) continue;

    // Handle strings
    if (!inString && (ch === '"' || ch === "'" || ch === "`")) {
      inString = true;
      stringChar = ch;
      continue;
    }
    if (inString && ch === stringChar && prevChar !== "\\") {
      inString = false;
      continue;
    }
    if (inString) {
      prevChar = ch;
      continue;
    }

    // Check brackets
    if (openers.has(ch)) {
      stack.push(ch);
    } else if (closers.has(ch)) {
      const expected = pairs[ch];
      if (stack.length === 0 || stack[stack.length - 1] !== expected) {
        return false;
      }
      stack.pop();
    }

    prevChar = ch;
  }

  return stack.length === 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: File loading and compression
// ─────────────────────────────────────────────────────────────────────────────

async function loadFileContents(
  storageKey: string,
  files: string[]
): Promise<Map<string, string>> {
  const contents = new Map<string, string>();

  const results = await Promise.allSettled(
    files.map(async (fp) => {
      const content = await readFile(storageKey, fp);
      return { fp, content };
    })
  );

  for (const result of results) {
    if (result.status === "fulfilled" && result.value.content !== null) {
      contents.set(result.value.fp, result.value.content);
    }
  }

  return contents;
}

function compressFilesForLevel2(
  fileContents: Map<string, string>
): { path: string; compressed: string }[] {
  const result: { path: string; compressed: string }[] = [];
  const entries = Array.from(fileContents.entries());

  for (const [filePath, content] of entries) {
    const compressed = compressFile(content, filePath, {
      level: "skeleton",
      maxChars: 3000,
    });
    result.push({ path: filePath, compressed: compressed.content });
  }

  return result;
}

function extractFunctionCode(
  fileContents: Map<string, string>,
  functions: string[]
): { name: string; file: string; code: string }[] {
  const results: { name: string; file: string; code: string }[] = [];
  const entries = Array.from(fileContents.entries());

  for (const funcRef of functions) {
    // funcRef format: "file:functionName" or just "functionName"
    const colonIdx = funcRef.indexOf(":");
    const fileOrFunc = colonIdx !== -1 ? funcRef.slice(0, colonIdx) : "";
    const funcName = colonIdx !== -1 ? funcRef.slice(colonIdx + 1) : funcRef;

    for (const [filePath, content] of entries) {
      if (fileOrFunc && !filePath.includes(fileOrFunc)) continue;

      const extracted = extractFunction(content, funcName);
      if (extracted) {
        results.push({ name: funcName, file: filePath, code: extracted });
        break;
      }
    }
  }

  return results;
}

function extractFunction(content: string, funcName: string): string | null {
  const lines = content.split("\n");
  let startLine = -1;

  // Find function start
  const escapedName = escapeRegex(funcName);
  const patterns = [
    new RegExp(`\\bfunction\\s+${escapedName}\\b`),
    new RegExp(`\\b${escapedName}\\s*=`),
    new RegExp(`\\b${escapedName}\\s*\\(`),
    new RegExp(`\\b${escapedName}\\s*[(<]`),
  ];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (patterns.some((p) => p.test(line))) {
      startLine = i;
      break;
    }
  }

  if (startLine === -1) return null;

  // Find function end by tracking braces
  let braceDepth = 0;
  let foundOpenBrace = false;

  for (let i = startLine; i < lines.length; i++) {
    const line = lines[i];
    for (const ch of line) {
      if (ch === "{") {
        braceDepth++;
        foundOpenBrace = true;
      } else if (ch === "}") {
        braceDepth--;
        if (foundOpenBrace && braceDepth === 0) {
          return lines.slice(startLine, i + 1).join("\n");
        }
      }
    }
  }

  // If we couldn't find balanced braces, return a reasonable chunk
  const endLine = Math.min(startLine + 50, lines.length - 1);
  return lines.slice(startLine, endLine + 1).join("\n");
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: Build localized context for repair
// ─────────────────────────────────────────────────────────────────────────────

function buildLocalizedContext(
  fileContents: Map<string, string>,
  localization: LocalizationResult
): string {
  const sections: string[] = [];

  // If we have line-level localization, show only those ranges
  if (localization.lines.length > 0) {
    for (const range of localization.lines) {
      const content = fileContents.get(range.file);
      if (!content) continue;

      const lines = content.split("\n");
      // Include some context around the range
      const contextPadding = 5;
      const start = Math.max(0, range.start - contextPadding - 1);
      const end = Math.min(lines.length, range.end + contextPadding);

      const snippet = lines
        .slice(start, end)
        .map((line, idx) => `${start + idx + 1} | ${line}`)
        .join("\n");

      sections.push(`### ${range.file} (lines ${range.start}-${range.end})\n\`\`\`\n${snippet}\n\`\`\``);
    }
  } else if (localization.functions.length > 0) {
    // Show function-level code
    const functionCode = extractFunctionCode(fileContents, localization.functions);
    for (const { name, file, code } of functionCode) {
      sections.push(`### ${file} — ${name}\n\`\`\`\n${code}\n\`\`\``);
    }
  } else {
    // Show compressed file contents
    const entries = Array.from(fileContents.entries());
    for (const [filePath, content] of entries) {
      const compressed = compressFile(content, filePath, {
        level: "skeleton",
        maxChars: 4000,
      });
      sections.push(`### ${filePath}\n\`\`\`\n${compressed.content}\n\`\`\``);
    }
  }

  return sections.join("\n\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// Parsing helpers
// ─────────────────────────────────────────────────────────────────────────────

function parseFileList(response: string, maxFiles: number): string[] {
  const files: string[] = [];
  const lines = response.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();
    // Match patterns like: "- src/lib/foo.ts", "1. src/lib/foo.ts", "src/lib/foo.ts"
    const match = trimmed.match(
      /^(?:[-*•]\s*|\d+[.)]\s*)?[`"]?([^\s`"]+\.[a-zA-Z]{1,10})[`"]?/
    );
    if (match && match[1]) {
      const filePath = match[1].replace(/^\//, "");
      if (!files.includes(filePath)) {
        files.push(filePath);
      }
    }
    if (files.length >= maxFiles) break;
  }

  return files;
}

function parseFunctionList(response: string, maxFunctions: number): string[] {
  const functions: string[] = [];
  const lines = response.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();
    // Match patterns like: "- file.ts:functionName", "functionName", "file.ts:ClassName.method"
    const match = trimmed.match(
      /^(?:[-*•]\s*|\d+[.)]\s*)?[`"]?([^\s`"]+(?::[^\s`"]+)?)[`"]?/
    );
    if (match && match[1] && !match[1].startsWith("//") && !match[1].startsWith("#")) {
      const funcRef = match[1];
      // Filter out obvious non-function entries
      if (funcRef.length > 1 && !funcRef.startsWith("http") && !functions.includes(funcRef)) {
        functions.push(funcRef);
      }
    }
    if (functions.length >= maxFunctions) break;
  }

  return functions;
}

function parseLineRanges(response: string): { file: string; start: number; end: number }[] {
  const ranges: { file: string; start: number; end: number }[] = [];
  const lines = response.split("\n");

  for (const line of lines) {
    // Match patterns like: "file.ts:10-25", "file.ts lines 10-25", "file.ts:10:25"
    const match = line.match(
      /([^\s:]+\.[a-zA-Z]{1,10})(?::|\s+lines?\s+)(\d+)[-\u2013:]\s*(\d+)/
    );
    if (match) {
      ranges.push({
        file: match[1],
        start: parseInt(match[2], 10),
        end: parseInt(match[3], 10),
      });
    }
  }

  return ranges;
}

// ─────────────────────────────────────────────────────────────────────────────
// Prompt templates
// ─────────────────────────────────────────────────────────────────────────────

const LOCALIZE_LEVEL1_SYSTEM = `You are a code localization expert. Your job is to identify which files in a repository are most likely to need changes for a given task.

Rules:
- Output ONLY a list of file paths, one per line
- Use the format: - path/to/file.ext
- List 5-10 most relevant files, ordered by relevance
- Do NOT explain your reasoning
- Do NOT include files that are unlikely to need changes
- Focus on implementation files, not test files (unless the task is about tests)`;

const LOCALIZE_LEVEL2_SYSTEM = `You are a code localization expert. Given file contents, identify which specific functions, classes, or methods need to be modified.

Rules:
- Output ONLY a list of function/class references, one per line
- Use the format: - filename:functionName or - filename:ClassName.methodName
- List the most relevant items, ordered by relevance
- Do NOT explain your reasoning
- Focus on the specific code that needs changes`;

const LOCALIZE_LEVEL3_SYSTEM = `You are a code localization expert. Given specific functions/code, identify the exact line ranges that need modification.

Rules:
- Output ONLY line ranges, one per line
- Use the format: filename:startLine-endLine
- Be precise — identify only the lines that need changes
- Include a few lines of context around the change point
- Do NOT explain your reasoning`;

const REPAIR_SYSTEM_PROMPT = `You are a code repair expert. Generate a patch to fix/implement the requested change.

Output your changes using SEARCH/REPLACE blocks:

<<<<<<< SEARCH
exact code to find (must match the file exactly)
=======
replacement code
>>>>>>> REPLACE

Rules:
- Each SEARCH/REPLACE block must start with the file path on its own line: \`filepath: path/to/file.ext\`
- The SEARCH section must contain EXACT text from the file (including whitespace)
- Keep changes minimal — only modify what's necessary
- You may output multiple SEARCH/REPLACE blocks for different files or locations
- Do NOT include explanations outside the blocks`;

function buildLevel1Prompt(task: string, repoMap: string): string {
  return `## Task
${task}

## Repository Structure
${repoMap}

## Instructions
Which files are most likely to need changes for this task? List them below:`;
}

function buildLevel2Prompt(
  task: string,
  compressedFiles: { path: string; compressed: string }[]
): string {
  const fileSection = compressedFiles
    .map((f) => `### ${f.path}\n\`\`\`\n${f.compressed}\n\`\`\``)
    .join("\n\n");

  return `## Task
${task}

## File Contents (compressed)
${fileSection}

## Instructions
Which specific functions, classes, or methods need to be modified? List them below:`;
}

function buildLevel3Prompt(
  task: string,
  relevantCode: { name: string; file: string; code: string }[]
): string {
  const codeSection = relevantCode
    .map((f) => `### ${f.file} — ${f.name}\n\`\`\`\n${f.code}\n\`\`\``)
    .join("\n\n");

  return `## Task
${task}

## Relevant Code
${codeSection}

## Instructions
Which exact line ranges need to be modified? Use format: filename:startLine-endLine`;
}

function buildRepairPrompt(task: string, localizedCode: string, candidateIndex: number): string {
  const variation =
    candidateIndex === 0
      ? "Generate the most straightforward fix."
      : candidateIndex === 1
        ? "Consider edge cases and generate a robust fix."
        : "Generate an alternative approach to solving this.";

  return `## Task
${task}

## Relevant Code
${localizedCode}

## Instructions
${variation}

Generate SEARCH/REPLACE blocks to implement the required changes. Remember:
- SEARCH text must match the file EXACTLY
- Keep changes minimal
- Prefix each block with the file path`;
}
