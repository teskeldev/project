/**
 * Chain-of-Thought Decomposer — Phase 2.4
 *
 * Breaks complex tasks into reasoning steps, forcing the AI to think through
 * problems systematically. Especially important for weaker models that skip
 * steps when given complex tasks. Supports multiple decomposition strategies
 * tailored to different task types.
 */

export type DecompositionStrategy =
  | 'sequential'       // Step-by-step linear reasoning
  | 'hierarchical'     // Break into sub-problems, solve each
  | 'tdd'             // Test-driven: spec → test → implement → verify
  | 'localize_first'  // Find relevant code → understand → plan → implement
  | 'minimal_change'; // Understand current → identify minimum change → apply

export type DecomposedTask = {
  strategy: DecompositionStrategy;
  steps: TaskStep[];
  totalSteps: number;
  estimatedComplexity: number; // 0-1
};

export type TaskStep = {
  order: number;
  instruction: string;
  expectedOutput: string;
  dependsOn?: number[];
  isVerification?: boolean;
};

export type DecomposeOptions = {
  task: string;
  taskType?: string;
  complexity?: number;
  modelStrength?: 'weak' | 'medium' | 'strong';
  maxSteps?: number;
  includeVerification?: boolean;
};

// ---------------------------------------------------------------------------
// Strategy selection
// ---------------------------------------------------------------------------

const TASK_TYPE_STRATEGY_MAP: Record<string, DecompositionStrategy> = {
  bug_fix: 'localize_first',
  bugfix: 'localize_first',
  fix: 'localize_first',
  debug: 'localize_first',
  feature: 'sequential',
  feature_with_tests: 'tdd',
  tdd: 'tdd',
  test: 'tdd',
  refactor: 'minimal_change',
  refactoring: 'minimal_change',
  rename: 'minimal_change',
  cleanup: 'minimal_change',
  multi_file: 'hierarchical',
  complex: 'hierarchical',
  architecture: 'hierarchical',
};

/** Select the best decomposition strategy for a task */
export function selectStrategy(options: DecomposeOptions): DecompositionStrategy {
  // Explicit task type mapping takes priority
  if (options.taskType) {
    const mapped = TASK_TYPE_STRATEGY_MAP[options.taskType.toLowerCase().replace(/[-\s]/g, '_')];
    if (mapped) return mapped;
  }

  // Infer from task description
  const taskLower = options.task.toLowerCase();

  if (matchesAny(taskLower, ['bug', 'fix', 'broken', 'error', 'crash', 'doesn\'t work', 'not working', 'fails'])) {
    return 'localize_first';
  }

  if (matchesAny(taskLower, ['test', 'tdd', 'spec', 'coverage'])) {
    return 'tdd';
  }

  if (matchesAny(taskLower, ['refactor', 'rename', 'move', 'extract', 'simplify', 'clean up', 'cleanup'])) {
    return 'minimal_change';
  }

  if (matchesAny(taskLower, ['multiple files', 'across', 'system', 'architecture', 'redesign'])) {
    return 'hierarchical';
  }

  // High complexity → hierarchical
  if ((options.complexity ?? 0) > 0.7) {
    return 'hierarchical';
  }

  return 'sequential';
}

// ---------------------------------------------------------------------------
// Decomposition
// ---------------------------------------------------------------------------

/** Decompose a task into chain-of-thought steps */
export function decomposeTask(options: DecomposeOptions): DecomposedTask {
  const strategy = selectStrategy(options);
  const modelStrength = options.modelStrength ?? 'medium';
  const includeVerification = options.includeVerification ?? true;
  const maxSteps = options.maxSteps ?? (modelStrength === 'weak' ? 8 : 6);
  const complexity = options.complexity ?? estimateComplexity(options.task);

  let steps: TaskStep[];

  switch (strategy) {
    case 'sequential':
      steps = buildSequentialSteps(options.task, modelStrength);
      break;
    case 'localize_first':
      steps = buildLocalizeFirstSteps(options.task, modelStrength);
      break;
    case 'tdd':
      steps = buildTddSteps(options.task, modelStrength);
      break;
    case 'hierarchical':
      steps = buildHierarchicalSteps(options.task, modelStrength);
      break;
    case 'minimal_change':
      steps = buildMinimalChangeSteps(options.task, modelStrength);
      break;
  }

  // Add verification steps if requested
  if (includeVerification) {
    steps = injectVerificationSteps(steps, modelStrength);
  }

  // Trim to max steps
  if (steps.length > maxSteps) {
    steps = steps.slice(0, maxSteps);
    // Re-number
    steps.forEach((s, i) => { s.order = i + 1; });
  }

  return {
    strategy,
    steps,
    totalSteps: steps.length,
    estimatedComplexity: complexity,
  };
}

// ---------------------------------------------------------------------------
// Step builders
// ---------------------------------------------------------------------------

function buildSequentialSteps(task: string, strength: string): TaskStep[] {
  const steps: TaskStep[] = [
    {
      order: 1,
      instruction: `Understand the requirement: "${task}". Identify what needs to be done and any constraints.`,
      expectedOutput: 'A clear restatement of the goal and any constraints or edge cases to consider.',
    },
    {
      order: 2,
      instruction: 'Identify the file(s) that need to be modified or created.',
      expectedOutput: 'A list of file paths with a brief note on what changes each needs.',
    },
    {
      order: 3,
      instruction: 'Write the implementation. Make the necessary code changes.',
      expectedOutput: 'The complete code changes (new code or modifications to existing code).',
    },
    {
      order: 4,
      instruction: 'Verify correctness: check for syntax errors, logic errors, and edge cases.',
      expectedOutput: 'Confirmation that the implementation is correct, or a list of issues found.',
      isVerification: true,
    },
  ];

  if (strength === 'weak') {
    // Insert an extra planning step
    steps.splice(2, 0, {
      order: 3,
      instruction: 'Plan the exact changes: for each file, describe what code will be added, modified, or removed.',
      expectedOutput: 'A detailed plan listing each change with before/after descriptions.',
    });
    reorderSteps(steps);
  }

  return steps;
}

function buildLocalizeFirstSteps(task: string, strength: string): TaskStep[] {
  const steps: TaskStep[] = [
    {
      order: 1,
      instruction: `Read the error/bug description carefully: "${task}". Identify symptoms and any error messages.`,
      expectedOutput: 'A summary of the bug symptoms, error messages, and expected vs actual behavior.',
    },
    {
      order: 2,
      instruction: 'Identify which file and function contains the bug. Trace the code path from the symptom to the root cause.',
      expectedOutput: 'The specific file path, function name, and line range where the bug originates.',
    },
    {
      order: 3,
      instruction: 'Understand the current (broken) behavior. Read the relevant code and explain what it does wrong.',
      expectedOutput: 'An explanation of why the current code produces the wrong behavior.',
    },
    {
      order: 4,
      instruction: 'Determine the root cause. What is the fundamental issue?',
      expectedOutput: 'A clear statement of the root cause (e.g., off-by-one error, missing null check, wrong variable).',
    },
    {
      order: 5,
      instruction: 'Write the minimal fix. Change only what is necessary to fix the root cause.',
      expectedOutput: 'The exact code change (SEARCH/REPLACE) that fixes the bug.',
      dependsOn: [4],
    },
    {
      order: 6,
      instruction: 'Verify the fix handles edge cases. Consider: null inputs, empty arrays, boundary values, concurrent access.',
      expectedOutput: 'Confirmation that edge cases are handled, or additional changes needed.',
      isVerification: true,
      dependsOn: [5],
    },
  ];

  if (strength === 'weak') {
    // Add explicit "DO NOT skip" warnings
    steps[1].instruction += ' DO NOT skip this step — you must identify the exact location before attempting a fix.';
    steps[3].instruction += ' DO NOT skip this step — state the root cause explicitly before writing code.';
  }

  return steps;
}

function buildTddSteps(task: string, strength: string): TaskStep[] {
  const steps: TaskStep[] = [
    {
      order: 1,
      instruction: `Define the expected behavior (specification) for: "${task}". What should the code do?`,
      expectedOutput: 'A clear specification: inputs, outputs, behavior, and edge cases.',
    },
    {
      order: 2,
      instruction: 'Write test cases that capture the expected behavior. Cover happy path and edge cases.',
      expectedOutput: 'Complete test code with descriptive test names and assertions.',
      dependsOn: [1],
    },
    {
      order: 3,
      instruction: 'Implement the code to make all tests pass. Focus on correctness first.',
      expectedOutput: 'Implementation code that satisfies all test cases.',
      dependsOn: [2],
    },
    {
      order: 4,
      instruction: 'Verify all tests pass. Mentally run through each test with the implementation.',
      expectedOutput: 'Confirmation that each test passes, or identification of failing tests.',
      isVerification: true,
      dependsOn: [3],
    },
    {
      order: 5,
      instruction: 'Refactor if needed while ensuring tests still pass. Improve code quality without changing behavior.',
      expectedOutput: 'Refactored code (if needed) or confirmation that no refactoring is necessary.',
      dependsOn: [4],
    },
  ];

  if (strength === 'weak') {
    steps[1].instruction += ' List at least 3 specific test cases before writing any code.';
    steps[2].instruction += ' DO NOT skip writing tests. Write the full test code before implementing.';
  }

  return steps;
}

function buildHierarchicalSteps(task: string, strength: string): TaskStep[] {
  const steps: TaskStep[] = [
    {
      order: 1,
      instruction: `Break the task into 2-4 independent sub-tasks: "${task}". Each sub-task should be self-contained.`,
      expectedOutput: 'A numbered list of sub-tasks, each with a clear scope and deliverable.',
    },
    {
      order: 2,
      instruction: 'For each sub-task: identify the files involved and plan the changes needed.',
      expectedOutput: 'For each sub-task: file paths and a brief description of changes.',
      dependsOn: [1],
    },
    {
      order: 3,
      instruction: 'Implement sub-task 1. Make all necessary changes for this sub-task only.',
      expectedOutput: 'Complete code changes for sub-task 1.',
      dependsOn: [2],
    },
    {
      order: 4,
      instruction: 'Implement sub-task 2. Make all necessary changes for this sub-task only.',
      expectedOutput: 'Complete code changes for sub-task 2.',
      dependsOn: [2],
    },
    {
      order: 5,
      instruction: 'Implement remaining sub-tasks (if any). Then integrate all changes and verify they work together.',
      expectedOutput: 'Remaining code changes and confirmation that all sub-tasks integrate correctly.',
      dependsOn: [3, 4],
    },
    {
      order: 6,
      instruction: 'Final verification: check for conflicts between sub-tasks, missing imports, and type errors.',
      expectedOutput: 'Confirmation of correctness or list of integration issues to fix.',
      isVerification: true,
      dependsOn: [5],
    },
  ];

  if (strength === 'weak') {
    steps[0].instruction += ' DO NOT skip this decomposition step. You MUST break the task down before implementing.';
    // Add verification after each sub-task
    steps.splice(4, 0, {
      order: 5,
      instruction: 'Verify sub-task 1 is correct before proceeding. Check for errors.',
      expectedOutput: 'Confirmation that sub-task 1 implementation is correct.',
      isVerification: true,
      dependsOn: [3],
    });
    reorderSteps(steps);
  }

  return steps;
}

function buildMinimalChangeSteps(task: string, strength: string): TaskStep[] {
  const steps: TaskStep[] = [
    {
      order: 1,
      instruction: `Understand the current implementation fully. Read the relevant code for: "${task}".`,
      expectedOutput: 'A summary of how the current code works, including key functions and data flow.',
    },
    {
      order: 2,
      instruction: 'Identify the minimum set of changes needed. What is the smallest change that achieves the goal?',
      expectedOutput: 'A list of the minimum changes required, with justification for why each is necessary.',
      dependsOn: [1],
    },
    {
      order: 3,
      instruction: 'Verify no unintended behavior change will occur. Check callers, tests, and dependent code.',
      expectedOutput: 'Analysis of impact: what callers exist, what tests cover this code, any risks.',
      isVerification: true,
      dependsOn: [2],
    },
    {
      order: 4,
      instruction: 'Apply changes one at a time. Make each change as a separate, reviewable unit.',
      expectedOutput: 'The code changes, presented as individual SEARCH/REPLACE blocks.',
      dependsOn: [3],
    },
    {
      order: 5,
      instruction: 'Confirm behavior is preserved. The refactored code should produce identical results.',
      expectedOutput: 'Confirmation that behavior is unchanged, or identification of any differences.',
      isVerification: true,
      dependsOn: [4],
    },
  ];

  if (strength === 'weak') {
    steps[1].instruction += ' DO NOT make unnecessary changes. Only change what is strictly required.';
    steps[2].instruction += ' This step is critical — DO NOT skip it.';
  }

  return steps;
}

// ---------------------------------------------------------------------------
// Verification injection
// ---------------------------------------------------------------------------

function injectVerificationSteps(steps: TaskStep[], strength: string): TaskStep[] {
  if (strength !== 'weak') {
    // For medium/strong models, verification steps are already included in templates
    return steps;
  }

  // For weak models, add verification after every implementation step
  const result: TaskStep[] = [];
  for (const step of steps) {
    result.push(step);
    if (!step.isVerification && isImplementationStep(step)) {
      const existing = result.find(
        (s) => s.isVerification && s.dependsOn?.includes(step.order)
      );
      if (!existing) {
        result.push(generateVerificationStep(step));
      }
    }
  }
  reorderSteps(result);
  return result;
}

function isImplementationStep(step: TaskStep): boolean {
  const keywords = ['implement', 'write', 'create', 'add', 'change', 'modify', 'fix', 'apply'];
  const lower = step.instruction.toLowerCase();
  return keywords.some((kw) => lower.includes(kw));
}

/** Generate a verification step for a given implementation step */
export function generateVerificationStep(step: TaskStep): TaskStep {
  return {
    order: step.order + 1,
    instruction: `VERIFY: Check the output of step ${step.order}. Look for syntax errors, logic errors, missing edge cases, and incorrect assumptions. DO NOT skip this verification.`,
    expectedOutput: 'Either "Verified: no issues found" or a list of specific issues that need to be fixed.',
    dependsOn: [step.order],
    isVerification: true,
  };
}

// ---------------------------------------------------------------------------
// Prompt formatting
// ---------------------------------------------------------------------------

/** Format decomposed steps into a prompt that forces step-by-step reasoning */
export function formatAsPrompt(
  decomposed: DecomposedTask,
  format: 'xml' | 'markdown' | 'numbered' = 'xml'
): string {
  switch (format) {
    case 'xml':
      return formatXml(decomposed);
    case 'markdown':
      return formatMarkdown(decomposed);
    case 'numbered':
      return formatNumbered(decomposed);
  }
}

function formatXml(decomposed: DecomposedTask): string {
  const lines: string[] = [];
  lines.push(`<chain-of-thought strategy="${decomposed.strategy}" steps="${decomposed.totalSteps}">`);
  lines.push(`<instructions>`);
  lines.push(`You MUST complete each step in order. Output your reasoning for each step inside the corresponding tags.`);
  lines.push(`Do NOT skip steps. Do NOT combine steps. Complete each one fully before moving to the next.`);
  lines.push(`</instructions>`);
  lines.push('');

  for (const step of decomposed.steps) {
    const attrs: string[] = [`n="${step.order}"`];
    if (step.isVerification) attrs.push('type="verification"');
    if (step.dependsOn?.length) attrs.push(`depends-on="${step.dependsOn.join(',')}"`);

    lines.push(`<step ${attrs.join(' ')}>`);
    lines.push(`  <instruction>${step.instruction}</instruction>`);
    lines.push(`  <expected_output>${step.expectedOutput}</expected_output>`);
    lines.push(`</step>`);
    lines.push(`<step_${step.order}_output>`);
    lines.push(`<!-- Your response for step ${step.order} goes here -->`);
    lines.push(`</step_${step.order}_output>`);
    lines.push('');
  }

  lines.push(`</chain-of-thought>`);
  return lines.join('\n');
}

function formatMarkdown(decomposed: DecomposedTask): string {
  const lines: string[] = [];
  lines.push(`## Chain-of-Thought (${decomposed.strategy})`);
  lines.push('');
  lines.push('Complete each step in order. Do NOT skip steps.');
  lines.push('');

  for (const step of decomposed.steps) {
    const label = step.isVerification ? '✓ VERIFY' : `Step ${step.order}`;
    lines.push(`### ${label}: ${getStepTitle(step)}`);
    lines.push('');
    lines.push(`**Do:** ${step.instruction}`);
    lines.push('');
    lines.push(`**Expected output:** ${step.expectedOutput}`);
    if (step.dependsOn?.length) {
      lines.push(`**Depends on:** Step(s) ${step.dependsOn.join(', ')}`);
    }
    lines.push('');
    lines.push('---');
    lines.push('');
  }

  return lines.join('\n');
}

function formatNumbered(decomposed: DecomposedTask): string {
  const lines: string[] = [];
  lines.push(`CHAIN-OF-THOUGHT (${decomposed.strategy}) — ${decomposed.totalSteps} steps`);
  lines.push('Complete each step in order. Do NOT skip steps.');
  lines.push('');

  for (const step of decomposed.steps) {
    const prefix = step.isVerification ? `${step.order}. [VERIFY]` : `${step.order}. [INSTRUCTION]`;
    lines.push(`${prefix} ${step.instruction}`);
    lines.push(`   [EXPECTED] ${step.expectedOutput}`);
    if (step.dependsOn?.length) {
      lines.push(`   [DEPENDS ON] Step(s) ${step.dependsOn.join(', ')}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------

function matchesAny(text: string, keywords: string[]): boolean {
  return keywords.some((kw) => text.includes(kw));
}

function reorderSteps(steps: TaskStep[]): void {
  steps.forEach((step, i) => { step.order = i + 1; });
}

function getStepTitle(step: TaskStep): string {
  // Extract a short title from the instruction (first clause or first N words)
  const instruction = step.instruction;
  const colonIdx = instruction.indexOf(':');
  if (colonIdx > 0 && colonIdx < 50) {
    return instruction.slice(0, colonIdx);
  }
  const words = instruction.split(' ').slice(0, 5);
  return words.join(' ') + (instruction.split(' ').length > 5 ? '...' : '');
}

function estimateComplexity(task: string): number {
  let score = 0.3; // Base complexity

  const complexitySignals: [string[], number][] = [
    [['multiple files', 'across', 'several', 'all'], 0.2],
    [['refactor', 'redesign', 'architecture', 'system'], 0.2],
    [['and', 'also', 'additionally', 'plus'], 0.1],
    [['test', 'verify', 'ensure'], 0.05],
    [['simple', 'just', 'only', 'quick'], -0.15],
    [['typo', 'rename', 'comment'], -0.1],
  ];

  const lower = task.toLowerCase();
  for (const [keywords, weight] of complexitySignals) {
    if (keywords.some((kw) => lower.includes(kw))) {
      score += weight;
    }
  }

  // Longer task descriptions tend to be more complex
  const wordCount = task.split(/\s+/).length;
  if (wordCount > 50) score += 0.1;
  if (wordCount > 100) score += 0.1;

  return Math.max(0, Math.min(1, score));
}
