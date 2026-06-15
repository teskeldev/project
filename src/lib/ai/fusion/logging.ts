/**
 * Fusion request logging + analytics rollups over FusionRequestLog.
 * SERVER-ONLY.
 */
import { prisma } from "@/lib/db";

export type FusionRequestInput = {
  provider: string;
  modelId?: string;
  profileId?: string;
  tokensIn?: number;
  tokensOut?: number;
  costUsd?: number;
  latencyMs?: number;
  success?: boolean;
  error?: string;
};

export async function recordFusionRequest(workspaceId: string, input: FusionRequestInput): Promise<void> {
  try {
    await prisma.fusionRequestLog.create({
      data: {
        workspaceId,
        provider: input.provider,
        modelId: input.modelId ?? null,
        profileId: input.profileId ?? null,
        tokensIn: input.tokensIn ?? 0,
        tokensOut: input.tokensOut ?? 0,
        costUsd: input.costUsd ?? 0,
        latencyMs: input.latencyMs ?? 0,
        success: input.success ?? true,
        error: input.error ?? null,
      },
    });
  } catch {
    // Logging must never break a request.
  }
}

export type AnalyticsRange = "24h" | "7d" | "30d" | "90d";

const RANGE_MS: Record<AnalyticsRange, number> = {
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
  "90d": 90 * 24 * 60 * 60 * 1000,
};

export async function getAnalytics(workspaceId: string, range: AnalyticsRange) {
  const since = new Date(Date.now() - RANGE_MS[range]);
  const bucketByHour = range === "24h";

  const rows = await prisma.fusionRequestLog.findMany({
    where: { workspaceId, createdAt: { gte: since } },
    select: {
      provider: true,
      modelId: true,
      tokensIn: true,
      tokensOut: true,
      costUsd: true,
      latencyMs: true,
      success: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  const series = new Map<string, { requests: number; cost: number; latencyTotal: number; errors: number }>();
  const byProvider = new Map<string, number>();
  const byModel = new Map<string, number>();
  let totalCost = 0;
  let totalLatency = 0;
  let errors = 0;

  for (const r of rows) {
    const d = r.createdAt;
    const key = bucketByHour
      ? `${d.getUTCMonth() + 1}/${d.getUTCDate()} ${String(d.getUTCHours()).padStart(2, "0")}:00`
      : `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
    const s = series.get(key) ?? { requests: 0, cost: 0, latencyTotal: 0, errors: 0 };
    s.requests += 1;
    s.cost += r.costUsd;
    s.latencyTotal += r.latencyMs;
    if (!r.success) s.errors += 1;
    series.set(key, s);

    byProvider.set(r.provider, (byProvider.get(r.provider) ?? 0) + 1);
    if (r.modelId) byModel.set(r.modelId, (byModel.get(r.modelId) ?? 0) + 1);
    totalCost += r.costUsd;
    totalLatency += r.latencyMs;
    if (!r.success) errors += 1;
  }

  const timeline = Array.from(series.entries()).map(([bucket, v]) => ({
    bucket,
    requests: v.requests,
    cost: Math.round(v.cost * 10000) / 10000,
    avgLatency: v.requests ? Math.round(v.latencyTotal / v.requests) : 0,
    errorRate: v.requests ? v.errors / v.requests : 0,
  }));

  return {
    range,
    totals: {
      requests: rows.length,
      cost: Math.round(totalCost * 10000) / 10000,
      avgLatency: rows.length ? Math.round(totalLatency / rows.length) : 0,
      errorRate: rows.length ? errors / rows.length : 0,
    },
    timeline,
    byProvider: Array.from(byProvider.entries()).map(([name, value]) => ({ name, value })),
    byModel: Array.from(byModel.entries()).map(([name, value]) => ({ name, value })),
  };
}
