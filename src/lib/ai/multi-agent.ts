/**
 * Multi-Agent Debate/Critic — multiple AI "agents" review and improve each other's work.
 * Phase 3.10: Generates solutions, has critic agents review them, and iterates
 * until consensus or max rounds reached.
 */

export type DebateOptions = {
  task: string;
  context: string;
  candidates?: string[];
  rounds?: number;
  modelId?: string;
  provider?: string;
  workspaceId?: string;
  signal?: AbortSignal;
};

export type DebateResult = {
  winner: string;
  rounds: { critic: string; response: string }[];
  consensus: boolean;
  improvements: string[];
};

export type CriticResult = {
  score: number;
  issues: string[];
  suggestions: string[];
};

type CriticOptions = {
  modelId?: string;
  provider?: string;
  workspaceId?: string;
  signal?: AbortSignal;
};

const DEFAULT_ROUNDS = 2;
const CONSENSUS_THRESHOLD = 0.8;

/**
 * Simulate an LLM call for the critic agent.
 * In production, this would call the actual AI provider.
 */
async function callCriticAgent(
  solution: string,
  task: string,
  _options?: CriticOptions
): Promise<CriticResult> {
  if (_options?.signal?.aborted) {
    throw new Error('Aborted');
  }

  // Heuristic-based scoring when no LLM is available
  const issues: string[] = [];
  const suggestions: string[] = [];
  let score = 0.7;

  // Check for common code quality issues
  if (solution.includes('TODO') || solution.includes('FIXME')) {
    issues.push('Contains unresolved TODO/FIXME comments');
    suggestions.push('Resolve all placeholder comments before submission');
    score -= 0.1;
  }

  if (solution.includes('any')) {
    issues.push('Uses "any" type which reduces type safety');
    suggestions.push('Replace "any" with specific types');
    score -= 0.05;
  }

  if (solution.includes('console.log')) {
    issues.push('Contains debug console.log statements');
    suggestions.push('Remove or replace with proper logging');
    score -= 0.05;
  }

  if (!solution.includes('try') && solution.includes('await')) {
    issues.push('Async code lacks error handling');
    suggestions.push('Add try/catch blocks around async operations');
    score -= 0.1;
  }

  if (solution.length < 50) {
    issues.push('Solution appears incomplete or too brief');
    suggestions.push('Provide a more comprehensive implementation');
    score -= 0.2;
  }

  // Check for task relevance (simple keyword overlap)
  const taskWords = task.toLowerCase().split(/\s+/);
  const solutionLower = solution.toLowerCase();
  const relevantWords = taskWords.filter((w) => w.length > 3 && solutionLower.includes(w));
  if (relevantWords.length < taskWords.filter((w) => w.length > 3).length * 0.3) {
    issues.push('Solution may not fully address the task requirements');
    suggestions.push('Ensure all task requirements are covered');
    score -= 0.1;
  }

  // Bonus for good practices
  if (solution.includes('export')) score += 0.02;
  if (solution.includes('interface') || solution.includes('type ')) score += 0.02;
  if (solution.includes('/**')) score += 0.02;

  score = Math.max(0, Math.min(1, score));

  return { score, issues, suggestions };
}

/**
 * Simulate an LLM call for the author agent to revise a solution.
 * In production, this would call the actual AI provider.
 */
async function callAuthorAgent(
  currentSolution: string,
  criticism: CriticResult,
  _task: string,
  _options?: CriticOptions
): Promise<string> {
  if (_options?.signal?.aborted) {
    throw new Error('Aborted');
  }

  let revised = currentSolution;

  // Apply simple automated fixes based on suggestions
  for (const issue of criticism.issues) {
    if (issue.includes('console.log')) {
      revised = revised.replace(/console\.log\([^)]*\);?\n?/g, '');
    }
    if (issue.includes('TODO') || issue.includes('FIXME')) {
      revised = revised.replace(/\/\/\s*(TODO|FIXME)[^\n]*/g, '');
    }
  }

  return revised.trim();
}

/**
 * Run a multi-agent debate to improve code quality.
 * Process: Generate solution → Critic reviews → Author revises → repeat.
 * Accepts when critic score > 0.8 or max rounds exhausted.
 */
export async function runDebate(options: DebateOptions): Promise<DebateResult> {
  const {
    task,
    context,
    candidates = [],
    rounds: maxRounds = DEFAULT_ROUNDS,
    signal,
  } = options;

  const agentOptions: CriticOptions = {
    modelId: options.modelId,
    provider: options.provider,
    workspaceId: options.workspaceId,
    signal,
  };

  // Start with the first candidate or generate from context
  let currentSolution = candidates[0] || context;
  const debateRounds: { critic: string; response: string }[] = [];
  const improvements: string[] = [];
  let consensus = false;
  let bestSolution = currentSolution;
  let bestScore = 0;

  for (let round = 0; round < maxRounds; round++) {
    if (signal?.aborted) {
      break;
    }

    // Critic reviews the current solution
    const criticism = await callCriticAgent(currentSolution, task, agentOptions);

    // Track the best solution seen
    if (criticism.score > bestScore) {
      bestScore = criticism.score;
      bestSolution = currentSolution;
    }

    // Check for consensus (score above threshold)
    if (criticism.score >= CONSENSUS_THRESHOLD) {
      consensus = true;
      debateRounds.push({
        critic: `Score: ${criticism.score}. ${criticism.issues.length === 0 ? 'No issues found.' : criticism.issues.join('; ')}`,
        response: currentSolution,
      });
      break;
    }

    // Author revises based on criticism
    const revised = await callAuthorAgent(currentSolution, criticism, task, agentOptions);

    // Track improvements
    if (revised !== currentSolution) {
      improvements.push(
        ...criticism.suggestions.filter((s) => s.length > 0)
      );
    }

    debateRounds.push({
      critic: `Score: ${criticism.score}. Issues: ${criticism.issues.join('; ')}`,
      response: revised,
    });

    currentSolution = revised;
  }

  // If we have multiple candidates, compare them
  if (candidates.length > 1 && !consensus) {
    for (let i = 1; i < candidates.length; i++) {
      if (signal?.aborted) break;
      const criticism = await callCriticAgent(candidates[i], task, agentOptions);
      if (criticism.score > bestScore) {
        bestScore = criticism.score;
        bestSolution = candidates[i];
      }
    }
  }

  return {
    winner: consensus ? currentSolution : bestSolution,
    rounds: debateRounds,
    consensus,
    improvements: Array.from(new Set(improvements)),
  };
}

/**
 * Have a critic agent review and score a solution.
 */
export async function criticize(
  solution: string,
  task: string,
  options?: CriticOptions
): Promise<CriticResult> {
  return callCriticAgent(solution, task, options);
}
