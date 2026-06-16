/**
 * Task Classifier — determines the type and characteristics of a coding task
 * from the user's natural language description.
 *
 * Uses keyword matching and heuristics to classify tasks without requiring
 * an LLM call, enabling fast routing decisions at near-zero cost.
 */

export type TaskCategory =
  | 'bug_fix'
  | 'feature_implementation'
  | 'refactoring'
  | 'test_writing'
  | 'code_review'
  | 'explanation'
  | 'debugging'
  | 'optimization'
  | 'documentation'
  | 'configuration'
  | 'migration'
  | 'unknown';

export type TaskCharacteristics = {
  category: TaskCategory;
  confidence: number;
  requiresMultiFile: boolean;
  requiresNewCode: boolean;
  requiresTests: boolean;
  requiresContext: boolean;
  isDestructive: boolean;
  estimatedScope: 'trivial' | 'small' | 'medium' | 'large' | 'epic';
  suggestedApproach: string;
  keywords: string[];
};

/**
 * Pattern definitions for each task category.
 * Each entry maps a category to its trigger patterns and associated weights.
 */
const CATEGORY_PATTERNS: Record<TaskCategory, { patterns: RegExp[]; weight: number }> = {
  bug_fix: {
    patterns: [
      /\b(fix|bug|error|broken|crash|issue|fault|defect|regression|fails?|failing)\b/i,
      /\b(doesn'?t work|not working|incorrect|wrong)\b/i,
      /\b(exception|stack ?trace|null pointer|undefined is not)\b/i,
    ],
    weight: 1.0,
  },
  feature_implementation: {
    patterns: [
      /\b(add|implement|create|build|new feature|introduce|develop)\b/i,
      /\b(support for|enable|allow|make it possible)\b/i,
      /\b(integrate|hook up|wire up|connect)\b/i,
    ],
    weight: 1.0,
  },
  refactoring: {
    patterns: [
      /\b(refactor|clean ?up|restructure|rename|extract|simplify|decouple)\b/i,
      /\b(split|decompose|consolidate|reorganize|modularize)\b/i,
      /\b(reduce duplication|dry|single responsibility)\b/i,
    ],
    weight: 1.0,
  },
  test_writing: {
    patterns: [
      /\b(test|spec|coverage|unit test|integration test|e2e)\b/i,
      /\b(assert|expect|mock|stub|fixture)\b/i,
      /\b(test case|test suite|describe|it\s*\()\b/i,
    ],
    weight: 1.0,
  },
  code_review: {
    patterns: [
      /\b(review|check|audit|inspect|look at|evaluate)\b/i,
      /\b(code quality|best practice|anti-?pattern|smell)\b/i,
      /\b(feedback|suggestions?|improvements?)\b/i,
    ],
    weight: 0.8,
  },
  explanation: {
    patterns: [
      /\b(explain|what does|how does|why does|what is|how is)\b/i,
      /\b(understand|walk me through|break down|clarify)\b/i,
      /\b(meaning of|purpose of|reason for)\b/i,
    ],
    weight: 1.0,
  },
  debugging: {
    patterns: [
      /\b(debug|investigate|trace|diagnose|troubleshoot)\b/i,
      /\b(find the cause|root cause|figure out why)\b/i,
      /\b(log|breakpoint|step through)\b/i,
    ],
    weight: 1.0,
  },
  optimization: {
    patterns: [
      /\b(optimize|performance|speed|slow|fast|efficient)\b/i,
      /\b(memory|cpu|latency|throughput|bottleneck)\b/i,
      /\b(cache|lazy|batch|parallel|async)\b/i,
    ],
    weight: 0.9,
  },
  documentation: {
    patterns: [
      /\b(document|jsdoc|readme|comment|docstring)\b/i,
      /\b(api docs?|changelog|guide|tutorial)\b/i,
      /\b(annotate|describe the|write docs?)\b/i,
    ],
    weight: 1.0,
  },
  configuration: {
    patterns: [
      /\b(config|setup|install|env|environment)\b/i,
      /\b(settings?|options?|\.env|yaml|toml|json config)\b/i,
      /\b(ci\/cd|pipeline|docker|deploy)\b/i,
    ],
    weight: 0.9,
  },
  migration: {
    patterns: [
      /\b(migrate|upgrade|update version|breaking change)\b/i,
      /\b(deprecat|move from|switch to|convert to)\b/i,
      /\b(v\d+|major version|schema change)\b/i,
    ],
    weight: 1.0,
  },
  unknown: {
    patterns: [],
    weight: 0,
  },
};

/**
 * Patterns that indicate multi-file scope.
 */
const MULTI_FILE_INDICATORS: RegExp[] = [
  /\b(across|multiple files|all files|everywhere|project-?wide)\b/i,
  /\b(refactor|migrate|rename across|global)\b/i,
  /\b(component|module|service|layer)s\b/i,
];

/**
 * Patterns that indicate new code creation.
 */
const NEW_CODE_INDICATORS: RegExp[] = [
  /\b(create|new file|add a|build a|implement a new|scaffold)\b/i,
  /\b(generate|bootstrap|initialize|set up a new)\b/i,
];

/**
 * Patterns that indicate destructive potential.
 */
const DESTRUCTIVE_INDICATORS: RegExp[] = [
  /\b(delete|remove|drop|destroy|breaking change)\b/i,
  /\b(replace|overwrite|rewrite|migrate away)\b/i,
  /\b(schema change|database migration|api change)\b/i,
];

/**
 * Scope estimation based on description characteristics.
 */
const SCOPE_INDICATORS: Record<string, RegExp[]> = {
  trivial: [/\b(typo|rename|one-?liner|simple|quick|small)\b/i],
  small: [/\b(single file|minor|straightforward|basic)\b/i],
  medium: [/\b(feature|several|a few|moderate)\b/i],
  large: [/\b(multiple|complex|significant|major|overhaul)\b/i],
  epic: [/\b(rewrite|architecture|entire|system-?wide|full)\b/i],
};

/**
 * Suggested approaches per category.
 */
const APPROACH_SUGGESTIONS: Record<TaskCategory, string> = {
  bug_fix: 'Reproduce the issue, identify root cause, implement fix, verify with tests',
  feature_implementation: 'Design the interface, implement core logic, add tests, integrate',
  refactoring: 'Ensure test coverage first, make incremental changes, verify behavior preserved',
  test_writing: 'Identify untested paths, write failing tests, verify they pass with current code',
  code_review: 'Check logic, error handling, edge cases, naming, and adherence to patterns',
  explanation: 'Trace the code flow, identify key abstractions, explain in plain language',
  debugging: 'Add logging, reproduce consistently, bisect to isolate, verify fix',
  optimization: 'Profile first, identify bottleneck, optimize hot path, benchmark before/after',
  documentation: 'Identify audience, document public API, add examples, keep concise',
  configuration: 'Check existing config patterns, validate values, document options',
  migration: 'Create migration plan, handle backward compatibility, test rollback path',
  unknown: 'Analyze the request, gather context, break into smaller steps',
};

/**
 * Extract meaningful keywords from a task description.
 */
function extractKeywords(description: string): string[] {
  const stopWords = new Set([
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'shall', 'can', 'need', 'dare', 'ought',
    'used', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from',
    'as', 'into', 'through', 'during', 'before', 'after', 'above', 'below',
    'between', 'out', 'off', 'over', 'under', 'again', 'further', 'then',
    'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'each',
    'every', 'both', 'few', 'more', 'most', 'other', 'some', 'such', 'no',
    'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very',
    'just', 'because', 'but', 'and', 'or', 'if', 'while', 'that', 'this',
    'it', 'its', 'i', 'me', 'my', 'we', 'our', 'you', 'your', 'he', 'she',
    'they', 'them', 'their', 'what', 'which', 'who', 'whom', 'please',
  ]);

  const words = description
    .toLowerCase()
    .replace(/[^a-z0-9\s\-_.]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stopWords.has(w));

  // Deduplicate while preserving order
  return Array.from(new Set(words));
}

/**
 * Count pattern matches for a given category against the description.
 */
function countMatches(description: string, patterns: RegExp[]): number {
  let count = 0;
  for (const pattern of patterns) {
    if (pattern.test(description)) {
      count++;
    }
  }
  return count;
}

/**
 * Determine whether the task likely requires tests.
 */
function shouldRequireTests(category: TaskCategory, description: string): boolean {
  if (category === 'test_writing') return true;
  if (category === 'explanation' || category === 'documentation' || category === 'code_review') {
    return false;
  }
  // Bug fixes and features should generally have tests
  if (category === 'bug_fix' || category === 'feature_implementation') return true;
  // Refactoring should preserve existing tests
  if (category === 'refactoring') return true;
  // Check for explicit test mentions
  return /\b(test|spec|coverage)\b/i.test(description);
}

/**
 * Determine whether the task requires understanding existing code context.
 */
function shouldRequireContext(
  category: TaskCategory,
  _description: string,
  context?: { currentFile?: string; recentFiles?: string[] }
): boolean {
  // Most categories need context except pure creation tasks
  if (category === 'explanation' || category === 'debugging' || category === 'code_review') {
    return true;
  }
  if (category === 'bug_fix' || category === 'refactoring' || category === 'optimization') {
    return true;
  }
  // If we have file context, we likely need it
  if (context?.currentFile || (context?.recentFiles && context.recentFiles.length > 0)) {
    return true;
  }
  return category !== 'documentation' && category !== 'configuration';
}

/**
 * Estimate the scope of the task.
 */
function estimateScope(
  description: string,
  category: TaskCategory,
  isMultiFile: boolean
): 'trivial' | 'small' | 'medium' | 'large' | 'epic' {
  // Check explicit scope indicators
  for (const [scope, patterns] of Object.entries(SCOPE_INDICATORS)) {
    for (const pattern of patterns) {
      if (pattern.test(description)) {
        return scope as 'trivial' | 'small' | 'medium' | 'large' | 'epic';
      }
    }
  }

  // Infer from category and characteristics
  if (category === 'explanation' || category === 'documentation') return 'small';
  if (category === 'migration') return 'large';
  if (isMultiFile) return 'medium';

  // Infer from description length (longer descriptions tend to be more complex)
  const wordCount = description.split(/\s+/).length;
  if (wordCount <= 5) return 'trivial';
  if (wordCount <= 15) return 'small';
  if (wordCount <= 40) return 'medium';
  if (wordCount <= 80) return 'large';
  return 'epic';
}

/**
 * Classify a task from the user's natural language description.
 *
 * @param description - The user's task description in natural language
 * @param context - Optional context about the current editing session
 * @returns TaskCharacteristics describing the classified task
 *
 * @example
 * ```ts
 * const result = classifyTask("Fix the null pointer error in the auth module");
 * // result.category === 'bug_fix'
 * // result.confidence === 0.9
 * // result.requiresContext === true
 * ```
 */
export function classifyTask(
  description: string,
  context?: { currentFile?: string; recentFiles?: string[] }
): TaskCharacteristics {
  if (!description || description.trim().length === 0) {
    return {
      category: 'unknown',
      confidence: 0,
      requiresMultiFile: false,
      requiresNewCode: false,
      requiresTests: false,
      requiresContext: false,
      isDestructive: false,
      estimatedScope: 'trivial',
      suggestedApproach: APPROACH_SUGGESTIONS.unknown,
      keywords: [],
    };
  }

  const normalizedDesc = description.trim();

  // Score each category
  const scores: { category: TaskCategory; score: number }[] = [];

  for (const [category, { patterns, weight }] of Object.entries(CATEGORY_PATTERNS)) {
    if (category === 'unknown') continue;
    const matches = countMatches(normalizedDesc, patterns);
    if (matches > 0) {
      // Score is based on number of matches and pattern weight
      const score = Math.min(matches / patterns.length, 1.0) * weight;
      scores.push({ category: category as TaskCategory, score });
    }
  }

  // Sort by score descending
  scores.sort((a, b) => b.score - a.score);

  // Determine winning category
  let category: TaskCategory = 'unknown';
  let confidence = 0;

  if (scores.length > 0) {
    category = scores[0].category;
    confidence = Math.min(scores[0].score + 0.3, 0.95); // Base confidence boost

    // Reduce confidence if there's ambiguity (close second place)
    if (scores.length > 1 && scores[1].score > scores[0].score * 0.7) {
      confidence *= 0.8;
    }

    // Boost confidence if multiple patterns matched
    const matchCount = countMatches(
      normalizedDesc,
      CATEGORY_PATTERNS[category].patterns
    );
    if (matchCount >= 2) {
      confidence = Math.min(confidence + 0.1, 0.95);
    }
  }

  // Determine characteristics
  const requiresMultiFile =
    MULTI_FILE_INDICATORS.some((p) => p.test(normalizedDesc)) ||
    category === 'migration' ||
    category === 'refactoring';

  const requiresNewCode =
    NEW_CODE_INDICATORS.some((p) => p.test(normalizedDesc)) ||
    category === 'feature_implementation' ||
    category === 'test_writing';

  const isDestructive =
    DESTRUCTIVE_INDICATORS.some((p) => p.test(normalizedDesc)) ||
    category === 'migration';

  const requiresTests = shouldRequireTests(category, normalizedDesc);
  const requiresContext = shouldRequireContext(category, normalizedDesc, context);
  const estimatedScope = estimateScope(normalizedDesc, category, requiresMultiFile);
  const keywords = extractKeywords(normalizedDesc);

  return {
    category,
    confidence: Math.round(confidence * 100) / 100,
    requiresMultiFile,
    requiresNewCode,
    requiresTests,
    requiresContext,
    isDestructive,
    estimatedScope,
    suggestedApproach: APPROACH_SUGGESTIONS[category],
    keywords,
  };
}
