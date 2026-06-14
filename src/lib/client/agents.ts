/**
 * Typed client helpers for Phase 6 background agents.
 *
 * REST calls use `apiFetch` from the shared API client. The events endpoint is
 * SSE-over-GET; we read it with the shared SSE reader so we can attach an
 * AbortController for clean teardown.
 */
import { apiFetch, ApiClientError } from "@/lib/client/api";
import { readSSEStream } from "@/lib/client/sse";
import type {
  AgentRunSummaryDTO,
  AgentRunDetailDTO,
} from "@/lib/agents/schemas";

export type {
  AgentRunSummaryDTO,
  AgentRunDetailDTO,
  AgentStepDTO,
  AgentPlan,
  AgentRunResult,
} from "@/lib/agents/schemas";

export class AgentClientError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status = 0, code?: string) {
    super(message);
    this.name = "AgentClientError";
    this.status = status;
    this.code = code;
  }
}

/** Wrap apiFetch with agent-specific error class. */
async function agentFetch<T>(url: string, opts?: RequestInit): Promise<T> {
  try {
    return await apiFetch<T>(url, opts);
  } catch (err) {
    if (err instanceof ApiClientError) {
      throw new AgentClientError(err.message, err.status, err.code);
    }
    throw err;
  }
}

/* ------------------------------- REST API -------------------------------- */

export function listAgentRuns(
  projectId: string
): Promise<{ runs: AgentRunSummaryDTO[] }> {
  return agentFetch(`/api/projects/${projectId}/agents`);
}

export function createAgentRun(
  projectId: string,
  input: { goal: string; threadId?: string }
): Promise<{ run: AgentRunSummaryDTO }> {
  return agentFetch(`/api/projects/${projectId}/agents`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function getAgentRun(
  agentRunId: string
): Promise<{ run: AgentRunDetailDTO }> {
  return agentFetch(`/api/agents/${agentRunId}`);
}

export function cancelAgentRun(
  agentRunId: string
): Promise<{ cancelled: boolean }> {
  return agentFetch(`/api/agents/${agentRunId}/cancel`, { method: "POST" });
}

/* ----------------------------- SSE event reader -------------------------- */

export type AgentStreamEvent =
  | { type: "status"; status: string }
  | { type: "queued" }
  | { type: "planning" }
  | { type: "step_started"; step: AgentStreamStep }
  | { type: "step_completed"; step: AgentStreamStep }
  | { type: "generating_diff" }
  | { type: "waiting_approval"; changeSetId: string | null }
  | { type: "completed" }
  | { type: "failed"; error: string }
  | { type: "cancelled" }
  | { type: "end" };

export type AgentStreamStep = {
  id: string;
  type: string;
  title: string;
  status: string;
  output?: unknown;
};

export type AgentStreamHandlers = {
  onEvent: (event: AgentStreamEvent) => void;
  onError?: (message: string) => void;
};

type Envelope<T> =
  | { success: true; data: T }
  | { success: false; error: { message: string; code?: string } };

/**
 * Open the SSE events stream for a run. Opening the stream triggers execution
 * server-side (see the events route). Returns `{ done, abort }`; call abort()
 * to stop reading (the run keeps progressing in-process).
 */
export function streamAgentEvents(
  agentRunId: string,
  handlers: AgentStreamHandlers
): { done: Promise<void>; abort: () => void } {
  const controller = new AbortController();

  const done = (async () => {
    let res: Response;
    try {
      res = await fetch(`/api/agents/${agentRunId}/events`, {
        method: "GET",
        headers: { Accept: "text/event-stream" },
        signal: controller.signal,
      });
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      handlers.onError?.(
        err instanceof Error ? err.message : "Network request failed"
      );
      return;
    }

    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("text/event-stream")) {
      let message = `Request failed with status ${res.status}`;
      try {
        const body = (await res.json()) as Envelope<unknown>;
        if (body && body.success === false) message = body.error.message;
      } catch {
        /* ignore */
      }
      handlers.onError?.(message);
      return;
    }

    if (!res.body) {
      handlers.onError?.("Empty response stream");
      return;
    }

    try {
      for await (const frame of readSSEStream(res)) {
        let payload: Record<string, unknown> = {};
        try {
          payload = JSON.parse(frame.data) as Record<string, unknown>;
        } catch {
          continue;
        }
        handlers.onEvent({ type: frame.event, ...payload } as AgentStreamEvent);
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        handlers.onError?.(
          err instanceof Error ? err.message : "Stream read failed"
        );
      }
    }
  })();

  return { done, abort: () => controller.abort() };
}
