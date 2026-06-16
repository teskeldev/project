/**
 * Teskel AI core types — shared type definitions for the model and tool systems.
 *
 * These types define the provider-agnostic interface for AI completions,
 * messages, tool definitions, and streaming events.
 */

// ---------------------------------------------------------------------------
// JSON Schema helpers
// ---------------------------------------------------------------------------

/** JSON Schema property definition. */
export type JsonSchemaProperty = {
  type: string;
  description?: string;
  enum?: unknown[];
  items?: JsonSchemaProperty;
  properties?: Record<string, JsonSchemaProperty>;
  required?: string[];
  default?: unknown;
};

// ---------------------------------------------------------------------------
// Message types
// ---------------------------------------------------------------------------

export type MessageRole = "system" | "user" | "assistant" | "tool";

export type TextContent = { type: "text"; text: string };
export type ImageContent = { type: "image"; url: string; detail?: string };
export type ToolCallContent = {
  type: "tool_call";
  id: string;
  name: string;
  arguments: string;
};
export type ToolResultContent = {
  toolCallId: string;
  content: string;
  isError?: boolean;
};
export type ReasoningContent = { type: "reasoning"; text: string };

export type UserContent = string | Array<TextContent | ImageContent>;
export type AssistantContent = TextContent | ToolCallContent | ReasoningContent;
export type ToolContent = ToolResultContent[];

export type SystemMessage = { role: "system"; content: string };
export type UserMessage = { role: "user"; content: UserContent };
export type AssistantMessage = {
  role: "assistant";
  content: string | AssistantContent[];
};
export type ToolMessage = { role: "tool"; content: ToolContent };

export type Message = SystemMessage | UserMessage | AssistantMessage | ToolMessage;

// ---------------------------------------------------------------------------
// Message factory (value + type export)
// ---------------------------------------------------------------------------

/**
 * Helper for constructing typed messages.
 *
 * @example
 * ```ts
 * const msgs = [
 *   Message.system("You are helpful."),
 *   Message.user("Hello!"),
 * ];
 * ```
 */
export const Message = {
  system(content: string): SystemMessage {
    return { role: "system", content };
  },
  user(content: UserContent): UserMessage {
    return { role: "user", content };
  },
  assistant(content: string | AssistantContent[]): AssistantMessage {
    return { role: "assistant", content };
  },
  tool(content: ToolContent): ToolMessage {
    return { role: "tool", content };
  },
};

// ---------------------------------------------------------------------------
// Tool definitions (flat format used by the model layer)
// ---------------------------------------------------------------------------

/**
 * Tool definition in the flat format used internally by the model layer.
 * Model implementations convert this to their provider-specific format
 * (e.g., OpenAI wraps it in `{ type: "function", function: { ... } }`).
 */
export type ToolDefinition = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
};

/** Tool choice for completion requests. */
export type ToolChoice = "auto" | "required" | "none" | { name: string };

// ---------------------------------------------------------------------------
// Completion request / response
// ---------------------------------------------------------------------------

export type Usage = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
};

export type CompletionRequest = {
  messages: Message[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  tools?: ToolDefinition[];
  toolChoice?: ToolChoice;
  instructions?: string;
  outputSchema?: Record<string, unknown>;
};

export type CompletionResponse = {
  content: AssistantContent[];
  usage: Usage;
  finishReason: "stop" | "tool_calls" | "length" | "content_filter";
};

// ---------------------------------------------------------------------------
// Streaming events
// ---------------------------------------------------------------------------

export type CompletionStreamEvent =
  | { type: "text_delta"; delta: string }
  | { type: "reasoning_delta"; delta: string }
  | {
      type: "tool_call_delta";
      id: string;
      name: string | undefined;
      argumentsDelta: string | undefined;
    }
  | { type: "tool_call"; toolCall: ToolCallContent }
  | { type: "final"; response: CompletionResponse }
  | { type: "error"; error: unknown };

// ---------------------------------------------------------------------------
// Model interfaces
// ---------------------------------------------------------------------------

export type ModelCapabilities = {
  streaming: boolean;
  tools: boolean;
  toolChoice: boolean;
  imageInput: boolean;
  outputSchema: boolean;
  reasoning: boolean;
};

export interface CompletionModel {
  readonly provider: string;
  readonly modelId: string;
  readonly capabilities: ModelCapabilities;
  completion(request: CompletionRequest): Promise<CompletionResponse>;
}

export interface StreamingCompletionModel extends CompletionModel {
  streamCompletion(
    request: CompletionRequest,
  ): AsyncIterable<CompletionStreamEvent>;
}

/**
 * Type guard: check if a model supports streaming.
 */
export function isStreamingModel(
  model: CompletionModel,
): model is StreamingCompletionModel {
  return model.capabilities.streaming && "streamCompletion" in model;
}
