/**
 * Multi-Model Fusion Pipeline — Panel → Judge Orchestration.
 *
 * Faithful adaptation of the Fusion-Fable methodology to Teskel's API-based
 * architecture (the upstream skill drives codex/gemini CLIs with web+bash; here
 * panelists are provider API calls and "running the code" uses Teskel's own
 * validators + sandboxed test runner instead of arbitrary host bash).
 *
 * The mechanism is INDEPENDENCE, THEN SYNTHESIS:
 *   1. Fan the user's task out to a PANEL of models in parallel, each answering
 *      independently and BLIND to the others — same task verbatim, no assigned
 *      lenses/personas. Diversity is harvested from independence, not manufactured.
 *   2. Opus 4.8 JUDGES. The pipeline can't be reversed: Opus always synthesizes
 *      and writes the final answer; panelists never see each other's work.
 *
 * Two tracks, chosen by classifying the DELIVERABLE first:
 *   - Track A (artifact: code/script/config) — "run both, then merge": verify
 *     every candidate, merge the parts that demonstrably worked onto the strongest
 *     base, then re-verify the merged artifact and fix until it passes.
 *   - Track B (research/analysis) — structured synthesis: Consensus, Contradictions,
 *     Partial coverage, Unique insights, Blind spots, then a grounded final answer.
 *
 * A failed/dropped panelist is treated as ABSENT — never as silent agreement.
 */
import { chat, isAIConfiguredAsync, type AIMessage } from "@/lib/ai/provider";
import { validateSyntax } from "./validators/ast-validator";
import { runLint } from "./validators/lint-validator";
import { runTests } from "./validators/test-runner";

// ---------------------------------------------------------------------------
// Model identifiers (driver-first; Opus 4.8 always judges)
// ---------------------------------------------------------------------------

const OPUS = { model: "claude-opus-4-8", provider: "anthropic" } as const;
const GPT = { model: "gpt-4o", provider: "openai" } as const;
const GEMINI = { model: "gemini-3.1-pro", provider: "google" } as const;

const MAX_MERGE_FIX_ATTEMPTS = 2;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PanelSlug =
  | "opus4.8-4.8"
  | "opus4.8-gpt5.5"
  | "opus4.8-gpt5.5-gemini3.1pro"
  | string;

export type FusionOptions = {
  task: string;
  context?: string;
  systemPrompt?: string;
  panelSlug?: PanelSlug;
  workspaceId?: string;
  projectId?: string;

  // Track A verification / "running the candidates".
  validateSyntax?: boolean;
  runLint?: boolean;
  runTests?: boolean;
  testCommand?: string;
  cwd?: string;

  signal?: AbortSignal;
};

export type CandidateVerification = {
  /** Whether we were actually able to exercise the candidate at all. */
  ran: boolean;
  syntaxValid: boolean;
  lintPassed: boolean | null; // null = not run
  testsPassed: boolean | null; // null = not run
  /** Human-readable summary of what passed / broke when this candidate ran. */
  feedback: string;
};

export type PanelistResponse = {
  model: string;
  provider: string;
  /** Stable label used in attribution, e.g. "Opus 4.8 run A", "GPT-5.5". */
  label: string;
  response: string;
  /** True when the panelist call errored — judge must treat it as ABSENT. */
  failed: boolean;
  verification?: CandidateVerification;
};

export type FusionResult = {
  success: boolean;
  deliverable: string;
  panelSlug: string;
  /** Driver-first list of panelists that actually participated. */
  panelists: string[];
  /** The judge model (always Opus 4.8 when Anthropic is configured). */
  judge: string;
  track: "A" | "B";
  /** Panelists requested but dropped (missing provider / errored). */
  dropped: string[];
  /** Set when the panel ran with fewer models than the requested slug. */
  downgraded: boolean;
  /** Track A: did the merged artifact pass verification when re-run? */
  verified?: boolean;
  /** Track A: how many judge merge/fix passes were taken. */
  mergeAttempts?: number;
  analysis?: {
    consensus: string;
    contradictions: string;
    partial: string;
    unique: string;
    blindSpots: string;
  };
  candidates?: PanelistResponse[];
  mergeRationale?: string;
  notes?: string;
  durationMs: number;
};

type PanelMember = {
  model: string;
  provider: string;
  temperature?: number;
};

// ---------------------------------------------------------------------------
// Judge prompts
// ---------------------------------------------------------------------------

const JUDGE_TRACK_A_PROMPT = `You are Opus 4.8, the Judge in a Multi-Model Fusion pipeline. The panelists each
produced an independent candidate implementation for the SAME task, blind to one another. Each candidate was
then EXERCISED (syntax / lint / tests) and the observed results are given to you. Your job is to merge them
into a SINGLE working artifact — not a report, not two programs pasted together.

Task:
{{task}}

{{candidates}}

Rules for merging (follow exactly):
1. Build a model of each candidate's approach, then decide what to keep based on the OBSERVED verification
   results above — what demonstrably worked outranks what merely "looks" better.
2. Pick the strongest candidate as the foundation and graft in the SPECIFIC pieces from the others that you
   can see worked (a correct edge-case fix, a function that passed where the base's failed).
3. Resolve every disagreement in favor of the version that verified. Never average two answers and never keep
   both "to be safe". Treat any candidate marked ABSENT as not present — never as agreement.
4. Make the seams clean: consistent signatures, imports, types, style. One coherent design.

Return ONLY a JSON object (no markdown fences, no prose) of exactly this shape:
{
  "code": "the complete merged artifact, ready to run as-is",
  "mergeRationale": "what each candidate did when run, what you took from each and why, which disagreements you resolved how"
}`;

const JUDGE_TRACK_A_FIX_PROMPT = `You are Opus 4.8, the Judge. The merged artifact you produced was re-run and
FAILED verification. Fix it so it passes, keeping the same overall design.

Task:
{{task}}

Observed failures when the merged artifact was re-run:
{{failures}}

Current merged artifact:
\`\`\`
{{code}}
\`\`\`

Return ONLY a JSON object (no fences, no prose):
{
  "code": "the corrected, complete artifact ready to run as-is",
  "mergeRationale": "what you changed to make it pass"
}`;

const JUDGE_TRACK_B_PROMPT = `You are Opus 4.8, the Judge in a Multi-Model Fusion pipeline. You are reading every
panelist's response AFTER all of them answered independently and blind to one another. Do not vote or average.

Task:
{{task}}

Panelist responses:
{{responses}}

Instructions:
1. **Consensus** — points where panelists independently agree. Independent agreement (even two cold runs of the
   same model) is your HIGHEST-confidence signal; note how many converged.
2. **Contradictions** — direct disagreements on fact or recommendation. State the competing positions, who holds
   them, and adjudicate where you can (who ran the code / read a primary source). Never bury a real conflict.
3. **Partial Coverage** — important sub-questions only some panelists engaged.
4. **Unique Insights** — non-obvious, valuable points raised by exactly one panelist; preserve them.
5. **Blind Spots** — what the panel AS A WHOLE missed, including shared assumptions none questioned; you may add
   one they didn't name.
6. **Final Answer** — grounded in the above: lead with high-confidence consensus, fold in unique insights, flag
   what stays uncertain. It must follow FROM the synthesis, not be one panelist's answer lightly edited.

Evidence over assertion: a panelist that ran the code or read the source outranks one reasoning from memory,
regardless of model. Treat any panelist marked ABSENT as not present — never as agreement.

Format your output EXACTLY as markdown with these headers:
# Final Answer
[grounded answer]

# Consensus
- [point] (Attributed to: [panelist(s)])

# Contradictions
- [conflict] ([position A] — [panelist] vs [position B] — [panelist])

# Partial Coverage
- [sub-point] (Attributed to: [panelist(s)])

# Unique Insights
- [insight] (Attributed to: [panelist])

# Blind Spots
- [blind spot] (Attributed to: [panelist(s)] or added by Judge)
`;

// ---------------------------------------------------------------------------
// Step 0 — Pick the panel (driver-first; Opus always judges)
// ---------------------------------------------------------------------------

export type DetectedPanel = {
  slug: string;
  panelists: PanelMember[];
  judge: { model: string; provider: string };
  dropped: string[];
  downgraded: boolean;
};

type Availability = { hasAnthropic: boolean; hasOpenai: boolean; hasGoogle: boolean };
type PanelBase = DetectedPanel;

/**
 * Resolve the richest panel the configured providers can support, driver-first.
 * Opus 4.8 is always the judge when Anthropic is available — the pipeline can't
 * be reversed. When Anthropic is absent we degrade (Fusion-Fable assumes Opus is
 * always present); the strongest configured provider becomes the judge and the
 * result is flagged as downgraded.
 */
export async function detectPanel(workspaceId?: string): Promise<DetectedPanel> {
  // Panel is resolved purely from configured provider availability; Opus judges.
  return composeAuto(await readAvailability(workspaceId));
}

async function readAvailability(workspaceId?: string): Promise<Availability> {
  const [hasAnthropic, hasOpenai, hasGoogle] = await Promise.all([
    isAIConfiguredAsync("anthropic", workspaceId),
    isAIConfiguredAsync("openai", workspaceId),
    isAIConfiguredAsync("google", workspaceId),
  ]);
  return { hasAnthropic, hasOpenai, hasGoogle };
}

/** Richest available panel, driver-first (Opus drives + judges). */
function composeAuto({ hasAnthropic, hasOpenai, hasGoogle }: Availability): PanelBase {
  const judge = hasAnthropic
    ? { ...OPUS }
    : hasOpenai
      ? { ...GPT }
      : { model: "gpt-4o-mini", provider: "openai" };

  if (hasAnthropic && hasOpenai && hasGoogle) {
    return {
      slug: "opus4.8-gpt5.5-gemini3.1pro",
      panelists: [{ ...OPUS }, { ...GPT }, { ...GEMINI }],
      judge,
      dropped: [],
      downgraded: false,
    };
  }
  if (hasAnthropic && hasOpenai) {
    return { slug: "opus4.8-gpt5.5", panelists: [{ ...OPUS }, { ...GPT }], judge, dropped: [], downgraded: false };
  }
  if (hasAnthropic) {
    return {
      slug: "opus4.8-4.8",
      panelists: [{ ...OPUS, temperature: 0.2 }, { ...OPUS, temperature: 0.5 }],
      judge,
      dropped: [],
      downgraded: false,
    };
  }
  // No Anthropic — Opus can't drive; run whatever exists, flagged downgraded.
  const fallback: PanelMember[] = hasOpenai
    ? [{ ...GPT, temperature: 0.2 }, { ...GPT, temperature: 0.5 }]
    : [{ model: "gpt-4o-mini", provider: "openai", temperature: 0.2 }];
  return {
    slug: hasOpenai ? "gpt-gpt" : "single",
    panelists: fallback,
    judge,
    dropped: ["opus4.8 (Anthropic not configured)"],
    downgraded: true,
  };
}

/**
 * Resolve a specific requested slug, dropping members whose provider isn't
 * configured (graceful downgrade, never a hard failure).
 */
function composeSlug(slug: string, { hasAnthropic, hasOpenai, hasGoogle }: Availability): PanelBase {
  const judge = hasAnthropic ? { ...OPUS } : { ...GPT };
  const dropped: string[] = [];

  let wanted: { member: PanelMember; ok: boolean; label: string }[];
  if (slug === "opus4.8-gpt5.5-gemini3.1pro") {
    wanted = [
      { member: { ...OPUS }, ok: hasAnthropic, label: "opus4.8 (Anthropic)" },
      { member: { ...GPT }, ok: hasOpenai, label: "gpt5.5 (OpenAI)" },
      { member: { ...GEMINI }, ok: hasGoogle, label: "gemini3.1pro (Google)" },
    ];
  } else if (slug === "opus4.8-gpt5.5") {
    wanted = [
      { member: { ...OPUS }, ok: hasAnthropic, label: "opus4.8 (Anthropic)" },
      { member: { ...GPT }, ok: hasOpenai, label: "gpt5.5 (OpenAI)" },
    ];
  } else {
    // opus4.8-4.8 — two cold Opus runs.
    wanted = [
      { member: { ...OPUS, temperature: 0.2 }, ok: hasAnthropic, label: "opus4.8 run A" },
      { member: { ...OPUS, temperature: 0.5 }, ok: hasAnthropic, label: "opus4.8 run B" },
    ];
  }

  const panelists = wanted.filter((w) => w.ok).map((w) => w.member);
  for (const w of wanted) if (!w.ok) dropped.push(w.label);

  // If everything dropped, fall back to the richest auto panel.
  if (panelists.length === 0) return composeAuto({ hasAnthropic, hasOpenai, hasGoogle });

  return { slug, panelists, judge, dropped, downgraded: dropped.length > 0 };
}

/** Resolve panelists for an explicitly requested slug from provider availability. */
async function resolveRequestedSlug(
  slug: string,
  workspaceId: string | undefined
): Promise<DetectedPanel> {
  return composeSlug(slug, await readAvailability(workspaceId));
}

// ---------------------------------------------------------------------------
// Execution engine
// ---------------------------------------------------------------------------

export async function executeFusion(options: FusionOptions): Promise<FusionResult> {
  const startTime = Date.now();
  const { task, context = "", systemPrompt, workspaceId, signal } = options;

  // Step 0 — resolve the panel.
  const panel =
    options.panelSlug && options.panelSlug !== "auto"
      ? await resolveRequestedSlug(options.panelSlug, workspaceId)
      : await detectPanel(workspaceId);

  const panelists = panel.panelists;

  // Classify the DELIVERABLE: artifact (Track A) vs research/analysis (Track B).
  const track = classifyTrack(task, options.validateSyntax);

  // Step 1 — fan out: each panelist gets the task VERBATIM + the independence
  // instruction, in parallel, blind to one another. No lenses, no personas.
  const labels = labelPanelists(panelists);
  const panelistPrompt = buildPanelistPrompt(context, task);

  const baseSystem =
    systemPrompt ||
    "You are an expert AI developer and analyst. Solve the task completely and directly.";

  const responses = await Promise.all(
    panelists.map(async (p, index): Promise<PanelistResponse> => {
      const messages: AIMessage[] = [
        { role: "system", content: baseSystem },
        { role: "user", content: panelistPrompt },
      ];
      try {
        const response = await chat(messages, {
          model: p.model,
          provider: p.provider,
          workspaceId,
          // Slight temperature spread to harvest reasoning diversity from
          // independence; never assigned personas.
          temperature: p.temperature ?? (index === 0 ? 0.2 : 0.4),
          signal,
        });
        return { model: p.model, provider: p.provider, label: labels[index], response, failed: false };
      } catch (err) {
        return {
          model: p.model,
          provider: p.provider,
          label: labels[index],
          response: `Error running panelist: ${err instanceof Error ? err.message : String(err)}`,
          failed: true,
        };
      }
    })
  );

  // A failed panelist is ABSENT — excluded from synthesis, never silent agreement.
  const active = responses.filter((r) => !r.failed);

  if (active.length === 0) {
    return baseResult(panel, track, responses, startTime, {
      success: false,
      deliverable: "Fusion failed: every panelist errored. Check provider configuration.",
    });
  }

  return track === "A"
    ? runTrackA(options, panel, responses, active, startTime)
    : runTrackB(options, panel, responses, active, startTime);
}

// ---------------------------------------------------------------------------
// Track A — run both, then merge, then run again until it passes
// ---------------------------------------------------------------------------

async function runTrackA(
  options: FusionOptions,
  panel: DetectedPanel,
  responses: PanelistResponse[],
  active: PanelistResponse[],
  startTime: number
): Promise<FusionResult> {
  const { workspaceId, signal } = options;

  // Step 2a — exercise every candidate and record observed behavior.
  for (const res of active) {
    res.verification = await verifyArtifact(extractCode(res.response), options);
  }

  // Step 2b — judge merges using the OBSERVED results.
  const candidatesBlock = active
    .map((r, i) => {
      const v = r.verification!;
      return [
        `### Candidate ${i + 1} — ${r.label} (${r.model} via ${r.provider})`,
        `- Ran: ${v.ran ? "yes" : "no"}`,
        `- Syntax valid: ${v.syntaxValid}`,
        `- Lint: ${v.lintPassed === null ? "not run" : v.lintPassed ? "passed" : "failed"}`,
        `- Tests: ${v.testsPassed === null ? "not run" : v.testsPassed ? "passed" : "failed"}`,
        `- Observed: ${v.feedback}`,
        "- Code:",
        "```",
        extractCode(r.response),
        "```",
      ].join("\n");
    })
    .join("\n\n");

  const judgePrompt = JUDGE_TRACK_A_PROMPT.replace("{{task}}", options.task).replace(
    "{{candidates}}",
    candidatesBlock
  );

  let merged = await judgeMerge(judgePrompt, panel.judge, workspaceId, signal);
  let mergeAttempts = 1;

  // Step 2c — re-run the merged artifact and fix until it passes (bounded).
  let mergedVerification = await verifyArtifact(merged.code, options);
  while (
    !verificationPassed(mergedVerification) &&
    mergeAttempts <= MAX_MERGE_FIX_ATTEMPTS &&
    !signal?.aborted
  ) {
    const fixPrompt = JUDGE_TRACK_A_FIX_PROMPT.replace("{{task}}", options.task)
      .replace("{{failures}}", mergedVerification.feedback || "verification failed")
      .replace("{{code}}", merged.code);
    const fixed = await judgeMerge(fixPrompt, panel.judge, workspaceId, signal);
    merged = {
      code: fixed.code || merged.code,
      mergeRationale: `${merged.mergeRationale}\n\nFix pass ${mergeAttempts}: ${fixed.mergeRationale}`,
    };
    mergedVerification = await verifyArtifact(merged.code, options);
    mergeAttempts += 1;
  }

  return baseResult(panel, "A", responses, startTime, {
    success: true,
    deliverable: merged.code,
    mergeRationale: merged.mergeRationale,
    verified: verificationPassed(mergedVerification),
    mergeAttempts,
  });
}

// ---------------------------------------------------------------------------
// Track B — structured synthesis
// ---------------------------------------------------------------------------

async function runTrackB(
  options: FusionOptions,
  panel: DetectedPanel,
  responses: PanelistResponse[],
  active: PanelistResponse[],
  startTime: number
): Promise<FusionResult> {
  const { workspaceId, signal } = options;

  const responsesBlock = active
    .map((r) => `Panelist "${r.label}" (${r.model} via ${r.provider}):\n${r.response}\n---`)
    .join("\n\n");

  const judgePrompt = JUDGE_TRACK_B_PROMPT.replace("{{task}}", options.task).replace(
    "{{responses}}",
    responsesBlock
  );

  const synthesis = await chat(
    [
      { role: "system", content: "You are Opus 4.8 synthesizing multi-model insights." },
      { role: "user", content: judgePrompt },
    ],
    { model: panel.judge.model, provider: panel.judge.provider, workspaceId, temperature: 0.2, signal }
  );

  return baseResult(panel, "B", responses, startTime, {
    success: true,
    deliverable: synthesis,
    analysis: {
      consensus: extractMarkdownSection(synthesis, "Consensus"),
      contradictions: extractMarkdownSection(synthesis, "Contradictions"),
      partial: extractMarkdownSection(synthesis, "Partial Coverage"),
      unique: extractMarkdownSection(synthesis, "Unique Insights"),
      blindSpots: extractMarkdownSection(synthesis, "Blind Spots"),
    },
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build the verbatim-task panelist prompt (no lenses, no pre-digestion). */
function buildPanelistPrompt(context: string, task: string): string {
  const ctx = context ? `${context}\n\n` : "";
  return (
    `${ctx}Task: ${task}\n\n` +
    "Instruction: Solve the task above and return a complete, self-contained answer. " +
    "Research as needed (use the provided project context). You are one of several independent " +
    "experts answering this in parallel — you will not see the others' work, so do not assume any " +
    "shared context beyond this prompt. Return your absolute best work."
  );
}

/** Classify the deliverable: artifact (Track A) vs research/analysis (Track B). */
function classifyTrack(task: string, forceArtifact?: boolean): "A" | "B" {
  if (forceArtifact === true) return "A";
  const isArtifact =
    /\b(code|write|implement|build|create|fix|refactor|function|class|method|component|module|script|json|schema|yaml|dockerfile|prisma|migration|api|endpoint|test)\b/i.test(
      task
    );
  return isArtifact ? "A" : "B";
}

/** Stable attribution labels, driver-first. */
function labelPanelists(panelists: PanelMember[]): string[] {
  const counts = new Map<string, number>();
  return panelists.map((p) => {
    const base = shortName(p.model);
    const total = panelists.filter((q) => shortName(q.model) === base).length;
    const n = (counts.get(base) ?? 0) + 1;
    counts.set(base, n);
    return total > 1 ? `${base} run ${String.fromCharCode(64 + n)}` : base;
  });
}

function shortName(model: string): string {
  if (/opus/i.test(model)) return "Opus 4.8";
  if (/gpt/i.test(model)) return "GPT-5.5";
  if (/gemini/i.test(model)) return "Gemini 3.1 Pro";
  return model;
}

/**
 * "Run" a candidate within Teskel's safety model: syntax + lint, and tests when a
 * project command + cwd are available. This is the API-side analog of the upstream
 * skill exercising each candidate with bash.
 */
async function verifyArtifact(
  code: string,
  options: FusionOptions
): Promise<CandidateVerification> {
  if (!code.trim()) {
    return { ran: false, syntaxValid: false, lintPassed: null, testsPassed: null, feedback: "no code produced" };
  }

  const notes: string[] = [];
  let ran = false;

  // Syntax (default on for Track A).
  let syntaxValid = true;
  if (options.validateSyntax !== false) {
    const ast = validateSyntax(code);
    syntaxValid = ast.valid;
    ran = true;
    notes.push(
      ast.valid
        ? "syntax ok"
        : `syntax errors: ${ast.errors.slice(0, 3).map((e) => `L${e.line}: ${e.message}`).join("; ")}`
    );
  }

  // Lint.
  let lintPassed: boolean | null = null;
  if (options.runLint) {
    try {
      const lint = await runLint(code);
      lintPassed = lint.success;
      ran = true;
      notes.push(
        lint.success ? "lint clean" : `lint: ${lint.errors.slice(0, 3).map((e) => e.message).join("; ")}`
      );
    } catch {
      notes.push("lint unavailable");
    }
  }

  // Tests (only with a real project command + cwd — never the host repo).
  let testsPassed: boolean | null = null;
  if (options.runTests && options.testCommand && options.cwd) {
    try {
      const t = await runTests(options.testCommand, options.cwd);
      testsPassed = t.passed;
      ran = true;
      notes.push(`tests ${t.passedTests}/${t.totalTests} passed`);
    } catch {
      notes.push("tests failed to run");
    }
  }

  return { ran, syntaxValid, lintPassed, testsPassed, feedback: notes.join(", ") };
}

function verificationPassed(v: CandidateVerification): boolean {
  if (!v.ran) return true; // nothing to check — don't loop forever
  if (!v.syntaxValid) return false;
  if (v.lintPassed === false) return false;
  if (v.testsPassed === false) return false;
  return true;
}

async function judgeMerge(
  prompt: string,
  judge: { model: string; provider: string },
  workspaceId: string | undefined,
  signal: AbortSignal | undefined
): Promise<{ code: string; mergeRationale: string }> {
  try {
    const out = await chat(
      [
        { role: "system", content: "You are Opus 4.8, an expert software architect merging implementations." },
        { role: "user", content: prompt },
      ],
      { model: judge.model, provider: judge.provider, workspaceId, temperature: 0.1, signal }
    );
    return parseJsonMerge(out);
  } catch {
    return { code: "", mergeRationale: "Judge merge failed." };
  }
}

function baseResult(
  panel: DetectedPanel,
  track: "A" | "B",
  responses: PanelistResponse[],
  startTime: number,
  extra: Partial<FusionResult> & { deliverable: string; success: boolean }
): FusionResult {
  return {
    panelSlug: panel.slug,
    panelists: responses.filter((r) => !r.failed).map((r) => `${r.label} (${r.model})`),
    judge: `${panel.judge.model} (${panel.judge.provider})`,
    track,
    dropped: [
      ...panel.dropped,
      ...responses.filter((r) => r.failed).map((r) => `${r.label} (errored)`),
    ],
    downgraded: panel.downgraded || responses.some((r) => r.failed),
    candidates: responses,
    durationMs: Date.now() - startTime,
    notes: panel.downgraded
      ? "Panel downgraded — configure more providers (Anthropic, OpenAI, Google) for the full panel."
      : undefined,
    ...extra,
  };
}

function extractCode(text: string): string {
  const match = text.match(/```[a-zA-Z0-9-]*\n([\s\S]*?)\n```/);
  return match ? match[1].trim() : text.trim();
}

function parseJsonMerge(text: string): { code: string; mergeRationale: string } {
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (typeof parsed.code === "string") {
        return {
          code: parsed.code,
          mergeRationale:
            typeof parsed.mergeRationale === "string" ? parsed.mergeRationale : "Merged by judge.",
        };
      }
    }
  } catch {
    // fall through to regex extraction
  }
  return { code: extractCode(text), mergeRationale: "Extracted code directly from judge response." };
}

function extractMarkdownSection(text: string, sectionTitle: string): string {
  const regex = new RegExp(`#+\\s+${sectionTitle}[\\r\\n]+([\\s\\S]*?)(?:[\\r\\n]+#+|$)`, "i");
  const match = text.match(regex);
  return match ? match[1].trim() : "No details found.";
}
