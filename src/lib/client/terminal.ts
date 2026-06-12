/**
 * Typed client helpers for the Teskel terminal (Phase 5a).
 *
 * The /run endpoint responds with an SSE stream over a POST request, so we
 * cannot use EventSource (GET-only). `runCommandStream` POSTs the command and
 * incrementally parses the `text/event-stream` body from the ReadableStream.
 *
 * NOTE: this intentionally does NOT use the shared `apiFetch` (that unwraps a
 * JSON envelope); streaming needs raw Response access.
 */

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
    throw new TerminalClientError(message, res.status, code);
  }
  return body.data;
}

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

/* ----------------------------- REST helpers ----------------------------- */

export function listSessions(
  projectId: string
): Promise<{ sessions: TerminalSession[] }> {
  return jsonFetch(`/api/projects/${projectId}/terminal/sessions`);
}

export function createSession(
  projectId: string,
  input?: { title?: string; cwd?: string }
): Promise<{ session: TerminalSession }> {
  return jsonFetch(`/api/projects/${projectId}/terminal/sessions`, {
    method: "POST",
    body: JSON.stringify(input ?? {}),
  });
}

export function closeSession(
  sessionId: string
): Promise<{ closed: boolean }> {
  return jsonFetch(`/api/terminal/${sessionId}`, { method: "DELETE" });
}

export function killCommand(
  sessionId: string
): Promise<{ killed: boolean }> {
  return jsonFetch(`/api/terminal/${sessionId}/kill`, { method: "POST" });
}

export function listCommands(
  sessionId: string
): Promise<{ commands: TerminalCommand[] }> {
  return jsonFetch(`/api/terminal/${sessionId}/commands`);
}

/* ----------------------------- SSE-over-POST ---------------------------- */

export type RunStreamHandlers = {
  onOutput?: (chunk: string) => void;
  onCwd?: (cwd: string) => void;
  onWarning?: (message: string) => void;
  onExit?: (code: number | null) => void;
  onError?: (message: string) => void;
};

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

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    const dispatch = (raw: string) => {
      // Parse a single SSE event block ("event:" + "data:" lines).
      let event = "message";
      const dataLines: string[] = [];
      for (const line of raw.split("\n")) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
      }
      if (dataLines.length === 0) return;
      let payload: unknown;
      try {
        payload = JSON.parse(dataLines.join("\n"));
      } catch {
        return;
      }
      const p = payload as Record<string, unknown>;
      switch (event) {
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
    };

    try {
      for (;;) {
        const { done: streamDone, value } = await reader.read();
        if (streamDone) break;
        buffer += decoder.decode(value, { stream: true });
        let idx: number;
        // Events are separated by a blank line ("\n\n").
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
    }
  })();

  return { done, abort: () => controller.abort() };
}
