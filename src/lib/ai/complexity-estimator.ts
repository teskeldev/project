/**
 * Complexity Estimator — estimates how complex a coding task is.
 *
 * Used for model routing (complex tasks need stronger models) and
 * for determining decomposition strategy. Produces a normalized 0-1
 * score along with individual factor breakdowns.
 */

export type ComplexityScore = {
  score: number;
  level: 'trivial' | 'simple' | 'moderate' | 'complex' | 'very_complex';
  factors: ComplexityFactor[];
  recommendation: string;
};

export type ComplexityFactor = {
  name: string;
  weight: number;
  value: number;
  description: string;
};

export type ComplexityInput = {
  taskDescription: string;
  taskCategory?: string;
  affectedFiles?: number;
  codebaseSize?: number;
  hasExistingTests?: boolean;
  requiresArchitecturalChange?: boolean;
  involvesConcurrency?: boolean;
  involvesExternalAPIs?: boolean;
  involvesDatabase?: boolean;
  involvesAuth?: boolean;
};

/**
 * Keywords that indicate high complexity in a task description.
 */
const COMPLEXITY_KEYWORDS: { pattern: RegExp; weight: number }[] = [
  { pattern: /\b(distributed|microservice|event[- ]driven)\b/i, weight: 0.15 },
  { pattern: /\b(concurrent|parallel|thread[- ]safe|race condition)\b/i, weight: 0.12 },
  { pattern: /\b(migration|breaking change|backward compat)\b/i, weight: 0.12 },
  { pattern: /\b(security|vulnerabilit|exploit|injection)\b/i, weight: 0.10 },
  { pattern: /\b(real[- ]time|streaming|websocket|sse)\b/i, weight: 0.08 },
  { pattern: /\b(transaction|rollback|consistency|acid)\b/i, weight: 0.10 },
  { pattern: /\b(cache invalidat|eventual consistency)\b/i, weight: 0.10 },
  { pattern: /\b(polymorphi|inheritance|generic|type[- ]system)\b/i, weight: 0.06 },
  { pattern: /\b(recursive|graph|tree traversal|dynamic programming)\b/i, weight: 0.08 },
  { pattern: /\b(state machine|finite automata|parser)\b/i, weight: 0.10 },
  { pattern: /\b(cross[- ]platform|compatibility|polyfill)\b/i, weight: 0.06 },
  { pattern: /\b(encryption|cryptograph|hash|signing)\b/i, weight: 0.08 },
  { pattern: /\b(oauth|jwt|saml|openid)\b/i, weight: 0.07 },
  { pattern: /\b(queue|pub[- ]?sub|message broker|kafka)\b/i, weight: 0.08 },
  { pattern: /\b(kubernetes|docker|container|orchestrat)\b/i, weight: 0.06 },
];

/**
 * Keywords that indicate low complexity.
 */
const SIMPLICITY_KEYWORDS: RegExp[] = [
  /\b(typo|rename|comment|format|lint|trivial)\b/i,
  /\b(one[- ]liner|simple|quick|minor|small)\b/i,
  /\b(update text|change string|fix label|adjust spacing)\b/i,
];

/**
 * Calculate the description length factor.
 * Longer descriptions tend to correlate with more complex tasks.
 *
 * @param description - The task description
 * @returns A value between 0 and 0.15
 */
function calcDescriptionLengthFactor(description: string): ComplexityFactor {
  const wordCount = description.split(/\s+/).filter((w) => w.length > 0).length;

  // Normalize: 0 words = 0, 100+ words = max
  let value = Math.min(wordCount / 100, 1.0);

  // Apply diminishing returns
  value = Math.sqrt(value);

  const weight = 0.15;

  return {
    name: 'description_length',
    weight,
    value: Math.round(value * 100) / 100,
    description: `Task description has ${wordCount} words (longer descriptions suggest more complexity)`,
  };
}

/**
 * Calculate the multi-file factor based on number of affected files.
 *
 * @param affectedFiles - Number of files that need changes
 * @param codebaseSize - Total files in the project
 * @returns A value between 0 and 0.20
 */
function calcMultiFileFactor(affectedFiles?: number, codebaseSize?: number): ComplexityFactor {
  if (affectedFiles === undefined || affectedFiles <= 1) {
    return {
      name: 'multi_file',
      weight: 0.20,
      value: 0,
      description: 'Single file or no file information provided',
    };
  }

  // Normalize: 1 file = 0, 20+ files = max
  let value = Math.min((affectedFiles - 1) / 19, 1.0);

  // If we know codebase size, factor in the ratio
  if (codebaseSize && codebaseSize > 0) {
    const ratio = affectedFiles / codebaseSize;
    // If touching >20% of codebase, that's very complex
    if (ratio > 0.2) {
      value = Math.max(value, 0.9);
    }
  }

  return {
    name: 'multi_file',
    weight: 0.20,
    value: Math.round(value * 100) / 100,
    description: `${affectedFiles} files affected${codebaseSize ? ` out of ${codebaseSize} total` : ''}`,
  };
}

/**
 * Calculate the architectural change factor.
 */
function calcArchitecturalFactor(requiresArchitecturalChange?: boolean): ComplexityFactor {
  return {
    name: 'architectural_change',
    weight: 0.20,
    value: requiresArchitecturalChange ? 1.0 : 0,
    description: requiresArchitecturalChange
      ? 'Requires architectural changes (high impact, high risk)'
      : 'No architectural changes needed',
  };
}

/**
 * Calculate the concurrency/async factor.
 */
function calcConcurrencyFactor(involvesConcurrency?: boolean): ComplexityFactor {
  return {
    name: 'concurrency',
    weight: 0.10,
    value: involvesConcurrency ? 1.0 : 0,
    description: involvesConcurrency
      ? 'Involves concurrency/async patterns (race conditions, deadlocks possible)'
      : 'No concurrency concerns',
  };
}

/**
 * Calculate the external API factor.
 */
function calcExternalAPIFactor(involvesExternalAPIs?: boolean): ComplexityFactor {
  return {
    name: 'external_apis',
    weight: 0.10,
    value: involvesExternalAPIs ? 1.0 : 0,
    description: involvesExternalAPIs
      ? 'Involves external API integration (network, error handling, rate limits)'
      : 'No external API integration',
  };
}

/**
 * Calculate the database factor.
 */
function calcDatabaseFactor(involvesDatabase?: boolean): ComplexityFactor {
  return {
    name: 'database',
    weight: 0.10,
    value: involvesDatabase ? 1.0 : 0,
    description: involvesDatabase
      ? 'Involves database changes (schema, queries, migrations)'
      : 'No database changes',
  };
}

/**
 * Calculate the auth/security factor.
 */
function calcAuthFactor(involvesAuth?: boolean): ComplexityFactor {
  return {
    name: 'auth_security',
    weight: 0.10,
    value: involvesAuth ? 1.0 : 0,
    description: involvesAuth
      ? 'Involves authentication/security (high correctness requirements)'
      : 'No auth/security concerns',
  };
}

/**
 * Calculate the keyword complexity factor from the description.
 */
function calcKeywordFactor(description: string): ComplexityFactor {
  let totalWeight = 0;
  const matchedKeywords: string[] = [];

  for (const { pattern, weight } of COMPLEXITY_KEYWORDS) {
    if (pattern.test(description)) {
      totalWeight += weight;
      const match = description.match(pattern);
      if (match) matchedKeywords.push(match[0]);
    }
  }

  // Check for simplicity keywords that reduce complexity
  let simplicityReduction = 0;
  for (const pattern of SIMPLICITY_KEYWORDS) {
    if (pattern.test(description)) {
      simplicityReduction += 0.3;
    }
  }

  // Normalize to 0-1 range (cap at 0.5 total keyword weight = max)
  let value = Math.min(totalWeight / 0.5, 1.0);
  value = Math.max(value - simplicityReduction, 0);

  return {
    name: 'keyword_complexity',
    weight: 0.15,
    value: Math.round(value * 100) / 100,
    description:
      matchedKeywords.length > 0
        ? `Complexity keywords found: ${matchedKeywords.join(', ')}`
        : 'No specific complexity keywords detected',
  };
}

/**
 * Map a numeric score to a complexity level.
 */
function scoreToLevel(score: number): 'trivial' | 'simple' | 'moderate' | 'complex' | 'very_complex' {
  if (score <= 0.1) return 'trivial';
  if (score <= 0.3) return 'simple';
  if (score <= 0.55) return 'moderate';
  if (score <= 0.75) return 'complex';
  return 'very_complex';
}

/**
 * Generate a recommendation based on the complexity level.
 */
function getRecommendation(level: string): string {
  switch (level) {
    case 'trivial':
      return 'Use fastest/cheapest available model. Task is straightforward.';
    case 'simple':
      return 'A medium-tier model should handle this well. Minimal decomposition needed.';
    case 'moderate':
      return 'Use a strong model. Consider breaking into 2-3 subtasks.';
    case 'complex':
      return 'Use strongest available model. Decompose into multiple focused subtasks.';
    case 'very_complex':
      return 'Use frontier model with careful decomposition. Consider multi-step planning phase.';
    default:
      return 'Assess further before selecting a model.';
  }
}

/**
 * Estimate the complexity of a coding task.
 *
 * Produces a normalized 0-1 score based on multiple weighted factors
 * including description analysis, file scope, architectural impact,
 * and domain-specific concerns (concurrency, APIs, databases, auth).
 *
 * @param input - The complexity estimation input parameters
 * @returns A ComplexityScore with the overall score, level, factors, and recommendation
 *
 * @example
 * ```ts
 * const score = estimateComplexity({
 *   taskDescription: "Implement distributed caching with Redis",
 *   affectedFiles: 8,
 *   involvesExternalAPIs: true,
 *   involvesConcurrency: true,
 * });
 * // score.level === 'complex'
 * // score.score ≈ 0.65
 * ```
 */
export function estimateComplexity(input: ComplexityInput): ComplexityScore {
  const {
    taskDescription,
    affectedFiles,
    codebaseSize,
    requiresArchitecturalChange,
    involvesConcurrency,
    involvesExternalAPIs,
    involvesDatabase,
    involvesAuth,
  } = input;

  // Calculate all factors
  const factors: ComplexityFactor[] = [
    calcDescriptionLengthFactor(taskDescription),
    calcMultiFileFactor(affectedFiles, codebaseSize),
    calcArchitecturalFactor(requiresArchitecturalChange),
    calcConcurrencyFactor(involvesConcurrency),
    calcExternalAPIFactor(involvesExternalAPIs),
    calcDatabaseFactor(involvesDatabase),
    calcAuthFactor(involvesAuth),
    calcKeywordFactor(taskDescription),
  ];

  // Calculate weighted score
  let totalWeightedValue = 0;
  let totalWeight = 0;

  for (const factor of factors) {
    totalWeightedValue += factor.value * factor.weight;
    totalWeight += factor.weight;
  }

  // Normalize to 0-1
  const score = totalWeight > 0
    ? Math.round((totalWeightedValue / totalWeight) * 100) / 100
    : 0;

  const level = scoreToLevel(score);
  const recommendation = getRecommendation(level);

  return {
    score,
    level,
    factors,
    recommendation,
  };
}
