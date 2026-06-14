/**
 * Intelligent Model Router — selects the optimal model for a given task.
 *
 * Routes simple tasks to cheap/fast models and complex tasks to powerful ones.
 * Considers cost, latency, quality tradeoffs, and available model capabilities.
 * Checks environment variables to determine which providers are available.
 */

export type AvailableModel = {
  id: string;
  provider: string;
  tier: 'weak' | 'medium' | 'strong' | 'frontier';
  costPer1kTokens: number;
  avgLatencyMs: number;
  maxContext: number;
  strengths: string[];
};

export type RoutingDecision = {
  selectedModel: AvailableModel;
  reason: string;
  alternatives: { model: AvailableModel; reason: string }[];
  estimatedCost: number;
  estimatedLatency: number;
  confidence: number;
};

export type RoutingOptions = {
  taskDescription: string;
  taskCategory?: string;
  complexity?: number;
  preferSpeed?: boolean;
  preferCost?: boolean;
  preferQuality?: boolean;
  maxCostPerRequest?: number;
  requiredContext?: number;
  availableModels?: AvailableModel[];
};

/**
 * Model registry with known models and their characteristics.
 * Cost is approximate per 1k tokens (blended input/output).
 */
const MODEL_REGISTRY: AvailableModel[] = [
  // Frontier tier
  {
    id: 'claude-opus-4-8',
    provider: 'anthropic',
    tier: 'frontier',
    costPer1kTokens: 0.045,
    avgLatencyMs: 8000,
    maxContext: 200000,
    strengths: ['reasoning', 'code', 'analysis', 'complex_tasks'],
  },
  {
    id: 'claude-sonnet-4-6',
    provider: 'anthropic',
    tier: 'frontier',
    costPer1kTokens: 0.039,
    avgLatencyMs: 5000,
    maxContext: 200000,
    strengths: ['reasoning', 'code', 'analysis', 'speed'],
  },
  {
    id: 'gpt-4-turbo',
    provider: 'openai',
    tier: 'frontier',
    costPer1kTokens: 0.040,
    avgLatencyMs: 6000,
    maxContext: 128000,
    strengths: ['reasoning', 'code', 'general', 'instruction_following'],
  },

  // Strong tier
  {
    id: 'claude-haiku-4-5-20251001',
    provider: 'anthropic',
    tier: 'strong',
    costPer1kTokens: 0.012,
    avgLatencyMs: 3000,
    maxContext: 200000,
    strengths: ['code', 'reasoning', 'speed', 'instruction_following'],
  },
  {
    id: 'gpt-4o',
    provider: 'openai',
    tier: 'strong',
    costPer1kTokens: 0.010,
    avgLatencyMs: 2500,
    maxContext: 128000,
    strengths: ['code', 'reasoning', 'speed', 'multimodal'],
  },
  {
    id: 'qwen2.5-coder-32b',
    provider: 'ollama',
    tier: 'strong',
    costPer1kTokens: 0.0,
    avgLatencyMs: 4000,
    maxContext: 32000,
    strengths: ['code', 'local', 'privacy'],
  },
  {
    id: 'deepseek-coder-v2',
    provider: 'ollama',
    tier: 'strong',
    costPer1kTokens: 0.0,
    avgLatencyMs: 4500,
    maxContext: 128000,
    strengths: ['code', 'reasoning', 'local', 'privacy'],
  },

  // Medium tier
  {
    id: 'gpt-4o-mini',
    provider: 'openai',
    tier: 'medium',
    costPer1kTokens: 0.0003,
    avgLatencyMs: 1500,
    maxContext: 128000,
    strengths: ['speed', 'cost', 'code', 'general'],
  },
  {
    id: 'llama-3.1-70b',
    provider: 'groq',
    tier: 'medium',
    costPer1kTokens: 0.0008,
    avgLatencyMs: 800,
    maxContext: 131072,
    strengths: ['speed', 'code', 'reasoning', 'cost'],
  },
  {
    id: 'mixtral-8x7b',
    provider: 'groq',
    tier: 'medium',
    costPer1kTokens: 0.0005,
    avgLatencyMs: 600,
    maxContext: 32000,
    strengths: ['speed', 'cost', 'general'],
  },
  {
    id: 'qwen2.5-coder-7b',
    provider: 'ollama',
    tier: 'medium',
    costPer1kTokens: 0.0,
    avgLatencyMs: 2000,
    maxContext: 32000,
    strengths: ['code', 'local', 'privacy', 'cost'],
  },

  // Weak tier (fast and cheap)
  {
    id: 'llama-3.1-8b',
    provider: 'groq',
    tier: 'weak',
    costPer1kTokens: 0.0001,
    avgLatencyMs: 300,
    maxContext: 131072,
    strengths: ['speed', 'cost'],
  },
  {
    id: 'phi-4',
    provider: 'ollama',
    tier: 'weak',
    costPer1kTokens: 0.0,
    avgLatencyMs: 1000,
    maxContext: 16000,
    strengths: ['speed', 'cost', 'local', 'reasoning'],
  },
  {
    id: 'gemma-2-9b',
    provider: 'ollama',
    tier: 'weak',
    costPer1kTokens: 0.0,
    avgLatencyMs: 1200,
    maxContext: 8000,
    strengths: ['speed', 'cost', 'local'],
  },
];

/**
 * Map of provider names to the environment variables that indicate availability.
 */
const PROVIDER_ENV_VARS: Record<string, string[]> = {
  openai: ['OPENAI_API_KEY'],
  anthropic: ['ANTHROPIC_API_KEY'],
  groq: ['GROQ_API_KEY'],
  ollama: ['OLLAMA_BASE_URL', 'OLLAMA_HOST'],
};

/**
 * Check if a provider is available based on environment variables.
 */
function isProviderAvailable(provider: string): boolean {
  const envVars = PROVIDER_ENV_VARS[provider];
  if (!envVars) return false;

  for (const envVar of envVars) {
    const value = process.env[envVar];
    if (value && value.trim().length > 0) {
      return true;
    }
  }

  // Ollama is often available locally without explicit env var
  if (provider === 'ollama') {
    return true;
  }

  return false;
}

/**
 * Get the list of available models based on environment configuration.
 *
 * Checks for provider API keys in environment variables and returns
 * only models from providers that are configured.
 *
 * @returns Array of available models
 *
 * @example
 * ```ts
 * // With OPENAI_API_KEY set:
 * const models = getAvailableModels();
 * // Returns OpenAI models + Ollama models (always available)
 * ```
 */
export function getAvailableModels(): AvailableModel[] {
  return MODEL_REGISTRY.filter((model) => isProviderAvailable(model.provider));
}

/**
 * Get the model tier classification for a given model ID.
 *
 * @param modelId - The model identifier string
 * @returns The tier classification
 *
 * @example
 * ```ts
 * getModelTier('gpt-4o') // 'strong'
 * getModelTier('llama-3.1-8b') // 'weak'
 * getModelTier('unknown-model') // 'medium' (default)
 * ```
 */
export function getModelTier(modelId: string): 'weak' | 'medium' | 'strong' | 'frontier' {
  const normalizedId = modelId.toLowerCase();

  // Check exact matches first
  const registryMatch = MODEL_REGISTRY.find(
    (m) => m.id.toLowerCase() === normalizedId
  );
  if (registryMatch) return registryMatch.tier;

  // Pattern-based classification for models not in registry
  const frontierPatterns = [
    /claude.*opus/i,
    /claude.*fable/i,
    /claude-sonnet-4/i,
    /gpt-4-turbo/i,
    /gpt-4-(?!mini|o-mini)/i,
    /o1-preview/i,
    /o1-pro/i,
  ];

  const strongPatterns = [
    /claude.*sonnet/i,
    /gpt-4o(?!-mini)/i,
    /qwen.*32b/i,
    /deepseek.*coder.*v2/i,
    /deepseek.*v3/i,
    /llama.*405b/i,
  ];

  const mediumPatterns = [
    /gpt-4o-mini/i,
    /llama.*70b/i,
    /mixtral/i,
    /qwen.*7b/i,
    /qwen.*14b/i,
    /codellama.*34b/i,
    /deepseek.*coder(?!.*v2)/i,
  ];

  const weakPatterns = [
    /llama.*8b/i,
    /phi-[234]/i,
    /gemma.*[29]b/i,
    /mistral.*7b/i,
    /qwen.*[0-3]b/i,
    /tinyllama/i,
  ];

  for (const pattern of frontierPatterns) {
    if (pattern.test(normalizedId)) return 'frontier';
  }
  for (const pattern of strongPatterns) {
    if (pattern.test(normalizedId)) return 'strong';
  }
  for (const pattern of mediumPatterns) {
    if (pattern.test(normalizedId)) return 'medium';
  }
  for (const pattern of weakPatterns) {
    if (pattern.test(normalizedId)) return 'weak';
  }

  // Default to medium if unknown
  return 'medium';
}

/**
 * Determine the minimum required tier based on task complexity.
 */
function getMinimumTier(complexity: number): 'weak' | 'medium' | 'strong' | 'frontier' {
  if (complexity <= 0.1) return 'weak';
  if (complexity <= 0.3) return 'medium';
  if (complexity <= 0.6) return 'strong';
  return 'frontier';
}

/**
 * Numeric tier ordering for comparison.
 */
const TIER_ORDER: Record<string, number> = {
  weak: 0,
  medium: 1,
  strong: 2,
  frontier: 3,
};

/**
 * Score a model for a given routing scenario.
 * Higher score = better fit.
 */
function scoreModel(
  model: AvailableModel,
  options: RoutingOptions,
  minimumTier: 'weak' | 'medium' | 'strong' | 'frontier'
): number {
  let score = 0;

  // Base score from tier appropriateness
  const tierDiff = TIER_ORDER[model.tier] - TIER_ORDER[minimumTier];
  if (tierDiff < 0) {
    // Model is below minimum tier — heavy penalty
    score -= 100;
  } else if (tierDiff === 0) {
    // Perfect tier match
    score += 50;
  } else if (tierDiff === 1) {
    // One tier above — slight bonus for quality, slight penalty for cost
    score += 30;
  } else {
    // Overkill — diminishing returns
    score += 20;
  }

  // Speed preference
  if (options.preferSpeed) {
    // Reward low latency (normalize: 300ms = best, 8000ms = worst)
    const latencyScore = 1 - Math.min(model.avgLatencyMs / 8000, 1);
    score += latencyScore * 40;

    // Bonus for Groq (known for fast inference)
    if (model.provider === 'groq') {
      score += 15;
    }
  }

  // Cost preference
  if (options.preferCost) {
    // Reward low cost (normalize: 0 = best, 0.05 = worst)
    const costScore = 1 - Math.min(model.costPer1kTokens / 0.05, 1);
    score += costScore * 40;

    // Bonus for local/free models
    if (model.costPer1kTokens === 0) {
      score += 20;
    }
  }

  // Quality preference (default if nothing else specified)
  if (options.preferQuality || (!options.preferSpeed && !options.preferCost)) {
    score += TIER_ORDER[model.tier] * 15;

    // Bonus for code-specialized models on coding tasks
    if (model.strengths.includes('code')) {
      score += 10;
    }
    if (model.strengths.includes('reasoning')) {
      score += 8;
    }
  }

  // Budget constraint
  if (options.maxCostPerRequest !== undefined) {
    // Estimate tokens for this task (rough: 2k input + 2k output = 4k tokens)
    const estimatedTokens = 4;
    const estimatedCost = model.costPer1kTokens * estimatedTokens;
    if (estimatedCost > options.maxCostPerRequest) {
      score -= 200; // Hard penalty for exceeding budget
    }
  }

  // Context window requirement
  if (options.requiredContext !== undefined && model.maxContext < options.requiredContext) {
    score -= 200; // Hard penalty for insufficient context
  }

  // Category-specific bonuses
  if (options.taskCategory) {
    const category = options.taskCategory;
    if (
      (category === 'explanation' || category === 'documentation') &&
      model.strengths.includes('general')
    ) {
      score += 5;
    }
    if (
      (category === 'bug_fix' || category === 'debugging') &&
      model.strengths.includes('reasoning')
    ) {
      score += 8;
    }
    if (
      category === 'feature_implementation' &&
      model.strengths.includes('code')
    ) {
      score += 8;
    }
  }

  return score;
}

/**
 * Estimate the cost for a task based on the model and complexity.
 */
function estimateCost(model: AvailableModel, complexity: number): number {
  // Rough token estimate based on complexity
  // Trivial: ~1k tokens, Complex: ~10k tokens
  const estimatedTokensK = 1 + complexity * 9;
  return Math.round(model.costPer1kTokens * estimatedTokensK * 10000) / 10000;
}

/**
 * Estimate latency for a task based on the model and complexity.
 */
function estimateLatency(model: AvailableModel, complexity: number): number {
  // More complex tasks generate more tokens, increasing latency
  const multiplier = 1 + complexity * 2;
  return Math.round(model.avgLatencyMs * multiplier);
}

/**
 * Route a task to the optimal model based on task characteristics and preferences.
 *
 * Considers task complexity, user preferences (speed/cost/quality), budget
 * constraints, context window requirements, and available models to select
 * the best model for the job.
 *
 * @param options - Routing options including task description, complexity, and preferences
 * @returns A RoutingDecision with the selected model, alternatives, and reasoning
 *
 * @example
 * ```ts
 * const decision = routeTask({
 *   taskDescription: "Fix typo in README",
 *   complexity: 0.05,
 *   preferCost: true,
 * });
 * // decision.selectedModel.tier === 'weak'
 * // decision.reason includes "trivial"
 * ```
 *
 * @example
 * ```ts
 * const decision = routeTask({
 *   taskDescription: "Implement distributed caching layer",
 *   complexity: 0.8,
 *   preferQuality: true,
 * });
 * // decision.selectedModel.tier === 'frontier'
 * ```
 */
export function routeTask(options: RoutingOptions): RoutingDecision {
  const complexity = options.complexity ?? 0.5;
  const models = options.availableModels ?? getAvailableModels();

  if (models.length === 0) {
    // Fallback: return a default model if nothing is available
    const fallback: AvailableModel = {
      id: 'gpt-4o-mini',
      provider: 'openai',
      tier: 'medium',
      costPer1kTokens: 0.0003,
      avgLatencyMs: 1500,
      maxContext: 128000,
      strengths: ['speed', 'cost', 'code', 'general'],
    };
    return {
      selectedModel: fallback,
      reason: 'No models available from configured providers. Defaulting to gpt-4o-mini.',
      alternatives: [],
      estimatedCost: estimateCost(fallback, complexity),
      estimatedLatency: estimateLatency(fallback, complexity),
      confidence: 0.3,
    };
  }

  const minimumTier = getMinimumTier(complexity);

  // Score all models
  const scoredModels = models
    .map((model) => ({
      model,
      score: scoreModel(model, options, minimumTier),
    }))
    .sort((a, b) => b.score - a.score);

  const selected = scoredModels[0];
  const alternatives = scoredModels
    .slice(1, 4)
    .filter((s) => s.score > -100) // Only include viable alternatives
    .map((s) => ({
      model: s.model,
      reason: generateAlternativeReason(s.model, selected.model, options),
    }));

  // Generate reason for selection
  const reason = generateSelectionReason(selected.model, options, complexity, minimumTier);

  // Calculate confidence based on score gap
  let confidence = 0.7;
  if (scoredModels.length > 1) {
    const gap = selected.score - scoredModels[1].score;
    if (gap > 30) confidence = 0.9;
    else if (gap > 15) confidence = 0.8;
    else if (gap > 5) confidence = 0.7;
    else confidence = 0.6;
  }

  // Boost confidence if tier matches perfectly
  if (selected.model.tier === minimumTier) {
    confidence = Math.min(confidence + 0.05, 0.95);
  }

  return {
    selectedModel: selected.model,
    reason,
    alternatives,
    estimatedCost: estimateCost(selected.model, complexity),
    estimatedLatency: estimateLatency(selected.model, complexity),
    confidence: Math.round(confidence * 100) / 100,
  };
}

/**
 * Generate a human-readable reason for why a model was selected.
 */
function generateSelectionReason(
  model: AvailableModel,
  options: RoutingOptions,
  complexity: number,
  minimumTier: string
): string {
  const parts: string[] = [];

  // Complexity-based reasoning
  if (complexity <= 0.1) {
    parts.push('Task is trivial');
  } else if (complexity <= 0.3) {
    parts.push('Task is simple');
  } else if (complexity <= 0.6) {
    parts.push('Task has moderate complexity');
  } else if (complexity <= 0.75) {
    parts.push('Task is complex');
  } else {
    parts.push('Task is very complex');
  }

  parts.push(`requiring at least ${minimumTier}-tier model`);

  // Preference-based reasoning
  if (options.preferSpeed) {
    parts.push(`optimized for speed (${model.avgLatencyMs}ms avg latency)`);
  } else if (options.preferCost) {
    parts.push(
      `optimized for cost ($${model.costPer1kTokens}/1k tokens)`
    );
  } else {
    parts.push(`${model.id} selected for best quality/cost balance`);
  }

  return parts.join('; ') + '.';
}

/**
 * Generate a reason for why an alternative model could be used.
 */
function generateAlternativeReason(
  alternative: AvailableModel,
  selected: AvailableModel,
  _options: RoutingOptions
): string {
  if (alternative.avgLatencyMs < selected.avgLatencyMs) {
    return `Faster (${alternative.avgLatencyMs}ms vs ${selected.avgLatencyMs}ms) but potentially lower quality`;
  }
  if (alternative.costPer1kTokens < selected.costPer1kTokens) {
    return `Cheaper ($${alternative.costPer1kTokens} vs $${selected.costPer1kTokens}/1k tokens)`;
  }
  if (TIER_ORDER[alternative.tier] > TIER_ORDER[selected.tier]) {
    return `Higher quality (${alternative.tier} tier) but more expensive`;
  }
  if (alternative.maxContext > selected.maxContext) {
    return `Larger context window (${alternative.maxContext} vs ${selected.maxContext} tokens)`;
  }
  if (alternative.strengths.includes('local')) {
    return 'Local model — no data leaves your machine';
  }
  return `Alternative ${alternative.tier}-tier option from ${alternative.provider}`;
}
