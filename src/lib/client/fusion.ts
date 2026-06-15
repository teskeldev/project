/**
 * Typed client for the Fusion (AI Team Builder) API.
 */
import { apiFetch } from "@/lib/client/api";

const qs = (workspaceId: string, extra?: Record<string, string>) =>
  "?" + new URLSearchParams({ workspaceId, ...(extra ?? {}) }).toString();

function send<T>(path: string, method: string, body: unknown): Promise<T> {
  return apiFetch<T>(path, { method, body: JSON.stringify(body) });
}

export type AvailableModel = {
  ref: string; provider: string; providerLabel: string; modelId: string; name: string; contextWindow: number;
};

export type FusionLimits = { maxCostUsd: number; maxTokens: number; timeoutMs: number };

export type Fusion = {
  id: string;
  name: string;
  description: string | null;
  modelIds: string[];
  skillIds: string[];
  ruleIds: string[];
  knowledgeIds: string[];
  strategy: string;
  judge: string;
  judgeModelId: string | null;
  limits: FusionLimits;
  status: string;
  updatedAt: string;
};

export type FusionTemplate = {
  id: string; name: string; description: string; providers: string[]; skillSlugs: string[]; strategy: string; judge: string;
};

export type FusionModelRun = {
  ref: string; provider: string; modelId: string; ok: boolean; response: string;
  latencyMs: number; tokensIn: number; tokensOut: number; error?: string;
};
export type FusionRunResult = {
  runs: FusionModelRun[]; fused: string; judgeUsed: string; warnings: string[];
  metrics: { tokens: number; costUsd: number; latencyMs: number; executionMs: number };
};

export const fusionApi = {
  listModels: (ws: string) => apiFetch<{ models: AvailableModel[] }>(`/api/fusion/models${qs(ws)}`),

  listFusions: (ws: string, includeArchived = false) =>
    apiFetch<{ fusions: Fusion[] }>(`/api/fusion/fusions${qs(ws, includeArchived ? { includeArchived: "true" } : undefined)}`),
  getFusion: (ws: string, id: string) => apiFetch<{ fusion: Fusion }>(`/api/fusion/fusions/${id}${qs(ws)}`),
  createFusion: (ws: string, b: Record<string, unknown>) => send<{ fusion: Fusion }>("/api/fusion/fusions", "POST", { workspaceId: ws, ...b }),
  updateFusion: (ws: string, id: string, b: Record<string, unknown>) => send<{ fusion: Fusion }>(`/api/fusion/fusions/${id}`, "PATCH", { workspaceId: ws, ...b }),
  deleteFusion: (ws: string, id: string) => send<{ deleted: boolean }>(`/api/fusion/fusions/${id}`, "DELETE", { workspaceId: ws }),
  duplicateFusion: (ws: string, id: string) => send<{ fusion: Fusion }>(`/api/fusion/fusions/${id}/duplicate`, "POST", { workspaceId: ws }),

  listTemplates: () => apiFetch<{ templates: FusionTemplate[] }>("/api/fusion/templates"),
  useTemplate: (ws: string, id: string) => send<{ fusion: Fusion; warnings: string[] }>(`/api/fusion/templates/${id}/use`, "POST", { workspaceId: ws }),

  runPlayground: (ws: string, fusionId: string, prompt: string) =>
    send<{ result: FusionRunResult }>("/api/fusion/playground", "POST", { workspaceId: ws, fusionId, prompt }),
};
