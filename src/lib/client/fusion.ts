/**
 * Typed client for the Fusion (AI Team Builder) API.
 */
import { apiFetch } from "@/lib/client/api";
import { readSSEStream } from "@/lib/client/sse";

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
  runs: FusionModelRun[]; fused: string; mergeRationale?: string; judgeUsed: string; warnings: string[];
  metrics: { tokens: number; costUsd: number; latencyMs: number; executionMs: number };
};

export type FusionProgress =
  | { type: "model_start"; ref: string; modelId: string }
  | { type: "model_done"; ref: string; modelId: string; ok: boolean; latencyMs: number }
  | { type: "judging" };

export type PlaygroundCallbacks = {
  onProgress?: (ev: FusionProgress) => void;
  onResult: (result: FusionRunResult) => void;
  onError: (message: string) => void;
};

/** Stream a Fusion run (live per-model progress + judging, then the result). */
export async function runPlaygroundStream(
  workspaceId: string,
  fusionId: string,
  prompt: string,
  callbacks: PlaygroundCallbacks,
  signal?: AbortSignal
): Promise<void> {
  let res: Response;
  try {
    res = await fetch("/api/fusion/playground", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId, fusionId, prompt }),
      signal,
    });
  } catch (err) {
    if (signal?.aborted) return;
    callbacks.onError(err instanceof Error ? err.message : "Network error");
    return;
  }
  if (!res.ok || !res.headers.get("content-type")?.includes("text/event-stream") || !res.body) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.error?.message) message = body.error.message;
    } catch {
      /* keep default */
    }
    callbacks.onError(message);
    return;
  }
  try {
    for await (const frame of readSSEStream(res)) {
      let data: Record<string, unknown> = {};
      try {
        data = frame.data ? JSON.parse(frame.data) : {};
      } catch {
        data = {};
      }
      if (frame.event === "model_start" || frame.event === "model_done" || frame.event === "judging") {
        callbacks.onProgress?.(data as unknown as FusionProgress);
      } else if (frame.event === "result") {
        callbacks.onResult((data as { result: FusionRunResult }).result);
      } else if (frame.event === "error") {
        callbacks.onError(typeof data.message === "string" ? data.message : "Fusion run failed");
        return;
      }
    }
  } catch (err) {
    if (!signal?.aborted) callbacks.onError(err instanceof Error ? err.message : "Stream read failed");
  }
}

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
};
