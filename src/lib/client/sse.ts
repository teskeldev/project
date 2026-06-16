/**
 * Shared SSE (Server-Sent Events) stream reader for Teskel client modules.
 * Eliminates the duplicated buffer/parse logic across chatStream, design,
 * terminal, and agents clients.
 */

export type SSEFrame = {
  event: string;
  data: string;
};

/**
 * Parse a single SSE text block into event + data.
 * Returns null if the block contains no data lines.
 */
export function parseSSEFrame(block: string): SSEFrame | null {
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

/**
 * Read an SSE stream from a fetch Response, yielding parsed frames.
 * Handles buffering, line splitting, and the data:/event: protocol.
 */
export async function* readSSEStream(response: Response): AsyncGenerator<SSEFrame> {
  if (!response.body) return;

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

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
        if (block.trim()) {
          const frame = parseSSEFrame(block);
          if (frame) yield frame;
        }
      }
    }

    // Drain any trailing frame without a terminating blank line.
    if (buffer.trim()) {
      const frame = parseSSEFrame(buffer);
      if (frame) yield frame;
    }
  } finally {
    reader.releaseLock();
  }
}
