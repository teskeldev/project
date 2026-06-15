/**
 * Static catalogs for the Fusion Orchestration Hub — provider kinds, MCP server
 * kinds, routing strategies and judge modes. Pure data (no secrets, no Node-only
 * imports) so it is safe to import from both server and client code.
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

export const MCP_KINDS = [
  "filesystem",
  "browser",
  "github",
  "postgres",
  "supabase",
  "notion",
  "linear",
  "slack",
  "custom",
] as const;
export type McpKind = (typeof MCP_KINDS)[number];

export const ROUTING_STRATEGIES = [
  "fastest",
  "cheapest",
  "quality",
  "coding",
  "research",
  "vision",
  "weighted",
  "cost",
  "latency",
  "fallback",
  "custom",
] as const;
export type RoutingStrategy = (typeof ROUTING_STRATEGIES)[number];

export const JUDGE_MODES = [
  "consensus",
  "majority",
  "debate",
  "tournament",
  "merge",
  "custom",
] as const;
export type JudgeMode = (typeof JUDGE_MODES)[number];

export type ModelCapabilities = {
  reasoning: boolean;
  vision: boolean;
  tools: boolean;
  structuredOutput: boolean;
  jsonMode: boolean;
};

export const DEFAULT_CAPABILITIES: ModelCapabilities = {
  reasoning: false,
  vision: false,
  tools: true,
  structuredOutput: true,
  jsonMode: true,
};

export type ModelPricing = { input: number; output: number };
export const DEFAULT_PRICING: ModelPricing = { input: 0, output: 0 };
