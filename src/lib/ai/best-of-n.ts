/**
 * Best-of-N Generation — Phase 3.5
 *
 * Generates multiple candidate solutions and selects the best one based on
 * configurable scoring strategies. Particularly effective when combined with
 * test-based selection for higher reliability.
 */
import { chat } from "@/lib/ai/provider";
import { validateSyntax } from "./validators/ast-validator";
import { runTests } from "./validators/test-runner";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CandidateScore = {
  index: number;
  code: string;
  scores: {
    syntaxValid: boolean;
    lintErrors: number;
    typeErrors: number;
    testsPassed: number;
    testsTotal: number;
    codeLength: number; // Shorter is often better (less hallucination)
  };
  totalScore: number; // Weighted composite score
};

export type BestOfNOptions = {
  task: string;
  context: string;
  systemPrompt?: string;
  n?: number; // Number of candidates (default 3)
  temperatures?: number[]; // Temperature for each candidate
  modelId?: string;
  provider?: string;
  workspaceId?: string;

  // Validation options
  validateSyntax?: boolean; // Default true
  runLint?: boolean; // Default false (expensive)
  runTests?: boolean; // Default false (expensive)
  testCommand?: string;
  cwd?: string;

  // Selection strategy
  strategy?: "test_based" | "lint_based" | "shortest" | "consensus";

  signal?: AbortSignal;
  onCandidate?: (index: number, code: string) => void;
};

export type BestOfNResult = {
  best: CandidateScore;
  candidates: CandidateScore[];
  strategy: string;
  totalGenerated: number;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_N = 3;
const DEFAULT_TEMPERATURES = [0.2, 0.4, 0.6];

// Score weights for composite scoring
const WEIGHTS = {
  syntaxValid: 100, // Binary: valid syntax is critical
  lintErrors: -5, // Penalty per lint error
  typeErrors: -10, // Penalty per type error
  testsPassed: 20, // Reward per passing test
  codeLength: -0.01, // Slight penalty for longer code
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Generate N candidates and select the best one */
export async function bestOfN(options: BestOfNOptions): Promise<BestOfNResult> {
  const {
    task,
    context,
    systemPrompt,
    n = DEFAULT_N,
    temperatures = DEFAULT_TEMPERATURES,
    modelId,
    provider,
    workspaceId,
    strategy = "test_based",
    signal,
    onCandidate,
  } = options;

  const doValidateSyntax = options.validateSyntax !== false;
  const doRunTests = options.runTests === true && !!options.testCommand;

  // Generate candidates with varying temperatures
  const candidates: CandidateScore[] = [];

  // Generate candidates in parallel for speed
  const generationPromises = Array.from({ length: n }, (_, i) => {
    const temp = temperatures[i % temperatures.length];
    return generateCandidate(
      task,
      context,
      systemPrompt,
      temp,
      { modelId, provider, workspaceId, signal }
    );
  });

  const rawCandidates = await Promise.allSettled(generationPromises);

  for (let i = 0; i < rawCandidates.length; i++) {
    const result = rawCandidates[i];
    if (result.status === "rejected") continue;

    const code = result.value;
    if (!code) continue;

    onCandidate?.(i, code);

    const scores = await scoreCandidate(code, {
      validateSyntax: doValidateSyntax,
      runLint: options.runLint,
      cwd: options.cwd,
      testCommand: doRunTests ? options.testCommand : undefined,
    });

    const totalScore = computeTotalScore(scores);
    candidates.push({ index: i, code, scores, totalScore });
  }

  if (candidates.length === 0) {
    // All candidates failed — return a placeholder
    const fallback: CandidateScore = {
      index: 0,
      code: "",
      scores: {
        syntaxValid: false,
        lintErrors: 0,
        typeErrors: 0,
        testsPassed: 0,
        testsTotal: 0,
        codeLength: 0,
      },
      totalScore: -Infinity,
    };
    return {
      best: fallback,
      candidates: [fallback],
      strategy,
      totalGenerated: n,
    };
  }

  // Select best based on strategy
  const best = selectBest(candidates, strategy);

  return {
    best,
    candidates,
    strategy,
    totalGenerated: n,
  };
}

/** Score a single candidate */
export async function scoreCandidate(
  code: string,
  options?: {
    validateSyntax?: boolean;
    runLint?: boolean;
    cwd?: string;
    testCommand?: string;
  }
): Promise<CandidateScore["scores"]> {
  const scores: CandidateScore["scores"] = {
    syntaxValid: true,
    lintErrors: 0,
    typeErrors: 0,
    testsPassed: 0,
    testsTotal: 0,
    codeLength: code.length,
  };

  // Syntax validation (fast)
  if (options?.validateSyntax !== false) {
    try {
      const syntaxResult = validateSyntax(code);
      scores.syntaxValid = syntaxResult.valid;
      if (!syntaxResult.valid) {
        // Count syntax errors as type errors for scoring
        scores.typeErrors += syntaxResult.errors?.length ?? 1;
      }
    } catch {
      // If validator throws, assume valid (don't penalize)
      scores.syntaxValid = true;
    }
  }

  // Test execution (slow, optional)
  if (options?.testCommand && options?.cwd) {
    try {
      const testResult = await runTests(options.testCommand, options.cwd);
      scores.testsPassed = testResult.passedTests;
      scores.testsTotal = testResult.totalTests;
    } catch {
      // Test execution failed — don't penalize
    }
  }

  return scores;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function generateCandidate(
  task: string,
  context: string,
  systemPrompt: string | undefined,
  temperature: number,
  opts: {
    modelId?: string;
    provider?: string;
    workspaceId?: string;
    signal?: AbortSignal;
  }
): Promise<string> {
  const messages = [
    {
      role: "system" as const,
      content:
        systemPrompt ??
        "You are a code generation assistant. Return ONLY the code, no explanations or markdown fences unless specifically requested.",
    },
    {
      role: "user" as const,
      content: `${context}\n\n## Task\n${task}`,
    },
  ];

  const response = await chat(messages, {
    model: opts.modelId,
    provider: opts.provider,
    workspaceId: opts.workspaceId,
    temperature,
    signal: opts.signal,
  });

  return extractCode(response);
}

function extractCode(response: string): string {
  // Try to extract from code fences
  const fenceMatch = response.match(
    /```(?:typescript|javascript|ts|js|python|go|rust|c|cpp)?\s*\n([\s\S]*?)\n```/
  );
  if (fenceMatch) return fenceMatch[1].trim();

  // Return raw response if it looks like code
  return response.trim();
}

function computeTotalScore(scores: CandidateScore["scores"]): number {
  let total = 0;

  if (scores.syntaxValid) total += WEIGHTS.syntaxValid;
  total += scores.lintErrors * WEIGHTS.lintErrors;
  total += scores.typeErrors * WEIGHTS.typeErrors;
  total += scores.testsPassed * WEIGHTS.testsPassed;
  total += scores.codeLength * WEIGHTS.codeLength;

  return total;
}

function selectBest(
  candidates: CandidateScore[],
  strategy: string
): CandidateScore {
  switch (strategy) {
    case "test_based":
      return selectByTests(candidates);
    case "lint_based":
      return selectByLint(candidates);
    case "shortest":
      return selectShortest(candidates);
    case "consensus":
      return selectByConsensus(candidates);
    default:
      return selectByTests(candidates);
  }
}

function selectByTests(candidates: CandidateScore[]): CandidateScore {
  // Pick candidate that passes most tests; break ties with total score
  return candidates.reduce((best, c) => {
    if (c.scores.testsPassed > best.scores.testsPassed) return c;
    if (
      c.scores.testsPassed === best.scores.testsPassed &&
      c.totalScore > best.totalScore
    )
      return c;
    return best;
  });
}

function selectByLint(candidates: CandidateScore[]): CandidateScore {
  // Pick candidate with fewest lint + type errors
  return candidates.reduce((best, c) => {
    const cErrors = c.scores.lintErrors + c.scores.typeErrors;
    const bestErrors = best.scores.lintErrors + best.scores.typeErrors;
    if (cErrors < bestErrors) return c;
    if (cErrors === bestErrors && c.totalScore > best.totalScore) return c;
    return best;
  });
}

function selectShortest(candidates: CandidateScore[]): CandidateScore {
  // Among syntactically valid candidates, pick shortest
  const valid = candidates.filter((c) => c.scores.syntaxValid);
  const pool = valid.length > 0 ? valid : candidates;

  return pool.reduce((best, c) => {
    if (c.scores.codeLength < best.scores.codeLength) return c;
    return best;
  });
}

function selectByConsensus(candidates: CandidateScore[]): CandidateScore {
  // If multiple candidates have similar structure, prefer the common approach.
  // We use a simple heuristic: normalize code and find the most common "shape".
  if (candidates.length < 2) return candidates[0];

  // Extract function/class signatures as a rough "shape"
  const shapes = candidates.map((c) => extractShape(c.code));

  // Count occurrences of each shape
  const shapeCounts = new Map<string, number>();
  for (const shape of shapes) {
    shapeCounts.set(shape, (shapeCounts.get(shape) ?? 0) + 1);
  }

  // Find the most common shape
  let maxCount = 0;
  let consensusShape = "";
  for (const [shape, count] of shapeCounts) {
    if (count > maxCount) {
      maxCount = count;
      consensusShape = shape;
    }
  }

  // If there's actual consensus (>1 candidate agrees), pick the best among them
  if (maxCount > 1) {
    const consensusCandidates = candidates.filter(
      (c, i) => shapes[i] === consensusShape
    );
    return consensusCandidates.reduce((best, c) =>
      c.totalScore > best.totalScore ? c : best
    );
  }

  // No consensus — fall back to total score
  return candidates.reduce((best, c) =>
    c.totalScore > best.totalScore ? c : best
  );
}

function extractShape(code: string): string {
  // Extract a normalized "shape" — function names, class names, exports
  const signatures: string[] = [];

  const funcMatches = code.matchAll(
    /(?:export\s+)?(?:async\s+)?function\s+(\w+)/g
  );
  for (const m of funcMatches) signatures.push(`fn:${m[1]}`);

  const classMatches = code.matchAll(/(?:export\s+)?class\s+(\w+)/g);
  for (const m of classMatches) signatures.push(`cls:${m[1]}`);

  const exportMatches = code.matchAll(/export\s+(?:const|let|var)\s+(\w+)/g);
  for (const m of exportMatches) signatures.push(`var:${m[1]}`);

  return signatures.sort().join("|");
}
