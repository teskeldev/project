/**
 * Single source of truth for AI provider metadata (9router-style), shared by
 * Integrations (connect UI + config + test) and Fusion (catalog). Pure data,
 * safe on server + client. Only `apikey`/local providers — no OAuth/cookie/media.
 *
 * `format` selects the request/validate shape (OpenAI-compatible vs Anthropic).
 * `validatePath` is appended to baseUrl for a lightweight connection test.
 */
export type ProviderFormat = "openai" | "anthropic";

export type AiProviderEntry = {
  id: string;
  name: string;
  category: "AI Providers" | "OpenAI-compatible" | "Local";
  display: { textIcon: string; color: string; website: string; apiKeyUrl?: string };
  transport: { baseUrl: string; format: ProviderFormat; validatePath: string };
  /** Requires an API key (false for local runtimes). */
  requiresKey: boolean;
  /** A local runtime (no key, localhost). */
  local: boolean;
  /** User must supply the baseUrl (custom / Azure). */
  baseUrlRequired?: boolean;
};

export const AI_PROVIDER_REGISTRY: AiProviderEntry[] = [
  { id: "openai", name: "OpenAI", category: "AI Providers", display: { textIcon: "AI", color: "#10a37f", website: "https://openai.com", apiKeyUrl: "https://platform.openai.com/api-keys" }, transport: { baseUrl: "https://api.openai.com/v1", format: "openai", validatePath: "/models" }, requiresKey: true, local: false },
  { id: "anthropic", name: "Anthropic", category: "AI Providers", display: { textIcon: "AN", color: "#D97757", website: "https://anthropic.com", apiKeyUrl: "https://console.anthropic.com/settings/keys" }, transport: { baseUrl: "https://api.anthropic.com/v1", format: "anthropic", validatePath: "/models" }, requiresKey: true, local: false },
  { id: "google", name: "Google AI (Gemini)", category: "AI Providers", display: { textIcon: "GG", color: "#4285F4", website: "https://ai.google.dev", apiKeyUrl: "https://aistudio.google.com/apikey" }, transport: { baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai", format: "openai", validatePath: "/models" }, requiresKey: true, local: false },
  { id: "xai", name: "xAI (Grok)", category: "AI Providers", display: { textIcon: "XAI", color: "#111111", website: "https://x.ai", apiKeyUrl: "https://console.x.ai" }, transport: { baseUrl: "https://api.x.ai/v1", format: "openai", validatePath: "/models" }, requiresKey: true, local: false },
  { id: "deepseek", name: "DeepSeek", category: "AI Providers", display: { textIcon: "DS", color: "#4D6BFE", website: "https://deepseek.com", apiKeyUrl: "https://platform.deepseek.com/api_keys" }, transport: { baseUrl: "https://api.deepseek.com/v1", format: "openai", validatePath: "/models" }, requiresKey: true, local: false },
  { id: "groq", name: "Groq", category: "AI Providers", display: { textIcon: "GQ", color: "#F55036", website: "https://groq.com", apiKeyUrl: "https://console.groq.com/keys" }, transport: { baseUrl: "https://api.groq.com/openai/v1", format: "openai", validatePath: "/models" }, requiresKey: true, local: false },
  { id: "mistral", name: "Mistral AI", category: "AI Providers", display: { textIcon: "MI", color: "#FA520F", website: "https://mistral.ai", apiKeyUrl: "https://console.mistral.ai/api-keys" }, transport: { baseUrl: "https://api.mistral.ai/v1", format: "openai", validatePath: "/models" }, requiresKey: true, local: false },
  { id: "cohere", name: "Cohere", category: "AI Providers", display: { textIcon: "CO", color: "#39594D", website: "https://cohere.com", apiKeyUrl: "https://dashboard.cohere.com/api-keys" }, transport: { baseUrl: "https://api.cohere.ai/compatibility/v1", format: "openai", validatePath: "/models" }, requiresKey: true, local: false },
  { id: "openrouter", name: "OpenRouter", category: "OpenAI-compatible", display: { textIcon: "OR", color: "#6566F1", website: "https://openrouter.ai", apiKeyUrl: "https://openrouter.ai/keys" }, transport: { baseUrl: "https://openrouter.ai/api/v1", format: "openai", validatePath: "/models" }, requiresKey: true, local: false },
  { id: "together", name: "Together AI", category: "OpenAI-compatible", display: { textIcon: "TG", color: "#0F6FFF", website: "https://together.ai", apiKeyUrl: "https://api.together.ai/settings/api-keys" }, transport: { baseUrl: "https://api.together.xyz/v1", format: "openai", validatePath: "/models" }, requiresKey: true, local: false },
  { id: "fireworks", name: "Fireworks AI", category: "OpenAI-compatible", display: { textIcon: "FW", color: "#5019C5", website: "https://fireworks.ai", apiKeyUrl: "https://fireworks.ai/account/api-keys" }, transport: { baseUrl: "https://api.fireworks.ai/inference/v1", format: "openai", validatePath: "/models" }, requiresKey: true, local: false },
  { id: "cerebras", name: "Cerebras", category: "OpenAI-compatible", display: { textIcon: "CB", color: "#1A1A1A", website: "https://cerebras.ai", apiKeyUrl: "https://cloud.cerebras.ai" }, transport: { baseUrl: "https://api.cerebras.ai/v1", format: "openai", validatePath: "/models" }, requiresKey: true, local: false },
  { id: "azure-openai", name: "Azure OpenAI", category: "OpenAI-compatible", display: { textIcon: "AZ", color: "#0078D4", website: "https://azure.microsoft.com", apiKeyUrl: "https://portal.azure.com" }, transport: { baseUrl: "", format: "openai", validatePath: "/models" }, requiresKey: true, local: false, baseUrlRequired: true },
  { id: "custom", name: "Custom (OpenAI-compatible)", category: "OpenAI-compatible", display: { textIcon: "CU", color: "#64748B", website: "" }, transport: { baseUrl: "", format: "openai", validatePath: "/models" }, requiresKey: true, local: false, baseUrlRequired: true },
  { id: "ollama", name: "Ollama", category: "Local", display: { textIcon: "OL", color: "#111111", website: "https://ollama.com" }, transport: { baseUrl: "http://localhost:11434/v1", format: "openai", validatePath: "/models" }, requiresKey: false, local: true },
  { id: "lmstudio", name: "LM Studio", category: "Local", display: { textIcon: "LM", color: "#7C3AED", website: "https://lmstudio.ai" }, transport: { baseUrl: "http://localhost:1234/v1", format: "openai", validatePath: "/models" }, requiresKey: false, local: true },
];

export function getAiProvider(id: string): AiProviderEntry | undefined {
  return AI_PROVIDER_REGISTRY.find((p) => p.id === id);
}

export const AI_PROVIDER_IDS = AI_PROVIDER_REGISTRY.map((p) => p.id);
