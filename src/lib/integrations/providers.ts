/**
 * Integration provider catalog + config schemas.
 *
 * AI providers are DERIVED from the single provider registry
 * (`src/lib/ai/provider-registry.ts`) so Integrations and Fusion never diverge.
 * Non-AI integrations (github, mcp) are defined inline. Safe to import from both
 * server (API routes) and client (page) — no secrets, no Node-only imports.
 */
import { z } from "zod";
import { AI_PROVIDER_REGISTRY, type AiProviderEntry } from "@/lib/ai/provider-registry";

/** All connectable providers = AI registry ids + non-AI integrations. */
export const SUPPORTED_PROVIDERS = [
  ...AI_PROVIDER_REGISTRY.map((p) => p.id),
  "github",
  "mcp",
] as const;

export type ProviderId = string;

export function isSupportedProvider(value: string): value is ProviderId {
  return (SUPPORTED_PROVIDERS as readonly string[]).includes(value);
}

/* -------------------------------------------------------------------------- */
/* Config schemas                                                             */
/* -------------------------------------------------------------------------- */

function aiConfigSchema(e: AiProviderEntry): z.ZodTypeAny {
  const shape: Record<string, z.ZodTypeAny> = {};
  if (e.requiresKey) shape.apiKey = z.string().trim().min(1, "API key is required");
  shape.baseUrl = e.baseUrlRequired
    ? z.string().trim().url("Must be a valid URL")
    : z.string().trim().url("Must be a valid URL").optional();
  shape.model = z.string().trim().min(1).max(120).optional();
  return z.object(shape);
}

const githubConfigSchema = z.object({ token: z.string().trim().min(1, "Token is required") });
const mcpConfigSchema = z.object({
  url: z.string().trim().url("Must be a valid URL"),
  apiKey: z.string().trim().min(1).optional(),
});

export const PROVIDER_CONFIG_SCHEMAS: Record<string, z.ZodTypeAny> = {
  ...Object.fromEntries(AI_PROVIDER_REGISTRY.map((e) => [e.id, aiConfigSchema(e)])),
  github: githubConfigSchema,
  mcp: mcpConfigSchema,
};

export const PROVIDER_SECRET_FIELDS: Record<string, readonly string[]> = {
  ...Object.fromEntries(AI_PROVIDER_REGISTRY.map((e) => [e.id, e.requiresKey ? ["apiKey"] : []])),
  github: ["token"],
  mcp: ["apiKey"],
};

/** Validate a config object for a given provider. Throws ZodError on failure. */
export function parseProviderConfig(provider: string, config: unknown): Record<string, unknown> {
  const schema = PROVIDER_CONFIG_SCHEMAS[provider];
  if (!schema) throw new Error(`Unsupported provider: ${provider}`);
  return schema.parse(config) as Record<string, unknown>;
}

/* -------------------------------------------------------------------------- */
/* Display metadata (shared with the UI)                                      */
/* -------------------------------------------------------------------------- */

export type ConfigFieldType = "text" | "password" | "url";

export type ProviderField = {
  key: string;
  label: string;
  type: ConfigFieldType;
  required: boolean;
  placeholder?: string;
  secret: boolean;
};

export type ProviderMeta = {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  color?: string;
  website?: string;
  apiKeyUrl?: string;
  fields: ProviderField[];
};

function aiFields(e: AiProviderEntry): ProviderField[] {
  const fields: ProviderField[] = [];
  if (e.requiresKey) {
    fields.push({ key: "apiKey", label: "API Key", type: "password", required: true, placeholder: "sk-…", secret: true });
  }
  fields.push({
    key: "baseUrl",
    label: e.baseUrlRequired ? "Base URL" : "Base URL (optional)",
    type: "url",
    required: !!e.baseUrlRequired,
    placeholder: e.transport.baseUrl || "https://…/v1",
    secret: false,
  });
  fields.push({ key: "model", label: "Default Model (optional)", type: "text", required: false, placeholder: "e.g. gpt-4o-mini", secret: false });
  return fields;
}

const AI_CATALOG: ProviderMeta[] = AI_PROVIDER_REGISTRY.map((e) => ({
  id: e.id,
  name: e.name,
  description: e.local
    ? `Local ${e.name} runtime — no API key needed.`
    : `Connect ${e.name}. Powers Teskel chat, agents and Fusion.`,
  category: e.category,
  icon: e.display.textIcon,
  color: e.display.color,
  website: e.display.website || undefined,
  apiKeyUrl: e.display.apiKeyUrl,
  fields: aiFields(e),
}));

export const PROVIDER_CATALOG: ProviderMeta[] = [
  ...AI_CATALOG,
  {
    id: "github",
    name: "GitHub",
    description: "Connect repositories, create PRs, manage issues.",
    category: "Tools",
    icon: "GH",
    website: "https://github.com",
    fields: [{ key: "token", label: "Personal Access Token", type: "password", required: true, placeholder: "ghp_…", secret: true }],
  },
  {
    id: "mcp",
    name: "MCP Server",
    description: "Connect a Model Context Protocol server to extend tools.",
    category: "Tools",
    icon: "MC",
    fields: [
      { key: "url", label: "Server URL", type: "url", required: true, placeholder: "https://my-mcp-server.example.com", secret: false },
      { key: "apiKey", label: "API Key (optional)", type: "password", required: false, placeholder: "optional", secret: true },
    ],
  },
];

/** "Coming soon" providers shown in the UI but not yet connectable. */
export const COMING_SOON_PROVIDERS: Array<{ id: string; name: string; description: string; category: string; icon: string }> = [
  { id: "gitlab", name: "GitLab", description: "CI/CD pipelines, merge requests, repositories", category: "Tools", icon: "GL" },
  { id: "linear", name: "Linear", description: "Issue tracking, project management, sprints", category: "Tools", icon: "LN" },
  { id: "slack", name: "Slack", description: "Send messages, receive notifications, search channels", category: "Tools", icon: "SL" },
  { id: "notion", name: "Notion", description: "Read docs, create pages, sync knowledge base", category: "Tools", icon: "NT" },
];
