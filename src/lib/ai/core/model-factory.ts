/**
 * Factory for creating the appropriate CompletionModel based on provider config.
 *
 * Automatically routes to OpenAI-compatible or Anthropic implementations
 * based on the provider identifier. Uses Teskel's existing env vars and
 * key resolution.
 */
import type { StreamingCompletionModel } from "./types";
import { OpenAIModel } from "./openai-model";
import { AnthropicModel } from "./anthropic-model";

export type CreateModelOptions = {
  /** Provider identifier: 'openai' | 'anthropic' | 'groq' | 'ollama' | 'openrouter' | etc. */
  provider: string;
  /** Model ID override (e.g. 'gpt-4o', 'claude-sonnet-4-20250514'). */
  model?: string;
  /** Explicit API key (bypasses env/DB resolution). */
  apiKey?: string;
  /** Base URL override. */
  baseUrl?: string;
  /** Workspace ID for DB-based key resolution. */
  workspaceId?: string;
};

/**
 * Create a CompletionModel for the given provider.
 *
 * Anthropic uses its own API format; everything else is treated as
 * OpenAI-compatible (OpenAI, Groq, Ollama, OpenRouter, etc.).
 *
 * @example
 * ```ts
 * const model = createModel({ provider: "openai", model: "gpt-4o" });
 * const response = await model.completion({
 *   messages: [Message.user("Hello!")],
 * });
 * ```
 */
export function createModel(options: CreateModelOptions): StreamingCompletionModel {
  const { provider, model, apiKey, baseUrl, workspaceId } = options;

  if (provider === "anthropic") {
    return new AnthropicModel({ model, apiKey, baseUrl, workspaceId });
  }

  // OpenAI-compatible: openai, groq, ollama, openrouter, or any custom provider
  return new OpenAIModel({
    provider,
    model,
    apiKey,
    baseUrl,
    workspaceId,
  });
}

/**
 * Create a model from the active environment configuration.
 *
 * Uses AI_PROVIDER env var (default: 'openai') and resolves model/key
 * from environment variables.
 */
export function createDefaultModel(workspaceId?: string): StreamingCompletionModel {
  const provider = process.env.AI_PROVIDER?.trim() ?? "openai";
  return createModel({ provider, workspaceId });
}
