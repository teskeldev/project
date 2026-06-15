/**
 * Zod schemas for Fusion hub resource APIs. Shapes line up with the store input
 * types so the CRUD route factories wire through cleanly.
 */
import { z } from "zod";
import { PROVIDER_CATALOG, MCP_KINDS, ROUTING_STRATEGIES, JUDGE_MODES } from "./catalog";

const PROVIDER_KINDS = PROVIDER_CATALOG.map((p) => p.kind) as [string, ...string[]];

export const workspaceOnly = z.object({ workspaceId: z.string().min(1) });

/* Providers */
export const providerCreate = z.object({
  workspaceId: z.string().min(1),
  kind: z.enum(PROVIDER_KINDS),
  name: z.string().min(1).max(80),
  baseUrl: z.string().url().max(300).optional(),
  integrationId: z.string().max(60).optional(),
  enabled: z.boolean().optional(),
});
export const providerUpdate = z.object({
  workspaceId: z.string().min(1),
  kind: z.enum(PROVIDER_KINDS).optional(),
  name: z.string().min(1).max(80).optional(),
  baseUrl: z.string().url().max(300).nullable().optional(),
  integrationId: z.string().max(60).nullable().optional(),
  enabled: z.boolean().optional(),
});

/* Models */
const pricing = z.object({ input: z.number().min(0), output: z.number().min(0) });
const capabilities = z.object({
  reasoning: z.boolean(),
  vision: z.boolean(),
  tools: z.boolean(),
  structuredOutput: z.boolean(),
  jsonMode: z.boolean(),
});
export const modelCreate = z.object({
  workspaceId: z.string().min(1),
  providerId: z.string().min(1),
  name: z.string().min(1).max(120),
  modelId: z.string().min(1).max(120),
  contextWindow: z.number().int().min(0).optional(),
  pricing,
  capabilities,
  enabled: z.boolean().optional(),
});
export const modelUpdate = z.object({
  workspaceId: z.string().min(1),
  name: z.string().min(1).max(120).optional(),
  modelId: z.string().min(1).max(120).optional(),
  contextWindow: z.number().int().min(0).optional(),
  pricing: pricing.optional(),
  capabilities: capabilities.optional(),
  enabled: z.boolean().optional(),
});

/* Teams */
export const teamCreate = z.object({
  workspaceId: z.string().min(1),
  name: z.string().min(1).max(80),
  description: z.string().max(300).optional(),
  modelIds: z.array(z.string()).max(20),
});
export const teamUpdate = z.object({
  workspaceId: z.string().min(1),
  name: z.string().min(1).max(80).optional(),
  description: z.string().max(300).nullable().optional(),
  modelIds: z.array(z.string()).max(20).optional(),
});

/* Routing */
export const routingCreate = z.object({
  workspaceId: z.string().min(1),
  name: z.string().min(1).max(80),
  strategy: z.enum(ROUTING_STRATEGIES),
  config: z.unknown().default({}),
});
export const routingUpdate = z.object({
  workspaceId: z.string().min(1),
  name: z.string().min(1).max(80).optional(),
  strategy: z.enum(ROUTING_STRATEGIES).optional(),
  config: z.unknown().optional(),
});

/* Judges */
export const judgeCreate = z.object({
  workspaceId: z.string().min(1),
  name: z.string().min(1).max(80),
  mode: z.enum(JUDGE_MODES),
  judgeModelId: z.string().max(120).optional(),
  config: z.unknown().default({}),
});
export const judgeUpdate = z.object({
  workspaceId: z.string().min(1),
  name: z.string().min(1).max(80).optional(),
  mode: z.enum(JUDGE_MODES).optional(),
  judgeModelId: z.string().max(120).nullable().optional(),
  config: z.unknown().optional(),
});

/* MCP */
export const mcpCreate = z.object({
  workspaceId: z.string().min(1),
  name: z.string().min(1).max(80),
  kind: z.enum(MCP_KINDS),
  url: z.string().url().max(300).optional(),
  command: z.string().max(300).optional(),
  enabled: z.boolean().optional(),
});
export const mcpUpdate = z.object({
  workspaceId: z.string().min(1),
  name: z.string().min(1).max(80).optional(),
  kind: z.enum(MCP_KINDS).optional(),
  url: z.string().url().max(300).nullable().optional(),
  command: z.string().max(300).nullable().optional(),
  enabled: z.boolean().optional(),
});

/* Workflows */
export const workflowCreate = z.object({
  workspaceId: z.string().min(1),
  name: z.string().min(1).max(80),
  graph: z.unknown().default({ nodes: [], edges: [] }),
  enabled: z.boolean().optional(),
});
export const workflowUpdate = z.object({
  workspaceId: z.string().min(1),
  name: z.string().min(1).max(80).optional(),
  graph: z.unknown().optional(),
  enabled: z.boolean().optional(),
});
