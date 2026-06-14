/**
 * OpenAI-compatible CompletionModel implementation.
 *
 * Supports OpenAI, Groq, Ollama, OpenRouter, and any OpenAI-compatible API.
 * Uses fetch() directly (consistent with Teskel's existing provider.ts).
 */
import { ApiError } from "@/lib/api";
import { resolveApiKey } from "../resolve-key";
import { getProviderConfig } from "../providers";
import type {
  AssistantContent,
  CompletionRequest,
  CompletionResponse,
  CompletionStreamEvent,
  Message,
  ModelCapabilities,
  StreamingCompletionModel,
  ToolCallContent,
  ToolChoice,
  ToolDefinition,
  Usage,
} from "./types";

// ---------------------------------------------------------------------------
// OpenAI API types (request/response shapes)
// ---------------------------------------------------------------------------

type OpenAIRole = "system" | "user" | "assistant" | "tool";

type OpenAIContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string; detail?: string } };

type OpenAIToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

type OpenAIMessage = {
  role: OpenAIRole;
  content?: string | OpenAIContentPart[] | null;
  tool_calls?: OpenAIToolCall[];
  tool_call_id?: string;
  name?: string;
};

type OpenAITool = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

type OpenAIToolChoice =
  | "auto"
  | "required"
  | "none"
  | { type: "function"; function: { name: string } };

type OpenAIRequestBody = {
  model: string;
  messages: OpenAIMessage[];
  stream: boolean;
  temperature?: number;
  max_tokens?: number;
  tools?: OpenAITool[];
  tool_choice?: OpenAIToolChoice;
  response_format?: {
    type: "json_schema";
    json_schema: { name: string; schema: Record<string, unknown> };
  };
};

type OpenAIChoice = {
  index: number;
  message: {
    role: "assistant";
    content?: string | null;
    tool_calls?: OpenAIToolCall[];
  };
  finish_reason: string;
};

type OpenAIUsage = {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
};

type OpenAIChatResponse = {
  id: string;
  choices: OpenAIChoice[];
  usage: OpenAIUsage;
};

type OpenAIStreamDelta = {
  role?: string;
  content?: string | null;
  tool_calls?: Array<{
    index: number;
    id?: string;
    type?: string;
    function?: { name?: string; arguments?: string };
  }>;
};

type OpenAIStreamChunk = {
  id: string;
  choices: Array<{
    index: number;
    delta: OpenAIStreamDelta;
    finish_reason: string | null;
  }>;
  usage?: OpenAIUsage | null;
};

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export type OpenAIModelOptions = {
  /** Provider identifier (e.g. 'openai', 'groq', 'ollama'). Defaults to AI_PROVIDER env or 'openai'. */
  provider?: string;
  /** Model ID override (e.g. 'gpt-4o'). */
  model?: string;
  /** Explicit API key (bypasses env/DB resolution). */
  apiKey?: string;
  /** Base URL override. */
  baseUrl?: string;
  /** Workspace ID for DB-based key resolution. */
  workspaceId?: string;
};

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

export class OpenAIModel implements StreamingCompletionModel {
  readonly provider: string;
  readonly modelId: string;
  readonly capabilities: ModelCapabilities;

  private readonly apiKey: string | undefined;
  private readonly baseUrl: string;
  private readonly workspaceId: string | undefined;

  constructor(options: OpenAIModelOptions = {}) {
    this.provider =
      options.provider ?? process.env.AI_PROVIDER?.trim() ?? "openai";
    this.modelId = resolveModelId(this.provider, options.model);
    this.apiKey = options.apiKey;
    this.baseUrl = resolveBaseUrl(this.provider, options.baseUrl);
    this.workspaceId = options.workspaceId;

    this.capabilities = {
      streaming: true,
      tools: true,
      toolChoice: true,
      imageInput: true,
      outputSchema: true,
      reasoning: false,
    };
  }

  // ---- Non-streaming completion ----

  async completion(request: CompletionRequest): Promise<CompletionResponse> {
    const apiKey = await this.resolveKey();
    const model = request.model ?? this.modelId;
    const url = `${this.baseUrl}/chat/completions`;

    const body = buildRequestBody(request, model, false);

    const res = await fetch(url, {
      method: "POST",
      headers: buildHeaders(apiKey),
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      throw await toProviderError(res);
    }

    const json = (await res.json()) as OpenAIChatResponse;
    return parseResponse(json);
  }

  // ---- Streaming completion ----

  async *streamCompletion(
    request: CompletionRequest,
  ): AsyncIterable<CompletionStreamEvent> {
    const apiKey = await this.resolveKey();
    const model = request.model ?? this.modelId;
    const url = `${this.baseUrl}/chat/completions`;

    const body = buildRequestBody(request, model, true);

    const res = await fetch(url, {
      method: "POST",
      headers: buildHeaders(apiKey),
      body: JSON.stringify(body),
    });

    if (!res.ok || !res.body) {
      throw await toProviderError(res);
    }

    // Accumulate state for the final event
    const contentParts: AssistantContent[] = [];
    const toolCallAccumulators = new Map<
      number,
      { id: string; name: string; arguments: string }
    >();
    let textAccumulator = "";
    let usage: Usage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
    let finishReason: CompletionResponse["finishReason"] = "stop";

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
          if (data === "[DONE]") break;

          let chunk: OpenAIStreamChunk;
          try {
            chunk = JSON.parse(data) as OpenAIStreamChunk;
          } catch {
            continue;
          }

          const choice = chunk.choices?.[0];
          if (!choice) continue;

          const delta = choice.delta;

          // Text content
          if (delta.content) {
            textAccumulator += delta.content;
            yield { type: "text_delta", delta: delta.content };
          }

          // Tool calls
          if (delta.tool_calls) {
            for (const tc of delta.tool_calls) {
              let acc = toolCallAccumulators.get(tc.index);
              if (!acc) {
                acc = { id: tc.id ?? "", name: "", arguments: "" };
                toolCallAccumulators.set(tc.index, acc);
              }
              if (tc.id) acc.id = tc.id;
              if (tc.function?.name) acc.name = tc.function.name;
              if (tc.function?.arguments)
                acc.arguments += tc.function.arguments;

              yield {
                type: "tool_call_delta",
                id: acc.id,
                name: tc.function?.name,
                argumentsDelta: tc.function?.arguments,
              };
            }
          }

          // Finish reason
          if (choice.finish_reason) {
            finishReason = mapFinishReason(choice.finish_reason);
          }

          // Usage (some providers include it in the last chunk)
          if (chunk.usage) {
            usage = {
              inputTokens: chunk.usage.prompt_tokens,
              outputTokens: chunk.usage.completion_tokens,
              totalTokens: chunk.usage.total_tokens,
            };
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    // Build final content
    if (textAccumulator) {
      contentParts.push({ type: "text", text: textAccumulator });
    }

    for (const acc of toolCallAccumulators.values()) {
      const toolCall: ToolCallContent = {
        type: "tool_call",
        id: acc.id,
        name: acc.name,
        arguments: acc.arguments,
      };
      contentParts.push(toolCall);
      yield { type: "tool_call", toolCall };
    }

    yield {
      type: "final",
      response: { content: contentParts, usage, finishReason },
    };
  }

  // ---- Key resolution ----

  private async resolveKey(): Promise<string> {
    if (this.apiKey) return this.apiKey;

    const config = getProviderConfig(this.provider);
    if (config && !config.requiresApiKey) return "";

    const resolved = await resolveApiKey(this.provider, this.workspaceId);
    if (resolved) return resolved.apiKey;

    // Direct env fallback
    const envKey = getEnvKey(this.provider);
    if (envKey) return envKey;

    const name = config?.name ?? this.provider;
    throw new ApiError(
      `AI is not configured. Add a ${name} API key in Integrations to enable AI features.`,
      503,
      "AI_NOT_CONFIGURED",
    );
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resolveModelId(providerId: string, explicit?: string): string {
  if (explicit) return explicit;
  const envModel = process.env[`${providerId.toUpperCase()}_MODEL`]?.trim();
  if (envModel) return envModel;
  return process.env.OPENAI_MODEL?.trim() ?? "gpt-4o-mini";
}

function resolveBaseUrl(providerId: string, explicit?: string): string {
  if (explicit) return explicit.replace(/\/+$/, "");
  const envBase =
    process.env[`${providerId.toUpperCase()}_BASE_URL`]?.trim();
  if (envBase) return envBase.replace(/\/+$/, "");
  const config = getProviderConfig(providerId);
  return (config?.baseUrl ?? "https://api.openai.com/v1").replace(/\/+$/, "");
}

function getEnvKey(providerId: string): string | undefined {
  const map: Record<string, string> = {
    openai: "OPENAI_API_KEY",
    groq: "GROQ_API_KEY",
  };
  const envVar = map[providerId] ?? "OPENAI_API_KEY";
  const val = process.env[envVar]?.trim();
  return val && val.length > 0 ? val : undefined;
}

function buildHeaders(apiKey: string): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (apiKey) {
    headers["Authorization"] = `Bearer ${apiKey}`;
  }
  return headers;
}

function buildRequestBody(
  request: CompletionRequest,
  model: string,
  stream: boolean,
): OpenAIRequestBody {
  const messages = convertMessages(request.messages, request.instructions);

  const body: OpenAIRequestBody = { model, messages, stream };

  if (typeof request.temperature === "number")
    body.temperature = request.temperature;
  if (typeof request.maxTokens === "number")
    body.max_tokens = request.maxTokens;

  if (request.tools && request.tools.length > 0) {
    body.tools = request.tools.map(convertTool);
    if (request.toolChoice) {
      body.tool_choice = convertToolChoice(request.toolChoice);
    }
  }

  if (request.outputSchema) {
    body.response_format = {
      type: "json_schema",
      json_schema: { name: "response", schema: request.outputSchema },
    };
  }

  return body;
}

function convertMessages(
  messages: Message[],
  instructions?: string,
): OpenAIMessage[] {
  const result: OpenAIMessage[] = [];

  // Prepend instructions as a system message
  if (instructions) {
    result.push({ role: "system", content: instructions });
  }

  for (const msg of messages) {
    switch (msg.role) {
      case "system":
        result.push({ role: "system", content: msg.content });
        break;

      case "user": {
        if (typeof msg.content === "string") {
          result.push({ role: "user", content: msg.content });
        } else {
          const parts: OpenAIContentPart[] = msg.content.map(
            (part): OpenAIContentPart => {
              if (part.type === "text") {
                return { type: "text", text: part.text };
              }
              return {
                type: "image_url",
                image_url: { url: part.url, detail: part.detail },
              };
            },
          );
          result.push({ role: "user", content: parts });
        }
        break;
      }

      case "assistant": {
        if (typeof msg.content === "string") {
          result.push({ role: "assistant", content: msg.content });
        } else {
          let text = "";
          const toolCalls: OpenAIToolCall[] = [];
          for (const part of msg.content) {
            if (part.type === "text") {
              text += part.text;
            } else if (part.type === "tool_call") {
              toolCalls.push({
                id: part.id,
                type: "function",
                function: {
                  name: part.name,
                  arguments: part.arguments,
                },
              });
            }
            // reasoning content is not sent back to OpenAI
          }
          const openaiMsg: OpenAIMessage = { role: "assistant" };
          if (text) openaiMsg.content = text;
          if (toolCalls.length > 0) openaiMsg.tool_calls = toolCalls;
          result.push(openaiMsg);
        }
        break;
      }

      case "tool": {
        for (const part of msg.content) {
          result.push({
            role: "tool",
            tool_call_id: part.toolCallId,
            content: part.content,
          });
        }
        break;
      }
    }
  }

  return result;
}

function convertTool(tool: ToolDefinition): OpenAITool {
  return {
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  };
}

function convertToolChoice(choice: ToolChoice): OpenAIToolChoice {
  if (typeof choice === "string") {
    return choice as OpenAIToolChoice;
  }
  return { type: "function", function: { name: choice.name } };
}

function parseResponse(json: OpenAIChatResponse): CompletionResponse {
  const choice = json.choices[0];
  const content: AssistantContent[] = [];

  if (choice.message.content) {
    content.push({ type: "text", text: choice.message.content });
  }

  if (choice.message.tool_calls) {
    for (const tc of choice.message.tool_calls) {
      content.push({
        type: "tool_call",
        id: tc.id,
        name: tc.function.name,
        arguments: tc.function.arguments,
      });
    }
  }

  return {
    content,
    usage: {
      inputTokens: json.usage.prompt_tokens,
      outputTokens: json.usage.completion_tokens,
      totalTokens: json.usage.total_tokens,
    },
    finishReason: mapFinishReason(choice.finish_reason),
  };
}

function mapFinishReason(
  reason: string,
): CompletionResponse["finishReason"] {
  switch (reason) {
    case "stop":
      return "stop";
    case "tool_calls":
      return "tool_calls";
    case "length":
      return "length";
    case "content_filter":
      return "content_filter";
    default:
      return "stop";
  }
}

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
    detail || undefined,
  );
}
