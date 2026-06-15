/**
 * Static catalog for Fusion: provider kinds (used to derive the read-only model
 * registry from Integrations) + the Fusion strategy / judge option sets. Pure
 * data, safe to import from server and client.
 */

export type ProviderKind =
  | "openai"
  | "anthropic"
  | "google"
  | "openrouter"
  | "deepseek"
  | "groq"
  | "cerebras"
  | "together"
  | "fireworks"
  | "xai"
  | "ollama"
  | "lmstudio"
  | "azure-openai"
  | "custom";

export type ProviderCatalogEntry = {
  kind: ProviderKind;
  label: string;
  baseUrl: string;
  requiresKey: boolean;
  local: boolean;
};

export const PROVIDER_CATALOG: ProviderCatalogEntry[] = [
  { kind: "openai", label: "OpenAI", baseUrl: "https://api.openai.com/v1", requiresKey: true, local: false },
  { kind: "anthropic", label: "Anthropic", baseUrl: "https://api.anthropic.com/v1", requiresKey: true, local: false },
  { kind: "google", label: "Google AI", baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai", requiresKey: true, local: false },
  { kind: "openrouter", label: "OpenRouter", baseUrl: "https://openrouter.ai/api/v1", requiresKey: true, local: false },
  { kind: "deepseek", label: "DeepSeek", baseUrl: "https://api.deepseek.com/v1", requiresKey: true, local: false },
  { kind: "groq", label: "Groq", baseUrl: "https://api.groq.com/openai/v1", requiresKey: true, local: false },
  { kind: "cerebras", label: "Cerebras", baseUrl: "https://api.cerebras.ai/v1", requiresKey: true, local: false },
  { kind: "together", label: "Together AI", baseUrl: "https://api.together.xyz/v1", requiresKey: true, local: false },
  { kind: "fireworks", label: "Fireworks AI", baseUrl: "https://api.fireworks.ai/inference/v1", requiresKey: true, local: false },
  { kind: "xai", label: "xAI (Grok)", baseUrl: "https://api.x.ai/v1", requiresKey: true, local: false },
  { kind: "ollama", label: "Ollama", baseUrl: "http://localhost:11434/v1", requiresKey: false, local: true },
  { kind: "lmstudio", label: "LM Studio", baseUrl: "http://localhost:1234/v1", requiresKey: false, local: true },
  { kind: "azure-openai", label: "Azure OpenAI", baseUrl: "", requiresKey: true, local: false },
  { kind: "custom", label: "Custom (OpenAI-compatible)", baseUrl: "", requiresKey: true, local: false },
];

export function getProviderCatalog(kind: string): ProviderCatalogEntry | undefined {
  return PROVIDER_CATALOG.find((p) => p.kind === kind);
}

export const FUSION_STRATEGIES = ["single", "parallel", "consensus"] as const;
export type FusionStrategy = (typeof FUSION_STRATEGIES)[number];

export const JUDGE_OPTIONS = ["auto", "anthropic", "openai", "google"] as const;
export type JudgeOption = (typeof JUDGE_OPTIONS)[number];

export type FusionLimits = { maxCostUsd: number; maxTokens: number; timeoutMs: number };
export const DEFAULT_LIMITS: FusionLimits = { maxCostUsd: 5, maxTokens: 50000, timeoutMs: 60000 };
