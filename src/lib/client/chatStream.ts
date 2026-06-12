/**
 * SSE-over-POST client for the Teskel chat stream.
 *
 * `EventSource` can only issue GET requests, but `/api/ai/chat/stream` needs a
 * POST body ({ threadId, content, selectedPaths? }). So we POST with `fetch`,
 * read the `ReadableStream` body, and hand-parse the `text/event-stream`
 * framing ourselves.
 *
 * Wire format (see the route handler):
 *   event: delta\ndata: {"content":"..."}\n\n
 *   event: done\ndata: {"ok":true}\n\n
 *   event: error\ndata: {"message":"..."}\n\n
 *
 * On 503 (AI not configured) the route returns a JSON apiError envelope rather
 * than a stream; we surface that as a structured error so the UI can show the
 * "add an API key" affordance.
 */

export type ChatStreamEvent =
  | { type: "delta"; content: string }
  | { type: "done" }
  | { type: "error"; message: string; code?: string };

export type ChatStreamCallbacks = {
  onDelta: (content: string) => void;
  onDone: () => void;
  onError: (message: string, code?: string) => void;
};

type StreamArgs = {
  threadId: string;
  content: string;
  selectedPaths?: string[];
  signal?: AbortSignal;
};

/** A single SSE frame parsed into its `event:` name and `data:` payload. */
type RawEvent = { event: string; data: string };

/** Parse one `\n\n`-delimited SSE block into { event, data }. */
function parseFrame(block: string): RawEvent | null {
  let event = "message";
  const dataLines: string[] = [];

  for (const rawLine of block.split("\n")) {
    const line = rawLine.replace(/\r$/, "");
    if (line.startsWith("event:")) {
      event = line.slice("event:".length).trim();
    } else if (line.startsWith("data:")) {
      dataLines.push(line.slice("data:".length).replace(/^\s/, ""));
    }
    // ignore comments (":...") and other fields (id:, retry:)
  }

  if (dataLines.length === 0) return null;
  return { event, data: dataLines.join("\n") };
}

function toEvent(raw: RawEvent): ChatStreamEvent | null {
  let payload: unknown = {};
  try {
    payload = raw.data ? JSON.parse(raw.data) : {};
  } catch {
    payload = {};
  }
  const obj = (payload ?? {}) as Record<string, unknown>;

  switch (raw.event) {
    case "delta":
      return { type: "delta", content: String(obj.content ?? "") };
    case "done":
      return { type: "done" };
    case "error":
      return {
        type: "error",
        message:
          typeof obj.message === "string"
            ? obj.message
            : "The AI provider returned an error.",
      };
    default:
      return null;
  }
}

/**
 * POST to the chat stream and invoke callbacks as events arrive. Resolves when
 * the stream ends (after `done`, on error, or on abort). Never throws for
 * normal stream/abort conditions; reports problems via `onError`.
 */
export async function streamChatCompletion(
  args: StreamArgs,
  callbacks: ChatStreamCallbacks
): Promise<void> {
  const { threadId, content, selectedPaths, signal } = args;

  let res: Response;
  try {
    res = await fetch("/api/ai/chat/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ threadId, content, selectedPaths }),
      signal,
    });
  } catch (err) {
    if (signal?.aborted || (err instanceof Error && err.name === "AbortError")) {
      return; // user-initiated stop
    }
    callbacks.onError(
      err instanceof Error ? err.message : "Network request failed",
      "NETWORK_ERROR"
    );
    return;
  }

  const contentType = res.headers.get("content-type") ?? "";

  // Non-stream response: a JSON apiError envelope (e.g. 503 AI_NOT_CONFIGURED).
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

  const flushFrame = (block: string): boolean => {
    const trimmed = block.trim();
    if (!trimmed) return false;
    const raw = parseFrame(block);
    if (!raw) return false;
    const evt = toEvent(raw);
    if (!evt) return false;

    if (evt.type === "delta") {
      callbacks.onDelta(evt.content);
    } else if (evt.type === "done") {
      callbacks.onDone();
      return true; // signal completion
    } else if (evt.type === "error") {
      callbacks.onError(evt.message, evt.code);
      return true;
    }
    return false;
  };

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // SSE events are separated by a blank line (\n\n).
      let sepIndex: number;
      while ((sepIndex = buffer.indexOf("\n\n")) !== -1) {
        const block = buffer.slice(0, sepIndex);
        buffer = buffer.slice(sepIndex + 2);
        const finished = flushFrame(block);
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

    // Drain any trailing frame without a terminating blank line.
    if (buffer.trim()) flushFrame(buffer);
  } catch (err) {
    if (signal?.aborted || (err instanceof Error && err.name === "AbortError")) {
      return; // user pressed Stop
    }
    callbacks.onError(
      err instanceof Error ? err.message : "Stream read failed"
    );
  }
}
