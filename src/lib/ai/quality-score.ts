/**
 * Quality Scoring — estimates the quality of AI-generated code.
 * Phase 4.8: Provides a composite score based on multiple quality signals
 * including syntax, lint, types, tests, conciseness, style, and completeness.
 */

export type QualityDimension = {
  name: string;
  score: number;
  weight: number;
  details: string;
};

export type QualityReport = {
  overallScore: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  dimensions: QualityDimension[];
  suggestions: string[];
  confidence: number;
};

export type QualityInput = {
  code: string;
  task?: string;
  language?: string;
  syntaxValid?: boolean;
  lintErrors?: number;
  typeErrors?: number;
  testsPassed?: number;
  testsTotal?: number;
  diffSize?: number;
  originalCode?: string;
};

/**
 * Dimension weights for the composite score.
 */
const WEIGHTS = {
  syntax: 0.25,
  lint: 0.15,
  typeSafety: 0.15,
  testCoverage: 0.20,
  conciseness: 0.10,
  styleConsistency: 0.10,
  completeness: 0.05,
} as const;

/**
 * Grade thresholds.
 */
function scoreToGrade(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
  if (score >= 0.9) return 'A';
  if (score >= 0.8) return 'B';
  if (score >= 0.7) return 'C';
  if (score >= 0.6) return 'D';
  return 'F';
}

/**
 * Score syntax validity.
 * If explicitly provided, use that. Otherwise, do basic heuristic checks.
 */
function scoreSyntax(input: QualityInput): QualityDimension {
  let score: number;
  let details: string;

  if (input.syntaxValid !== undefined) {
    score = input.syntaxValid ? 1.0 : 0.0;
    details = input.syntaxValid ? 'Syntax is valid' : 'Syntax errors detected';
  } else {
    // Heuristic: check for balanced braces/brackets/parens
    score = 1.0;
    const code = input.code;
    const pairs: [string, string][] = [['{', '}'], ['[', ']'], ['(', ')']];

    for (const [open, close] of pairs) {
      const openCount = (code.match(new RegExp(`\\${open}`, 'g')) || []).length;
      const closeCount = (code.match(new RegExp(`\\${close}`, 'g')) || []).length;
      if (openCount !== closeCount) {
        score -= 0.3;
        break;
      }
    }

    // Check for unclosed strings (simple heuristic)
    const singleQuotes = (code.match(/'/g) || []).length;
    const doubleQuotes = (code.match(/"/g) || []).length;
    const backticks = (code.match(/`/g) || []).length;

    if (singleQuotes % 2 !== 0 || doubleQuotes % 2 !== 0 || backticks % 2 !== 0) {
      score -= 0.2;
    }

    score = Math.max(0, score);
    details = score === 1.0 ? 'No obvious syntax issues' : 'Potential syntax issues detected (heuristic)';
  }

  return { name: 'Syntax Validity', score, weight: WEIGHTS.syntax, details };
}

/**
 * Score lint compliance.
 */
function scoreLint(input: QualityInput): QualityDimension {
  let score: number;
  let details: string;

  if (input.lintErrors !== undefined) {
    if (input.lintErrors === 0) {
      score = 1.0;
      details = 'No lint errors';
    } else if (input.lintErrors <= 2) {
      score = 0.8;
      details = `${input.lintErrors} lint error(s)`;
    } else if (input.lintErrors <= 5) {
      score = 0.5;
      details = `${input.lintErrors} lint errors`;
    } else {
      score = Math.max(0, 1.0 - input.lintErrors * 0.1);
      details = `${input.lintErrors} lint errors (significant)`;
    }
  } else {
    // Heuristic checks
    score = 1.0;
    const issues: string[] = [];

    // Check for common lint issues
    if (/var\s/.test(input.code)) {
      score -= 0.1;
      issues.push('uses var instead of let/const');
    }

    if (/==(?!=)/.test(input.code) && input.language !== 'python') {
      score -= 0.05;
      issues.push('uses == instead of ===');
    }

    // Extremely long lines
    const lines = input.code.split('\n');
    const longLines = lines.filter((l) => l.length > 120).length;
    if (longLines > 0) {
      score -= Math.min(0.1, longLines * 0.02);
      issues.push(`${longLines} lines exceed 120 chars`);
    }

    score = Math.max(0, score);
    details = issues.length === 0 ? 'No obvious lint issues' : issues.join('; ');
  }

  return { name: 'Lint Compliance', score, weight: WEIGHTS.lint, details };
}

/**
 * Score type safety.
 */
function scoreTypeSafety(input: QualityInput): QualityDimension {
  let score: number;
  let details: string;

  if (input.typeErrors !== undefined) {
    if (input.typeErrors === 0) {
      score = 1.0;
      details = 'No type errors';
    } else if (input.typeErrors <= 2) {
      score = 0.6;
      details = `${input.typeErrors} type error(s)`;
    } else {
      score = Math.max(0, 1.0 - input.typeErrors * 0.15);
      details = `${input.typeErrors} type errors`;
    }
  } else {
    // Heuristic: check for type annotations and 'any' usage
    score = 0.8; // Assume reasonable by default
    const issues: string[] = [];

    const anyCount = (input.code.match(/:\s*any\b/g) || []).length;
    if (anyCount > 0) {
      score -= Math.min(0.3, anyCount * 0.05);
      issues.push(`${anyCount} uses of 'any' type`);
    }

    // Check for type assertions (might indicate type issues)
    const assertCount = (input.code.match(/as\s+\w/g) || []).length;
    if (assertCount > 3) {
      score -= 0.1;
      issues.push('excessive type assertions');
    }

    // Bonus for explicit return types
    const funcCount = (input.code.match(/(?:function|=>)/g) || []).length;
    const returnTypeCount = (input.code.match(/\):\s*\w/g) || []).length;
    if (funcCount > 0 && returnTypeCount / funcCount > 0.5) {
      score += 0.05;
    }

    score = Math.max(0, Math.min(1, score));
    details = issues.length === 0 ? 'Type usage appears reasonable' : issues.join('; ');
  }

  return { name: 'Type Safety', score, weight: WEIGHTS.typeSafety, details };
}

/**
 * Score test coverage.
 */
function scoreTestCoverage(input: QualityInput): QualityDimension {
  let score: number;
  let details: string;

  if (input.testsPassed !== undefined && input.testsTotal !== undefined) {
    if (input.testsTotal === 0) {
      score = 0.5; // No tests is neutral, not terrible
      details = 'No tests available';
    } else {
      score = input.testsPassed / input.testsTotal;
      details = `${input.testsPassed}/${input.testsTotal} tests passing`;
    }
  } else {
    // Can't assess without test data
    score = 0.7; // Neutral assumption
    details = 'Test results not available';
  }

  return { name: 'Test Coverage', score, weight: WEIGHTS.testCoverage, details };
}

/**
 * Score code conciseness.
 * Shorter code (relative to task complexity) is generally better,
 * as it indicates less hallucination and more focused solutions.
 */
function scoreConciseness(input: QualityInput): QualityDimension {
  const lines = input.code.split('\n');
  const nonEmptyLines = lines.filter((l) => l.trim().length > 0).length;
  let score: number;
  let details: string;

  if (input.diffSize !== undefined) {
    // Score based on diff size — smaller diffs for the same task are better
    if (input.diffSize <= 10) {
      score = 1.0;
      details = 'Minimal change';
    } else if (input.diffSize <= 50) {
      score = 0.9;
      details = 'Reasonably concise change';
    } else if (input.diffSize <= 150) {
      score = 0.7;
      details = 'Moderate change size';
    } else {
      score = Math.max(0.3, 1.0 - input.diffSize / 500);
      details = `Large change (${input.diffSize} lines)`;
    }
  } else {
    // Heuristic based on code density
    const commentLines = lines.filter((l) => /^\s*(\/\/|\/\*|\*|#)/.test(l)).length;
    const commentRatio = nonEmptyLines > 0 ? commentLines / nonEmptyLines : 0;

    // Moderate comments are good, excessive is bad
    if (commentRatio > 0.4) {
      score = 0.6;
      details = 'Excessive comments relative to code';
    } else if (commentRatio > 0.1) {
      score = 0.9;
      details = 'Good comment-to-code ratio';
    } else {
      score = 0.8;
      details = 'Minimal comments';
    }

    // Penalize very long outputs
    if (nonEmptyLines > 300) {
      score -= 0.2;
      details += '; very long output';
    }

    score = Math.max(0, Math.min(1, score));
  }

  return { name: 'Conciseness', score, weight: WEIGHTS.conciseness, details };
}

/**
 * Score style consistency with existing code.
 */
function scoreStyleConsistency(input: QualityInput): QualityDimension {
  let score = 0.8; // Default assumption
  const issues: string[] = [];

  if (input.originalCode) {
    // Compare style signals between original and new code
    const origUseSemicolons = (input.originalCode.match(/;\s*$/gm) || []).length > 0;
    const newUseSemicolons = (input.code.match(/;\s*$/gm) || []).length > 0;

    if (origUseSemicolons !== newUseSemicolons) {
      score -= 0.2;
      issues.push('semicolon usage inconsistent with existing code');
    }

    // Check indentation style
    const origTabs = /^\t/m.test(input.originalCode);
    const newTabs = /^\t/m.test(input.code);
    if (origTabs !== newTabs) {
      score -= 0.15;
      issues.push('indentation style mismatch');
    }

    // Check quote style
    const origSingleQuotes = (input.originalCode.match(/'/g) || []).length;
    const origDoubleQuotes = (input.originalCode.match(/"/g) || []).length;
    const origPrefersSingle = origSingleQuotes > origDoubleQuotes;

    const newSingleQuotes = (input.code.match(/'/g) || []).length;
    const newDoubleQuotes = (input.code.match(/"/g) || []).length;
    const newPrefersSingle = newSingleQuotes > newDoubleQuotes;

    if (origPrefersSingle !== newPrefersSingle) {
      score -= 0.1;
      issues.push('quote style inconsistent');
    }
  }

  score = Math.max(0, Math.min(1, score));
  const details = issues.length === 0 ? 'Style appears consistent' : issues.join('; ');

  return { name: 'Style Consistency', score, weight: WEIGHTS.styleConsistency, details };
}

/**
 * Score completeness — check for placeholder/incomplete code.
 */
function scoreCompleteness(input: QualityInput): QualityDimension {
  let score = 1.0;
  const issues: string[] = [];

  const placeholderPatterns = [
    /TODO/gi,
    /FIXME/gi,
    /HACK/gi,
    /XXX/gi,
    /placeholder/gi,
    /implement\s+(?:this|here|me)/gi,
    /not\s+implemented/gi,
    /\.\.\.\s*(?:\/\/|$)/gm,
    /pass\s*#\s*TODO/gi,
    /raise\s+NotImplementedError/g,
    /throw\s+new\s+Error\(['"]not implemented/gi,
  ];

  let placeholderCount = 0;
  for (const pattern of placeholderPatterns) {
    const matches = input.code.match(pattern);
    if (matches) {
      placeholderCount += matches.length;
    }
  }

  if (placeholderCount > 0) {
    score -= Math.min(0.8, placeholderCount * 0.15);
    issues.push(`${placeholderCount} placeholder/incomplete marker(s) found`);
  }

  // Check for empty function bodies
  const emptyBodies = (input.code.match(/\{\s*\}/g) || []).length;
  if (emptyBodies > 1) {
    score -= Math.min(0.3, emptyBodies * 0.1);
    issues.push(`${emptyBodies} empty function/block bodies`);
  }

  score = Math.max(0, score);
  const details = issues.length === 0 ? 'Code appears complete' : issues.join('; ');

  return { name: 'Completeness', score, weight: WEIGHTS.completeness, details };
}

/**
 * Generate improvement suggestions based on dimension scores.
 */
function generateSuggestions(dimensions: QualityDimension[]): string[] {
  const suggestions: string[] = [];

  for (const dim of dimensions) {
    if (dim.score < 0.7) {
      switch (dim.name) {
        case 'Syntax Validity':
          suggestions.push('Fix syntax errors before proceeding');
          break;
        case 'Lint Compliance':
          suggestions.push('Run linter and fix reported issues');
          break;
        case 'Type Safety':
          suggestions.push('Add proper type annotations and remove "any" types');
          break;
        case 'Test Coverage':
          suggestions.push('Add or fix failing tests');
          break;
        case 'Conciseness':
          suggestions.push('Reduce code size — remove unnecessary code and comments');
          break;
        case 'Style Consistency':
          suggestions.push('Match the existing code style (indentation, quotes, semicolons)');
          break;
        case 'Completeness':
          suggestions.push('Replace all TODO/placeholder comments with actual implementations');
          break;
      }
    }
  }

  return suggestions;
}

/**
 * Calculate confidence in the quality assessment.
 * Higher when we have more concrete signals (test results, lint data, etc.)
 */
function calculateConfidence(input: QualityInput): number {
  let confidence = 0.3; // Base confidence from heuristics

  if (input.syntaxValid !== undefined) confidence += 0.15;
  if (input.lintErrors !== undefined) confidence += 0.15;
  if (input.typeErrors !== undefined) confidence += 0.15;
  if (input.testsPassed !== undefined) confidence += 0.15;
  if (input.originalCode) confidence += 0.1;

  return Math.min(1, confidence);
}

/**
 * Score the quality of generated code.
 * Returns a comprehensive quality report with composite score, grade,
 * individual dimension scores, and improvement suggestions.
 */
export function scoreQuality(input: QualityInput): QualityReport {
  const dimensions: QualityDimension[] = [
    scoreSyntax(input),
    scoreLint(input),
    scoreTypeSafety(input),
    scoreTestCoverage(input),
    scoreConciseness(input),
    scoreStyleConsistency(input),
    scoreCompleteness(input),
  ];

  // Calculate weighted composite score
  const totalWeight = dimensions.reduce((sum, d) => sum + d.weight, 0);
  const overallScore = dimensions.reduce((sum, d) => sum + d.score * d.weight, 0) / totalWeight;

  return {
    overallScore,
    grade: scoreToGrade(overallScore),
    dimensions,
    suggestions: generateSuggestions(dimensions),
    confidence: calculateConfidence(input),
  };
}

/**
 * Quick quality check — fast heuristic-only assessment.
 * Returns a single score between 0 and 1.
 * Does not require external tool results.
 */
export function quickQualityCheck(code: string, language?: string): number {
  const input: QualityInput = { code, language };
  const report = scoreQuality(input);
  return report.overallScore;
}
