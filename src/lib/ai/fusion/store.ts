/**
 * Fusion Orchestration Hub — DB accessors for every hub resource
 * (providers, models, teams, routing, judges, MCP servers, workflows, settings)
 * plus the Overview aggregation. All scoped to a workspace.
 *
 * App-level input types are used at the boundary; Prisma `Json` casts are
 * centralized here so route/handler code never touches Prisma input types.
 *
 * SERVER-ONLY.
 */
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import type { ModelCapabilities, ModelPricing } from "./catalog";

const json = (v: unknown): Prisma.InputJsonValue => v as Prisma.InputJsonValue;

/* ------------------------------- Providers -------------------------------- */

export type ProviderInput = {
  kind: string;
  name: string;
  baseUrl?: string | null;
  integrationId?: string | null;
  enabled?: boolean;
};

export function listProviders(workspaceId: string) {
  return prisma.fusionProvider.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { models: true } } },
  });
}

export function createProvider(workspaceId: string, data: ProviderInput) {
  return prisma.fusionProvider.create({
    data: {
      workspaceId,
      kind: data.kind,
      name: data.name,
      baseUrl: data.baseUrl ?? null,
      integrationId: data.integrationId ?? null,
      enabled: data.enabled ?? true,
    },
  });
}

export async function updateProvider(workspaceId: string, id: string, data: Partial<ProviderInput>) {
  await assertOwned("fusionProvider", workspaceId, id);
  return prisma.fusionProvider.update({
    where: { id },
    data: {
      ...(data.kind !== undefined && { kind: data.kind }),
      ...(data.name !== undefined && { name: data.name }),
      ...(data.baseUrl !== undefined && { baseUrl: data.baseUrl }),
      ...(data.integrationId !== undefined && { integrationId: data.integrationId }),
      ...(data.enabled !== undefined && { enabled: data.enabled }),
    },
  });
}

export async function deleteProvider(workspaceId: string, id: string) {
  await assertOwned("fusionProvider", workspaceId, id);
  return prisma.fusionProvider.delete({ where: { id } });
}

/* -------------------------------- Models ---------------------------------- */

export type ModelInput = {
  providerId: string;
  name: string;
  modelId: string;
  contextWindow?: number;
  pricing: ModelPricing;
  capabilities: ModelCapabilities;
  enabled?: boolean;
};

export function listModels(workspaceId: string) {
  return prisma.fusionModel.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "asc" },
    include: { provider: { select: { id: true, name: true, kind: true } } },
  });
}

export async function createModel(workspaceId: string, data: ModelInput) {
  await assertOwned("fusionProvider", workspaceId, data.providerId);
  return prisma.fusionModel.create({
    data: {
      workspaceId,
      providerId: data.providerId,
      name: data.name,
      modelId: data.modelId,
      contextWindow: data.contextWindow ?? 0,
      pricing: json(data.pricing),
      capabilities: json(data.capabilities),
      enabled: data.enabled ?? true,
    },
  });
}

export async function updateModel(workspaceId: string, id: string, data: Partial<ModelInput>) {
  await assertOwned("fusionModel", workspaceId, id);
  return prisma.fusionModel.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.modelId !== undefined && { modelId: data.modelId }),
      ...(data.contextWindow !== undefined && { contextWindow: data.contextWindow }),
      ...(data.pricing !== undefined && { pricing: json(data.pricing) }),
      ...(data.capabilities !== undefined && { capabilities: json(data.capabilities) }),
      ...(data.enabled !== undefined && { enabled: data.enabled }),
    },
  });
}

export async function deleteModel(workspaceId: string, id: string) {
  await assertOwned("fusionModel", workspaceId, id);
  return prisma.fusionModel.delete({ where: { id } });
}

/* --------------------------------- Teams ---------------------------------- */

export type TeamInput = { name: string; description?: string | null; modelIds: string[] };

export function listTeams(workspaceId: string) {
  return prisma.fusionTeam.findMany({ where: { workspaceId }, orderBy: { createdAt: "asc" } });
}
export function createTeam(workspaceId: string, data: TeamInput) {
  return prisma.fusionTeam.create({
    data: { workspaceId, name: data.name, description: data.description ?? null, modelIds: json(data.modelIds) },
  });
}
export async function updateTeam(workspaceId: string, id: string, data: Partial<TeamInput>) {
  await assertOwned("fusionTeam", workspaceId, id);
  return prisma.fusionTeam.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.modelIds !== undefined && { modelIds: json(data.modelIds) }),
    },
  });
}
export async function deleteTeam(workspaceId: string, id: string) {
  await assertOwned("fusionTeam", workspaceId, id);
  return prisma.fusionTeam.delete({ where: { id } });
}

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

/* --------------------------------- MCP ------------------------------------ */

export type McpInput = { name: string; kind: string; url?: string | null; command?: string | null; enabled?: boolean };

export function listMcpServers(workspaceId: string) {
  return prisma.fusionMcpServer.findMany({ where: { workspaceId }, orderBy: { createdAt: "asc" } });
}
export function createMcpServer(workspaceId: string, data: McpInput) {
  return prisma.fusionMcpServer.create({
    data: {
      workspaceId,
      name: data.name,
      kind: data.kind,
      url: data.url ?? null,
      command: data.command ?? null,
      enabled: data.enabled ?? true,
    },
  });
}
export async function updateMcpServer(workspaceId: string, id: string, data: Partial<McpInput>) {
  await assertOwned("fusionMcpServer", workspaceId, id);
  return prisma.fusionMcpServer.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.kind !== undefined && { kind: data.kind }),
      ...(data.url !== undefined && { url: data.url }),
      ...(data.command !== undefined && { command: data.command }),
      ...(data.enabled !== undefined && { enabled: data.enabled }),
    },
  });
}
export async function deleteMcpServer(workspaceId: string, id: string) {
  await assertOwned("fusionMcpServer", workspaceId, id);
  return prisma.fusionMcpServer.delete({ where: { id } });
}

/* ------------------------------- Workflows -------------------------------- */

export type WorkflowInput = { name: string; graph?: unknown; enabled?: boolean };

export function listWorkflows(workspaceId: string) {
  return prisma.fusionWorkflow.findMany({ where: { workspaceId }, orderBy: { createdAt: "asc" } });
}
export function createWorkflow(workspaceId: string, data: WorkflowInput) {
  return prisma.fusionWorkflow.create({
    data: { workspaceId, name: data.name, graph: json(data.graph ?? { nodes: [], edges: [] }), enabled: data.enabled ?? true },
  });
}
export async function updateWorkflow(workspaceId: string, id: string, data: Partial<WorkflowInput>) {
  await assertOwned("fusionWorkflow", workspaceId, id);
  return prisma.fusionWorkflow.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.graph !== undefined && { graph: json(data.graph) }),
      ...(data.enabled !== undefined && { enabled: data.enabled }),
    },
  });
}
export async function deleteWorkflow(workspaceId: string, id: string) {
  await assertOwned("fusionWorkflow", workspaceId, id);
  return prisma.fusionWorkflow.delete({ where: { id } });
}

/* -------------------------------- Settings -------------------------------- */

const DEFAULT_SETTINGS = {
  defaults: { defaultProvider: null, defaultTeam: null, defaultJudge: null, defaultRouting: null },
  featureFlags: { experimentalModels: false, betaProviders: false, autoFallback: true, autoRetry: true },
};

export async function getSettings(workspaceId: string) {
  const existing = await prisma.fusionSettings.findUnique({ where: { workspaceId } });
  if (existing) return existing;
  return prisma.fusionSettings.create({
    data: { workspaceId, defaults: json(DEFAULT_SETTINGS.defaults), featureFlags: json(DEFAULT_SETTINGS.featureFlags) },
  });
}

export async function updateSettings(
  workspaceId: string,
  data: { defaults?: unknown; featureFlags?: unknown }
) {
  await getSettings(workspaceId);
  return prisma.fusionSettings.update({
    where: { workspaceId },
    data: {
      ...(data.defaults !== undefined && { defaults: json(data.defaults) }),
      ...(data.featureFlags !== undefined && { featureFlags: json(data.featureFlags) }),
    },
  });
}

/* -------------------------------- Overview -------------------------------- */

export async function getOverview(workspaceId: string) {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const monthStart = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [
    providers,
    activeProviders,
    models,
    activeModels,
    teams,
    profiles,
    workflows,
    mcpServers,
    activeMcp,
    skills,
    dailyRequests,
    dailyAgg,
    monthAgg,
    successCount,
    recent,
  ] = await Promise.all([
    prisma.fusionProvider.count({ where: { workspaceId } }),
    prisma.fusionProvider.count({ where: { workspaceId, enabled: true, lastStatus: "connected" } }),
    prisma.fusionModel.count({ where: { workspaceId } }),
    prisma.fusionModel.count({ where: { workspaceId, enabled: true } }),
    prisma.fusionTeam.count({ where: { workspaceId } }),
    prisma.fusionProfile.count({ where: { workspaceId } }),
    prisma.fusionWorkflow.count({ where: { workspaceId } }),
    prisma.fusionMcpServer.count({ where: { workspaceId } }),
    prisma.fusionMcpServer.count({ where: { workspaceId, enabled: true } }),
    prisma.skill.count({ where: { workspaceId } }),
    prisma.fusionRequestLog.count({ where: { workspaceId, createdAt: { gte: since } } }),
    prisma.fusionRequestLog.aggregate({
      where: { workspaceId, createdAt: { gte: since } },
      _sum: { tokensIn: true, tokensOut: true },
      _avg: { latencyMs: true },
      _count: { _all: true },
    }),
    prisma.fusionRequestLog.aggregate({
      where: { workspaceId, createdAt: { gte: monthStart } },
      _sum: { costUsd: true },
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

  return {
    stats: {
      providers,
      activeProviders,
      models,
      activeModels,
      teams,
      profiles,
      workflows,
      mcpServers,
      activeMcp,
      skills,
      dailyRequests,
      monthlyCost: monthAgg._sum.costUsd ?? 0,
      tokenUsage: (dailyAgg._sum.tokensIn ?? 0) + (dailyAgg._sum.tokensOut ?? 0),
      avgLatencyMs: Math.round(dailyAgg._avg.latencyMs ?? 0),
      successRate: total > 0 ? successCount / total : 1,
    },
    recent,
  };
}

/* ------------------------------- internals -------------------------------- */

type OwnedModel =
  | "fusionProvider"
  | "fusionModel"
  | "fusionTeam"
  | "fusionRouting"
  | "fusionJudge"
  | "fusionMcpServer"
  | "fusionWorkflow";

/** Throw unless the row exists and belongs to the workspace. */
async function assertOwned(model: OwnedModel, workspaceId: string, id: string): Promise<void> {
  const where = { id, workspaceId };
  const sel = { select: { id: true } };
  let row: { id: string } | null = null;
  switch (model) {
    case "fusionProvider": row = await prisma.fusionProvider.findFirst({ where, ...sel }); break;
    case "fusionModel": row = await prisma.fusionModel.findFirst({ where, ...sel }); break;
    case "fusionTeam": row = await prisma.fusionTeam.findFirst({ where, ...sel }); break;
    case "fusionRouting": row = await prisma.fusionRouting.findFirst({ where, ...sel }); break;
    case "fusionJudge": row = await prisma.fusionJudge.findFirst({ where, ...sel }); break;
    case "fusionMcpServer": row = await prisma.fusionMcpServer.findFirst({ where, ...sel }); break;
    case "fusionWorkflow": row = await prisma.fusionWorkflow.findFirst({ where, ...sel }); break;
  }
  if (!row) throw new ApiNotFound();
}

class ApiNotFound extends Error {
  constructor() {
    super("Resource not found");
    this.name = "ApiNotFound";
  }
}
