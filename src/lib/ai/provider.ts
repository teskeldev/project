/**
 * Teskel AI provider abstraction — multi-provider support.
 *
 * SERVER-ONLY: this module reads API keys from the environment and must
 * never be imported by client components.
 *
 * Supports OpenAI-compatible providers (OpenAI, Groq, Ollama) and Anthropic
 * (different API format with x-api-key header and messages API).
 *
 * Provider selection: AI_PROVIDER env var (default: 'openai') or per-request override.
 */
import { ApiError } from "@/lib/api";
import { getProviderConfig } from "./providers";
import { resolveApiKey } from "./resolve-key";

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
  /** Override the provider for this request (e.g. 'anthropic', 'groq'). */
  provider?: string;
  /** Workspace ID to resolve API keys from DB integrations. */
  workspaceId?: string;
};

const DEFAULT_MODEL = "gpt-4o-mini";

// ---------------------------------------------------------------------------
// Environment helpers
// ---------------------------------------------------------------------------

function getActiveProviderId(opts?: ChatOptions): string {
  return opts?.provider ?? process.env.AI_PROVIDER?.trim() ?? "openai";
}

function getApiKeyForProvider(providerId: string): string | undefined {
  let key: string | undefined;
  switch (providerId) {
    case "openai":
      key = process.env.OPENAI_API_KEY;
      break;
    case "anthropic":
      key = process.env.ANTHROPIC_API_KEY;
      break;
    case "google":
      key = process.env.GOOGLE_API_KEY ?? process.env.GEMINI_API_KEY;
      break;
    case "groq":
      key = process.env.GROQ_API_KEY;
      break;
    case "ollama":
      // Ollama doesn't require an API key
      return "ollama";
    default:
      key = process.env.OPENAI_API_KEY;
  }
  return key && key.trim().length > 0 ? key.trim() : undefined;
}

function getBaseUrl(providerId: string): string {
  // Allow env override for any provider
  const envBase = process.env[`${providerId.toUpperCase()}_BASE_URL`]?.trim();
  if (envBase && envBase.length > 0) {
    return envBase.replace(/\/+$/, "");
  }
  // Fall back to provider config
  const config = getProviderConfig(providerId);
  const base = config?.baseUrl ?? "https://api.openai.com/v1";
  return base.replace(/\/+$/, "");
}

function getModel(providerId: string, opts?: ChatOptions): string {
  if (opts?.model) return opts.model;
  // Check env var for provider-specific model
  const envModel = process.env[`${providerId.toUpperCase()}_MODEL`]?.trim();
  if (envModel) return envModel;
  // Fall back to generic env or default
  return process.env.OPENAI_MODEL?.trim() ?? DEFAULT_MODEL;
}

/** True when an API key is present for the active provider (sync env check only). */
export function isAIConfigured(providerId?: string): boolean {
  const id = providerId ?? process.env.AI_PROVIDER?.trim() ?? "openai";
  const config = getProviderConfig(id);
  if (config && !config.requiresApiKey) return true;
  return getApiKeyForProvider(id) !== undefined;
}

/**
 * Async check: true when an API key is available from env OR DB integrations.
 */
export async function isAIConfiguredAsync(
  providerId?: string,
  workspaceId?: string
): Promise<boolean> {
  const id = providerId ?? process.env.AI_PROVIDER?.trim() ?? "openai";
  const config = getProviderConfig(id);
  if (config && !config.requiresApiKey) return true;
  // Fast path: env var is set
  if (getApiKeyForProvider(id) !== undefined) return true;
  // Slow path: check DB
  if (!workspaceId) return false;
  const resolved = await resolveApiKey(id, workspaceId);
  return resolved !== null;
}

/**
 * Resolve the API key for a provider, checking env then DB.
 * Throws ApiError(503) if no key is found.
 */
async function requireApiKeyAsync(
  providerId: string,
  workspaceId?: string
): Promise<string> {
  const config = getProviderConfig(providerId);
  if (config && !config.requiresApiKey) {
    return ""; // No key needed (e.g. Ollama)
  }

  const resolved = await resolveApiKey(providerId, workspaceId);
  if (resolved) {
    return resolved.apiKey;
  }

  const name = config?.name ?? providerId;
  throw new ApiError(
    `AI is not configured. Add a ${name} API key in Integrations to enable chat.`,
    503,
    "AI_NOT_CONFIGURED"
  );
}

// ---------------------------------------------------------------------------
// OpenAI-compatible adapter (OpenAI, Groq, Ollama)
// ---------------------------------------------------------------------------

type OpenAIBody = {
  model: string;
  messages: AIMessage[];
  stream: boolean;
  temperature?: number;
  max_tokens?: number;
};

function buildOpenAIBody(
  messages: AIMessage[],
  model: string,
  opts: ChatOptions | undefined,
  stream: boolean
): OpenAIBody {
  const body: OpenAIBody = { model, messages, stream };
  if (typeof opts?.temperature === "number") body.temperature = opts.temperature;
  if (typeof opts?.maxTokens === "number") body.max_tokens = opts.maxTokens;
  return body;
}

async function* streamOpenAICompatible(
  messages: AIMessage[],
  providerId: string,
  opts?: ChatOptions
): AsyncGenerator<string> {
  const apiKey = await requireApiKeyAsync(providerId, opts?.workspaceId);
  const baseUrl = getBaseUrl(providerId);
  const model = getModel(providerId, opts);
  const url = `${baseUrl}/chat/completions`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (apiKey) {
    headers["Authorization"] = `Bearer ${apiKey}`;
  }

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(buildOpenAIBody(messages, model, opts, true)),
    signal: opts?.signal,
  });

  if (!res.ok || !res.body) {
    throw await toProviderError(res);
  }

  yield* parseSSEStream(res.body);
}

// ---------------------------------------------------------------------------
// Anthropic adapter
// ---------------------------------------------------------------------------

type AnthropicMessage = {
  role: "user" | "assistant";
  content: string;
};

function convertToAnthropicMessages(messages: AIMessage[]): {
  system: string | undefined;
  messages: AnthropicMessage[];
} {
  let system: string | undefined;
  const anthropicMessages: AnthropicMessage[] = [];

  for (const msg of messages) {
    if (msg.role === "system") {
      system = (system ? system + "\n\n" : "") + msg.content;
    } else if (msg.role === "user" || msg.role === "assistant") {
      anthropicMessages.push({ role: msg.role, content: msg.content });
    } else if (msg.role === "tool") {
      // Map tool messages as user messages for Anthropic
      anthropicMessages.push({ role: "user", content: msg.content });
    }
  }

  return { system, messages: anthropicMessages };
}

async function* streamAnthropic(
  messages: AIMessage[],
  opts?: ChatOptions
): AsyncGenerator<string> {
  const apiKey = await requireApiKeyAsync("anthropic", opts?.workspaceId);
  const baseUrl = getBaseUrl("anthropic");
  const model = getModel("anthropic", opts);
  const url = `${baseUrl}/messages`;

  const { system, messages: anthropicMessages } = convertToAnthropicMessages(messages);

  const body: Record<string, unknown> = {
    model,
    messages: anthropicMessages,
    stream: true,
    max_tokens: opts?.maxTokens ?? 4096,
  };
  if (system) body.system = system;
  if (typeof opts?.temperature === "number") body.temperature = opts.temperature;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
    signal: opts?.signal,
  });

  if (!res.ok || !res.body) {
    throw await toProviderError(res);
  }

  // Anthropic SSE format: event types include content_block_delta
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      let newlineIdx: number;
      while ((newlineIdx = buffer.indexOf("\n")) !== -1) {
        const rawLine = buffer.slice(0, newlineIdx).trim();
        buffer = buffer.slice(newlineIdx + 1);

        if (!rawLine || !rawLine.startsWith("data:")) continue;

        const data = rawLine.slice("data:".length).trim();
        if (data === "[DONE]") return;

        try {
          const parsed = JSON.parse(data);
          // Anthropic streaming events
          if (parsed.type === "content_block_delta" && parsed.delta?.text) {
            yield parsed.delta.text;
          } else if (parsed.type === "message_stop") {
            return;
          }
        } catch {
          // Ignore malformed JSON
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

// ---------------------------------------------------------------------------
// Shared utilities
// ---------------------------------------------------------------------------

/**
 * Translate a non-200 response into a safe ApiError.
 */
async function toProviderError(res: Response): Promise<ApiError> {
  let detail = "";
  try {
    const text = await res.text();
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
 * Parse an OpenAI-compatible SSE stream, yielding content deltas.
 */
async function* parseSSEStream(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      let newlineIdx: number;
      while ((newlineIdx = buffer.indexOf("\n")) !== -1) {
        const rawLine = buffer.slice(0, newlineIdx).trim();
        buffer = buffer.slice(newlineIdx + 1);

        if (!rawLine || !rawLine.startsWith("data:")) continue;

        const data = rawLine.slice("data:".length).trim();
        if (data === "[DONE]") return;

        try {
          const parsed = JSON.parse(data) as {
            choices?: Array<{ delta?: { content?: string } }>;
          };
          const delta = parsed.choices?.[0]?.delta?.content;
          if (delta) yield delta;
        } catch {
          // Ignore malformed/partial JSON lines
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Stream chat completions, yielding incremental content deltas as strings.
 * Automatically routes to the correct provider adapter.
 */
export async function* streamChat(
  messages: AIMessage[],
  opts?: ChatOptions
): AsyncGenerator<string> {
  const providerId = getActiveProviderId(opts);

  if (providerId === "anthropic") {
    yield* streamAnthropic(messages, opts);
  } else {
    // OpenAI-compatible: openai, groq, ollama, or any custom
    yield* streamOpenAICompatible(messages, providerId, opts);
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
