/**
 * Teskel AI core — tool system, agent framework, and provider-agnostic CompletionModel interface.
 *
 * @example
 * ```ts
 * import { createModel, AgentBuilder, createHook, Message } from "@/lib/ai/core";
 *
 * const model = createModel({ provider: "openai", model: "gpt-4o" });
 *
 * const agent = new AgentBuilder("assistant", model)
 *   .instructions("You are helpful.")
 *   .tool(searchTool)
 *   .hook(loggingHook)
 *   .build();
 *
 * const response = await agent.prompt("Hello!").send();
 * ```
 */

// --- Core types (messages, tools, completions, streaming, model interfaces) ---
export { Message, isStreamingModel } from "./types";

export type {
  JsonSchemaProperty,
  MessageRole,
  TextContent,
  ImageContent,
  ToolCallContent,
  ToolResultContent,
  ReasoningContent,
  UserContent,
  AssistantContent,
  ToolContent,
  SystemMessage,
  UserMessage,
  AssistantMessage,
  ToolMessage,
  ToolDefinition,
  ToolChoice,
  Usage,
  CompletionRequest,
  CompletionResponse,
  CompletionStreamEvent,
  ModelCapabilities,
  CompletionModel,
  StreamingCompletionModel,
} from "./types";

// --- Tool system ---
export { createTool, createThinkTool } from "./tool";
export type { Tool, AnyTool, CreateToolOptions } from "./tool";

export { ToolSet, ToolNotFoundError, ToolCallError } from "./tool-set";

// --- Hook system ---
export {
  createHook,
  composeHooks,
  composeAllHooks,
  createRunControl,
  createToolCallControl,
} from "./hooks";

export type {
  HookAction,
  ToolCallHookAction,
  RunControl,
  ToolCallControl,
  CompletionCallHookArgs,
  CompletionResponseHookArgs,
  ToolCallHookArgs,
  ToolResultHookArgs,
  PromptHook,
} from "./hooks";

// --- Agent system ---
export {
  Agent,
  PromptRequest,
  MaxTurnsError,
  PromptCancelledError,
} from "./agent";

export type {
  AgentOptions,
  PromptResponse,
  AgentStreamEvent,
} from "./agent";

export { AgentBuilder } from "./agent-builder";

// --- Extractor (structured data extraction) ---
export { Extractor, ExtractorBuilder, ExtractionError } from "./extractor";
export type { ExtractionResponse } from "./extractor";

// --- Pipeline (composable data processing) ---
export { Pipeline, PipelineBuilder } from "./pipeline";
export type { PipelineOp } from "./pipeline";

// --- Streaming utilities ---
export { toReadableStream, parseJsonlStream } from "./streaming";

// --- Model implementations ---
export { OpenAIModel } from "./openai-model";
export type { OpenAIModelOptions } from "./openai-model";

export { AnthropicModel } from "./anthropic-model";
export type { AnthropicModelOptions } from "./anthropic-model";

// --- Factory ---
export { createModel, createDefaultModel } from "./model-factory";
export type { CreateModelOptions } from "./model-factory";
