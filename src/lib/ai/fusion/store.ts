/**
 * Fusion store — only the two persisted orchestration configs (Routing, Judge)
 * plus the Overview snapshot. Models are derived (see models.ts), not stored.
 *
 * SERVER-ONLY.
 */
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { listAvailableModels } from "./models";

const json = (v: unknown): Prisma.InputJsonValue => v as Prisma.InputJsonValue;

/* -------------------------------- Routing --------------------------------- */

export type RoutingInput = { name: string; strategy: string; config?: unknown };

export function listRoutings(workspaceId: string) {
  return prisma.fusionRouting.findMany({ where: { workspaceId }, orderBy: { createdAt: "asc" } });
}
export function createRouting(workspaceId: string, data: RoutingInput) {
  return prisma.fusionRouting.create({
    data: { workspaceId, name: data.name, strategy: data.strategy, config: json(data.config ?? {}) },
  });
}
export async function updateRouting(workspaceId: string, id: string, data: Partial<RoutingInput>) {
  await assertOwned("fusionRouting", workspaceId, id);
  return prisma.fusionRouting.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.strategy !== undefined && { strategy: data.strategy }),
      ...(data.config !== undefined && { config: json(data.config) }),
    },
  });
}
export async function deleteRouting(workspaceId: string, id: string) {
  await assertOwned("fusionRouting", workspaceId, id);
  return prisma.fusionRouting.delete({ where: { id } });
}

/* --------------------------------- Judges --------------------------------- */

export type JudgeInput = { name: string; mode: string; judgeModelId?: string | null; config?: unknown };

export function listJudges(workspaceId: string) {
  return prisma.fusionJudge.findMany({ where: { workspaceId }, orderBy: { createdAt: "asc" } });
}
export function createJudge(workspaceId: string, data: JudgeInput) {
  return prisma.fusionJudge.create({
    data: {
      workspaceId,
      name: data.name,
      mode: data.mode,
      judgeModelId: data.judgeModelId ?? null,
      config: json(data.config ?? {}),
    },
  });
}
export async function updateJudge(workspaceId: string, id: string, data: Partial<JudgeInput>) {
  await assertOwned("fusionJudge", workspaceId, id);
  return prisma.fusionJudge.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.mode !== undefined && { mode: data.mode }),
      ...(data.judgeModelId !== undefined && { judgeModelId: data.judgeModelId }),
      ...(data.config !== undefined && { config: json(data.config) }),
    },
  });
}
export async function deleteJudge(workspaceId: string, id: string) {
  await assertOwned("fusionJudge", workspaceId, id);
  return prisma.fusionJudge.delete({ where: { id } });
}

/* -------------------------------- Overview -------------------------------- */

export async function getOverview(workspaceId: string) {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [models, routings, judges, dailyAgg, successCount, recent] = await Promise.all([
    listAvailableModels(workspaceId),
    prisma.fusionRouting.count({ where: { workspaceId } }),
    prisma.fusionJudge.count({ where: { workspaceId } }),
    prisma.fusionRequestLog.aggregate({
      where: { workspaceId, createdAt: { gte: since } },
      _sum: { tokensIn: true, tokensOut: true, costUsd: true },
      _avg: { latencyMs: true },
      _count: { _all: true },
    }),
    prisma.fusionRequestLog.count({ where: { workspaceId, createdAt: { gte: since }, success: true } }),
    prisma.fusionRequestLog.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { id: true, provider: true, modelId: true, success: true, latencyMs: true, costUsd: true, createdAt: true, error: true },
    }),
  ]);

  const total = dailyAgg._count._all || 0;
  const providers = new Set(models.map((m) => m.provider)).size;

  return {
    stats: {
      providers,
      models: models.length,
      routings,
      judges,
      dailyRequests: total,
      tokenUsage: (dailyAgg._sum.tokensIn ?? 0) + (dailyAgg._sum.tokensOut ?? 0),
      dailyCost: dailyAgg._sum.costUsd ?? 0,
      avgLatencyMs: Math.round(dailyAgg._avg.latencyMs ?? 0),
      successRate: total > 0 ? successCount / total : 1,
    },
    recent,
  };
}

/* ------------------------------- internals -------------------------------- */

async function assertOwned(model: "fusionRouting" | "fusionJudge", workspaceId: string, id: string): Promise<void> {
  const where = { id, workspaceId };
  const sel = { select: { id: true } };
  const row =
    model === "fusionRouting"
      ? await prisma.fusionRouting.findFirst({ where, ...sel })
      : await prisma.fusionJudge.findFirst({ where, ...sel });
  if (!row) throw new Error("Resource not found");
}
