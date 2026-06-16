/**
 * Anthropic CompletionModel implementation.
 *
 * Handles Anthropic's Messages API format, tool_use blocks, and streaming.
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
// Anthropic API types
// ---------------------------------------------------------------------------

type AnthropicRole = "user" | "assistant";

type AnthropicTextBlock = { type: "text"; text: string };
type AnthropicImageBlock = {
  type: "image";
  source:
    | { type: "url"; url: string }
    | { type: "base64"; media_type: string; data: string };
};
type AnthropicToolUseBlock = {
  type: "tool_use";
  id: string;
  name: string;
  input: unknown;
};
type AnthropicToolResultBlock = {
  type: "tool_result";
  tool_use_id: string;
  content: string;
  is_error?: boolean;
};
type AnthropicThinkingBlock = { type: "thinking"; thinking: string };

type AnthropicContentBlock =
  | AnthropicTextBlock
  | AnthropicImageBlock
  | AnthropicToolUseBlock
  | AnthropicToolResultBlock
  | AnthropicThinkingBlock;

type AnthropicMessage = {
  role: AnthropicRole;
  content: string | AnthropicContentBlock[];
};

type AnthropicTool = {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
};

type AnthropicToolChoice =
  | { type: "auto" }
  | { type: "any" }
  | { type: "tool"; name: string };

type AnthropicRequestBody = {
  model: string;
  messages: AnthropicMessage[];
  max_tokens: number;
  stream?: boolean;
  system?: string;
  temperature?: number;
  tools?: AnthropicTool[];
  tool_choice?: AnthropicToolChoice;
};

type AnthropicResponseMessage = {
  id: string;
  type: "message";
  role: "assistant";
  content: AnthropicContentBlock[];
  stop_reason: string | null;
  usage: { input_tokens: number; output_tokens: number };
};

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export type AnthropicModelOptions = {
  /** Model ID override (e.g. 'claude-sonnet-4-20250514'). */
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

const ANTHROPIC_VERSION = "2023-06-01";
const DEFAULT_MAX_TOKENS = 4096;

export class AnthropicModel implements StreamingCompletionModel {
  readonly provider = "anthropic";
  readonly modelId: string;
  readonly capabilities: ModelCapabilities;

  private readonly apiKey: string | undefined;
  private readonly baseUrl: string;
  private readonly workspaceId: string | undefined;

  constructor(options: AnthropicModelOptions = {}) {
    this.modelId = resolveModelId(options.model);
    this.apiKey = options.apiKey;
    this.baseUrl = resolveBaseUrl(options.baseUrl);
    this.workspaceId = options.workspaceId;

    this.capabilities = {
      streaming: true,
      tools: true,
      toolChoice: true,
      imageInput: true,
      outputSchema: false,
      reasoning: true,
    };
  }

  // ---- Non-streaming completion ----

  async completion(request: CompletionRequest): Promise<CompletionResponse> {
    const apiKey = await this.resolveKey();
    const model = request.model ?? this.modelId;
    const url = `${this.baseUrl}/messages`;

    const body = buildRequestBody(request, model, false);

    const res = await fetch(url, {
      method: "POST",
      headers: buildHeaders(apiKey),
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      throw await toProviderError(res);
    }

    const json = (await res.json()) as AnthropicResponseMessage;
    return parseResponse(json);
  }

  // ---- Streaming completion ----

  async *streamCompletion(
    request: CompletionRequest,
  ): AsyncIterable<CompletionStreamEvent> {
    const apiKey = await this.resolveKey();
    const model = request.model ?? this.modelId;
    const url = `${this.baseUrl}/messages`;

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
    const blockAccumulators = new Map<
      number,
      | { type: "text"; text: string }
      | { type: "tool_use"; id: string; name: string; input: string }
      | { type: "thinking"; text: string }
    >();
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

          let event: Record<string, unknown>;
          try {
            event = JSON.parse(data);
          } catch {
            continue;
          }

          const eventType = event.type as string;

          switch (eventType) {
            case "message_start": {
              const message = event.message as
                | AnthropicResponseMessage
                | undefined;
              if (message?.usage) {
                usage = {
                  inputTokens: message.usage.input_tokens,
                  outputTokens: message.usage.output_tokens,
                  totalTokens:
                    message.usage.input_tokens +
                    message.usage.output_tokens,
                };
              }
              break;
            }

            case "content_block_start": {
              const index = event.index as number;
              const block = event.content_block as Record<string, unknown>;
              if (block.type === "text") {
                blockAccumulators.set(index, {
                  type: "text",
                  text: (block.text as string) ?? "",
                });
              } else if (block.type === "tool_use") {
                blockAccumulators.set(index, {
                  type: "tool_use",
                  id: block.id as string,
                  name: block.name as string,
                  input: "",
                });
              } else if (block.type === "thinking") {
                blockAccumulators.set(index, {
                  type: "thinking",
                  text: (block.thinking as string) ?? "",
                });
              }
              break;
            }

            case "content_block_delta": {
              const index = event.index as number;
              const delta = event.delta as Record<string, unknown>;
              const acc = blockAccumulators.get(index);

              if (delta.type === "text_delta" && acc?.type === "text") {
                const text = delta.text as string;
                acc.text += text;
                yield { type: "text_delta", delta: text };
              } else if (
                delta.type === "input_json_delta" &&
                acc?.type === "tool_use"
              ) {
                const partial = delta.partial_json as string;
                acc.input += partial;
                yield {
                  type: "tool_call_delta",
                  id: acc.id,
                  name: undefined,
                  argumentsDelta: partial,
                };
              } else if (
                delta.type === "thinking_delta" &&
                acc?.type === "thinking"
              ) {
                const text = delta.thinking as string;
                acc.text += text;
                yield { type: "reasoning_delta", delta: text };
              }
              break;
            }

            case "content_block_stop": {
              const index = event.index as number;
              const acc = blockAccumulators.get(index);
              if (acc?.type === "tool_use") {
                const toolCall: ToolCallContent = {
                  type: "tool_call",
                  id: acc.id,
                  name: acc.name,
                  arguments: acc.input,
                };
                contentParts.push(toolCall);
                yield { type: "tool_call", toolCall };
              } else if (acc?.type === "text" && acc.text) {
                contentParts.push({ type: "text", text: acc.text });
              } else if (acc?.type === "thinking" && acc.text) {
                contentParts.push({
                  type: "reasoning",
                  text: acc.text,
                });
              }
              break;
            }

            case "message_delta": {
              const delta = event.delta as
                | Record<string, unknown>
                | undefined;
              const eventUsage = event.usage as
                | { output_tokens?: number }
                | undefined;
              if (delta?.stop_reason) {
                finishReason = mapStopReason(
                  delta.stop_reason as string,
                );
              }
              if (eventUsage?.output_tokens) {
                usage = {
                  ...usage,
                  outputTokens: eventUsage.output_tokens,
                  totalTokens:
                    usage.inputTokens + eventUsage.output_tokens,
                };
              }
              break;
            }

            case "message_stop":
              break;

            case "error": {
              yield { type: "error", error: event.error };
              break;
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    yield {
      type: "final",
      response: { content: contentParts, usage, finishReason },
    };
  }

  // ---- Key resolution ----

  private async resolveKey(): Promise<string> {
    if (this.apiKey) return this.apiKey;

    const resolved = await resolveApiKey("anthropic", this.workspaceId);
    if (resolved) return resolved.apiKey;

    // Direct env fallback
    const envKey = process.env.ANTHROPIC_API_KEY?.trim();
    if (envKey && envKey.length > 0) return envKey;

    throw new ApiError(
      "AI is not configured. Add an Anthropic API key in Integrations to enable AI features.",
      503,
      "AI_NOT_CONFIGURED",
    );
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resolveModelId(explicit?: string): string {
  if (explicit) return explicit;
  const envModel = process.env.ANTHROPIC_MODEL?.trim();
  if (envModel) return envModel;
  return "claude-sonnet-4-20250514";
}

function resolveBaseUrl(explicit?: string): string {
  if (explicit) return explicit.replace(/\/+$/, "");
  const envBase = process.env.ANTHROPIC_BASE_URL?.trim();
  if (envBase) return envBase.replace(/\/+$/, "");
  const config = getProviderConfig("anthropic");
  return (config?.baseUrl ?? "https://api.anthropic.com/v1").replace(
    /\/+$/,
    "",
  );
}

function buildHeaders(apiKey: string): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "x-api-key": apiKey,
    "anthropic-version": ANTHROPIC_VERSION,
  };
}

function buildRequestBody(
  request: CompletionRequest,
  model: string,
  stream: boolean,
): AnthropicRequestBody {
  const { system, messages } = convertMessages(
    request.messages,
    request.instructions,
  );

  const body: AnthropicRequestBody = {
    model,
    messages,
    max_tokens: request.maxTokens ?? DEFAULT_MAX_TOKENS,
  };

  if (stream) body.stream = true;
  if (system) body.system = system;
  if (typeof request.temperature === "number")
    body.temperature = request.temperature;

  if (request.tools && request.tools.length > 0) {
    body.tools = request.tools.map(convertTool);
    if (request.toolChoice) {
      body.tool_choice = convertToolChoice(request.toolChoice);
    }
  }

  return body;
}

function convertMessages(
  messages: Message[],
  instructions?: string,
): { system: string | undefined; messages: AnthropicMessage[] } {
  let system: string | undefined;
  const result: AnthropicMessage[] = [];

  if (instructions) {
    system = instructions;
  }

  for (const msg of messages) {
    switch (msg.role) {
      case "system":
        system = system ? `${system}\n\n${msg.content}` : msg.content;
        break;

      case "user": {
        if (typeof msg.content === "string") {
          result.push({ role: "user", content: msg.content });
        } else {
          const blocks: AnthropicContentBlock[] = msg.content.map(
            (part): AnthropicContentBlock => {
              if (part.type === "text") {
                return { type: "text", text: part.text };
              }
              return {
                type: "image",
                source: { type: "url", url: part.url },
              };
            },
          );
          result.push({ role: "user", content: blocks });
        }
        break;
      }

      case "assistant": {
        if (typeof msg.content === "string") {
          result.push({ role: "assistant", content: msg.content });
        } else {
          const blocks: AnthropicContentBlock[] = [];
          for (const part of msg.content) {
            if (part.type === "text") {
              blocks.push({ type: "text", text: part.text });
            } else if (part.type === "tool_call") {
              let parsedInput: unknown;
              try {
                parsedInput = JSON.parse(part.arguments);
              } catch {
                parsedInput = {};
              }
              blocks.push({
                type: "tool_use",
                id: part.id,
                name: part.name,
                input: parsedInput,
              });
            } else if (part.type === "reasoning") {
              blocks.push({
                type: "thinking",
                thinking: part.text,
              });
            }
          }
          result.push({ role: "assistant", content: blocks });
        }
        break;
      }

      case "tool": {
        // Anthropic expects tool results as user messages with tool_result blocks
        const blocks: AnthropicContentBlock[] = msg.content.map(
          (part): AnthropicToolResultBlock => ({
            type: "tool_result",
            tool_use_id: part.toolCallId,
            content: part.content,
            is_error: part.isError,
          }),
        );
        result.push({ role: "user", content: blocks });
        break;
      }
    }
  }

  return { system, messages: result };
}

function convertTool(tool: ToolDefinition): AnthropicTool {
  return {
    name: tool.name,
    description: tool.description,
    input_schema: tool.parameters,
  };
}

function convertToolChoice(choice: ToolChoice): AnthropicToolChoice {
  if (typeof choice === "string") {
    switch (choice) {
      case "auto":
        return { type: "auto" };
      case "required":
        return { type: "any" };
      case "none":
        // Anthropic doesn't have a "none" tool choice; return auto as fallback.
        // Callers should remove tools from the request for "none" behavior.
        return { type: "auto" };
      default:
        return { type: "auto" };
    }
  }
  return { type: "tool", name: choice.name };
}

function parseResponse(
  json: AnthropicResponseMessage,
): CompletionResponse {
  const content: AssistantContent[] = [];

  for (const block of json.content) {
    if (block.type === "text") {
      content.push({ type: "text", text: block.text });
    } else if (block.type === "tool_use") {
      content.push({
        type: "tool_call",
        id: block.id,
        name: block.name,
        arguments: JSON.stringify(block.input),
      });
    } else if (block.type === "thinking") {
      content.push({ type: "reasoning", text: block.thinking });
    }
  }

  return {
    content,
    usage: {
      inputTokens: json.usage.input_tokens,
      outputTokens: json.usage.output_tokens,
      totalTokens: json.usage.input_tokens + json.usage.output_tokens,
    },
    finishReason: mapStopReason(json.stop_reason ?? "end_turn"),
  };
}

function mapStopReason(
  reason: string,
): CompletionResponse["finishReason"] {
  switch (reason) {
    case "end_turn":
    case "stop_sequence":
      return "stop";
    case "tool_use":
      return "tool_calls";
    case "max_tokens":
      return "length";
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
