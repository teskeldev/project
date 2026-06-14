/**
 * Typed client helpers for the Teskel terminal (Phase 5a).
 *
 * The /run endpoint responds with an SSE stream over a POST request, so we
 * cannot use EventSource (GET-only). `runCommandStream` POSTs the command and
 * incrementally parses the `text/event-stream` body from the ReadableStream.
 *
 * NOTE: REST calls use `apiFetch` from the shared API client. The streaming
 * endpoint needs raw Response access, so it uses fetch directly with the shared
 * SSE reader.
 */

import { apiFetch, ApiClientError } from "@/lib/client/api";
import { readSSEStream } from "@/lib/client/sse";

export type TerminalStatus = "ACTIVE" | "CLOSED";

export type TerminalSession = {
  id: string;
  projectId: string;
  userId: string;
  title: string;
  /** Project-relative cwd; "" == project root. */
  cwd: string;
  status: TerminalStatus;
  createdAt: string;
  updatedAt: string;
};

export type TerminalCommand = {
  id: string;
  sessionId: string;
  command: string;
  output: string | null;
  exitCode: number | null;
  createdAt: string;
};

export class TerminalClientError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status = 0, code?: string) {
    super(message);
    this.name = "TerminalClientError";
    this.status = status;
    this.code = code;
  }
}

/** Wrap apiFetch with terminal-specific error class. */
async function terminalFetch<T>(url: string, opts?: RequestInit): Promise<T> {
  try {
    return await apiFetch<T>(url, opts);
  } catch (err) {
    if (err instanceof ApiClientError) {
      throw new TerminalClientError(err.message, err.status, err.code);
    }
    throw err;
  }
}

/* ----------------------------- REST helpers ----------------------------- */

export function listSessions(
  projectId: string
): Promise<{ sessions: TerminalSession[] }> {
  return terminalFetch(`/api/projects/${projectId}/terminal/sessions`);
}

export function createSession(
  projectId: string,
  input?: { title?: string; cwd?: string }
): Promise<{ session: TerminalSession }> {
  return terminalFetch(`/api/projects/${projectId}/terminal/sessions`, {
    method: "POST",
    body: JSON.stringify(input ?? {}),
  });
}

export function closeSession(
  sessionId: string
): Promise<{ closed: boolean }> {
  return terminalFetch(`/api/terminal/${sessionId}`, { method: "DELETE" });
}

export function killCommand(
  sessionId: string
): Promise<{ killed: boolean }> {
  return terminalFetch(`/api/terminal/${sessionId}/kill`, { method: "POST" });
}

export function listCommands(
  sessionId: string
): Promise<{ commands: TerminalCommand[] }> {
  return terminalFetch(`/api/terminal/${sessionId}/commands`);
}

/* ----------------------------- SSE-over-POST ---------------------------- */

export type RunStreamHandlers = {
  onOutput?: (chunk: string) => void;
  onCwd?: (cwd: string) => void;
  onWarning?: (message: string) => void;
  onExit?: (code: number | null) => void;
  onError?: (message: string) => void;
};

type Envelope<T> =
  | { success: true; data: T }
  | { success: false; error: { message: string; code?: string } };

/**
 * POST a command to /run and stream the SSE response. Resolves when the stream
 * completes. The returned object exposes `abort()` to cancel mid-flight.
 *
 * If the server rejects the command up-front (e.g. BLOCKED_COMMAND it returns a
 * JSON error envelope, not an event-stream); in that case `onError` is invoked
 * with the message and the promise resolves.
 */
export function runCommandStream(
  sessionId: string,
  command: string,
  handlers: RunStreamHandlers
): { done: Promise<void>; abort: () => void } {
  const controller = new AbortController();

  const done = (async () => {
    let res: Response;
    try {
      res = await fetch(`/api/terminal/${sessionId}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command }),
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

    // Non-stream JSON response => an error envelope (e.g. blocked command).
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
        let payload: unknown;
        try {
          payload = JSON.parse(frame.data);
        } catch {
          continue;
        }
        const p = payload as Record<string, unknown>;
        switch (frame.event) {
          case "output":
            handlers.onOutput?.(String(p.chunk ?? ""));
            break;
          case "cwd":
            handlers.onCwd?.(String(p.cwd ?? ""));
            break;
          case "warning":
            handlers.onWarning?.(String(p.message ?? ""));
            break;
          case "exit":
            handlers.onExit?.(
              p.code === null || p.code === undefined ? null : Number(p.code)
            );
            break;
          case "error":
            handlers.onError?.(String(p.message ?? "Command failed"));
            break;
        }
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
