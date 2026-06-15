/**
 * Teskel background-agent orchestration engine (Phase 6).
 *
 * SERVER-ONLY. Drives an AgentRun through a fixed, typed sequence of steps and
 * emits structured events for an SSE stream.
 *
 * EXECUTION MODEL — two paths share `driveAgentRun()`:
 *   1. DURABLE (default when Redis is configured): the POST create endpoint
 *      enqueues a BullMQ job (`enqueueAgentRun`); the separate worker process
 *      (`src/worker/`) drives the run independently of any HTTP connection, so
 *      it survives cold starts / restarts and scales horizontally.
 *   2. IN-PROCESS FALLBACK (no queue configured): the GET events endpoint calls
 *      `driveAgentRun()` directly on first connect, running the steps inside the
 *      request lifecycle.
 *
 * Either way, the QUEUED -> RUNNING transition is claimed atomically (see the
 * `updateMany` guard in `driveAgentRun`), so only one executor ever drives a
 * run. A reconnect to an already-finished (or already-running) run just replays
 * the current DB status without re-executing.
 *
 * SAFETY:
 *  - The agent NEVER applies changes to disk and NEVER runs shell commands. It
 *    only proposes a ChangeSet (PENDING_REVIEW) that the user approves later via
 *    the Composer (Phase 4). Suggested commands are recorded as step output.
 *  - All file reads go through the storage layer (resolveSafe); context is
 *    capped; the AI key is never exposed.
 */
import type { AgentStepType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { readFile } from "@/lib/storage";
import { buildProjectContext } from "@/lib/ai/context";
import { chat, isAIConfigured, type AIMessage } from "@/lib/ai/provider";
import { generateChangeSet } from "@/lib/ai/changeset";
import { status as gitStatus } from "@/lib/git/service";
import type { AgentPlan, AgentRunResult } from "@/lib/agents/schemas";
import { runSearch } from "@/lib/search/engine";
import type { AgentEvent } from "@/lib/agents/events";
import {
  publishEvent,
  subscribeEvents,
  publishCancel,
  subscribeCancel,
} from "@/lib/queue/event-bus";
import { enqueueAgentRun } from "@/lib/queue/agent-queue";

/* ----------------------------- event protocol ---------------------------- */

export type { AgentEvent, AgentStepEvent } from "@/lib/agents/events";

/**
 * AbortControllers for runs executing IN THIS process (the worker, or the web
 * process in the no-Redis fallback). Cross-instance cancellation arrives over
 * the event bus and aborts the matching controller via `subscribeCancel`.
 */
const localAbort = new Map<string, AbortController>();

/** Subscribe to live events for a run. Returns an unsubscribe fn. */
export function subscribe(
  agentRunId: string,
  listener: (event: AgentEvent) => void
): () => void {
  return subscribeEvents(agentRunId, listener);
}

function emit(agentRunId: string, event: AgentEvent): void {
  publishEvent(agentRunId, event);
}

/** Whether the run is currently being driven in this process. */
export function isRunning(agentRunId: string): boolean {
  return localAbort.has(agentRunId);
}

/* ------------------------------- creation -------------------------------- */

export type StartAgentRunInput = {
  projectId: string;
  userId: string;
  goal: string;
  threadId?: string;
  fusionId?: string;
};

/**
 * Create a QUEUED AgentRun row and return it. Does NOT execute -- execution is
 * triggered by the events endpoint via `driveAgentRun()` so the work happens
 * inside an HTTP request lifecycle.
 */
export async function startAgentRun(input: StartAgentRunInput) {
  const run = await prisma.agentRun.create({
    data: {
      projectId: input.projectId,
      userId: input.userId,
      goal: input.goal,
      threadId: input.threadId ?? null,
      fusionId: input.fusionId ?? null,
      status: "QUEUED",
    },
  });
  // Durable path: enqueue a BullMQ job so a worker drives the run independently
  // of any HTTP connection. Returns false when no queue is configured, in which
  // case the SSE events endpoint drives the run in-process on first connect.
  await enqueueAgentRun({
    agentRunId: run.id,
    projectId: run.projectId,
    userId: run.userId,
  });
  return run;
}

/* ----------------------------- cancellation ------------------------------ */

/**
 * Cancel a run: abort any in-flight AI calls, mark CANCELLED in the DB, and
 * emit a cancelled event. Idempotent for already-finished runs.
 */
export async function cancel(agentRunId: string): Promise<boolean> {
  const run = await prisma.agentRun.findUnique({
    where: { id: agentRunId },
    select: { status: true },
  });
  if (!run) return false;

  const terminal =
    run.status === "COMPLETED" ||
    run.status === "FAILED" ||
    run.status === "CANCELLED";
  if (terminal) return false;

  await prisma.agentRun.update({
    where: { id: agentRunId },
    data: { status: "CANCELLED", error: "Cancelled by user" },
  });
  // Fail any non-terminal step.
  await prisma.agentStep.updateMany({
    where: { agentRunId, status: { in: ["PENDING", "RUNNING"] } },
    data: { status: "FAILED" },
  });

  // Deliver the cancel to whichever process is executing the run (this one or a
  // remote worker) so it aborts in-flight AI calls; then notify SSE clients.
  publishCancel(agentRunId);
  emit(agentRunId, { type: "cancelled" });
  return true;
}

/* ------------------------------- internals -------------------------------- */

class CancelledError extends Error {
  constructor() {
    super("Agent run cancelled");
    this.name = "CancelledError";
  }
}

function assertNotAborted(signal: AbortSignal): void {
  if (signal.aborted) throw new CancelledError();
}

/** Persist a step (RUNNING) and emit step_started. */
async function beginStep(
  agentRunId: string,
  type: AgentStepType,
  title: string,
  input?: Prisma.InputJsonValue
) {
  const step = await prisma.agentStep.create({
    data: {
      agentRunId,
      type,
      title,
      status: "RUNNING",
      input: input ?? undefined,
    },
  });
  emit(agentRunId, {
    type: "step_started",
    step: { id: step.id, type, title, status: "RUNNING" },
  });
  return step;
}

/** Mark a step COMPLETED with output and emit step_completed. */
async function completeStep(
  agentRunId: string,
  stepId: string,
  type: AgentStepType,
  title: string,
  output?: Prisma.InputJsonValue
) {
  await prisma.agentStep.update({
    where: { id: stepId },
    data: { status: "COMPLETED", output: output ?? undefined },
  });
  emit(agentRunId, {
    type: "step_completed",
    step: { id: stepId, type, title, status: "COMPLETED", output },
  });
}

async function failStep(stepId: string): Promise<void> {
  await prisma.agentStep
    .update({ where: { id: stepId }, data: { status: "FAILED" } })
    .catch(() => undefined);
}

/* --------------------------- typed agent tools ---------------------------- */
/*
 * Tools are a fixed, typed surface -- NOT arbitrary code/command execution.
 * RUN_COMMAND is intentionally absent as an executable tool; suggested commands
 * are only recorded as step output.
 * PRODUCTION TODO: gated command execution could be added later by reusing the
 * terminal runner's validateCommand() behind an explicit user approval gate.
 */

const MAX_SEARCH_FILES = 8;
const MAX_FILE_SNIPPET = 2_000;

/** List project files (paths) from the FileNode mirror, files only. */
async function listFiles(projectId: string): Promise<string[]> {
  const nodes = await prisma.fileNode.findMany({
    where: { projectId, type: "FILE" },
    select: { path: true },
    orderBy: { path: "asc" },
    take: 1000,
  });
  return nodes.map((n) => n.path);
}

/** Search project files using the proper search engine. */
async function searchCode(
  projectId: string,
  storageKey: string,
  query: string
): Promise<{ path: string; score: number }[]> {
  const response = await runSearch(projectId, storageKey, {
    q: query,
    type: "all",
    caseSensitive: false,
    regex: false,
    maxResults: MAX_SEARCH_FILES,
  });
  // Deduplicate by file path and assign a simple descending score.
  const seen = new Set<string>();
  const results: { path: string; score: number }[] = [];
  for (const match of response.results) {
    if (!seen.has(match.file)) {
      seen.add(match.file);
      results.push({ path: match.file, score: MAX_SEARCH_FILES - results.length });
    }
  }
  return results;
}

/** Read a small snippet of a file via the safe storage layer. */
async function readSnippet(
  storageKey: string,
  path: string
): Promise<string | null> {
  try {
    const content = await readFile(storageKey, path);
    return content.slice(0, MAX_FILE_SNIPPET);
  } catch {
    return null;
  }
}

/* ----------------------------- plan generation ---------------------------- */

const PLAN_INSTRUCTION = [
  "You are planning how to accomplish a coding goal in an existing project.",
  "Respond with ONLY a JSON object, no markdown fences or prose, matching:",
  '{ "summary": string, "steps": string[] }',
  "Where steps is an ordered list of 3-6 short, concrete actions.",
  "Do NOT include shell commands as steps you intend to run -- the agent will",
  "only PROPOSE file changes for user review and never executes commands.",
].join("\n");

function extractJsonObject(raw: string): string {
  let text = raw.trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) text = fence[1].trim();
  if (!text.startsWith("{")) {
    const s = text.indexOf("{");
    const e = text.lastIndexOf("}");
    if (s !== -1 && e !== -1 && e > s) text = text.slice(s, e + 1);
  }
  return text;
}

async function generatePlan(
  projectId: string,
  goal: string,
  signal: AbortSignal,
  fusion?: { system: string; primary: { provider: string; modelId: string } | null }
): Promise<AgentPlan> {
  const { system } = await buildProjectContext(projectId);
  const messages: AIMessage[] = [
    ...(fusion?.system ? [{ role: "system" as const, content: fusion.system }] : []),
    { role: "system", content: system },
    { role: "system", content: PLAN_INSTRUCTION },
    { role: "user", content: `Goal:\n${goal}` },
  ];

  const raw = await chat(messages, {
    temperature: 0.2,
    signal,
    ...(fusion?.primary ? { model: fusion.primary.modelId, provider: fusion.primary.provider } : {}),
  });

  try {
    const parsed = JSON.parse(extractJsonObject(raw)) as Partial<AgentPlan>;
    const steps = Array.isArray(parsed.steps)
      ? parsed.steps.filter((s): s is string => typeof s === "string").slice(0, 6)
      : [];
    if (steps.length === 0) {
      return { summary: goal, steps: ["Analyze the goal and propose changes"] };
    }
    return {
      summary: typeof parsed.summary === "string" ? parsed.summary : goal,
      steps,
    };
  } catch {
    // Non-fatal: fall back to a single-step plan so the run can proceed.
    return { summary: goal, steps: ["Analyze the goal and propose changes"] };
  }
}

/* ------------------------------ orchestration ----------------------------- */

/**
 * Drive a QUEUED run through its steps. Safe to call from the events endpoint:
 * if the run is already running or terminal, it returns immediately (the
 * caller just streams current DB state). Guards against double execution via
 * the in-memory `started` flag.
 */
export type DriveOptions = {
  /**
   * True when the caller (the BullMQ worker) still has retry attempts left for
   * this job. On a retryable failure the run is reverted to QUEUED so the next
   * attempt can re-claim it, rather than being marked FAILED permanently.
   */
  willRetry?: boolean;
};

export async function driveAgentRun(
  agentRunId: string,
  opts: DriveOptions = {}
): Promise<void> {
  // Atomically claim the run by transitioning QUEUED -> RUNNING. Only the
  // process whose update matches (count === 1) proceeds; this is the
  // cross-instance guard against two workers (or a worker + an SSE fallback)
  // driving the same run.
  const claim = await prisma.agentRun.updateMany({
    where: { id: agentRunId, status: "QUEUED" },
    data: { status: "RUNNING" },
  });
  if (claim.count === 0) return; // already running / terminal / missing

  const run = await prisma.agentRun.findUnique({
    where: { id: agentRunId },
    select: { id: true, projectId: true, goal: true, status: true, fusionId: true },
  });
  if (!run) return;

  const abort = new AbortController();
  localAbort.set(agentRunId, abort);
  const unsubscribeCancel = subscribeCancel(agentRunId, () => abort.abort());
  const signal = abort.signal;

  const project = await prisma.project.findUnique({
    where: { id: run.projectId },
    select: { storageKey: true, workspaceId: true },
  });
  const storageKey = project?.storageKey ?? "";

  // Lightweight Fusion config injection: if the run was started with a Fusion,
  // resolve its primary model + injected context (rules/knowledge/skills) and
  // use them for this run's plan + changeset generation. No per-step fan-out.
  let fusionCtx: { system: string; primary: { provider: string; modelId: string } | null; warnings: string[] } | null = null;
  if (run.fusionId && project?.workspaceId) {
    try {
      const { resolveFusionContext } = await import("@/lib/ai/fusion/resolver");
      fusionCtx = await resolveFusionContext(run.fusionId, project.workspaceId, run.projectId);
    } catch {
      // Non-fatal: fall back to default model/context.
    }
  }
  const fusionAi = fusionCtx?.primary
    ? { model: fusionCtx.primary.modelId, provider: fusionCtx.primary.provider }
    : {};

  let currentStepId: string | null = null;

  try {
    if (!isAIConfigured()) {
      throw new Error(
        "AI is not configured. Add an OpenAI key in Integrations to enable agents."
      );
    }

    // Status is already RUNNING (set atomically by the claim above).

    /* 1. THINK / plan ----------------------------------------------------- */
    emit(agentRunId, { type: "planning" });
    assertNotAborted(signal);
    {
      const step = await beginStep(agentRunId, "THINK", "Planning approach");
      currentStepId = step.id;
      const plan = await generatePlan(run.projectId, run.goal, signal, fusionCtx ?? undefined);
      assertNotAborted(signal);
      await prisma.agentRun.update({
        where: { id: agentRunId },
        data: { plan: plan as unknown as Prisma.InputJsonValue },
      });
      await completeStep(agentRunId, step.id, "THINK", "Planning approach", {
        plan,
      } as unknown as Prisma.InputJsonValue);
      currentStepId = null;
    }

    /* 2. SEARCH + READ_FILE: gather relevant context ---------------------- */
    let relevantPaths: string[] = [];
    {
      const step = await beginStep(
        agentRunId,
        "SEARCH",
        "Searching for relevant files"
      );
      currentStepId = step.id;
      assertNotAborted(signal);
      const hits = await searchCode(run.projectId, storageKey, run.goal);
      relevantPaths = hits.map((h) => h.path);
      if (relevantPaths.length === 0) {
        // Fall back to the first few files so the agent has some grounding.
        relevantPaths = (await listFiles(run.projectId)).slice(0, MAX_SEARCH_FILES);
      }
      await completeStep(
        agentRunId,
        step.id,
        "SEARCH",
        "Searching for relevant files",
        { matches: relevantPaths } as unknown as Prisma.InputJsonValue
      );
      currentStepId = null;
    }

    {
      const step = await beginStep(
        agentRunId,
        "READ_FILE",
        `Reading ${relevantPaths.length} file(s)`
      );
      currentStepId = step.id;
      const read: string[] = [];
      for (const p of relevantPaths) {
        assertNotAborted(signal);
        const snippet = await readSnippet(storageKey, p);
        if (snippet !== null) read.push(p);
      }
      await completeStep(
        agentRunId,
        step.id,
        "READ_FILE",
        `Reading ${relevantPaths.length} file(s)`,
        { read } as unknown as Prisma.InputJsonValue
      );
      currentStepId = null;
    }

    /* Optional GIT status snapshot (best-effort, read-only). ---------------- */
    {
      const step = await beginStep(agentRunId, "GIT", "Checking git status");
      currentStepId = step.id;
      let summary: string;
      try {
        const st = await gitStatus(storageKey);
        summary = st.isRepo
          ? `branch ${st.branch ?? "?"}, ${
              st.staged.length + st.unstaged.length + st.untracked.length
            } changed`
          : "not a git repository";
      } catch {
        summary = "git status unavailable";
      }
      await completeStep(agentRunId, step.id, "GIT", "Checking git status", {
        summary,
      } as unknown as Prisma.InputJsonValue);
      currentStepId = null;
    }

    /* 3. DIFF: generate a ChangeSet linked to this run -------------------- */
    emit(agentRunId, { type: "generating_diff" });
    assertNotAborted(signal);
    let changeSetId: string;
    {
      const step = await beginStep(
        agentRunId,
        "DIFF",
        "Generating proposed changes"
      );
      currentStepId = step.id;

      // Re-read plan for instruction enrichment.
      const planRow = await prisma.agentRun.findUnique({
        where: { id: agentRunId },
        select: { plan: true },
      });
      const plan = (planRow?.plan as AgentPlan | null) ?? null;
      const planText =
        plan && plan.steps.length
          ? `\n\nPlan:\n${plan.steps.map((s, i) => `${i + 1}. ${s}`).join("\n")}`
          : "";
      const relevantText = relevantPaths.length
        ? `\n\nRelevant files:\n${relevantPaths.join("\n")}`
        : "";

      const changeSet = await generateChangeSet(
        run.projectId,
        `${run.goal}${planText}${relevantText}`,
        {
          selectedPaths: relevantPaths,
          ai: { signal, ...fusionAi },
          systemPrefix: fusionCtx?.system || undefined,
        }
      );
      changeSetId = changeSet.id;

      // Link the changeset to this run.
      await prisma.changeSet.update({
        where: { id: changeSet.id },
        data: { agentRunId },
      });

      await completeStep(
        agentRunId,
        step.id,
        "DIFF",
        "Generating proposed changes",
        {
          changeSetId,
          fileCount: changeSet.fileChanges.length,
        } as unknown as Prisma.InputJsonValue
      );
      currentStepId = null;
    }

    /* 4. REVIEW -> WAITING_APPROVAL --------------------------------------- */
    assertNotAborted(signal);
    {
      const step = await beginStep(
        agentRunId,
        "REVIEW",
        "Ready for review"
      );
      await completeStep(agentRunId, step.id, "REVIEW", "Ready for review", {
        changeSetId,
      } as unknown as Prisma.InputJsonValue);
    }

    const result: AgentRunResult = {
      changeSetId,
      message:
        "Proposed changes are ready. Approve them in the Composer to apply.",
    };
    await prisma.agentRun.update({
      where: { id: agentRunId },
      data: {
        status: "WAITING_APPROVAL",
        result: result as unknown as Prisma.InputJsonValue,
      },
    });
    emit(agentRunId, { type: "waiting_approval", changeSetId });
  } catch (err) {
    if (currentStepId) await failStep(currentStepId);

    if (err instanceof CancelledError || signal.aborted) {
      // cancel() already set the DB state + emitted the cancelled event.
      return;
    }

    const message = err instanceof Error ? err.message : "Agent run failed";

    if (opts.willRetry) {
      // Hand the run back to the queue: revert the claim so the next attempt
      // can re-acquire it. Do NOT emit a terminal event yet.
      await prisma.agentRun
        .updateMany({
          where: { id: agentRunId, status: "RUNNING" },
          data: { status: "QUEUED", error: message },
        })
        .catch(() => undefined);
      throw err; // BullMQ schedules the retry with backoff.
    }

    await prisma.agentRun
      .update({
        where: { id: agentRunId },
        data: { status: "FAILED", error: message },
      })
      .catch(() => undefined);
    emit(agentRunId, { type: "failed", error: message });
    // Re-throw so the BullMQ worker can route the job to the dead-letter queue.
    // The in-process (no-queue) caller catches and ignores this.
    throw err;
  } finally {
    unsubscribeCancel();
    localAbort.delete(agentRunId);
  }
}
