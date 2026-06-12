/**
 * Integration provider catalog + config schemas (Phase 7c).
 *
 * This is a LOCAL schema module for the integrations feature; it is intentionally
 * NOT appended to the shared `src/lib/validators.ts`. It is safe to import from
 * both server (API routes) and client (page) code — it contains no secrets and
 * no Node-only imports.
 *
 * Supported providers store an encrypted config blob whose shape is defined by
 * the per-provider zod schemas below.
 */
import { z } from "zod";

/** Providers that are fully wired in this phase. */
export const SUPPORTED_PROVIDERS = [
  "openai",
  "anthropic",
  "github",
  "mcp",
] as const;

export type ProviderId = (typeof SUPPORTED_PROVIDERS)[number];

export function isSupportedProvider(value: string): value is ProviderId {
  return (SUPPORTED_PROVIDERS as readonly string[]).includes(value);
}

/* -------------------------------------------------------------------------- */
/* Per-provider config schemas                                                */
/* -------------------------------------------------------------------------- */

const openaiConfigSchema = z.object({
  apiKey: z.string().trim().min(1, "API key is required"),
  baseUrl: z.string().trim().url("Must be a valid URL").optional(),
  model: z.string().trim().min(1).max(120).optional(),
});

const anthropicConfigSchema = z.object({
  apiKey: z.string().trim().min(1, "API key is required"),
  baseUrl: z.string().trim().url("Must be a valid URL").optional(),
  model: z.string().trim().min(1).max(120).optional(),
});

const githubConfigSchema = z.object({
  token: z.string().trim().min(1, "Token is required"),
});

const mcpConfigSchema = z.object({
  url: z.string().trim().url("Must be a valid URL"),
  apiKey: z.string().trim().min(1).optional(),
});

/** Maps a provider id to its config schema. */
export const PROVIDER_CONFIG_SCHEMAS: Record<ProviderId, z.ZodTypeAny> = {
  openai: openaiConfigSchema,
  anthropic: anthropicConfigSchema,
  github: githubConfigSchema,
  mcp: mcpConfigSchema,
};

/**
 * Which config keys hold a secret (must be masked / never returned) vs a
 * non-secret hint that is safe to echo back to the client.
 */
export const PROVIDER_SECRET_FIELDS: Record<ProviderId, readonly string[]> = {
  openai: ["apiKey"],
  anthropic: ["apiKey"],
  github: ["token"],
  mcp: ["apiKey"],
};

/** Validate a config object for a given provider. Throws ZodError on failure. */
export function parseProviderConfig(
  provider: ProviderId,
  config: unknown
): Record<string, unknown> {
  const schema = PROVIDER_CONFIG_SCHEMAS[provider];
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
  id: ProviderId;
  name: string;
  description: string;
  category: string;
  icon: string;
  fields: ProviderField[];
};

export const PROVIDER_CATALOG: ProviderMeta[] = [
  {
    id: "openai",
    name: "OpenAI",
    description:
      "OpenAI-compatible chat models. Powers Teskel's AI chat and agents.",
    category: "AI Providers",
    icon: "AI",
    fields: [
      {
        key: "apiKey",
        label: "API Key",
        type: "password",
        required: true,
        placeholder: "sk-...",
        secret: true,
      },
      {
        key: "baseUrl",
        label: "Base URL",
        type: "url",
        required: false,
        placeholder: "https://api.openai.com/v1",
        secret: false,
      },
      {
        key: "model",
        label: "Default Model",
        type: "text",
        required: false,
        placeholder: "gpt-4o-mini",
        secret: false,
      },
    ],
  },
  {
    id: "anthropic",
    name: "Anthropic",
    description: "Claude models via the Anthropic API.",
    category: "AI Providers",
    icon: "AN",
    fields: [
      {
        key: "apiKey",
        label: "API Key",
        type: "password",
        required: true,
        placeholder: "sk-ant-...",
        secret: true,
      },
      {
        key: "baseUrl",
        label: "Base URL",
        type: "url",
        required: false,
        placeholder: "https://api.anthropic.com",
        secret: false,
      },
      {
        key: "model",
        label: "Default Model",
        type: "text",
        required: false,
        placeholder: "claude-3-5-sonnet-latest",
        secret: false,
      },
    ],
  },
  {
    id: "github",
    name: "GitHub",
    description: "Connect repositories, create PRs, manage issues.",
    category: "Version Control",
    icon: "GH",
    fields: [
      {
        key: "token",
        label: "Personal Access Token",
        type: "password",
        required: true,
        placeholder: "ghp_...",
        secret: true,
      },
    ],
  },
  {
    id: "mcp",
    name: "MCP Server",
    description: "Connect a Model Context Protocol server to extend tools.",
    category: "MCP",
    icon: "MC",
    fields: [
      {
        key: "url",
        label: "Server URL",
        type: "url",
        required: true,
        placeholder: "https://my-mcp-server.example.com",
        secret: false,
      },
      {
        key: "apiKey",
        label: "API Key (optional)",
        type: "password",
        required: false,
        placeholder: "optional",
        secret: true,
      },
    ],
  },
];

/** "Coming soon" providers shown in the UI but not yet connectable. */
export const COMING_SOON_PROVIDERS: Array<{
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
}> = [
  { id: "gitlab", name: "GitLab", description: "CI/CD pipelines, merge requests, repositories", category: "Version Control", icon: "GL" },
  { id: "linear", name: "Linear", description: "Issue tracking, project management, sprints", category: "Project Management", icon: "LN" },
  { id: "jira", name: "Jira", description: "Agile boards, epics, sprints, backlog management", category: "Project Management", icon: "JR" },
  { id: "slack", name: "Slack", description: "Send messages, receive notifications, search channels", category: "Communication", icon: "SL" },
  { id: "vercel", name: "Vercel", description: "Deploy previews, production deployments, analytics", category: "Deployment", icon: "VC" },
  { id: "sentry", name: "Sentry", description: "Error tracking, performance monitoring, alerts", category: "Monitoring", icon: "SN" },
  { id: "notion", name: "Notion", description: "Read docs, create pages, sync knowledge base", category: "Documentation", icon: "NT" },
];