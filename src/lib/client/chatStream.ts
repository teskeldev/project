/**
 * SSE-over-POST client for the Teskel chat stream.
 *
 * `EventSource` can only issue GET requests, but `/api/ai/chat/stream` needs a
 * POST body ({ threadId, content, selectedPaths? }). So we POST with `fetch`,
 * read the `ReadableStream` body, and hand-parse the `text/event-stream`
 * framing ourselves.
 *
 * Wire format (see the route handler):
 *   event: thinking\ndata: {"content":"..."}\n\n
 *   event: delta\ndata: {"content":"..."}\n\n
 *   event: compaction\ndata: {"message":"...","compactedCount":N,"remainingCount":N}\n\n
 *   event: done\ndata: {"ok":true}\n\n
 *   event: error\ndata: {"message":"..."}\n\n
 *
 * On 503 (AI not configured) the route returns a JSON apiError envelope rather
 * than a stream; we surface that as a structured error so the UI can show the
 * "add an API key" affordance.
 */

import { readSSEStream, type SSEFrame } from "@/lib/client/sse";

export type FusionResultPayload = {
  output: string;
  runs: Array<{ modelId: string; provider: string; ok: boolean; latencyMs: number }>;
  judgeUsed: string;
  warnings: string[];
  metrics: { tokens: number; costUsd: number; latencyMs: number; executionMs: number };
};

export type FusionProgressPayload =
  | { type: "model_start"; ref: string; modelId: string }
  | { type: "model_done"; ref: string; modelId: string; ok: boolean; latencyMs: number }
  | { type: "judging" };

export type ChatStreamEvent =
  | { type: "thinking"; content: string }
  | { type: "delta"; content: string }
  | { type: "compaction"; message: string; compactedCount: number; remainingCount: number }
  | { type: "fusion-progress"; payload: FusionProgressPayload }
  | { type: "fusion-result"; payload: FusionResultPayload }
  | { type: "done" }
  | { type: "error"; message: string; code?: string };

export type ChatStreamCallbacks = {
  onDelta: (content: string) => void;
  onDone: () => void;
  onError: (message: string, code?: string) => void;
  onCompaction?: (message: string, compactedCount: number, remainingCount: number) => void;
  onThinking?: (content: string) => void;
  /** Fired once for a Fusion turn with the fused output + per-model debug info. */
  onFusionResult?: (payload: FusionResultPayload) => void;
  /** Live per-model progress during a Fusion turn ("thinking"). */
  onFusionProgress?: (payload: FusionProgressPayload) => void;
};

type StreamArgs = {
  threadId: string;
  content: string;
  selectedPaths?: string[];
  model?: string;
  fusionId?: string;
  signal?: AbortSignal;
};

function toEvent(raw: SSEFrame): ChatStreamEvent | null {
  let payload: unknown = {};
  try {
    payload = raw.data ? JSON.parse(raw.data) : {};
  } catch {
    payload = {};
  }
  const obj = (payload ?? {}) as Record<string, unknown>;

  switch (raw.event) {
    case "thinking":
      return { type: "thinking", content: String(obj.content ?? "") };
    case "delta":
      return { type: "delta", content: String(obj.content ?? "") };
    case "compaction":
      return {
        type: "compaction",
        message: String(obj.message ?? ""),
        compactedCount: Number(obj.compactedCount ?? 0),
        remainingCount: Number(obj.remainingCount ?? 0),
      };
    case "fusion-progress":
      return { type: "fusion-progress", payload: obj as unknown as FusionProgressPayload };
    case "fusion-result":
      return {
        type: "fusion-result",
        payload: {
          output: String(obj.output ?? ""),
          runs: Array.isArray(obj.runs) ? (obj.runs as FusionResultPayload["runs"]) : [],
          judgeUsed: String(obj.judgeUsed ?? ""),
          warnings: Array.isArray(obj.warnings) ? (obj.warnings as string[]) : [],
          metrics: (obj.metrics as FusionResultPayload["metrics"]) ?? { tokens: 0, costUsd: 0, latencyMs: 0, executionMs: 0 },
        },
      };
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
  const { threadId, content, selectedPaths, model, fusionId, signal } = args;

  let res: Response;
  try {
    res = await fetch("/api/ai/chat/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ threadId, content, selectedPaths, model, fusionId }),
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

  try {
    for await (const frame of readSSEStream(res)) {
      const evt = toEvent(frame);
      if (!evt) continue;

      if (evt.type === "thinking") {
        callbacks.onThinking?.(evt.content);
      } else if (evt.type === "delta") {
        callbacks.onDelta(evt.content);
      } else if (evt.type === "compaction") {
        callbacks.onCompaction?.(evt.message, evt.compactedCount, evt.remainingCount);
      } else if (evt.type === "fusion-progress") {
        callbacks.onFusionProgress?.(evt.payload);
      } else if (evt.type === "fusion-result") {
        callbacks.onFusionResult?.(evt.payload);
        callbacks.onDelta(evt.payload.output); // render the fused text in the bubble
      } else if (evt.type === "done") {
        callbacks.onDone();
        return;
      } else if (evt.type === "error") {
        callbacks.onError(evt.message, evt.code);
        return;
      }
    }
  } catch (err) {
    if (signal?.aborted || (err instanceof Error && err.name === "AbortError")) {
      return; // user pressed Stop
    }
    callbacks.onError(
      err instanceof Error ? err.message : "Stream read failed"
    );
  }
}
