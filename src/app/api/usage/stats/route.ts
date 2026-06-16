/**
 * GET /api/usage/stats?workspaceId=...&days=30
 * Returns aggregated usage stats: total requests, tokens, cost,
 * daily breakdown, and per-provider breakdown.
 */
import { prisma } from "@/lib/db";
import { apiSuccess, handleApiError, requireUser, ApiError, NO_STORE_HEADERS } from "@/lib/api";

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get("workspaceId")?.trim();
    const days = Math.min(parseInt(searchParams.get("days") ?? "30", 10), 365);

    if (!workspaceId) throw new ApiError("workspaceId is required", 400, "BAD_REQUEST");

    const member = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: user.id } },
    });
    if (!member) throw new ApiError("Forbidden", 403, "FORBIDDEN");

    const since = new Date(Date.now() - days * 86_400_000);

    // Database-level aggregation for massive performance improvements over findMany
    const [totalsAgg, errorCount, providerAgg, providerErrorsAgg, dailyRaw] = await Promise.all([
      // 1. Overall totals
      prisma.aiRequestLog.aggregate({
        where: { workspaceId, createdAt: { gte: since } },
        _count: { _all: true },
        _sum: {
          inputTokens: true,
          outputTokens: true,
          costUsd: true,
          durationMs: true,
        },
      }),
      // 2. Total errors
      prisma.aiRequestLog.count({
        where: { workspaceId, createdAt: { gte: since }, status: { not: "success" } },
      }),
      // 3. Provider groupings
      prisma.aiRequestLog.groupBy({
        by: ["provider"],
        where: { workspaceId, createdAt: { gte: since } },
        _count: { _all: true },
        _sum: { inputTokens: true, outputTokens: true, costUsd: true },
      }),
      // 4. Provider errors
      prisma.aiRequestLog.groupBy({
        by: ["provider"],
        where: { workspaceId, createdAt: { gte: since }, status: { not: "success" } },
        _count: { _all: true },
      }),
      // 5. Daily buckets via raw SQL (optimal for date grouping in Postgres)
      prisma.$queryRaw<{ day: string; reqs: number; cost: number; tokens: number }[]>`
        SELECT
          TO_CHAR("createdAt", 'YYYY-MM-DD') as day,
          COUNT(*)::int as reqs,
          COALESCE(SUM("costUsd"), 0)::float as cost,
          COALESCE(SUM("inputTokens" + "outputTokens"), 0)::int as tokens
        FROM "AiRequestLog"
        WHERE "workspaceId" = ${workspaceId} AND "createdAt" >= ${since}
        GROUP BY TO_CHAR("createdAt", 'YYYY-MM-DD')
        ORDER BY day ASC
      `,
    ]);

    const totals = {
      requests: totalsAgg._count._all,
      inputTokens: totalsAgg._sum.inputTokens ?? 0,
      outputTokens: totalsAgg._sum.outputTokens ?? 0,
      costUsd: totalsAgg._sum.costUsd ?? 0,
      durationMs: totalsAgg._sum.durationMs ?? 0,
      errors: errorCount,
    };

    // Pre-fill daily map with empty buckets to guarantee continuous data
    const dailyMap = new Map<string, { requests: number; costUsd: number; tokens: number }>();
    for (let i = 0; i < days; i++) {
      const d = new Date(since.getTime() + i * 86_400_000);
      dailyMap.set(d.toISOString().slice(0, 10), { requests: 0, costUsd: 0, tokens: 0 });
    }
    for (const row of dailyRaw) {
      if (dailyMap.has(row.day)) {
        dailyMap.set(row.day, { requests: row.reqs, costUsd: row.cost, tokens: row.tokens });
      }
    }
    const daily = [...dailyMap.entries()].map(([date, v]) => ({ date, ...v })).sort((a, b) => a.date.localeCompare(b.date));

    // Provider map
    const errorMap = new Map(providerErrorsAgg.map((e) => [e.provider, e._count._all]));
    const byProvider = providerAgg.map((p) => ({
      provider: p.provider,
      requests: p._count._all,
      tokens: (p._sum.inputTokens ?? 0) + (p._sum.outputTokens ?? 0),
      costUsd: p._sum.costUsd ?? 0,
      errors: errorMap.get(p.provider) ?? 0,
    })).sort((a, b) => b.requests - a.requests);

    return apiSuccess(
      { totals, daily, byProvider, days },
      { headers: NO_STORE_HEADERS }
    );
  } catch (err) {
    return handleApiError(err);
  }
}
