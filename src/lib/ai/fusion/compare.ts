/**
 * Compare — run one prompt across multiple registered models in parallel,
 * collecting speed / tokens / cost / a quick quality heuristic. SERVER-ONLY.
 */
import { prisma } from "@/lib/db";
import { chat } from "@/lib/ai/provider";
import { getProviderCatalog, type ModelPricing } from "./catalog";
import { recordFusionRequest } from "./logging";

export type CompareResult = {
  modelId: string;
  label: string;
  provider: string;
  response: string;
  ok: boolean;
  latencyMs: number;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
  qualityScore: number;
  error?: string;
};

const CHARS_PER_TOKEN = 4;

/** Rough token estimate when the provider doesn't return usage. */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/** Lightweight, provider-agnostic quality heuristic (length + structure). */
function qualityHeuristic(text: string): number {
  if (!text.trim()) return 0;
  const len = Math.min(text.length / 1500, 1); // rewards substantive answers up to a point
  const structured = /[\n\-*#`]|\d\./.test(text) ? 0.2 : 0;
  return Math.round(Math.min(1, 0.5 * len + 0.3 + structured) * 100) / 100;
}

export async function compareModels(
  workspaceId: string,
  prompt: string,
  fusionModelIds: string[]
): Promise<CompareResult[]> {
  const models = await prisma.fusionModel.findMany({
    where: { workspaceId, id: { in: fusionModelIds } },
    include: { provider: true },
  });

  return Promise.all(
    models.map(async (m): Promise<CompareResult> => {
      const pricing = (m.pricing as ModelPricing) ?? { input: 0, output: 0 };
      const catalog = getProviderCatalog(m.provider.kind);
      const baseUrl = m.provider.baseUrl || catalog?.baseUrl || undefined;
      const start = Date.now();
      try {
        const response = await chat(
          [{ role: "user", content: prompt }],
          { model: m.modelId, provider: m.provider.kind, baseUrl, workspaceId, signal: AbortSignal.timeout(60000) }
        );
        const latencyMs = Date.now() - start;
        const tokensIn = estimateTokens(prompt);
        const tokensOut = estimateTokens(response);
        const costUsd =
          (tokensIn / 1_000_000) * pricing.input + (tokensOut / 1_000_000) * pricing.output;
        void recordFusionRequest(workspaceId, {
          provider: m.provider.kind,
          modelId: m.modelId,
          tokensIn,
          tokensOut,
          costUsd,
          latencyMs,
          success: true,
        });
        return {
          modelId: m.modelId,
          label: m.name,
          provider: m.provider.kind,
          response,
          ok: true,
          latencyMs,
          tokensIn,
          tokensOut,
          costUsd: Math.round(costUsd * 1_000_000) / 1_000_000,
          qualityScore: qualityHeuristic(response),
        };
      } catch (err) {
        const latencyMs = Date.now() - start;
        const message = err instanceof Error ? err.message : String(err);
        void recordFusionRequest(workspaceId, {
          provider: m.provider.kind,
          modelId: m.modelId,
          latencyMs,
          success: false,
          error: message,
        });
        return {
          modelId: m.modelId,
          label: m.name,
          provider: m.provider.kind,
          response: "",
          ok: false,
          latencyMs,
          tokensIn: 0,
          tokensOut: 0,
          costUsd: 0,
          qualityScore: 0,
          error: message,
        };
      }
    })
  );
}
