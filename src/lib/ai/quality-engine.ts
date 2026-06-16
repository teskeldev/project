/**
 * Teskel Quality Amplification Engine — the unified orchestrator.
 *
 * This is the PRIMARY entry point for all AI code generation in Teskel.
 * It coordinates all quality amplification modules to produce the best
 * possible output regardless of which model is being used.
 *
 * Architecture:
 * ┌─────────────────────────────────────────────────────────────┐
 * │  USER REQUEST                                                │
 * │       ↓                                                      │
 * │  Task Classification → Complexity Estimation → Model Routing │
 * │       ↓                                                      │
 * │  Smart Context Assembly (relevance + compression + budget)   │
 * │       ↓                                                      │
 * │  Pipeline Selection (agentless | agent_loop | multi_pass)    │
 * │       ↓                                                      │
 * │  Pattern Application (skeleton-flesh | spec-first | minimal) │
 * │       ↓                                                      │
 * │  Execution with Verification (AST + lint + type + test)      │
 * │       ↓                                                      │
 * │  Error Recovery (retry | simplify | decompose)               │
 * │       ↓                                                      │
 * │  Quality Scoring + Output                                    │
 * └─────────────────────────────────────────────────────────────┘
 */

import { classifyTask, type TaskCharacteristics, type TaskCategory } from './task-classifier';
import { estimateComplexity, type ComplexityScore } from './complexity-estimator';
import { routeTask, getModelTier } from './model-router';
import { buildSmartContext, type SmartContextResult } from './smart-context';
import { multiPassExecute } from './multi-pass';
import { runAgentlessPipeline } from './pipelines/agentless';
import { runAgentLoop } from './pipelines/agent-loop';
import { skeletonFlesh } from './patterns/skeleton-flesh';
import { specFirst } from './patterns/spec-first';
import { generateMinimalDiff } from './patterns/diff-minimization';
import { bestOfN } from './best-of-n';
import { scoreQuality } from './quality-score';
import { executeRecovery, type RecoveryResult } from './error-recovery';
import { validateSyntax } from './validators/ast-validator';
import { runLint, runTypeCheck } from './validators/lint-validator';
import { runTests } from './validators/test-runner';
import { adaptPrompt } from './prompt-adapter';
import type { AdaptOptions } from './prompt-adapter';
import { selectAdaptedExamples, detectProjectStyle, type ProjectStyle } from './dynamic-examples';
import { getRelevantWarnings, formatWarningsForPrompt, logFailure } from './learning/failure-log';
import { executeFusion as runFusion } from './fusion-panel';
import { readFile } from '@/lib/storage';

// ─────────────────────────────────────────────────────────────────────────────
// Public Types
// ─────────────────────────────────────────────────────────────────────────────

export type QualityEngineOptions = {
  // Required
  task: string;
  projectId: string;
  storageKey: string;

  // Model configuration
  modelId?: string;
  provider?: string;
  workspaceId?: string;

  // Quality settings
  qualityLevel?: 'fast' | 'balanced' | 'maximum';

  // Context
  selectedPaths?: string[];
  conversationHistory?: string;

  // Pipeline override
  forcePipeline?: 'agentless' | 'agent_loop' | 'multi_pass' | 'fusion';
  forcePattern?: 'skeleton_flesh' | 'spec_first' | 'diff_minimal' | 'none';

  // Verification
  enableLint?: boolean;
  enableTypeCheck?: boolean;
  enableTests?: boolean;
  testCommand?: string;
  cwd?: string;

  // Callbacks for progress reporting
  onPhase?: (phase: string, detail: string) => void;
  onProgress?: (percent: number, message: string) => void;

  // Abort
  signal?: AbortSignal;
};

export type QualityEngineResult = {
  output: string;
  patches?: { filePath: string; search: string; replace: string }[];

  quality: {
    score: number;
    grade: 'A' | 'B' | 'C' | 'D' | 'F';
    dimensions: { name: string; score: number }[];
  };

  metadata: {
    modelUsed: string;
    pipelineUsed: string;
    patternUsed: string;
    totalPasses: number;
    totalDurationMs: number;
    tokensUsed: number;
    costEstimate: number;
    verificationsPassed: string[];
    verificationsFailed: string[];
  };

  contextUsed: {
    filesIncluded: string[];
    repoMapIncluded: boolean;
    fewShotExamplesUsed: number;
    relevantFilesFound: number;
  };

  warnings: string[];
};

// ─────────────────────────────────────────────────────────────────────────────
// Internal Types
// ─────────────────────────────────────────────────────────────────────────────

type PipelineType = 'agentless' | 'agent_loop' | 'multi_pass' | 'fusion';
type PatternType = 'skeleton_flesh' | 'spec_first' | 'diff_minimal' | 'none';

type AdaptTaskType = AdaptOptions['taskType'];

type ExecutionPlan = {
  pipeline: PipelineType;
  pattern: PatternType;
  modelId: string;
  provider: string;
  tier: 'weak' | 'medium' | 'strong' | 'frontier';
  enableReview: boolean;
  enableBestOfN: boolean;
  bestOfNCount: number;
  maxPasses: number;
  verification: {
    ast: boolean;
    lint: boolean;
    typeCheck: boolean;
    tests: boolean;
  };
};

type VerificationOutcome = {
  passed: boolean;
  passedChecks: string[];
  failedChecks: string[];
  errors: string[];
  feedback: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_QUALITY_LEVEL = 'balanced';
const MAX_RECOVERY_ATTEMPTS = 3;
const ESTIMATED_TOKENS_PER_CHAR = 0.25;
const COST_PER_1K_TOKENS: Record<string, number> = {
  weak: 0.0005,
  medium: 0.003,
  strong: 0.012,
  frontier: 0.040,
};

// ─────────────────────────────────────────────────────────────────────────────
// Main Entry Point
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Run the Quality Amplification Engine.
 *
 * This is the primary entry point that orchestrates all modules:
 * classification → routing → context → pipeline → pattern → verification → scoring
 */
export async function runQualityEngine(options: QualityEngineOptions): Promise<QualityEngineResult> {
  const startTime = Date.now();
  const warnings: string[] = [];
  const qualityLevel = options.qualityLevel ?? DEFAULT_QUALITY_LEVEL;

  const phase = (name: string, detail: string) => {
    options.onPhase?.(name, detail);
  };
  const progress = (percent: number, message: string) => {
    options.onProgress?.(percent, message);
  };

  checkAbort(options.signal);

  // ─── Phase 1: Classify & Estimate ───────────────────────────────────────────
  progress(5, 'Classifying task...');

  const characteristics = classifyTask(options.task);
  const complexity = estimateComplexity({
    taskDescription: options.task,
    taskCategory: characteristics.category,
    affectedFiles: options.selectedPaths?.length,
  });

  phase('classify', `${characteristics.category}, complexity: ${complexity.score.toFixed(2)} (${complexity.level})`);
  progress(10, 'Task classified');

  checkAbort(options.signal);

  // ─── Phase 2: Route Model ──────────────────────────────────────────────────
  progress(15, 'Selecting model...');

  const routing = resolveModel(options, qualityLevel, characteristics, complexity);
  const modelId = routing.modelId;
  const provider = routing.provider;
  const tier = routing.tier;

  phase('route', `Selected: ${modelId} (${tier})`);
  progress(20, `Model: ${modelId}`);

  checkAbort(options.signal);

  // ─── Phase 3: Build Context ────────────────────────────────────────────────
  progress(25, 'Building context...');

  let smartContext: SmartContextResult;
  try {
    smartContext = await buildSmartContext(options.projectId, {
      query: options.task,
      selectedPaths: options.selectedPaths,
      modelId,
      provider,
      taskType: mapCategoryToTaskType(characteristics.category),
      conversationContext: options.conversationHistory,
      includeRepoMap: qualityLevel !== 'fast',
      includeRelevantFiles: true,
      maxRelevantFiles: qualityLevel === 'maximum' ? 15 : qualityLevel === 'balanced' ? 10 : 5,
    });
  } catch (err) {
    warnings.push(`Context building partially failed: ${errorMessage(err)}`);
    smartContext = createFallbackContext();
  }

  // Get few-shot examples if not in fast mode
  let fewShotExamples: { task: string; solution: string }[] = [];
  if (qualityLevel !== 'fast') {
    try {
      const style = detectProjectStyleFromContext(smartContext);
      fewShotExamples = selectAdaptedExamples(
        characteristics.category,
        style,
        qualityLevel === 'maximum' ? 3 : 2
      );
    } catch {
      // Non-critical: proceed without examples
    }
  }

  // Get failure warnings from learning log
  const failureWarnings = getRelevantWarnings(characteristics.category, modelId, options.task);
  const warningBlock = failureWarnings.length > 0
    ? formatWarningsForPrompt(failureWarnings)
    : '';

  phase('context', `${smartContext.metadata.filesIncluded} files, ${smartContext.budget.used} chars`);
  progress(35, 'Context assembled');

  checkAbort(options.signal);

  // ─── Phase 4: Build Execution Plan ─────────────────────────────────────────
  const plan = buildExecutionPlan(options, qualityLevel, characteristics, complexity, tier, modelId, provider);

  phase('pipeline', plan.pipeline);
  phase('pattern', plan.pattern);
  progress(40, `Pipeline: ${plan.pipeline}, Pattern: ${plan.pattern}`);

  checkAbort(options.signal);

  // ─── Phase 5: Execute ──────────────────────────────────────────────────────
  progress(45, 'Generating...');

  let output = '';
  let patches: { filePath: string; search: string; replace: string }[] = [];
  let totalPasses = 0;

  try {
    const execResult = await executeWithPlan(plan, {
      task: options.task,
      context: smartContext.system,
      projectId: options.projectId,
      storageKey: options.storageKey,
      workspaceId: options.workspaceId,
      characteristics,
      fewShotExamples,
      warningBlock,
      selectedPaths: options.selectedPaths,
      signal: options.signal,
      onProgress: (pct, msg) => {
        // Map execution progress (0-100) to our range (45-75)
        const mapped = 45 + Math.round(pct * 0.3);
        progress(mapped, msg);
      },
    });

    output = execResult.output;
    patches = execResult.patches;
    totalPasses = execResult.passes;
  } catch (err) {
    checkAbort(options.signal);

    // Execution failed — attempt recovery
    warnings.push(`Primary execution failed: ${errorMessage(err)}`);
    phase('recovery', 'Attempting error recovery...');
    progress(60, 'Recovering from error...');

    const recoveryResult = await attemptRecovery(
      options.task,
      smartContext.system,
      errorMessage(err),
      { modelId, provider, workspaceId: options.workspaceId, signal: options.signal }
    );

    if (recoveryResult.recovered) {
      output = recoveryResult.output;
      totalPasses += recoveryResult.attempts;
      warnings.push(`Recovered after ${recoveryResult.attempts} attempt(s)`);
    } else {
      // Log the failure for future learning
      logFailure({
        taskType: characteristics.category,
        modelId,
        errorType: 'execution_failure',
        errorMessage: errorMessage(err),
        context: 'execution_failed',
        preventionHint: `Task "${options.task.slice(0, 80)}" failed during ${plan.pipeline} pipeline execution`,
      });

      return buildFailureResult(options, modelId, plan, startTime, smartContext, fewShotExamples, warnings, err);
    }
  }

  progress(75, 'Generation complete');
  checkAbort(options.signal);

  // ─── Phase 6: Verification ─────────────────────────────────────────────────
  progress(78, 'Verifying output...');

  let verification: VerificationOutcome = {
    passed: true,
    passedChecks: [],
    failedChecks: [],
    errors: [],
    feedback: '',
  };

  if (plan.verification.ast || plan.verification.lint || plan.verification.typeCheck || plan.verification.tests) {
    verification = await runVerification(output, plan.verification, {
      testCommand: options.testCommand,
      cwd: options.cwd,
      signal: options.signal,
    });

    phase('verify', verification.passed
      ? `Passed: ${verification.passedChecks.join(', ')}`
      : `Failed: ${verification.failedChecks.join(', ')}`);

    // If verification failed and we have budget for recovery
    if (!verification.passed && qualityLevel !== 'fast') {
      progress(82, 'Fixing verification issues...');

      const fixResult = await attemptVerificationFix(
        output,
        verification,
        options.task,
        smartContext.system,
        { modelId, provider, workspaceId: options.workspaceId, signal: options.signal }
      );

      if (fixResult.fixed) {
        output = fixResult.output;
        totalPasses += fixResult.attempts;
        warnings.push(`Fixed verification issues after ${fixResult.attempts} attempt(s)`);

        // Re-verify
        verification = await runVerification(output, plan.verification, {
          testCommand: options.testCommand,
          cwd: options.cwd,
          signal: options.signal,
        });
      } else {
        warnings.push('Verification issues could not be fully resolved');
      }
    }
  }

  progress(90, 'Scoring quality...');
  checkAbort(options.signal);

  // ─── Phase 7: Score & Return ───────────────────────────────────────────────
  const qualityReport = scoreQuality({
    code: output,
    task: options.task,
    syntaxValid: !verification.failedChecks.includes('ast'),
    lintErrors: countErrors(verification, 'lint'),
    typeErrors: countErrors(verification, 'type'),
  });

  // Log failure if quality is very low
  if (qualityReport.overallScore < 0.4) {
    logFailure({
      taskType: characteristics.category,
      modelId,
      errorType: 'low_quality',
      errorMessage: `Low quality score: ${qualityReport.overallScore.toFixed(2)}`,
      context: 'quality_scoring',
      preventionHint: `Model ${modelId} produced low-quality output for ${characteristics.category} tasks`,
    });
    warnings.push(`Quality score is low (${qualityReport.grade}). Consider using a higher quality level.`);
  }

  const durationMs = Date.now() - startTime;
  const estimatedTokens = Math.round(
    (smartContext.budget.used + output.length) * ESTIMATED_TOKENS_PER_CHAR
  );
  const costEstimate = (estimatedTokens / 1000) * (COST_PER_1K_TOKENS[tier] ?? 0.01);

  progress(100, 'Complete');

  return {
    output,
    patches: patches.length > 0 ? patches : undefined,

    quality: {
      score: qualityReport.overallScore,
      grade: qualityReport.grade,
      dimensions: qualityReport.dimensions.map((d) => ({ name: d.name, score: d.score })),
    },

    metadata: {
      modelUsed: modelId,
      pipelineUsed: plan.pipeline,
      patternUsed: plan.pattern,
      totalPasses,
      totalDurationMs: durationMs,
      tokensUsed: estimatedTokens,
      costEstimate: Math.round(costEstimate * 10000) / 10000,
      verificationsPassed: verification.passedChecks,
      verificationsFailed: verification.failedChecks,
    },

    contextUsed: {
      filesIncluded: smartContext.relevantFiles.map((f) => f.path),
      repoMapIncluded: smartContext.metadata.repoMapIncluded,
      fewShotExamplesUsed: fewShotExamples.length,
      relevantFilesFound: smartContext.relevantFiles.length,
    },

    warnings,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Convenience Entry Points
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Quick mode — single pass, no verification (for chat responses).
 * Optimized for speed: ~2-5 seconds.
 */
export async function quickGenerate(
  task: string,
  projectId: string,
  storageKey: string,
  options?: Partial<QualityEngineOptions>
): Promise<QualityEngineResult> {
  return runQualityEngine({
    ...options,
    task,
    projectId,
    storageKey,
    qualityLevel: 'fast',
    enableLint: false,
    enableTypeCheck: false,
    enableTests: false,
  });
}

/**
 * Maximum quality mode — all techniques enabled.
 * Uses best-of-N, full verification, strongest model: ~30-60 seconds.
 */
export async function maxQualityGenerate(
  task: string,
  projectId: string,
  storageKey: string,
  options?: Partial<QualityEngineOptions>
): Promise<QualityEngineResult> {
  return runQualityEngine({
    ...options,
    task,
    projectId,
    storageKey,
    qualityLevel: 'maximum',
    enableLint: true,
    enableTypeCheck: true,
    enableTests: options?.testCommand != null,
    testCommand: options?.testCommand,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 2: Model Resolution
// ─────────────────────────────────────────────────────────────────────────────

function resolveModel(
  options: QualityEngineOptions,
  qualityLevel: 'fast' | 'balanced' | 'maximum',
  characteristics: TaskCharacteristics,
  complexity: ComplexityScore
): { modelId: string; provider: string; tier: 'weak' | 'medium' | 'strong' | 'frontier' } {
  // If user explicitly specified a model, use it
  if (options.modelId) {
    const tier = getModelTier(options.modelId);
    return { modelId: options.modelId, provider: options.provider ?? '', tier };
  }

  // Route based on quality level and complexity
  const routing = routeTask({
    taskDescription: options.task,
    taskCategory: characteristics.category,
    complexity: complexity.score,
    preferSpeed: qualityLevel === 'fast',
    preferCost: qualityLevel === 'fast',
    preferQuality: qualityLevel === 'maximum',
  });

  return {
    modelId: routing.selectedModel.id,
    provider: routing.selectedModel.provider,
    tier: routing.selectedModel.tier,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 4: Execution Plan
// ─────────────────────────────────────────────────────────────────────────────

function buildExecutionPlan(
  options: QualityEngineOptions,
  qualityLevel: 'fast' | 'balanced' | 'maximum',
  characteristics: TaskCharacteristics,
  complexity: ComplexityScore,
  tier: 'weak' | 'medium' | 'strong' | 'frontier',
  modelId: string,
  provider: string
): ExecutionPlan {
  // ─── Pipeline Selection ─────────────────────────────────────────────────────
  let pipeline: PipelineType;

  if (options.forcePipeline) {
    pipeline = options.forcePipeline;
  } else if (qualityLevel === 'fast') {
    pipeline = 'agentless';
  } else if (tier === 'weak' || complexity.score < 0.3) {
    pipeline = 'agentless';
  } else if (qualityLevel === 'maximum' && complexity.score > 0.8) {
    // Hardest maximum-quality tasks: fan out to the multi-model fusion panel
    // and synthesize via the judge. detectPanel() degrades gracefully to a
    // single provider when only one is configured.
    pipeline = 'fusion';
  } else if ((tier === 'strong' || tier === 'frontier') && complexity.score > 0.6) {
    pipeline = 'agent_loop';
  } else {
    pipeline = 'multi_pass';
  }

  // ─── Pattern Selection ──────────────────────────────────────────────────────
  let pattern: PatternType;

  if (options.forcePattern) {
    pattern = options.forcePattern;
  } else if (qualityLevel === 'fast') {
    pattern = 'none';
  } else if (
    characteristics.category === 'feature_implementation' &&
    complexity.score > 0.5 &&
    characteristics.requiresNewCode
  ) {
    pattern = 'skeleton_flesh';
  } else if (
    (characteristics.category === 'bug_fix' || characteristics.category === 'test_writing') &&
    options.testCommand
  ) {
    pattern = 'spec_first';
  } else if (
    !characteristics.requiresNewCode &&
    characteristics.category !== 'feature_implementation' &&
    options.selectedPaths?.length
  ) {
    pattern = 'diff_minimal';
  } else {
    pattern = 'none';
  }

  // The fusion pipeline performs its own multi-candidate generation + judge
  // synthesis, so single-candidate patterns must not shadow it.
  if (pipeline === 'fusion') {
    pattern = 'none';
  }

  // ─── Verification Settings ──────────────────────────────────────────────────
  const verification = {
    ast: qualityLevel !== 'fast',
    lint: options.enableLint ?? (qualityLevel === 'balanced' || qualityLevel === 'maximum'),
    typeCheck: options.enableTypeCheck ?? qualityLevel === 'maximum',
    tests: (options.enableTests ?? false) && !!options.testCommand,
  };

  // ─── Pass & Best-of-N Settings ─────────────────────────────────────────────
  const enableBestOfN = qualityLevel === 'maximum';
  const bestOfNCount = qualityLevel === 'maximum' ? 3 : 1;
  const maxPasses = qualityLevel === 'fast' ? 1 : qualityLevel === 'balanced' ? 3 : 5;
  const enableReview = qualityLevel !== 'fast';

  return {
    pipeline,
    pattern,
    modelId,
    provider,
    tier,
    enableReview,
    enableBestOfN,
    bestOfNCount,
    maxPasses,
    verification,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 5: Execution
// ─────────────────────────────────────────────────────────────────────────────

type ExecutionContext = {
  task: string;
  context: string;
  projectId: string;
  storageKey: string;
  workspaceId?: string;
  characteristics: TaskCharacteristics;
  fewShotExamples: { task: string; solution: string }[];
  warningBlock: string;
  selectedPaths?: string[];
  signal?: AbortSignal;
  onProgress?: (percent: number, message: string) => void;
};

type ExecutionResult = {
  output: string;
  patches: { filePath: string; search: string; replace: string }[];
  passes: number;
};

async function executeWithPlan(plan: ExecutionPlan, ctx: ExecutionContext): Promise<ExecutionResult> {
  // Build the enhanced prompt with examples and warnings
  const enhancedContext = buildEnhancedContext(ctx);

  // ─── Best-of-N (maximum quality) ───────────────────────────────────────────
  // The agent loop and fusion panel run their own multi-candidate strategies,
  // so best-of-N must not intercept them.
  if (plan.enableBestOfN && plan.pipeline !== 'agent_loop' && plan.pipeline !== 'fusion') {
    return executeBestOfN(plan, ctx, enhancedContext);
  }

  // ─── Pattern-based execution ────────────────────────────────────────────────
  if (plan.pattern !== 'none') {
    return executeWithPattern(plan, ctx, enhancedContext);
  }

  // ─── Pipeline-based execution ───────────────────────────────────────────────
  switch (plan.pipeline) {
    case 'agentless':
      return executeAgentless(plan, ctx, enhancedContext);
    case 'agent_loop':
      return executeAgentLoop(plan, ctx);
    case 'multi_pass':
      return executeMultiPass(plan, ctx, enhancedContext);
    case 'fusion':
      return executeFusion(plan, ctx, enhancedContext);
    default:
      return executeMultiPass(plan, ctx, enhancedContext);
  }
}

function buildEnhancedContext(ctx: ExecutionContext): string {
  const parts: string[] = [ctx.context];

  // Add few-shot examples
  if (ctx.fewShotExamples.length > 0) {
    parts.push('\n\n--- EXAMPLES OF SIMILAR TASKS ---');
    for (const example of ctx.fewShotExamples) {
      parts.push(`\nTask: ${example.task}\nSolution:\n${example.solution}`);
    }
    parts.push('--- END EXAMPLES ---\n');
  }

  // Add failure warnings
  if (ctx.warningBlock) {
    parts.push(`\n${ctx.warningBlock}\n`);
  }

  return parts.join('');
}

async function executeBestOfN(
  plan: ExecutionPlan,
  ctx: ExecutionContext,
  enhancedContext: string
): Promise<ExecutionResult> {
  ctx.onProgress?.(20, `Generating ${plan.bestOfNCount} candidates...`);

  const result = await bestOfN({
    task: ctx.task,
    context: enhancedContext,
    n: plan.bestOfNCount,
    modelId: plan.modelId,
    provider: plan.provider,
    workspaceId: ctx.workspaceId,
    validateSyntax: true,
    runLint: plan.verification.lint,
    strategy: 'lint_based',
    signal: ctx.signal,
    onCandidate: (index) => {
      ctx.onProgress?.(20 + Math.round((index / plan.bestOfNCount) * 60), `Candidate ${index + 1}/${plan.bestOfNCount}`);
    },
  });

  ctx.onProgress?.(90, 'Selected best candidate');

  return {
    output: result.best.code,
    patches: [],
    passes: result.totalGenerated,
  };
}

async function executeWithPattern(
  plan: ExecutionPlan,
  ctx: ExecutionContext,
  enhancedContext: string
): Promise<ExecutionResult> {
  switch (plan.pattern) {
    case 'skeleton_flesh': {
      ctx.onProgress?.(30, 'Generating skeleton...');

      const sfResult = await skeletonFlesh({
        task: ctx.task,
        context: enhancedContext,
        language: detectLanguageFromContext(ctx),
        modelId: plan.modelId,
        provider: plan.provider,
        workspaceId: ctx.workspaceId,
        signal: ctx.signal,
      });

      ctx.onProgress?.(80, 'Skeleton filled');

      return {
        output: sfResult.flesh,
        patches: [],
        passes: sfResult.steps.length,
      };
    }

    case 'spec_first': {
      ctx.onProgress?.(20, 'Writing specification...');

      const spResult = await specFirst({
        task: ctx.task,
        context: enhancedContext,
        language: detectLanguageFromContext(ctx),
        modelId: plan.modelId,
        provider: plan.provider,
        workspaceId: ctx.workspaceId,
        signal: ctx.signal,
      });

      ctx.onProgress?.(80, 'Implementation complete');

      return {
        output: spResult.implementation,
        patches: [],
        passes: spResult.steps.length,
      };
    }

    case 'diff_minimal': {
      ctx.onProgress?.(30, 'Generating minimal diff...');

      // For diff_minimal, we need a target file. Prefer an explicitly selected
      // path and read its real content from storage; only fall back to scraping
      // the context block when neither a selected path nor a readable file exists.
      const targetFile =
        ctx.selectedPaths?.[0] ?? ctx.characteristics.keywords[0] ?? 'unknown';
      let fileContent = '';
      try {
        fileContent = await readFile(ctx.storageKey, targetFile);
      } catch {
        fileContent = extractFileContentFromContext(enhancedContext, targetFile);
      }

      const dmResult = await generateMinimalDiff({
        task: ctx.task,
        filePath: targetFile,
        fileContent,
        context: enhancedContext,
        modelId: plan.modelId,
        provider: plan.provider,
        workspaceId: ctx.workspaceId,
        signal: ctx.signal,
      });

      ctx.onProgress?.(80, 'Diff generated');

      const patches = dmResult.blocks.map((block) => ({
        filePath: targetFile,
        search: block.search,
        replace: block.replace,
      }));

      // Build output from patches
      const output = patches
        .map((p) => `<<<<<<< SEARCH\n${p.search}\n=======\n${p.replace}\n>>>>>>> REPLACE`)
        .join('\n\n');

      return { output, patches, passes: 1 };
    }

    default:
      return executeMultiPass(plan, ctx, enhancedContext);
  }
}

async function executeFusion(
  plan: ExecutionPlan,
  ctx: ExecutionContext,
  enhancedContext: string
): Promise<ExecutionResult> {
  ctx.onProgress?.(30, 'Fanning out task to multi-model panel...');

  const result = await runFusion({
    task: ctx.task,
    context: enhancedContext,
    workspaceId: ctx.workspaceId,
    projectId: ctx.projectId,
    validateSyntax: plan.verification.ast,
    runLint: plan.verification.lint,
    runTests: plan.verification.tests,
    signal: ctx.signal,
  });

  ctx.onProgress?.(90, 'Synthesis complete');

  return {
    output: result.deliverable,
    patches: [],
    passes: 1,
  };
}

async function executeAgentless(
  plan: ExecutionPlan,
  ctx: ExecutionContext,
  _enhancedContext: string
): Promise<ExecutionResult> {
  ctx.onProgress?.(30, 'Running agentless pipeline...');

  const result = await runAgentlessPipeline({
    task: ctx.task,
    projectId: ctx.projectId,
    storageKey: ctx.storageKey,
    modelId: plan.modelId,
    provider: plan.provider,
    workspaceId: ctx.workspaceId,
    candidates: plan.enableBestOfN ? plan.bestOfNCount : 1,
    signal: ctx.signal,
    onPhase: (phaseType, detail) => {
      if (phaseType === 'localize') ctx.onProgress?.(40, detail);
      else if (phaseType === 'repair') ctx.onProgress?.(60, detail);
      else ctx.onProgress?.(80, detail);
    },
  });

  const patches = (result.patch ?? []).map((p) => ({
    filePath: (p as { filePath?: string }).filePath ?? '',
    search: (p as { search?: string }).search ?? '',
    replace: (p as { replace?: string }).replace ?? '',
  }));

  const output = result.patch
    ? patches.map((p) => `File: ${p.filePath}\n<<<<<<< SEARCH\n${p.search}\n=======\n${p.replace}\n>>>>>>> REPLACE`).join('\n\n')
    : '';

  return {
    output,
    patches,
    passes: result.candidates.length,
  };
}

async function executeAgentLoop(
  plan: ExecutionPlan,
  ctx: ExecutionContext
): Promise<ExecutionResult> {
  ctx.onProgress?.(20, 'Starting agent loop...');

  const result = await runAgentLoop({
    task: ctx.task,
    projectId: ctx.projectId,
    storageKey: ctx.storageKey,
    modelId: plan.modelId,
    provider: plan.provider,
    workspaceId: ctx.workspaceId,
    maxIterations: plan.maxPasses * 3,
    enableSelfVerification: plan.enableReview,
    signal: ctx.signal,
    onIteration: (iteration) => {
      const pct = Math.min(20 + iteration * 10, 85);
      ctx.onProgress?.(pct, `Iteration ${iteration}`);
    },
  });

  const patches = result.patches.map((p) => ({
    filePath: (p as { filePath?: string }).filePath ?? '',
    search: (p as { search?: string }).search ?? '',
    replace: (p as { replace?: string }).replace ?? '',
  }));

  const output = result.reasoning.join('\n\n') + '\n\n' +
    patches.map((p) => `File: ${p.filePath}\n<<<<<<< SEARCH\n${p.search}\n=======\n${p.replace}\n>>>>>>> REPLACE`).join('\n\n');

  return {
    output,
    patches,
    passes: result.iterations,
  };
}

async function executeMultiPass(
  plan: ExecutionPlan,
  ctx: ExecutionContext,
  enhancedContext: string
): Promise<ExecutionResult> {
  ctx.onProgress?.(25, 'Starting multi-pass generation...');

  const adapted = adaptPrompt({
    modelId: plan.modelId,
    provider: plan.provider,
    systemPrompt: enhancedContext,
    userMessage: ctx.task,
    taskType: mapCategoryToAdaptTaskType(ctx.characteristics.category),
  });

  const result = await multiPassExecute({
    task: ctx.task,
    context: adapted.systemPrompt,
    systemPrompt: adapted.systemPrompt,
    modelId: plan.modelId,
    provider: plan.provider,
    workspaceId: ctx.workspaceId,
    maxPasses: plan.maxPasses,
    enableReview: plan.enableReview,
    enableRefine: plan.enableReview,
    signal: ctx.signal,
    onPassStart: (passType, passNumber) => {
      const pct = 25 + Math.round((passNumber / plan.maxPasses) * 50);
      ctx.onProgress?.(pct, `Pass ${passNumber}: ${passType}`);
    },
  });

  return {
    output: result.finalOutput,
    patches: [],
    passes: result.totalPasses,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 6: Verification
// ─────────────────────────────────────────────────────────────────────────────

async function runVerification(
  output: string,
  checks: { ast: boolean; lint: boolean; typeCheck: boolean; tests: boolean },
  options: { testCommand?: string; cwd?: string; signal?: AbortSignal }
): Promise<VerificationOutcome> {
  const passedChecks: string[] = [];
  const failedChecks: string[] = [];
  const errors: string[] = [];

  // Extract code blocks from output for validation
  const code = extractCodeFromOutput(output);
  if (!code) {
    // No code to validate — pass by default
    return { passed: true, passedChecks: ['no_code'], failedChecks: [], errors: [], feedback: '' };
  }

  // AST validation (instant, always safe)
  if (checks.ast) {
    const astResult = validateSyntax(code);
    if (astResult.valid) {
      passedChecks.push('ast');
    } else {
      failedChecks.push('ast');
      for (const err of astResult.errors) {
        errors.push(`[AST] Line ${err.line}: ${err.message}`);
      }
    }
  }

  // Lint check
  if (checks.lint) {
    try {
      const lintResult = await runLint(code);
      if (lintResult.success) {
        passedChecks.push('lint');
      } else {
        failedChecks.push('lint');
        for (const err of lintResult.errors) {
          errors.push(`[Lint] ${err.rule ?? 'unknown'}: ${err.message} (line ${err.line})`);
        }
      }
    } catch {
      // Lint tool not available — skip gracefully
      passedChecks.push('lint_skipped');
    }
  }

  // Type check
  if (checks.typeCheck) {
    try {
      const typeResult = await runTypeCheck(code);
      if (typeResult.success) {
        passedChecks.push('type_check');
      } else {
        failedChecks.push('type_check');
        for (const err of typeResult.errors) {
          errors.push(`[Type] ${err.file}:${err.line}: ${err.message}`);
        }
      }
    } catch {
      passedChecks.push('type_check_skipped');
    }
  }

  // Test execution. Require an explicit project cwd — never fall back to
  // process.cwd(), which would run the host (Teskel) repo's own test suite.
  if (checks.tests && options.testCommand) {
    if (!options.cwd) {
      passedChecks.push('tests_skipped');
    } else {
      try {
        const testResult = await runTests(options.testCommand, options.cwd);
        if (testResult.passed) {
          passedChecks.push('tests');
        } else {
          failedChecks.push('tests');
          for (const failure of testResult.failures) {
            errors.push(`[Test] ${failure.testName}: ${failure.message}`);
          }
        }
      } catch {
        passedChecks.push('tests_skipped');
      }
    }
  }

  const passed = failedChecks.length === 0;
  const feedback = errors.length > 0
    ? `Verification issues:\n${errors.join('\n')}`
    : '';

  return { passed, passedChecks, failedChecks, errors, feedback };
}

// ─────────────────────────────────────────────────────────────────────────────
// Error Recovery
// ─────────────────────────────────────────────────────────────────────────────

async function attemptRecovery(
  task: string,
  context: string,
  error: string,
  options: { modelId?: string; provider?: string; workspaceId?: string; signal?: AbortSignal }
): Promise<RecoveryResult> {
  return executeRecovery(task, context, error, {
    modelId: options.modelId,
    provider: options.provider,
    workspaceId: options.workspaceId,
    maxRetries: MAX_RECOVERY_ATTEMPTS,
    signal: options.signal,
  });
}

type VerificationFixResult = {
  fixed: boolean;
  output: string;
  attempts: number;
};

async function attemptVerificationFix(
  output: string,
  verification: VerificationOutcome,
  task: string,
  context: string,
  options: { modelId?: string; provider?: string; workspaceId?: string; signal?: AbortSignal }
): Promise<VerificationFixResult> {
  const errorSummary = verification.errors.slice(0, 10).join('\n');
  const fixPrompt = [
    'The following code was generated but has verification errors. Fix these issues:',
    '',
    'Errors:',
    errorSummary,
    '',
    'Original code:',
    output,
  ].join('\n');

  const result = await executeRecovery(task, context + '\n\n' + fixPrompt, errorSummary, {
    modelId: options.modelId,
    provider: options.provider,
    workspaceId: options.workspaceId,
    maxRetries: 2,
    signal: options.signal,
  });

  return {
    fixed: result.recovered,
    output: result.recovered ? result.output : output,
    attempts: result.attempts,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Utility Functions
// ─────────────────────────────────────────────────────────────────────────────

function checkAbort(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new Error('Quality engine execution aborted');
  }
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  return String(err);
}

function mapCategoryToTaskType(category: TaskCategory): 'chat' | 'completion' | 'agent' | 'review' {
  switch (category) {
    case 'code_review':
      return 'review';
    case 'explanation':
    case 'documentation':
      return 'chat';
    case 'debugging':
    case 'bug_fix':
    case 'feature_implementation':
    case 'refactoring':
    case 'migration':
      return 'agent';
    default:
      return 'completion';
  }
}

function mapCategoryToAdaptTaskType(category: TaskCategory): AdaptTaskType {
  switch (category) {
    case 'bug_fix':
    case 'debugging':
      return 'bug_fix';
    case 'refactoring':
      return 'refactoring';
    case 'test_writing':
      return 'test_writing';
    case 'code_review':
      return 'code_review';
    case 'explanation':
    case 'documentation':
      return 'explanation';
    case 'feature_implementation':
      return 'code_generation';
    case 'optimization':
    case 'configuration':
    case 'migration':
      return 'completion';
    default:
      return 'completion';
  }
}

function detectLanguageFromContext(ctx: ExecutionContext): string {
  // Infer language from selected paths or task keywords
  const paths = ctx.characteristics.keywords;
  for (const kw of paths) {
    if (kw.endsWith('.ts') || kw.endsWith('.tsx')) return 'typescript';
    if (kw.endsWith('.js') || kw.endsWith('.jsx')) return 'javascript';
    if (kw.endsWith('.py')) return 'python';
    if (kw.endsWith('.rs')) return 'rust';
    if (kw.endsWith('.go')) return 'go';
  }

  // Check task description
  const task = ctx.task.toLowerCase();
  if (task.includes('typescript') || task.includes('.ts')) return 'typescript';
  if (task.includes('javascript') || task.includes('.js')) return 'javascript';
  if (task.includes('python') || task.includes('.py')) return 'python';
  if (task.includes('rust') || task.includes('.rs')) return 'rust';
  if (task.includes('go ') || task.includes('golang')) return 'go';

  return 'typescript'; // Default
}

function extractFileContentFromContext(context: string, _filePath: string): string {
  // Try to extract file content from the context block
  // Context typically includes file contents in labeled blocks
  const fileBlockRegex = /```[\w]*\n([\s\S]*?)```/;
  const match = context.match(fileBlockRegex);
  return match?.[1] ?? '';
}

function extractCodeFromOutput(output: string): string | null {
  // Try to extract code from markdown code blocks
  const codeBlockRegex = /```[\w]*\n([\s\S]*?)```/g;
  const blocks: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = codeBlockRegex.exec(output)) !== null) {
    blocks.push(match[1]);
  }

  if (blocks.length > 0) {
    return blocks.join('\n\n');
  }

  // If no code blocks, check if the output itself looks like code
  const lines = output.split('\n');
  const codeIndicators = /^[\s]*[{}\[\]();=<>\/\*#@]|^[\s]*(import|export|function|class|const|let|var|if|for|while|return|def|fn|pub|use|mod)\b/;
  const codeLines = lines.filter((l) => codeIndicators.test(l));

  if (codeLines.length > lines.length * 0.3) {
    return output;
  }

  return null;
}

function detectProjectStyleFromContext(smartContext: SmartContextResult): ProjectStyle {
  // Build a minimal style from context metadata
  const files = smartContext.relevantFiles.map((f) => ({
    path: f.path,
    content: '', // We don't have full content here, use defaults
  }));

  if (files.length > 0) {
    try {
      return detectProjectStyle(files);
    } catch {
      // Fall through to default
    }
  }

  return {
    language: 'typescript',
    patterns: [],
    conventions: {
      semicolons: true,
      quotes: 'single',
      indentation: 'spaces',
      indentSize: 2,
    },
  };
}

function countErrors(verification: VerificationOutcome, type: 'lint' | 'type'): number {
  const prefix = type === 'lint' ? '[Lint]' : '[Type]';
  return verification.errors.filter((e) => e.startsWith(prefix)).length;
}

function createFallbackContext(): SmartContextResult {
  return {
    system: '',
    contextBlocks: [],
    relevantFiles: [],
    budget: { total: 0, used: 0, remaining: 0, breakdown: {} },
    metadata: { modelId: '', filesIncluded: 0, repoMapIncluded: false, compressionLevel: 'none' },
  };
}

function buildFailureResult(
  options: QualityEngineOptions,
  modelId: string,
  plan: ExecutionPlan,
  startTime: number,
  smartContext: SmartContextResult,
  fewShotExamples: { task: string; solution: string }[],
  warnings: string[],
  err: unknown
): QualityEngineResult {
  return {
    output: `Error: Unable to generate output. ${errorMessage(err)}`,
    quality: {
      score: 0,
      grade: 'F',
      dimensions: [],
    },
    metadata: {
      modelUsed: modelId,
      pipelineUsed: plan.pipeline,
      patternUsed: plan.pattern,
      totalPasses: 0,
      totalDurationMs: Date.now() - startTime,
      tokensUsed: 0,
      costEstimate: 0,
      verificationsPassed: [],
      verificationsFailed: ['execution'],
    },
    contextUsed: {
      filesIncluded: smartContext.relevantFiles.map((f) => f.path),
      repoMapIncluded: smartContext.metadata.repoMapIncluded,
      fewShotExamplesUsed: fewShotExamples.length,
      relevantFilesFound: smartContext.relevantFiles.length,
    },
    warnings: [...warnings, `Fatal: ${errorMessage(err)}`],
  };
}
