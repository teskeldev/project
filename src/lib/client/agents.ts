/**
 * Typed client helpers for Phase 6 background agents.
 *
 * REST calls go through a small JSON-envelope fetch (mirrors terminal.ts). The
 * events endpoint is SSE-over-GET; since it lives in an HTTP request we read it
 * with fetch + ReadableStream rather than EventSource so we can attach an
 * AbortController for clean teardown.
 */
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

type Envelope<T> =
  | { success: true; data: T }
  | { success: false; error: { message: string; code?: string } };

async function jsonFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  let body: Envelope<T> | null = null;
  try {
    body = (await res.json()) as Envelope<T>;
  } catch {
    /* no/invalid JSON */
  }
  if (!res.ok || !body || body.success === false) {
    const message =
      body && body.success === false
        ? body.error.message
        : `Request failed with status ${res.status}`;
    const code = body && body.success === false ? body.error.code : undefined;
    throw new AgentClientError(message, res.status, code);
  }
  return body.data;
}

/* ------------------------------- REST API -------------------------------- */

export function listAgentRuns(
  projectId: string
): Promise<{ runs: AgentRunSummaryDTO[] }> {
  return jsonFetch(`/api/projects/${projectId}/agents`);
}

export function createAgentRun(
  projectId: string,
  input: { goal: string; threadId?: string }
): Promise<{ run: AgentRunSummaryDTO }> {
  return jsonFetch(`/api/projects/${projectId}/agents`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function getAgentRun(
  agentRunId: string
): Promise<{ run: AgentRunDetailDTO }> {
  return jsonFetch(`/api/agents/${agentRunId}`);
}

export function cancelAgentRun(
  agentRunId: string
): Promise<{ cancelled: boolean }> {
  return jsonFetch(`/api/agents/${agentRunId}/cancel`, { method: "POST" });
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

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    const dispatch = (raw: string) => {
      let event = "message";
      const dataLines: string[] = [];
      for (const line of raw.split("\n")) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
      }
      if (dataLines.length === 0) return;
      let payload: Record<string, unknown> = {};
      try {
        payload = JSON.parse(dataLines.join("\n")) as Record<string, unknown>;
      } catch {
        return;
      }
      handlers.onEvent({ type: event, ...payload } as AgentStreamEvent);
    };

    try {
      for (;;) {
        const { done: streamDone, value } = await reader.read();
        if (streamDone) break;
        buffer += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buffer.indexOf("\n\n")) !== -1) {
          const block = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          if (block.trim()) dispatch(block);
        }
      }
      if (buffer.trim()) dispatch(buffer);
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        handlers.onError?.(
          err instanceof Error ? err.message : "Stream read failed"
        );
      }
    } finally {
      reader.releaseLock();
    }
  })();

  return { done, abort: () => controller.abort() };
}
