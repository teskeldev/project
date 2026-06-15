/**
 * Typed client for the simplified Fusion API. Thin wrappers over `apiFetch`
 * (which unwraps `{ success, data }` and throws on error).
 */
import { apiFetch } from "@/lib/client/api";

const qs = (workspaceId: string, extra?: Record<string, string>) =>
  "?" + new URLSearchParams({ workspaceId, ...(extra ?? {}) }).toString();

function send<T>(path: string, method: string, body: unknown): Promise<T> {
  return apiFetch<T>(path, { method, body: JSON.stringify(body) });
}

/* ------------------------------- types ------------------------------------ */

export type AvailableModel = {
  ref: string;
  provider: string;
  providerLabel: string;
  modelId: string;
  name: string;
  contextWindow: number;
};

export type RoutingRow = { id: string; name: string; strategy: string; config: { steps?: string[]; maxFanout?: number } };
export type JudgeRow = { id: string; name: string; mode: string; judgeModelId: string | null; config: Record<string, unknown> };

export type OverviewData = {
  stats: {
    providers: number; models: number; routings: number; judges: number;
    dailyRequests: number; tokenUsage: number; dailyCost: number; avgLatencyMs: number; successRate: number;
  };
  recent: Array<{ id: string; provider: string; modelId: string | null; success: boolean; latencyMs: number; costUsd: number; createdAt: string; error: string | null }>;
};

export type ModelRun = {
  ref: string; provider: string; modelId: string; ok: boolean; response: string;
  latencyMs: number; tokensIn: number; tokensOut: number; error?: string;
};
export type PlaygroundResult = {
  runs: ModelRun[]; fused: string; judgeMode: string; judgeModel: string; durationMs: number;
};

/* ------------------------------- endpoints -------------------------------- */

export const fusionApi = {
  overview: (ws: string) => apiFetch<OverviewData>(`/api/fusion/overview${qs(ws)}`),

  // read-only model registry (sourced from Integrations)
  listModels: (ws: string) => apiFetch<{ models: AvailableModel[] }>(`/api/fusion/models${qs(ws)}`),

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

  // playground
  playground: (ws: string, body: { prompt: string; modelRefs: string[]; strategy?: string; judgeMode?: string; judgeModel?: string }) =>
    send<{ result: PlaygroundResult }>("/api/fusion/playground", "POST", { workspaceId: ws, ...body }),
};
