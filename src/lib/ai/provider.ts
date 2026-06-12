/**
 * Teskel AI provider abstraction (OpenAI-compatible, SDK-free).
 *
 * SERVER-ONLY: this module reads OPENAI_API_KEY from the environment and must
 * never be imported by client components. (`server-only` package is not
 * installed; if it gets added, prefer `import "server-only";` at the top.)
 *
 * Talks directly to `${OPENAI_BASE_URL}/chat/completions` via fetch and
 * supports streaming via SSE parsing. The API key is kept strictly server-side
 * and is NEVER logged or returned to callers.
 */
import { ApiError } from "@/lib/api";

export type ChatRole = "system" | "user" | "assistant" | "tool";

export type AIMessage = {
  role: ChatRole;
  content: string;
};

export type ChatOptions = {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
};

const DEFAULT_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_MODEL = "gpt-4o-mini";

function getApiKey(): string | undefined {
  const key = process.env.OPENAI_API_KEY;
  return key && key.trim().length > 0 ? key.trim() : undefined;
}

function getBaseUrl(): string {
  const base = process.env.OPENAI_BASE_URL?.trim();
  // Strip any trailing slash so we can append the path cleanly.
  return (base && base.length > 0 ? base : DEFAULT_BASE_URL).replace(/\/+$/, "");
}

function getModel(opts?: ChatOptions): string {
  return opts?.model ?? process.env.OPENAI_MODEL?.trim() ?? DEFAULT_MODEL;
}

/** True when an API key is present in the environment. */
export function isAIConfigured(): boolean {
  return getApiKey() !== undefined;
}

function requireApiKey(): string {
  const key = getApiKey();
  if (!key) {
    throw new ApiError(
      "AI is not configured. Add an OpenAI API key in Integrations to enable chat.",
      503,
      "AI_NOT_CONFIGURED"
    );
  }
  return key;
}

type ChatCompletionBody = {
  model: string;
  messages: AIMessage[];
  stream: boolean;
  temperature?: number;
  max_tokens?: number;
};

function buildBody(
  messages: AIMessage[],
  opts: ChatOptions | undefined,
  stream: boolean
): ChatCompletionBody {
  const body: ChatCompletionBody = {
    model: getModel(opts),
    messages,
    stream,
  };
  if (typeof opts?.temperature === "number") {
    body.temperature = opts.temperature;
  }
  if (typeof opts?.maxTokens === "number") {
    body.max_tokens = opts.maxTokens;
  }
  return body;
}

/**
 * Translate a non-200 response into a safe ApiError. The upstream body may
 * contain provider detail but NEVER the api key (we never echo headers).
 */
async function toProviderError(res: Response): Promise<ApiError> {
  let detail = "";
  try {
    const text = await res.text();
    // Keep it short; avoid dumping huge HTML error pages.
    detail = text.slice(0, 500);
  } catch {
    // ignore body read failures
  }
  return new ApiError(
    "The AI provider returned an error. Please try again.",
    502,
    "AI_PROVIDER_ERROR",
    detail || undefined
  );
}

/**
 * Stream chat completions, yielding incremental content deltas as strings.
 * Parses SSE lines beginning with "data:" and stops on the "[DONE]" sentinel.
 */
export async function* streamChat(
  messages: AIMessage[],
  opts?: ChatOptions
): AsyncGenerator<string> {
  const apiKey = requireApiKey();
  const url = `${getBaseUrl()}/chat/completions`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(buildBody(messages, opts, true)),
    signal: opts?.signal,
  });

  if (!res.ok || !res.body) {
    throw await toProviderError(res);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // SSE events are separated by blank lines; process complete lines.
      let newlineIdx: number;
      while ((newlineIdx = buffer.indexOf("\n")) !== -1) {
        const rawLine = buffer.slice(0, newlineIdx).trim();
        buffer = buffer.slice(newlineIdx + 1);

        if (!rawLine || !rawLine.startsWith("data:")) {
          continue;
        }

        const data = rawLine.slice("data:".length).trim();
        if (data === "[DONE]") {
          return;
        }

        try {
          const parsed = JSON.parse(data) as {
            choices?: Array<{ delta?: { content?: string } }>;
          };
          const delta = parsed.choices?.[0]?.delta?.content;
          if (delta) {
            yield delta;
          }
        } catch {
          // Ignore malformed/partial JSON lines; the next chunk completes them.
        }
      }
    }
  } finally {
    // Always release the reader lock so the connection can be cleaned up.
    reader.releaseLock();
  }
}

/**
 * Non-streaming convenience: collects the full streamed response into a string.
 */
export async function chat(
  messages: AIMessage[],
  opts?: ChatOptions
): Promise<string> {
  let out = "";
  for await (const delta of streamChat(messages, opts)) {
    out += delta;
  }
  return out;
}
