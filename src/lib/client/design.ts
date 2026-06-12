/**
 * Client-side helpers for the Teskel Design feature.
 * Typed API calls + SSE stream reader for /api/design/generate.
 */

import { apiFetch } from "@/lib/client/api";

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

/** Parse one SSE block into { event, data }. */
function parseFrame(block: string): { event: string; data: string } | null {
  let event = "message";
  const dataLines: string[] = [];

  for (const rawLine of block.split("\n")) {
    const line = rawLine.replace(/\r$/, "");
    if (line.startsWith("event:")) {
      event = line.slice("event:".length).trim();
    } else if (line.startsWith("data:")) {
      dataLines.push(line.slice("data:".length).replace(/^\s/, ""));
    }
  }

  if (dataLines.length === 0) return null;
  return { event, data: dataLines.join("\n") };
}

/**
 * POST to /api/design/generate and stream SSE events.
 * Resolves when the stream ends. Reports problems via onError.
 */
export async function streamDesignGeneration(
  args: { sessionId: string; prompt: string; signal?: AbortSignal },
  callbacks: DesignStreamCallbacks
): Promise<void> {
  const { sessionId, prompt, signal } = args;

  let res: Response;
  try {
    res = await fetch("/api/design/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, prompt }),
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

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const processFrame = (block: string): boolean => {
    const trimmed = block.trim();
    if (!trimmed) return false;
    const raw = parseFrame(block);
    if (!raw) return false;

    let payload: Record<string, unknown> = {};
    try {
      payload = raw.data ? (JSON.parse(raw.data) as Record<string, unknown>) : {};
    } catch {
      payload = {};
    }

    switch (raw.event) {
      case "delta":
        callbacks.onDelta(String(payload.content ?? ""));
        break;
      case "done":
        callbacks.onDone(String(payload.versionId ?? ""));
        return true;
      case "error":
        callbacks.onError(
          typeof payload.message === "string"
            ? payload.message
            : "Generation failed"
        );
        return true;
    }
    return false;
  };

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      let sepIndex: number;
      while ((sepIndex = buffer.indexOf("\n\n")) !== -1) {
        const block = buffer.slice(0, sepIndex);
        buffer = buffer.slice(sepIndex + 2);
        const finished = processFrame(block);
        if (finished) {
          try {
            await reader.cancel();
          } catch {
            // ignore
          }
          return;
        }
      }
    }

    // Drain trailing frame
    if (buffer.trim()) processFrame(buffer);
  } catch (err) {
    if (signal?.aborted || (err instanceof Error && err.name === "AbortError")) {
      return;
    }
    callbacks.onError(err instanceof Error ? err.message : "Stream read failed");
  }
}
