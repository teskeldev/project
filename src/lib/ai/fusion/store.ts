/**
 * Fusion CRUD — the single reusable "AI Team" config. SERVER-ONLY.
 */
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { DEFAULT_LIMITS, type FusionLimits } from "./catalog";

const json = (v: unknown): Prisma.InputJsonValue => v as Prisma.InputJsonValue;

export type FusionData = {
  id: string;
  workspaceId: string;
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
  isTemplate: boolean;
  createdById: string;
  createdAt: string;
  updatedAt: string;
};

export type FusionInput = {
  name: string;
  description?: string | null;
  modelIds?: string[];
  skillIds?: string[];
  ruleIds?: string[];
  knowledgeIds?: string[];
  strategy?: string;
  judge?: string;
  judgeModelId?: string | null;
  limits?: Partial<FusionLimits>;
  status?: string;
};

type Row = {
  id: string; workspaceId: string; name: string; description: string | null;
  modelIds: unknown; skillIds: unknown; ruleIds: unknown; knowledgeIds: unknown;
  strategy: string; judge: string; judgeModelId: string | null; limits: unknown;
  status: string; isTemplate: boolean; createdById: string; createdAt: Date; updatedAt: Date;
};

const arr = (v: unknown): string[] => (Array.isArray(v) ? (v as string[]) : []);

function mapRow(r: Row): FusionData {
  return {
    id: r.id,
    workspaceId: r.workspaceId,
    name: r.name,
    description: r.description,
    modelIds: arr(r.modelIds),
    skillIds: arr(r.skillIds),
    ruleIds: arr(r.ruleIds),
    knowledgeIds: arr(r.knowledgeIds),
    strategy: r.strategy,
    judge: r.judge,
    judgeModelId: r.judgeModelId,
    limits: { ...DEFAULT_LIMITS, ...((r.limits as Partial<FusionLimits>) ?? {}) },
    status: r.status,
    isTemplate: r.isTemplate,
    createdById: r.createdById,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

export async function listFusions(
  workspaceId: string,
  opts: { includeArchived?: boolean } = {}
): Promise<FusionData[]> {
  const rows = await prisma.fusion.findMany({
    where: { workspaceId, ...(opts.includeArchived ? {} : { status: { not: "archived" } }) },
    orderBy: { updatedAt: "desc" },
  });
  return rows.map(mapRow);
}

export async function getFusion(workspaceId: string, id: string): Promise<FusionData | null> {
  const row = await prisma.fusion.findFirst({ where: { id, workspaceId } });
  return row ? mapRow(row) : null;
}

export async function createFusion(
  workspaceId: string,
  createdById: string,
  input: FusionInput
): Promise<FusionData> {
  const row = await prisma.fusion.create({
    data: {
      workspaceId,
      createdById,
      name: input.name,
      description: input.description ?? null,
      modelIds: json(input.modelIds ?? []),
      skillIds: json(input.skillIds ?? []),
      ruleIds: json(input.ruleIds ?? []),
      knowledgeIds: json(input.knowledgeIds ?? []),
      strategy: input.strategy ?? "single",
      judge: input.judge ?? "auto",
      judgeModelId: input.judgeModelId ?? null,
      limits: json({ ...DEFAULT_LIMITS, ...(input.limits ?? {}) }),
      status: input.status ?? "active",
    },
  });
  return mapRow(row);
}

export async function updateFusion(
  workspaceId: string,
  id: string,
  input: Partial<FusionInput>
): Promise<FusionData> {
  const owned = await prisma.fusion.findFirst({ where: { id, workspaceId }, select: { limits: true } });
  if (!owned) throw new Error("Fusion not found");
  const row = await prisma.fusion.update({
    where: { id },
    data: {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.modelIds !== undefined && { modelIds: json(input.modelIds) }),
      ...(input.skillIds !== undefined && { skillIds: json(input.skillIds) }),
      ...(input.ruleIds !== undefined && { ruleIds: json(input.ruleIds) }),
      ...(input.knowledgeIds !== undefined && { knowledgeIds: json(input.knowledgeIds) }),
      ...(input.strategy !== undefined && { strategy: input.strategy }),
      ...(input.judge !== undefined && { judge: input.judge }),
      ...(input.judgeModelId !== undefined && { judgeModelId: input.judgeModelId }),
      ...(input.limits !== undefined && {
        limits: json({ ...DEFAULT_LIMITS, ...((owned.limits as Partial<FusionLimits>) ?? {}), ...input.limits }),
      }),
      ...(input.status !== undefined && { status: input.status }),
    },
  });
  return mapRow(row);
}

export async function duplicateFusion(workspaceId: string, id: string, createdById: string): Promise<FusionData> {
  const src = await getFusion(workspaceId, id);
  if (!src) throw new Error("Fusion not found");
  // Ensure a unique name within the workspace.
  // The previous implementation did `await prisma.fusion.findFirst(...)` in a
  // loop, which is N queries deep. Compute the suffix in memory by listing
  // existing collisions once.
  const baseName = `${src.name} copy`;
  const existing = await prisma.fusion.findMany({
    where: { workspaceId, name: { startsWith: baseName } },
    select: { name: true },
  });
  const taken = new Set(existing.map((r) => r.name));
  let name = baseName;
  if (taken.has(baseName)) {
    for (let i = 2; ; i++) {
      const candidate = `${baseName} ${i}`;
      if (!taken.has(candidate)) {
        name = candidate;
        break;
      }
    }
  }
  return createFusion(workspaceId, createdById, {
    name,
    description: src.description,
    modelIds: src.modelIds,
    skillIds: src.skillIds,
    ruleIds: src.ruleIds,
    knowledgeIds: src.knowledgeIds,
    strategy: src.strategy,
    judge: src.judge,
    judgeModelId: src.judgeModelId,
    limits: src.limits,
    status: "active",
  });
}

export async function deleteFusion(workspaceId: string, id: string): Promise<void> {
  const owned = await prisma.fusion.findFirst({ where: { id, workspaceId }, select: { id: true } });
  if (!owned) throw new Error("Fusion not found");
  await prisma.fusion.delete({ where: { id } });
}
