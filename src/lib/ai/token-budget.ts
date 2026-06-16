/**
 * Token Budget Manager – Phase 1.6
 *
 * Manages token allocation across different context sections based on the model
 * being used. Different models have different effective context windows where
 * quality remains high; this module ensures we stay within those bounds.
 *
 * Primary unit: characters (with token estimation helpers).
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ModelCapacity = {
  modelId: string;
  maxContext: number;       // Total context window (tokens)
  effectiveContext: number; // Quality degrades beyond this (tokens)
  maxOutput: number;        // Max output tokens
  costPer1kInput: number;   // Cost per 1K input tokens (USD)
  costPer1kOutput: number;  // Cost per 1K output tokens (USD)
};

export type BudgetAllocation = {
  systemPrompt: number;       // Chars for system prompt + persona
  rules: number;              // Chars for rules/skills
  fewShotExamples: number;    // Chars for few-shot examples
  contextFiles: number;       // Chars for relevant code context
  repoMap: number;            // Chars for repo structure map
  taskDescription: number;    // Chars for user's request
  conversationHistory: number; // Chars for chat history
  reservedForOutput: number;  // Tokens reserved for model output
  total: number;              // Total budget in chars
};

export type BudgetOptions = {
  modelId?: string;
  provider?: string;
  taskType?: 'chat' | 'completion' | 'agent' | 'review';
  includeRepoMap?: boolean;
  includeFewShot?: boolean;
  conversationLength?: number; // number of previous messages
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Approximate characters per token for English text and code. */
const CHARS_PER_TOKEN = 4;

/** Model capacity registry keyed by modelId. */
const MODEL_REGISTRY: Record<string, ModelCapacity> = {
  'gpt-4o-mini': {
    modelId: 'gpt-4o-mini',
    maxContext: 128_000,
    effectiveContext: 16_000,
    maxOutput: 16_000,
    costPer1kInput: 0.00015,
    costPer1kOutput: 0.0006,
  },
  'gpt-4o': {
    modelId: 'gpt-4o',
    maxContext: 128_000,
    effectiveContext: 32_000,
    maxOutput: 16_000,
    costPer1kInput: 0.005,
    costPer1kOutput: 0.015,
  },
  'gpt-4-turbo': {
    modelId: 'gpt-4-turbo',
    maxContext: 128_000,
    effectiveContext: 24_000,
    maxOutput: 4_000,
    costPer1kInput: 0.01,
    costPer1kOutput: 0.03,
  },
  'claude-opus-4-8': {
    modelId: 'claude-opus-4-8',
    maxContext: 200_000,
    effectiveContext: 40_000,
    maxOutput: 8_000,
    costPer1kInput: 0.015,
    costPer1kOutput: 0.075,
  },
  'claude-sonnet-4-6': {
    modelId: 'claude-sonnet-4-6',
    maxContext: 200_000,
    effectiveContext: 40_000,
    maxOutput: 8_000,
    costPer1kInput: 0.003,
    costPer1kOutput: 0.015,
  },
  'claude-haiku-4-5-20251001': {
    modelId: 'claude-haiku-4-5-20251001',
    maxContext: 200_000,
    effectiveContext: 40_000,
    maxOutput: 8_000,
    costPer1kInput: 0.001,
    costPer1kOutput: 0.005,
  },
  'llama-3.1-8b': {
    modelId: 'llama-3.1-8b',
    maxContext: 128_000,
    effectiveContext: 8_000,
    maxOutput: 4_000,
    costPer1kInput: 0.0001,
    costPer1kOutput: 0.0001,
  },
  'llama-3.1-70b': {
    modelId: 'llama-3.1-70b',
    maxContext: 128_000,
    effectiveContext: 16_000,
    maxOutput: 4_000,
    costPer1kInput: 0.0008,
    costPer1kOutput: 0.0008,
  },
  'mixtral-8x7b': {
    modelId: 'mixtral-8x7b',
    maxContext: 32_000,
    effectiveContext: 12_000,
    maxOutput: 4_000,
    costPer1kInput: 0.0006,
    costPer1kOutput: 0.0006,
  },
  'qwen2.5-coder-7b': {
    modelId: 'qwen2.5-coder-7b',
    maxContext: 32_000,
    effectiveContext: 12_000,
    maxOutput: 8_000,
    costPer1kInput: 0.0001,
    costPer1kOutput: 0.0001,
  },
  'qwen2.5-coder-32b': {
    modelId: 'qwen2.5-coder-32b',
    maxContext: 128_000,
    effectiveContext: 24_000,
    maxOutput: 8_000,
    costPer1kInput: 0.0005,
    costPer1kOutput: 0.0005,
  },
  'deepseek-coder-v2': {
    modelId: 'deepseek-coder-v2',
    maxContext: 128_000,
    effectiveContext: 24_000,
    maxOutput: 8_000,
    costPer1kInput: 0.00014,
    costPer1kOutput: 0.00028,
  },
};

const DEFAULT_CAPACITY: ModelCapacity = {
  modelId: 'unknown',
  maxContext: 32_000,
  effectiveContext: 12_000,
  maxOutput: 4_000,
  costPer1kInput: 0.001,
  costPer1kOutput: 0.002,
};

/**
 * Allocation percentages per task type.
 * Keys map to BudgetAllocation fields (excluding reservedForOutput and total).
 */
const ALLOCATION_PROFILES: Record<
  NonNullable<BudgetOptions['taskType']>,
  Record<string, number>
> = {
  chat: {
    systemPrompt: 0.10,
    rules: 0.10,
    fewShotExamples: 0,
    contextFiles: 0.40,
    repoMap: 0.10,
    taskDescription: 0.10,
    conversationHistory: 0.20,
  },
  completion: {
    systemPrompt: 0.05,
    rules: 0,
    fewShotExamples: 0,
    contextFiles: 0.70,
    repoMap: 0.05,
    taskDescription: 0.20,
    conversationHistory: 0,
  },
  agent: {
    systemPrompt: 0.10,
    rules: 0.10,
    fewShotExamples: 0.15,
    contextFiles: 0.35,
    repoMap: 0.10,
    taskDescription: 0.20,
    conversationHistory: 0,
  },
  review: {
    systemPrompt: 0.10,
    rules: 0.05,
    fewShotExamples: 0,
    contextFiles: 0.60,
    repoMap: 0,
    taskDescription: 0.25,
    conversationHistory: 0,
  },
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Get model capacity configuration.
 *
 * Performs fuzzy matching: tries exact match first, then checks if the modelId
 * contains a known key (e.g. "openai/gpt-4o" matches "gpt-4o").
 */
export function getModelCapacity(modelId: string, _provider?: string): ModelCapacity {
  // Exact match
  if (MODEL_REGISTRY[modelId]) {
    return { ...MODEL_REGISTRY[modelId] };
  }

  // Fuzzy: check if modelId contains a known key
  const normalized = modelId.toLowerCase();
  for (const key of Object.keys(MODEL_REGISTRY)) {
    if (normalized.includes(key)) {
      return { ...MODEL_REGISTRY[key], modelId };
    }
  }

  // Fallback
  return { ...DEFAULT_CAPACITY, modelId };
}

/**
 * Calculate token budget allocation for a given model and task.
 *
 * Returns character budgets for each context section, ensuring we stay within
 * the model's effective context window.
 */
export function allocateBudget(options: BudgetOptions = {}): BudgetAllocation {
  const {
    modelId = 'unknown',
    provider,
    taskType = 'chat',
    includeRepoMap = true,
    includeFewShot = true,
    conversationLength = 0,
  } = options;

  const capacity = getModelCapacity(modelId, provider);
  const profile = ALLOCATION_PROFILES[taskType];

  // Effective tokens available for input (reserve output tokens)
  const inputTokens = capacity.effectiveContext - capacity.maxOutput;
  // Convert to characters
  const totalChars = Math.max(inputTokens * CHARS_PER_TOKEN, 0);

  // Build allocation
  const allocation: BudgetAllocation = {
    systemPrompt: 0,
    rules: 0,
    fewShotExamples: 0,
    contextFiles: 0,
    repoMap: 0,
    taskDescription: 0,
    conversationHistory: 0,
    reservedForOutput: capacity.maxOutput,
    total: totalChars,
  };

  // Calculate raw allocations
  let redistributable = 0;
  const sections: (keyof typeof profile)[] = [
    'systemPrompt',
    'rules',
    'fewShotExamples',
    'contextFiles',
    'repoMap',
    'taskDescription',
    'conversationHistory',
  ];

  // First pass: identify disabled sections and collect redistributable budget
  const activePercentages: Record<string, number> = {};
  for (const section of sections) {
    let pct = profile[section] ?? 0;

    // Disable sections based on options
    if (section === 'repoMap' && !includeRepoMap) {
      redistributable += pct;
      pct = 0;
    }
    if (section === 'fewShotExamples' && !includeFewShot) {
      redistributable += pct;
      pct = 0;
    }
    if (section === 'conversationHistory' && conversationLength === 0) {
      redistributable += pct;
      pct = 0;
    }

    activePercentages[section] = pct;
  }

  // Redistribute unused budget proportionally to active sections
  const activeTotal = Object.values(activePercentages).reduce((a, b) => a + b, 0);
  if (activeTotal > 0 && redistributable > 0) {
    for (const section of sections) {
      if (activePercentages[section] > 0) {
        activePercentages[section] +=
          redistributable * (activePercentages[section] / activeTotal);
      }
    }
  }

  // Second pass: assign character budgets
  for (const section of sections) {
    const chars = Math.floor(totalChars * (activePercentages[section] ?? 0));
    (allocation as Record<string, number>)[section] = chars;
  }

  return allocation;
}

/**
 * Estimate token count from a string.
 * Uses the rough heuristic: 1 token ≈ 4 characters for English/code.
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/**
 * Truncate text to fit within a character budget, preserving structure where
 * possible.
 *
 * Strategies:
 * - 'end': Cut at the end, append ellipsis marker.
 * - 'middle': Keep first 40% and last 40%, insert truncation marker.
 * - 'smart': For code, attempt to cut at function/class boundaries.
 */
export function truncateToFit(
  text: string,
  maxChars: number,
  strategy: 'end' | 'middle' | 'smart' = 'end',
): string {
  if (!text || text.length <= maxChars) {
    return text;
  }

  if (maxChars <= 0) {
    return '';
  }

  const marker = '\n... [truncated] ...\n';
  const markerLen = marker.length;

  switch (strategy) {
    case 'end':
      return truncateEnd(text, maxChars);

    case 'middle':
      return truncateMiddle(text, maxChars, marker, markerLen);

    case 'smart':
      return truncateSmart(text, maxChars, marker, markerLen);

    default:
      return truncateEnd(text, maxChars);
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function truncateEnd(text: string, maxChars: number): string {
  const suffix = '\n... [truncated]';
  if (maxChars <= suffix.length) {
    return text.slice(0, maxChars);
  }
  return text.slice(0, maxChars - suffix.length) + suffix;
}

function truncateMiddle(
  text: string,
  maxChars: number,
  marker: string,
  markerLen: number,
): string {
  const available = maxChars - markerLen;
  if (available <= 0) {
    return text.slice(0, maxChars);
  }

  // Split available space 50/50 between head and tail.
  // Since marker takes ~20% of maxChars, each side gets ~40% of total.
  const headChars = Math.floor(available * 0.5);
  const tailChars = available - headChars;

  return text.slice(0, headChars) + marker + text.slice(text.length - tailChars);
}

function truncateSmart(
  text: string,
  maxChars: number,
  marker: string,
  markerLen: number,
): string {
  // Attempt to find function/class boundaries to make clean cuts.
  // We look for common code boundary patterns.
  const boundaryPatterns = [
    /^(?:export\s+)?(?:async\s+)?function\s+/m,
    /^(?:export\s+)?class\s+/m,
    /^(?:export\s+)?(?:const|let|var)\s+\w+\s*=/m,
    /^(?:export\s+)?(?:interface|type|enum)\s+/m,
    /^def\s+/m,
    /^class\s+/m,
    /^\s*\n/m, // blank line as fallback boundary
  ];

  const available = maxChars - markerLen;
  if (available <= 0) {
    return text.slice(0, maxChars);
  }

  // Target: keep first ~50% and last ~50% of available budget, cutting at boundaries
  const targetHead = Math.floor(available * 0.5);
  const targetTail = available - targetHead;

  // Find a good cut point for the head (search backwards from targetHead for a boundary)
  let headEnd = targetHead;

  // Find the last newline before targetHead as a minimum decent boundary
  const lastNewline = text.lastIndexOf('\n', targetHead);
  if (lastNewline > targetHead * 0.7) {
    headEnd = lastNewline;
  }

  // Try to find a better boundary (function/class start) near the cut point
  for (const pattern of boundaryPatterns) {
    const searchRegion = text.slice(Math.max(0, headEnd - 300), headEnd + 100);
    const match = searchRegion.match(pattern);
    if (match && match.index !== undefined) {
      const absolutePos = Math.max(0, headEnd - 300) + match.index;
      // Only use this boundary if it doesn't lose too much content
      if (absolutePos > targetHead * 0.6 && absolutePos < targetHead * 1.2) {
        headEnd = absolutePos;
        break;
      }
    }
  }

  // Find a good cut point for the tail (search forward from text.length - targetTail)
  const tailStart = text.length - targetTail;
  let tailBegin = tailStart;

  // Find the next newline after tailStart
  const nextNewline = text.indexOf('\n', tailStart);
  if (nextNewline !== -1 && nextNewline < tailStart + 200) {
    tailBegin = nextNewline + 1;
  }

  // Try to find a function/class boundary near the tail start
  for (const pattern of boundaryPatterns) {
    const searchRegion = text.slice(tailBegin, Math.min(text.length, tailBegin + 500));
    const match = searchRegion.match(pattern);
    if (match && match.index !== undefined) {
      const absolutePos = tailBegin + match.index;
      if (absolutePos < tailStart + 500) {
        tailBegin = absolutePos;
        break;
      }
    }
  }

  // Ensure we don't exceed budget
  const headPart = text.slice(0, headEnd);
  const tailPart = text.slice(tailBegin);

  if (headPart.length + markerLen + tailPart.length <= maxChars) {
    return headPart + marker + tailPart;
  }

  // Fallback to middle strategy if smart boundaries exceeded budget
  return truncateMiddle(text, maxChars, marker, markerLen);
}
