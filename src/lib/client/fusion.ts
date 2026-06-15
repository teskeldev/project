/**
 * Typed client for the Fusion Orchestration Hub API. Thin wrappers over
 * `apiFetch` (which unwraps `{ success, data }` and throws on error).
 */
import { apiFetch } from "@/lib/client/api";

const qs = (workspaceId: string, extra?: Record<string, string>) =>
  "?" + new URLSearchParams({ workspaceId, ...(extra ?? {}) }).toString();

function send<T>(path: string, method: string, body: unknown): Promise<T> {
  return apiFetch<T>(path, { method, body: JSON.stringify(body) });
}

/* ------------------------------ shared types ------------------------------ */

export type ProviderRow = {
  id: string;
  kind: string;
  name: string;
  baseUrl: string | null;
  enabled: boolean;
  lastStatus: string | null;
  lastLatencyMs: number | null;
  lastCheckedAt: string | null;
  _count?: { models: number };
};

export type ModelRow = {
  id: string;
  providerId: string;
  name: string;
  modelId: string;
  contextWindow: number;
  pricing: { input: number; output: number };
  capabilities: Record<string, boolean>;
  enabled: boolean;
  provider?: { id: string; name: string; kind: string };
};

export type TeamRow = { id: string; name: string; description: string | null; modelIds: string[] };
export type RoutingRow = { id: string; name: string; strategy: string; config: Record<string, unknown> };
export type JudgeRow = { id: string; name: string; mode: string; judgeModelId: string | null; config: Record<string, unknown> };
export type McpRow = { id: string; name: string; kind: string; url: string | null; command: string | null; enabled: boolean; lastStatus: string | null };
export type WorkflowRow = { id: string; name: string; graph: { nodes: unknown[]; edges: unknown[] }; enabled: boolean };

export type HealthResult = { status: string; latencyMs: number; detail?: string };

export type OverviewData = {
  stats: {
    providers: number; activeProviders: number; models: number; activeModels: number;
    teams: number; profiles: number; workflows: number; mcpServers: number; activeMcp: number;
    skills: number; dailyRequests: number; monthlyCost: number; tokenUsage: number;
    avgLatencyMs: number; successRate: number;
  };
  recent: Array<{ id: string; provider: string; modelId: string | null; success: boolean; latencyMs: number; costUsd: number; createdAt: string; error: string | null }>;
};

export type AnalyticsData = {
  range: string;
  totals: { requests: number; cost: number; avgLatency: number; errorRate: number };
  timeline: Array<{ bucket: string; requests: number; cost: number; avgLatency: number; errorRate: number }>;
  byProvider: Array<{ name: string; value: number }>;
  byModel: Array<{ name: string; value: number }>;
};

export type CompareResult = {
  modelId: string; label: string; provider: string; response: string; ok: boolean;
  latencyMs: number; tokensIn: number; tokensOut: number; costUsd: number; qualityScore: number; error?: string;
};

export type ProfileRow = {
  id: string;
  name: string;
  isDefault: boolean;
  panelSlug: string;
  skillSlugs: string[];
  systemPrompt: string | null;
  teamId: string | null;
  routingId: string | null;
  judgeId: string | null;
};

export type FusionSettingsRow = {
  id: string;
  defaults: Record<string, string | null>;
  featureFlags: Record<string, boolean>;
};

/* ------------------------------- endpoints -------------------------------- */

export const fusionApi = {
  overview: (ws: string) => apiFetch<OverviewData>(`/api/fusion/overview${qs(ws)}`),
  analytics: (ws: string, range: string) => apiFetch<AnalyticsData>(`/api/fusion/analytics${qs(ws, { range })}`),

  // providers
  listProviders: (ws: string) => apiFetch<{ providers: ProviderRow[] }>(`/api/fusion/providers${qs(ws)}`),
  createProvider: (ws: string, b: Partial<ProviderRow> & { kind: string; name: string }) =>
    send<{ item: ProviderRow }>("/api/fusion/providers", "POST", { workspaceId: ws, ...b }),
  updateProvider: (ws: string, id: string, b: Partial<ProviderRow>) =>
    send<{ item: ProviderRow }>(`/api/fusion/providers/${id}`, "PATCH", { workspaceId: ws, ...b }),
  deleteProvider: (ws: string, id: string) => send<{ deleted: boolean }>(`/api/fusion/providers/${id}`, "DELETE", { workspaceId: ws }),
  testProvider: (ws: string, id: string) => send<{ result: HealthResult }>(`/api/fusion/providers/${id}/test`, "POST", { workspaceId: ws }),

  // models
  listModels: (ws: string) => apiFetch<{ models: ModelRow[] }>(`/api/fusion/models${qs(ws)}`),
  createModel: (ws: string, b: Record<string, unknown>) => send<{ item: ModelRow }>("/api/fusion/models", "POST", { workspaceId: ws, ...b }),
  updateModel: (ws: string, id: string, b: Record<string, unknown>) => send<{ item: ModelRow }>(`/api/fusion/models/${id}`, "PATCH", { workspaceId: ws, ...b }),
  deleteModel: (ws: string, id: string) => send<{ deleted: boolean }>(`/api/fusion/models/${id}`, "DELETE", { workspaceId: ws }),
  testModel: (ws: string, id: string, prompt?: string) => send<{ ok: boolean; latencyMs: number; sample?: string; error?: string }>(`/api/fusion/models/${id}/test`, "POST", { workspaceId: ws, prompt }),

  // teams
  listTeams: (ws: string) => apiFetch<{ teams: TeamRow[] }>(`/api/fusion/teams${qs(ws)}`),
  createTeam: (ws: string, b: Record<string, unknown>) => send<{ item: TeamRow }>("/api/fusion/teams", "POST", { workspaceId: ws, ...b }),
  updateTeam: (ws: string, id: string, b: Record<string, unknown>) => send<{ item: TeamRow }>(`/api/fusion/teams/${id}`, "PATCH", { workspaceId: ws, ...b }),
  deleteTeam: (ws: string, id: string) => send<{ deleted: boolean }>(`/api/fusion/teams/${id}`, "DELETE", { workspaceId: ws }),

  // routing
  listRoutings: (ws: string) => apiFetch<{ routings: RoutingRow[] }>(`/api/fusion/routing${qs(ws)}`),
  createRouting: (ws: string, b: Record<string, unknown>) => send<{ item: RoutingRow }>("/api/fusion/routing", "POST", { workspaceId: ws, ...b }),
  updateRouting: (ws: string, id: string, b: Record<string, unknown>) => send<{ item: RoutingRow }>(`/api/fusion/routing/${id}`, "PATCH", { workspaceId: ws, ...b }),
  deleteRouting: (ws: string, id: string) => send<{ deleted: boolean }>(`/api/fusion/routing/${id}`, "DELETE", { workspaceId: ws }),

  // judges
  listJudges: (ws: string) => apiFetch<{ judges: JudgeRow[] }>(`/api/fusion/judges${qs(ws)}`),
  createJudge: (ws: string, b: Record<string, unknown>) => send<{ item: JudgeRow }>("/api/fusion/judges", "POST", { workspaceId: ws, ...b }),
  updateJudge: (ws: string, id: string, b: Record<string, unknown>) => send<{ item: JudgeRow }>(`/api/fusion/judges/${id}`, "PATCH", { workspaceId: ws, ...b }),
  deleteJudge: (ws: string, id: string) => send<{ deleted: boolean }>(`/api/fusion/judges/${id}`, "DELETE", { workspaceId: ws }),

  // mcp
  listMcp: (ws: string) => apiFetch<{ servers: McpRow[] }>(`/api/fusion/mcp${qs(ws)}`),
  createMcp: (ws: string, b: Record<string, unknown>) => send<{ item: McpRow }>("/api/fusion/mcp", "POST", { workspaceId: ws, ...b }),
  updateMcp: (ws: string, id: string, b: Record<string, unknown>) => send<{ item: McpRow }>(`/api/fusion/mcp/${id}`, "PATCH", { workspaceId: ws, ...b }),
  deleteMcp: (ws: string, id: string) => send<{ deleted: boolean }>(`/api/fusion/mcp/${id}`, "DELETE", { workspaceId: ws }),
  healthMcp: (ws: string, id: string) => send<{ result: HealthResult }>(`/api/fusion/mcp/${id}/health`, "POST", { workspaceId: ws }),

  // workflows
  listWorkflows: (ws: string) => apiFetch<{ workflows: WorkflowRow[] }>(`/api/fusion/workflows${qs(ws)}`),
  createWorkflow: (ws: string, b: Record<string, unknown>) => send<{ item: WorkflowRow }>("/api/fusion/workflows", "POST", { workspaceId: ws, ...b }),
  updateWorkflow: (ws: string, id: string, b: Record<string, unknown>) => send<{ item: WorkflowRow }>(`/api/fusion/workflows/${id}`, "PATCH", { workspaceId: ws, ...b }),
  deleteWorkflow: (ws: string, id: string) => send<{ deleted: boolean }>(`/api/fusion/workflows/${id}`, "DELETE", { workspaceId: ws }),

  // profiles
  listProfiles: (ws: string) => apiFetch<{ profiles: ProfileRow[] }>(`/api/fusion/profiles${qs(ws)}`),
  createProfile: (ws: string, b: Record<string, unknown>) => send<{ profile: ProfileRow }>("/api/fusion/profiles", "POST", { workspaceId: ws, ...b }),
  updateProfile: (ws: string, id: string, b: Record<string, unknown>) => send<{ profile: ProfileRow }>(`/api/fusion/profiles/${id}`, "PATCH", { workspaceId: ws, ...b }),
  deleteProfile: (ws: string, id: string) => send<{ deleted: boolean }>(`/api/fusion/profiles/${id}`, "DELETE", { workspaceId: ws }),

  // compare + settings
  compare: (ws: string, prompt: string, modelIds: string[]) => send<{ results: CompareResult[] }>("/api/fusion/compare", "POST", { workspaceId: ws, prompt, modelIds }),
  getSettings: (ws: string) => apiFetch<{ settings: FusionSettingsRow }>(`/api/fusion/settings${qs(ws)}`),
  updateSettings: (ws: string, b: { defaults?: Record<string, unknown>; featureFlags?: Record<string, unknown> }) =>
    send<{ settings: FusionSettingsRow }>("/api/fusion/settings", "PATCH", { workspaceId: ws, ...b }),
};
