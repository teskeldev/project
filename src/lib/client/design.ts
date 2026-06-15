/**
 * Client-side helpers for the Teskel Design feature.
 * Typed API calls + SSE stream reader for /api/design/generate.
 */

import { apiFetch } from "@/lib/client/api";
import { readSSEStream, type SSEFrame } from "@/lib/client/sse";

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

export type DesignSession = {
  id: string;
  projectId: string;
  userId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  _count?: { versions: number };
};

export type DesignVersion = {
  id: string;
  sessionId: string;
  code: string;
  prompt: string;
  createdAt: string;
};

export type DesignSessionDetail = DesignSession & {
  versions: DesignVersion[];
};

/* -------------------------------------------------------------------------- */
/* REST helpers                                                                */
/* -------------------------------------------------------------------------- */

export function listDesignSessions(
  projectId: string
): Promise<{ sessions: (DesignSession & { _count: { versions: number } })[] }> {
  return apiFetch(`/api/design/sessions?projectId=${encodeURIComponent(projectId)}`);
}

export function createDesignSession(
  projectId: string,
  title?: string
): Promise<{ session: DesignSession }> {
  return apiFetch("/api/design/sessions", {
    method: "POST",
    body: JSON.stringify({ projectId, title }),
  });
}

export function getDesignSession(
  sessionId: string
): Promise<{ session: DesignSessionDetail }> {
  return apiFetch(`/api/design/sessions/${encodeURIComponent(sessionId)}`);
}

/* -------------------------------------------------------------------------- */
/* SSE stream for design generation                                           */
/* -------------------------------------------------------------------------- */

export type DesignStreamEvent =
  | { type: "delta"; content: string }
  | { type: "done"; versionId: string }
  | { type: "error"; message: string };

export type DesignStreamCallbacks = {
  onDelta: (content: string) => void;
  onDone: (versionId: string) => void;
  onError: (message: string, code?: string) => void;
};

function toDesignEvent(frame: SSEFrame): { event: DesignStreamEvent; terminal: boolean } | null {
  let payload: Record<string, unknown> = {};
  try {
    payload = frame.data ? (JSON.parse(frame.data) as Record<string, unknown>) : {};
  } catch {
    payload = {};
  }

  switch (frame.event) {
    case "delta":
      return { event: { type: "delta", content: String(payload.content ?? "") }, terminal: false };
    case "done":
      return { event: { type: "done", versionId: String(payload.versionId ?? "") }, terminal: true };
    case "error":
      return {
        event: {
          type: "error",
          message: typeof payload.message === "string" ? payload.message : "Generation failed",
        },
        terminal: true,
      };
    default:
      return null;
  }
}

/**
 * POST to /api/design/generate and stream SSE events.
 * Resolves when the stream ends. Reports problems via onError.
 */
export async function streamDesignGeneration(
  args: { sessionId: string; prompt: string; fusionId?: string; signal?: AbortSignal },
  callbacks: DesignStreamCallbacks
): Promise<void> {
  const { sessionId, prompt, fusionId, signal } = args;

  let res: Response;
  try {
    res = await fetch("/api/design/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, prompt, fusionId }),
      signal,
    });
  } catch (err) {
    if (signal?.aborted || (err instanceof Error && err.name === "AbortError")) {
      return;
    }
    callbacks.onError(
      err instanceof Error ? err.message : "Network request failed",
      "NETWORK_ERROR"
    );
    return;
  }

  const contentType = res.headers.get("content-type") ?? "";

  // Non-stream response (e.g. 503 AI_NOT_CONFIGURED)
  if (!contentType.includes("text/event-stream")) {
    let message = `Request failed with status ${res.status}`;
    let code: string | undefined;
    try {
      const body = (await res.json()) as {
        success?: boolean;
        error?: { message?: string; code?: string };
      };
      if (body?.error?.message) message = body.error.message;
      if (body?.error?.code) code = body.error.code;
    } catch {
      // keep default message
    }
    callbacks.onError(message, code);
    return;
  }

  if (!res.body) {
    callbacks.onError("The response did not include a stream body.");
    return;
  }

  try {
    for await (const frame of readSSEStream(res)) {
      const parsed = toDesignEvent(frame);
      if (!parsed) continue;

      const { event, terminal } = parsed;
      if (event.type === "delta") {
        callbacks.onDelta(event.content);
      } else if (event.type === "done") {
        callbacks.onDone(event.versionId);
      } else if (event.type === "error") {
        callbacks.onError(event.message);
      }

      if (terminal) return;
    }
  } catch (err) {
    if (signal?.aborted || (err instanceof Error && err.name === "AbortError")) {
      return;
    }
    callbacks.onError(err instanceof Error ? err.message : "Stream read failed");
  }
}
