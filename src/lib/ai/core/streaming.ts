/**
 * Teskel Streaming Utilities — JSONL encoding/decoding for ReadableStreams.
 *
 * Provides helpers for converting between AsyncIterables and ReadableStreams
 * using newline-delimited JSON (JSONL) encoding. Useful for streaming AI
 * events over HTTP responses (e.g., Server-Sent Events alternatives).
 *
 * @example
 * ```ts
 * // Server: convert async events to a ReadableStream response
 * const stream = toReadableStream(model.streamCompletion(request));
 * return new Response(stream, {
 *   headers: { "Content-Type": "application/x-ndjson" },
 * });
 *
 * // Client: parse the JSONL stream back into events
 * const response = await fetch("/api/stream");
 * for await (const event of parseJsonlStream(response.body!)) {
 *   console.log(event);
 * }
 * ```
 */

// ---------------------------------------------------------------------------
// Encoding: AsyncIterable → ReadableStream<Uint8Array>
// ---------------------------------------------------------------------------

/**
 * Convert an AsyncIterable of objects to a ReadableStream of JSONL-encoded bytes.
 *
 * Each object is serialized as a single line of JSON followed by a newline
 * character. The stream closes when the iterable is exhausted.
 *
 * @param events - An async iterable of objects to encode.
 * @returns A ReadableStream of UTF-8 encoded JSONL bytes.
 */
export function toReadableStream<T>(
  events: AsyncIterable<T>,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      try {
        for await (const event of events) {
          const line = JSON.stringify(event) + "\n";
          controller.enqueue(encoder.encode(line));
        }
        controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
  });
}

// ---------------------------------------------------------------------------
// Decoding: ReadableStream<Uint8Array> → AsyncIterable
// ---------------------------------------------------------------------------

/**
 * Parse a ReadableStream of JSONL-encoded bytes into an AsyncIterable of objects.
 *
 * Handles partial chunks by buffering incomplete lines until a newline
 * delimiter is received. Each complete line is parsed as JSON and yielded.
 *
 * @param stream - A ReadableStream of UTF-8 encoded JSONL bytes.
 * @returns An AsyncIterable of parsed objects.
 */
export async function* parseJsonlStream<T>(
  stream: ReadableStream<Uint8Array>,
): AsyncIterable<T> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });

      // Split on newlines; the last element may be an incomplete line
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed) {
          yield JSON.parse(trimmed) as T;
        }
      }
    }

    // Process any remaining data in the buffer after the stream ends
    const remaining = buffer.trim();
    if (remaining) {
      yield JSON.parse(remaining) as T;
    }
  } finally {
    reader.releaseLock();
  }
}
