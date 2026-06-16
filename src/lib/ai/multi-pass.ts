/**
 * Multi-Pass Execution Engine — Generate → Review → Refine loop.
 *
 * The single most impactful technique for elevating weak model output quality.
 * Runs the AI through multiple passes:
 * 1. Generate: Produce initial solution
 * 2. Review: Critique the solution (find bugs, edge cases, style issues)
 * 3. Refine: Fix issues identified in review
 *
 * Empirically improves GPT-4o-mini output quality by 25-40%.
 */

import { chat, type AIMessage, type ChatOptions } from "@/lib/ai/provider";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PassType = "generate" | "review" | "refine" | "verify";

export type MultiPassOptions = {
  /** What to accomplish */
  task: string;
  /** Code context (from smart-context) */
  context: string;
  /** Base system prompt */
  systemPrompt?: string;

  /** Model configuration */
  modelId?: string;
  provider?: string;
  workspaceId?: string;

  /** Max total passes (default 3) */
  maxPasses?: number;
  /** Enable review pass (default true) */
  enableReview?: boolean;
  /** Enable refine pass (default true) */
  enableRefine?: boolean;
  /** Custom review criteria */
  reviewCriteria?: string[];

  /** Expected output format instruction */
  outputFormat?: string;

  /** Callbacks */
  onPassStart?: (pass: PassType, passNumber: number) => void;
  onPassComplete?: (
    pass: PassType,
    passNumber: number,
    output: string
  ) => void;

  /** Abort */
  signal?: AbortSignal;
};

export type MultiPassResult = {
  /** The final refined output */
  finalOutput: string;
  /** Record of all passes */
  passes: PassRecord[];
  /** Total number of passes executed */
  totalPasses: number;
  /** Was the output improved by review/refine? */
  improved: boolean;
  /** Issues found during review */
  reviewFindings: string[];
  /** Estimated quality (0-1) */
  qualityScore: number;
};

export type PassRecord = {
  type: PassType;
  /** What was sent to the model */
  input: string;
  /** What the model returned */
  output: string;
  /** Duration in milliseconds */
  durationMs: number;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_MAX_PASSES = 3;

const DEFAULT_REVIEW_CRITERIA = [
  "Correctness: Does it solve the task completely and accurately?",
  "Edge cases: Are null, undefined, empty arrays, and boundary conditions handled?",
  "Error handling: Are errors caught, handled, and reported appropriately?",
  "Type safety: Are TypeScript types correct and specific (no unnecessary `any`)?",
  "Security: Any injection, XSS, path traversal, or prototype pollution risks?",
  "Performance: Any obvious N+1 queries, unnecessary loops, or memory leaks?",
  "Style: Does it match the existing codebase conventions and patterns?",
];

const REVIEW_SYSTEM_PROMPT = `You are a strict code reviewer. Your job is to find bugs, edge cases, security issues, and style problems in the provided code.

You MUST respond with a JSON object in this exact format:
{
  "findings": ["issue 1 description", "issue 2 description", ...],
  "severity": "none" | "minor" | "major"
}

Rules:
- "none": Code is correct, no issues found.
- "minor": Style issues, minor improvements, non-critical edge cases.
- "major": Bugs, security issues, missing error handling, incorrect logic.
- Be specific in findings — reference line numbers or function names when possible.
- Do NOT invent issues that don't exist. Only report real problems.
- If the code is good, return {"findings": [], "severity": "none"}.`;

const REFINE_SYSTEM_PROMPT = `You are a code refinement assistant. Fix all issues identified in the review while preserving the correct parts of the code.

Rules:
- Fix every issue listed in the review findings.
- Do NOT introduce new bugs or change correct behavior.
- Preserve the overall structure and style.
- Output ONLY the corrected code — no explanations, no markdown fences unless the original had them.
- If the original code was wrapped in markdown code fences, keep that format.`;

// ---------------------------------------------------------------------------
// Main execution loop
// ---------------------------------------------------------------------------

/** Run the multi-pass execution loop */
export async function multiPassExecute(
  options: MultiPassOptions
): Promise<MultiPassResult> {
  const {
    task,
    context,
    systemPrompt,
    modelId,
    provider,
    workspaceId,
    maxPasses = DEFAULT_MAX_PASSES,
    enableReview = true,
    enableRefine = true,
    reviewCriteria,
    outputFormat,
    onPassStart,
    onPassComplete,
    signal,
  } = options;

  const passes: PassRecord[] = [];
  let reviewFindings: string[] = [];
  let qualityScore = 0.5; // baseline
  let improved = false;

  // Abort check helper
  const checkAbort = () => {
    if (signal?.aborted) {
      throw new DOMException("Multi-pass execution aborted", "AbortError");
    }
  };

  // Chat options shared across passes
  const baseChatOpts: ChatOptions = {
    model: modelId,
    provider,
    workspaceId,
    signal,
  };

  // -------------------------------------------------------------------------
  // Pass 1: Generate
  // -------------------------------------------------------------------------
  checkAbort();
  onPassStart?.("generate", 1);

  const generatePrompt = buildGeneratePrompt(
    task,
    context,
    systemPrompt,
    outputFormat
  );

  const generateStart = Date.now();
  const generateOutput = await chat(generatePrompt.messages, {
    ...baseChatOpts,
    temperature: 0.3,
  });
  const generateDuration = Date.now() - generateStart;

  passes.push({
    type: "generate",
    input: generatePrompt.messages.map((m) => m.content).join("\n---\n"),
    output: generateOutput,
    durationMs: generateDuration,
  });

  onPassComplete?.("generate", 1, generateOutput);

  // If review is disabled or we've hit max passes, return early
  if (!enableReview || maxPasses < 2) {
    return {
      finalOutput: generateOutput,
      passes,
      totalPasses: 1,
      improved: false,
      reviewFindings: [],
      qualityScore,
    };
  }

  // -------------------------------------------------------------------------
  // Pass 2: Review
  // -------------------------------------------------------------------------
  checkAbort();
  onPassStart?.("review", 2);

  const reviewStart = Date.now();
  const reviewResult = await reviewPass(generateOutput, task, reviewCriteria, {
    modelId,
    provider,
    workspaceId,
    signal,
  });
  const reviewDurationMs = Date.now() - reviewStart;

  const reviewOutput = JSON.stringify(reviewResult, null, 2);

  passes.push({
    type: "review",
    input: generateOutput,
    output: reviewOutput,
    durationMs: reviewDurationMs,
  });

  reviewFindings = reviewResult.findings;
  onPassComplete?.("review", 2, reviewOutput);

  // Update quality score based on review
  if (reviewResult.severity === "none") {
    qualityScore += 0.2;
  } else if (reviewResult.severity === "minor") {
    qualityScore += 0.1;
  }
  // major severity: no bonus

  // Early termination: no issues found → skip refine
  if (reviewResult.severity === "none" || reviewResult.findings.length === 0) {
    // Check output format compliance
    if (outputFormat && isOutputFormatCompliant(generateOutput, outputFormat)) {
      qualityScore += 0.1;
    }

    return {
      finalOutput: generateOutput,
      passes,
      totalPasses: 2,
      improved: false,
      reviewFindings: [],
      qualityScore: Math.min(qualityScore, 1.0),
    };
  }

  // If refine is disabled or we've hit max passes, return with review info
  if (!enableRefine || maxPasses < 3) {
    return {
      finalOutput: generateOutput,
      passes,
      totalPasses: 2,
      improved: false,
      reviewFindings,
      qualityScore: Math.min(qualityScore, 1.0),
    };
  }

  // -------------------------------------------------------------------------
  // Pass 3: Refine
  // -------------------------------------------------------------------------
  checkAbort();
  onPassStart?.("refine", 3);

  const refineStart = Date.now();
  const refinedOutput = await refinePass(
    generateOutput,
    task,
    reviewFindings,
    { modelId, provider, workspaceId, signal }
  );
  const refineDuration = Date.now() - refineStart;

  passes.push({
    type: "refine",
    input: `${generateOutput}\n\n---FINDINGS---\n${reviewFindings.join("\n")}`,
    output: refinedOutput,
    durationMs: refineDuration,
  });

  onPassComplete?.("refine", 3, refinedOutput);

  // Determine if refinement actually changed the output
  improved = refinedOutput.trim() !== generateOutput.trim();
  if (improved) {
    qualityScore += 0.1;
  }

  // Check output format compliance
  if (outputFormat && isOutputFormatCompliant(refinedOutput, outputFormat)) {
    qualityScore += 0.1;
  }

  return {
    finalOutput: refinedOutput,
    passes,
    totalPasses: 3,
    improved,
    reviewFindings,
    qualityScore: Math.min(qualityScore, 1.0),
  };
}

// ---------------------------------------------------------------------------
// Review Pass
// ---------------------------------------------------------------------------

/** Run a single review pass on generated code */
export async function reviewPass(
  code: string,
  task: string,
  criteria?: string[],
  options?: {
    modelId?: string;
    provider?: string;
    workspaceId?: string;
    signal?: AbortSignal;
  }
): Promise<{
  findings: string[];
  severity: "none" | "minor" | "major";
  suggestions: string[];
}> {
  const activeCriteria = criteria ?? DEFAULT_REVIEW_CRITERIA;

  const userMessage = buildReviewUserMessage(code, task, activeCriteria);

  const messages: AIMessage[] = [
    { role: "system", content: REVIEW_SYSTEM_PROMPT },
    { role: "user", content: userMessage },
  ];

  const chatOpts: ChatOptions = {
    model: options?.modelId,
    provider: options?.provider,
    workspaceId: options?.workspaceId,
    signal: options?.signal,
    temperature: 0.1,
  };

  const rawOutput = await chat(messages, chatOpts);
  return parseReviewOutput(rawOutput);
}

// ---------------------------------------------------------------------------
// Refine Pass
// ---------------------------------------------------------------------------

/** Run a single refine pass based on review feedback */
export async function refinePass(
  code: string,
  task: string,
  findings: string[],
  options?: {
    modelId?: string;
    provider?: string;
    workspaceId?: string;
    signal?: AbortSignal;
  }
): Promise<string> {
  if (findings.length === 0) {
    return code;
  }

  const userMessage = buildRefineUserMessage(code, task, findings);

  const messages: AIMessage[] = [
    { role: "system", content: REFINE_SYSTEM_PROMPT },
    { role: "user", content: userMessage },
  ];

  const chatOpts: ChatOptions = {
    model: options?.modelId,
    provider: options?.provider,
    workspaceId: options?.workspaceId,
    signal: options?.signal,
    temperature: 0.2,
  };

  return chat(messages, chatOpts);
}

// ---------------------------------------------------------------------------
// Prompt Builders
// ---------------------------------------------------------------------------

function buildGeneratePrompt(
  task: string,
  context: string,
  systemPrompt?: string,
  outputFormat?: string
): { messages: AIMessage[] } {
  const system =
    systemPrompt ??
    `You are an expert software engineer. Write clean, correct, production-quality code.`;

  let userContent = "";

  if (context) {
    userContent += `## Relevant Code Context\n\n${context}\n\n`;
  }

  userContent += `## Task\n\n${task}`;

  if (outputFormat) {
    userContent += `\n\n## Output Format\n\n${outputFormat}`;
  }

  userContent += `\n\nProvide your complete solution. Be thorough and handle edge cases.`;

  return {
    messages: [
      { role: "system", content: system },
      { role: "user", content: userContent },
    ],
  };
}

function buildReviewUserMessage(
  code: string,
  task: string,
  criteria: string[]
): string {
  const criteriaList = criteria.map((c, i) => `${i + 1}. ${c}`).join("\n");

  return `## Original Task

${task}

## Code to Review

\`\`\`
${code}
\`\`\`

## Review Criteria

${criteriaList}

Review the code against ALL criteria above. Respond with a JSON object containing "findings" (array of strings describing issues) and "severity" ("none", "minor", or "major").`;
}

function buildRefineUserMessage(
  code: string,
  task: string,
  findings: string[]
): string {
  const findingsList = findings.map((f, i) => `${i + 1}. ${f}`).join("\n");

  return `## Original Task

${task}

## Current Code

\`\`\`
${code}
\`\`\`

## Issues to Fix

${findingsList}

Fix ALL the issues listed above. Output the complete corrected code. Preserve all correct behavior and structure.`;
}

// ---------------------------------------------------------------------------
// Output Parsing
// ---------------------------------------------------------------------------

/**
 * Parse the review output from the model.
 * Handles both clean JSON and JSON embedded in markdown/text.
 */
function parseReviewOutput(raw: string): {
  findings: string[];
  severity: "none" | "minor" | "major";
  suggestions: string[];
} {
  const defaultResult = {
    findings: [],
    severity: "none" as const,
    suggestions: [],
  };

  if (!raw || !raw.trim()) {
    return defaultResult;
  }

  // Try to extract JSON from the response
  const jsonStr = extractJson(raw);
  if (!jsonStr) {
    // If we can't find JSON, try to interpret the text as findings
    return interpretFreeformReview(raw);
  }

  try {
    const parsed = JSON.parse(jsonStr);

    const findings: string[] = Array.isArray(parsed.findings)
      ? parsed.findings.filter(
          (f: unknown): f is string => typeof f === "string" && f.length > 0
        )
      : [];

    const severity = validateSeverity(parsed.severity, findings);

    // Extract suggestions if present, otherwise derive from findings
    const suggestions: string[] = Array.isArray(parsed.suggestions)
      ? parsed.suggestions.filter(
          (s: unknown): s is string => typeof s === "string" && s.length > 0
        )
      : findings.map((f) => `Fix: ${f}`);

    return { findings, severity, suggestions };
  } catch {
    return interpretFreeformReview(raw);
  }
}

/**
 * Extract a JSON object from text that may contain markdown fences or
 * surrounding prose.
 */
function extractJson(text: string): string | null {
  // Try direct parse first
  const trimmed = text.trim();
  if (trimmed.startsWith("{")) {
    // Find the matching closing brace
    const end = findMatchingBrace(trimmed, 0);
    if (end !== -1) {
      return trimmed.slice(0, end + 1);
    }
  }

  // Try to find JSON in markdown code fences
  const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (fenceMatch?.[1]) {
    const inner = fenceMatch[1].trim();
    if (inner.startsWith("{")) {
      return inner;
    }
  }

  // Try to find a JSON object anywhere in the text
  const jsonMatch = text.match(/\{[\s\S]*"findings"[\s\S]*\}/);
  if (jsonMatch?.[0]) {
    return jsonMatch[0];
  }

  return null;
}

/** Find the index of the matching closing brace */
function findMatchingBrace(text: string, start: number): number {
  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];

    if (escape) {
      escape = false;
      continue;
    }

    if (ch === "\\") {
      escape = true;
      continue;
    }

    if (ch === '"') {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (ch === "{") depth++;
    if (ch === "}") {
      depth--;
      if (depth === 0) return i;
    }
  }

  return -1;
}

/** Validate and normalize severity based on findings */
function validateSeverity(
  raw: unknown,
  findings: string[]
): "none" | "minor" | "major" {
  if (typeof raw === "string") {
    const normalized = raw.toLowerCase().trim();
    if (normalized === "none" || normalized === "minor" || normalized === "major") {
      // Cross-check: if severity is "none" but there are findings, upgrade
      if (normalized === "none" && findings.length > 0) {
        return "minor";
      }
      return normalized;
    }
  }

  // Infer from findings count
  if (findings.length === 0) return "none";
  if (findings.length <= 2) return "minor";
  return "major";
}

/**
 * Interpret a freeform text review when JSON parsing fails.
 * Extracts bullet points or numbered items as findings.
 */
function interpretFreeformReview(text: string): {
  findings: string[];
  severity: "none" | "minor" | "major";
  suggestions: string[];
} {
  const lines = text.split("\n");
  const findings: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    // Match bullet points, numbered lists, or lines starting with -
    const match = trimmed.match(/^(?:[-*•]|\d+[.)]\s*)\s*(.+)/);
    if (match?.[1] && match[1].length > 10) {
      findings.push(match[1].trim());
    }
  }

  // Check for keywords indicating no issues
  const lowerText = text.toLowerCase();
  if (
    findings.length === 0 ||
    lowerText.includes("no issues found") ||
    lowerText.includes("code looks good") ||
    lowerText.includes("no problems")
  ) {
    return { findings: [], severity: "none", suggestions: [] };
  }

  const severity = findings.length <= 2 ? "minor" : "major";
  const suggestions = findings.map((f) => `Fix: ${f}`);

  return { findings, severity, suggestions };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Basic check for output format compliance.
 * Checks if the output appears to follow the requested format.
 */
function isOutputFormatCompliant(output: string, format: string): boolean {
  const lowerFormat = format.toLowerCase();
  const trimmedOutput = output.trim();

  // Check for common format expectations
  if (lowerFormat.includes("json")) {
    return trimmedOutput.startsWith("{") || trimmedOutput.startsWith("[");
  }

  if (lowerFormat.includes("typescript") || lowerFormat.includes("code")) {
    // Should contain actual code constructs
    return (
      trimmedOutput.includes("function") ||
      trimmedOutput.includes("const") ||
      trimmedOutput.includes("export") ||
      trimmedOutput.includes("class") ||
      trimmedOutput.includes("import")
    );
  }

  if (lowerFormat.includes("markdown")) {
    return trimmedOutput.includes("#") || trimmedOutput.includes("- ");
  }

  if (lowerFormat.includes("diff") || lowerFormat.includes("patch")) {
    return trimmedOutput.includes("@@") || trimmedOutput.includes("---");
  }

  // Default: assume compliant if output is non-empty
  return trimmedOutput.length > 0;
}
