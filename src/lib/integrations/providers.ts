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
import { OAUTH_PROVIDER_IDS, OAUTH_PROVIDER_CONFIGS } from "@/lib/integrations/oauth-configs";

/** All connectable providers = AI registry ids + OAuth AI + non-AI integrations. */
export const SUPPORTED_PROVIDERS = [
  ...AI_PROVIDER_REGISTRY.map((p) => p.id),
  ...OAUTH_PROVIDER_IDS,
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

// OAuth providers store tokens (set server-side via callback/poll routes, not by users directly)
const oauthConfigSchema = z.object({
  accessToken: z.string().min(1, "Access token is required"),
  refreshToken: z.string().optional(),
  expiresAt: z.number().optional(),
  scope: z.string().optional(),
  email: z.string().optional(),
  copilotToken: z.string().optional(),
});

export const PROVIDER_CONFIG_SCHEMAS: Record<string, z.ZodTypeAny> = {
  ...Object.fromEntries(AI_PROVIDER_REGISTRY.map((e) => [e.id, aiConfigSchema(e)])),
  ...Object.fromEntries(OAUTH_PROVIDER_IDS.map((id) => [id, oauthConfigSchema])),
  github: githubConfigSchema,
  mcp: mcpConfigSchema,
};

export const PROVIDER_SECRET_FIELDS: Record<string, readonly string[]> = {
  ...Object.fromEntries(AI_PROVIDER_REGISTRY.map((e) => [e.id, e.requiresKey ? ["apiKey"] : []])),
  ...Object.fromEntries(OAUTH_PROVIDER_IDS.map((id) => [id, ["accessToken", "refreshToken", "copilotToken"]])),
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
  /** OAuth providers skip the API key form and use OAuthModal instead. */
  authType?: "oauth";
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

const OAUTH_CATALOG: ProviderMeta[] = OAUTH_PROVIDER_IDS.map((id) => {
  const cfg = OAUTH_PROVIDER_CONFIGS[id];
  return {
    id: cfg.id,
    name: cfg.name,
    description: cfg.description,
    category: "OAuth AI",
    icon: cfg.icon,
    color: cfg.color,
    fields: [],
    authType: "oauth" as const,
  };
});

export const PROVIDER_CATALOG: ProviderMeta[] = [
  ...AI_CATALOG,
  ...OAUTH_CATALOG,
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

export type ComingSoonProvider = {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  color?: string;
  authType?: "oauth" | "cookie" | "free";
};

/** "Coming soon" providers — remaining OAuth AI providers + tool integrations. */
export const COMING_SOON_PROVIDERS: ComingSoonProvider[] = [
  // OAuth AI providers not yet implemented (claude-code, github-copilot, kilocode are live)
  { id: "cursor",     name: "Cursor IDE",  description: "Use your Cursor Pro subscription as an AI provider via OAuth.", category: "OAuth AI", icon: "CU", color: "#00D4AA", authType: "oauth" },
  { id: "cline",      name: "Cline",       description: "Connect Cline bot via OAuth for AI-assisted coding.",           category: "OAuth AI", icon: "CL", color: "#5B9BD5", authType: "oauth" },
  { id: "gemini-cli", name: "Gemini CLI",  description: "Free Gemini access via Google Cloud OAuth (no billing).",       category: "OAuth AI", icon: "GC", color: "#4285F4", authType: "oauth" },
  // Tool integrations
  { id: "gitlab",  name: "GitLab",  description: "CI/CD pipelines, merge requests, repositories.", category: "Tools", icon: "GL", color: "#FC6D26" },
  { id: "linear",  name: "Linear",  description: "Issue tracking, project management, sprints.",   category: "Tools", icon: "LN", color: "#5E6AD2" },
  { id: "slack",   name: "Slack",   description: "Send messages, receive notifications, search channels.", category: "Tools", icon: "SL", color: "#4A154B" },
  { id: "notion",  name: "Notion",  description: "Read docs, create pages, sync knowledge base.",  category: "Tools", icon: "NT", color: "#000000" },
];
