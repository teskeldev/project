/**
 * Error Recovery Strategies — Phase 3.7
 *
 * Handles various failure modes in AI code generation with targeted recovery
 * strategies. Provides progressive degradation: gentle retry → simplify →
 * decompose → fallback.
 */
import { chat } from "@/lib/ai/provider";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ErrorType =
  | "syntax_error"
  | "type_error"
  | "lint_error"
  | "test_failure"
  | "search_not_found" // SEARCH block doesn't match file
  | "format_error" // Output not in expected format
  | "context_overflow" // Response was cut off
  | "empty_response"
  | "hallucination" // References non-existent files/functions
  | "unknown";

export type RecoveryStrategy = {
  type: ErrorType;
  action: "retry" | "simplify" | "decompose" | "fallback" | "abort";
  prompt: string; // Modified prompt for retry
  adjustments: {
    temperature?: number;
    maxTokens?: number;
    simplifyContext?: boolean;
    addConstraints?: string[];
    removeContext?: string[];
  };
  maxRetries: number;
};

export type RecoveryResult = {
  recovered: boolean;
  output: string;
  strategy: RecoveryStrategy;
  attempts: number;
};

// ---------------------------------------------------------------------------
// Error classification patterns
// ---------------------------------------------------------------------------

const ERROR_PATTERNS: { type: ErrorType; patterns: RegExp[] }[] = [
  {
    type: "syntax_error",
    patterns: [
      /SyntaxError/i,
      /Unexpected token/i,
      /Parse error/i,
      /unterminated string/i,
      /unexpected end of/i,
      /invalid syntax/i,
    ],
  },
  {
    type: "type_error",
    patterns: [
      /TypeError/i,
      /Type '.*' is not assignable/i,
      /Property '.*' does not exist/i,
      /Cannot find name/i,
      /has no exported member/i,
      /TS\d{4}:/,
    ],
  },
  {
    type: "lint_error",
    patterns: [
      /eslint/i,
      /prettier/i,
      /lint.*error/i,
      /warning.*unused/i,
      /no-unused-vars/,
      /@typescript-eslint/,
    ],
  },
  {
    type: "test_failure",
    patterns: [
      /FAIL/,
      /test.*failed/i,
      /assertion.*failed/i,
      /expect.*received/i,
      /AssertionError/i,
    ],
  },
  {
    type: "search_not_found",
    patterns: [
      /search.*not found/i,
      /could not find.*in file/i,
      /no match.*search/i,
      /SEARCH block.*match/i,
    ],
  },
  {
    type: "format_error",
    patterns: [
      /invalid.*format/i,
      /expected.*format/i,
      /could not parse/i,
      /malformed.*output/i,
      /missing.*block/i,
    ],
  },
  {
    type: "context_overflow",
    patterns: [
      /maximum.*length/i,
      /context.*too long/i,
      /truncated/i,
      /token limit/i,
      /max_tokens/i,
    ],
  },
  {
    type: "empty_response",
    patterns: [
      /empty.*response/i,
      /no.*output/i,
      /blank.*response/i,
    ],
  },
  {
    type: "hallucination",
    patterns: [
      /file.*does not exist/i,
      /no such file/i,
      /module.*not found/i,
      /cannot resolve/i,
      /undefined.*function/i,
      /is not defined/i,
    ],
  },
];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Classify an error and determine recovery strategy */
export function classifyError(
  error: string,
  context?: { output?: string; format?: string }
): ErrorType {
  // Check for empty response first
  if (!error.trim() || error.trim().length < 5) {
    return "empty_response";
  }

  // Check if the output itself is empty (even if error message isn't)
  if (context?.output !== undefined && !context.output.trim()) {
    return "empty_response";
  }

  // Check for context overflow indicators
  if (context?.output) {
    const output = context.output;
    // Truncated responses often end mid-word or mid-line
    if (
      output.length > 100 &&
      !output.endsWith("\n") &&
      !output.endsWith("}") &&
      !output.endsWith(";") &&
      !output.endsWith("`")
    ) {
      // Could be truncated — check if error also suggests overflow
      if (/truncat|overflow|limit|cut.?off/i.test(error)) {
        return "context_overflow";
      }
    }
  }

  // Pattern-based classification
  for (const { type, patterns } of ERROR_PATTERNS) {
    for (const pattern of patterns) {
      if (pattern.test(error)) {
        return type;
      }
    }
  }

  return "unknown";
}

/** Get the recovery strategy for an error type */
export function getRecoveryStrategy(
  errorType: ErrorType,
  attempt: number,
  options?: { modelStrength?: "weak" | "medium" | "strong" }
): RecoveryStrategy {
  const strength = options?.modelStrength ?? "medium";

  // Progressive degradation based on attempt number
  if (attempt >= 3) {
    return buildAbortStrategy(errorType);
  }

  if (attempt === 2) {
    return buildSimplifyStrategy(errorType, strength);
  }

  // First attempt: gentle retry with targeted fix
  return buildRetryStrategy(errorType, strength);
}

/** Execute error recovery (retry with modified prompt) */
export async function executeRecovery(
  originalTask: string,
  originalContext: string,
  error: string,
  options?: {
    modelId?: string;
    provider?: string;
    workspaceId?: string;
    maxRetries?: number;
    signal?: AbortSignal;
  }
): Promise<RecoveryResult> {
  const maxRetries = options?.maxRetries ?? 3;
  const errorType = classifyError(error);

  let lastOutput = "";
  let lastStrategy: RecoveryStrategy | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    if (options?.signal?.aborted) {
      break;
    }

    const strategy = getRecoveryStrategy(errorType, attempt);
    lastStrategy = strategy;

    if (strategy.action === "abort") {
      return {
        recovered: false,
        output: lastOutput,
        strategy,
        attempts: attempt,
      };
    }

    // Build the recovery prompt
    const recoveryPrompt = buildRecoveryPrompt(
      errorType,
      lastOutput || originalContext,
      error,
      originalTask
    );

    // Apply adjustments
    const temperature = strategy.adjustments.temperature ?? 0.2;
    const maxTokens = strategy.adjustments.maxTokens;

    // Prepare context — possibly simplified
    let context = originalContext;
    if (strategy.adjustments.simplifyContext) {
      context = simplifyContext(originalContext);
    }

    // Add constraints to the prompt
    const constraints = strategy.adjustments.addConstraints?.join("\n") ?? "";
    const fullPrompt = constraints
      ? `${recoveryPrompt}\n\nAdditional constraints:\n${constraints}`
      : recoveryPrompt;

    try {
      const response = await chat(
        [
          {
            role: "system",
            content: buildSystemPrompt(errorType, attempt),
          },
          {
            role: "user",
            content: `${context}\n\n${fullPrompt}`,
          },
        ],
        {
          model: options?.modelId,
          provider: options?.provider,
          workspaceId: options?.workspaceId,
          temperature,
          maxTokens,
          signal: options?.signal,
        }
      );

      lastOutput = response;

      // Check if the response is valid (non-empty, not truncated)
      if (response.trim() && response.trim().length > 10) {
        return {
          recovered: true,
          output: response,
          strategy,
          attempts: attempt,
        };
      }
    } catch (err: unknown) {
      // If the AI call itself fails, continue to next attempt
      const errMsg = err instanceof Error ? err.message : String(err);
      error = errMsg; // Update error for next iteration
    }
  }

  return {
    recovered: false,
    output: lastOutput,
    strategy: lastStrategy ?? buildAbortStrategy(errorType),
    attempts: maxRetries,
  };
}

/** Build a recovery prompt based on the error type */
export function buildRecoveryPrompt(
  errorType: ErrorType,
  originalOutput: string,
  errorDetails: string,
  originalTask: string
): string {
  switch (errorType) {
    case "syntax_error":
      return (
        `The previous output had a syntax error:\n\n` +
        `Error: ${errorDetails}\n\n` +
        `Original output (with error):\n\`\`\`\n${truncate(originalOutput, 2000)}\n\`\`\`\n\n` +
        `Please fix the syntax error and return the corrected code. ` +
        `Ensure all brackets, parentheses, and quotes are properly matched.`
      );

    case "type_error":
      return (
        `The previous output had type errors:\n\n` +
        `Errors:\n${errorDetails}\n\n` +
        `Original task: ${originalTask}\n\n` +
        `Please fix the type errors. Ensure all types are correct and compatible. ` +
        `Do not use 'any' type unless absolutely necessary.`
      );

    case "lint_error":
      return (
        `The previous output had lint errors:\n\n` +
        `Errors:\n${errorDetails}\n\n` +
        `Please fix these lint issues while preserving the functionality. ` +
        `Remove unused imports, fix formatting, and follow the project's style.`
      );

    case "test_failure":
      return (
        `The previous output failed tests:\n\n` +
        `Test failures:\n${errorDetails}\n\n` +
        `Original task: ${originalTask}\n\n` +
        `Please fix the code to make all tests pass. Pay careful attention to ` +
        `expected vs actual values in the test output.`
      );

    case "search_not_found":
      return (
        `The SEARCH block in the previous output didn't match the actual file content.\n\n` +
        `Error: ${errorDetails}\n\n` +
        `Here's the actual file content that should be used:\n` +
        `\`\`\`\n${truncate(originalOutput, 3000)}\n\`\`\`\n\n` +
        `Please regenerate the SEARCH/REPLACE blocks using the exact text from the file above. ` +
        `The SEARCH text must match the file content exactly, including whitespace and indentation.`
      );

    case "format_error":
      return (
        `The previous output was not in the expected format.\n\n` +
        `Error: ${errorDetails}\n\n` +
        `Original task: ${originalTask}\n\n` +
        `Please provide your response in the correct format. ` +
        `Follow the format instructions exactly. Do not add extra text or explanations ` +
        `outside the expected structure.`
      );

    case "context_overflow":
      return (
        `The previous response was cut off due to length limits.\n\n` +
        `Original task: ${originalTask}\n\n` +
        `Please provide a more concise response. Focus on the essential changes only. ` +
        `If the task is complex, implement only the most critical parts.`
      );

    case "empty_response":
      return (
        `The previous attempt produced an empty response.\n\n` +
        `Original task: ${originalTask}\n\n` +
        `Please provide a complete response. If the task is unclear, ` +
        `implement the most reasonable interpretation.`
      );

    case "hallucination":
      return (
        `The previous output referenced files, functions, or modules that don't exist.\n\n` +
        `Error: ${errorDetails}\n\n` +
        `Original task: ${originalTask}\n\n` +
        `IMPORTANT: Only reference files, functions, classes, and modules that exist ` +
        `in the provided context. Do not invent or assume the existence of any imports ` +
        `or dependencies that are not explicitly shown.`
      );

    case "unknown":
    default:
      return (
        `The previous attempt encountered an error:\n\n` +
        `Error: ${errorDetails}\n\n` +
        `Original task: ${originalTask}\n\n` +
        `Please try again, addressing the error above.`
      );
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function buildRetryStrategy(
  errorType: ErrorType,
  _strength: "weak" | "medium" | "strong"
): RecoveryStrategy {
  const base: RecoveryStrategy = {
    type: errorType,
    action: "retry",
    prompt: "",
    adjustments: {
      temperature: 0.1, // Lower temperature for fixes
    },
    maxRetries: 3,
  };

  switch (errorType) {
    case "syntax_error":
      base.adjustments.temperature = 0.05;
      base.adjustments.addConstraints = [
        "Ensure all brackets, parentheses, and quotes are properly balanced.",
        "Validate the output is syntactically correct before returning.",
      ];
      break;

    case "type_error":
      base.adjustments.temperature = 0.1;
      base.adjustments.addConstraints = [
        "Ensure all types are correct and compatible.",
        "Use explicit type annotations where needed.",
      ];
      break;

    case "lint_error":
      base.adjustments.temperature = 0.1;
      base.adjustments.addConstraints = [
        "Follow the project's coding style and lint rules.",
        "Remove unused imports and variables.",
      ];
      break;

    case "test_failure":
      base.adjustments.temperature = 0.15;
      base.adjustments.addConstraints = [
        "Carefully read the test expectations and match them exactly.",
        "Pay attention to edge cases in the test output.",
      ];
      break;

    case "search_not_found":
      base.adjustments.temperature = 0.0;
      base.adjustments.addConstraints = [
        "Copy the SEARCH text exactly from the file content, character by character.",
        "Include enough context lines to make the match unique.",
      ];
      break;

    case "format_error":
      base.adjustments.temperature = 0.05;
      base.adjustments.addConstraints = [
        "Follow the output format exactly as specified.",
        "Do not add any text outside the expected format structure.",
      ];
      break;

    case "context_overflow":
      base.action = "simplify";
      base.adjustments.simplifyContext = true;
      base.adjustments.maxTokens = 8192;
      break;

    case "empty_response":
      base.adjustments.temperature = 0.3; // Slightly higher to encourage output
      base.adjustments.addConstraints = [
        "You must provide a non-empty response.",
        "If unsure, provide your best attempt.",
      ];
      break;

    case "hallucination":
      base.adjustments.temperature = 0.05;
      base.adjustments.addConstraints = [
        "ONLY reference files and functions that are explicitly shown in the context.",
        "Do NOT invent imports, modules, or function names.",
        "If you need a dependency that isn't shown, note it as a TODO comment.",
      ];
      break;

    default:
      base.adjustments.temperature = 0.2;
      break;
  }

  return base;
}

function buildSimplifyStrategy(
  errorType: ErrorType,
  strength: "weak" | "medium" | "strong"
): RecoveryStrategy {
  return {
    type: errorType,
    action: "simplify",
    prompt: "",
    adjustments: {
      temperature: 0.1,
      simplifyContext: true,
      maxTokens: strength === "weak" ? 4096 : 8192,
      addConstraints: [
        "Provide a simpler, more focused solution.",
        "Prioritize correctness over completeness.",
        "If the task is complex, implement the core functionality first.",
      ],
    },
    maxRetries: 3,
  };
}

function buildAbortStrategy(errorType: ErrorType): RecoveryStrategy {
  return {
    type: errorType,
    action: "abort",
    prompt: "",
    adjustments: {},
    maxRetries: 0,
  };
}

function buildSystemPrompt(errorType: ErrorType, attempt: number): string {
  const base =
    "You are a code repair assistant. Your job is to fix errors in generated code.";

  if (attempt === 1) {
    return `${base} Fix the specific error while preserving the original intent.`;
  }

  if (attempt === 2) {
    return `${base} The previous fix attempt failed. Provide a simpler, more conservative solution. Focus on correctness over elegance.`;
  }

  return `${base} Multiple fix attempts have failed. Provide the simplest possible working solution, even if it means reducing functionality.`;
}

function simplifyContext(context: string): string {
  // Remove comments, reduce whitespace, truncate long sections
  const lines = context.split("\n");
  const simplified: string[] = [];

  for (const line of lines) {
    // Skip pure comment lines
    if (/^\s*\/\//.test(line) || /^\s*#/.test(line)) continue;
    // Skip empty lines (keep max 1 consecutive)
    if (!line.trim()) {
      if (simplified.length > 0 && !simplified[simplified.length - 1].trim()) {
        continue;
      }
    }
    simplified.push(line);
  }

  // Truncate if still too long
  const result = simplified.join("\n");
  return truncate(result, 6000);
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + "\n... (truncated)";
}
