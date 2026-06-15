/**
 * resolveFusion — load a Fusion and its referenced resources, dropping anything
 * no longer available (models from Integrations; skills/rules/knowledge by id),
 * collecting warnings instead of failing. SERVER-ONLY.
 */
import { prisma } from "@/lib/db";
import { getFusion, type FusionData } from "./store";
import { listAvailableModels } from "./models";

export type ResolvedModel = { ref: string; provider: string; modelId: string; name: string };
export type ResolvedDoc = { id: string; title: string; content: string };

export type ResolvedFusion = {
  fusion: FusionData;
  models: ResolvedModel[];
  skills: ResolvedDoc[];
  rules: ResolvedDoc[];
  knowledge: ResolvedDoc[];
  warnings: string[];
};

export async function resolveFusion(
  fusionId: string,
  workspaceId: string,
  projectId?: string
): Promise<ResolvedFusion> {
  const fusion = await getFusion(workspaceId, fusionId);
  if (!fusion) throw new Error("Fusion not found");

  const warnings: string[] = [];

  // Models — cross with the workspace's available (Integrations-derived) registry.
  const available = await listAvailableModels(workspaceId);
  const byRef = new Map(available.map((m) => [m.ref, m]));
  const models: ResolvedModel[] = [];
  for (const ref of fusion.modelIds) {
    const m = byRef.get(ref);
    if (m) models.push({ ref: m.ref, provider: m.provider, modelId: m.modelId, name: m.name });
    else warnings.push(`Model unavailable: ${ref}`);
  }

  const inScope = (row: { workspaceId?: string | null; projectId?: string | null }) =>
    row.workspaceId === workspaceId || (!!projectId && row.projectId === projectId);

  // Skills
  const skills: ResolvedDoc[] = [];
  if (fusion.skillIds.length) {
    const rows = await prisma.skill.findMany({
      where: { id: { in: fusion.skillIds } },
      select: { id: true, name: true, content: true, workspaceId: true, projectId: true },
    });
    const found = new Map(rows.filter(inScope).map((r) => [r.id, r]));
    for (const id of fusion.skillIds) {
      const r = found.get(id);
      if (r) skills.push({ id: r.id, title: r.name, content: r.content });
      else warnings.push(`Skill unavailable: ${id}`);
    }
  }

  // Rules
  const rules: ResolvedDoc[] = [];
  if (fusion.ruleIds.length) {
    const rows = await prisma.rule.findMany({
      where: { id: { in: fusion.ruleIds } },
      select: { id: true, title: true, content: true, workspaceId: true, projectId: true },
    });
    const found = new Map(rows.filter(inScope).map((r) => [r.id, r]));
    for (const id of fusion.ruleIds) {
      const r = found.get(id);
      if (r) rules.push({ id: r.id, title: r.title, content: r.content });
      else warnings.push(`Rule unavailable: ${id}`);
    }
  }

  // Knowledge
  const knowledge: ResolvedDoc[] = [];
  if (fusion.knowledgeIds.length) {
    const rows = await prisma.knowledgeItem.findMany({
      where: { id: { in: fusion.knowledgeIds } },
      select: { id: true, title: true, content: true, workspaceId: true, projectId: true },
    });
    const found = new Map(rows.filter(inScope).map((r) => [r.id, r]));
    for (const id of fusion.knowledgeIds) {
      const r = found.get(id);
      if (r) knowledge.push({ id: r.id, title: r.title, content: r.content });
      else warnings.push(`Knowledge unavailable: ${id}`);
    }
  }

  return { fusion, models, skills, rules, knowledge, warnings };
}

/**
 * Format a resolved Fusion's Rules → Knowledge → Skills into one injectable
 * system block (bounded). Shared by the runner and by config-injection callers.
 */
export function buildFusionSystem(resolved: ResolvedFusion): string {
  const parts: string[] = [];
  if (resolved.rules.length) {
    parts.push("--- RULES ---\n" + resolved.rules.map((r) => `# ${r.title}\n${r.content}`).join("\n\n"));
  }
  if (resolved.knowledge.length) {
    parts.push("--- KNOWLEDGE ---\n" + resolved.knowledge.map((k) => `# ${k.title}\n${k.content}`).join("\n\n"));
  }
  if (resolved.skills.length) {
    parts.push("--- SKILLS ---\n" + resolved.skills.map((s) => `# ${s.title}\n${s.content}`).join("\n\n"));
  }
  let block = parts.join("\n\n");
  if (block.length > 16000) block = block.slice(0, 16000);
  return block;
}

/**
 * Lightweight config-injection primitive for multi-step / code-gen surfaces
 * (Agent, Composer): the Fusion's injected system context + its primary model.
 * No fan-out/judge — that stays in `runFusion` for single-shot surfaces.
 */
export async function resolveFusionContext(
  fusionId: string,
  workspaceId: string,
  projectId?: string
): Promise<{ system: string; primary: { provider: string; modelId: string } | null; warnings: string[] }> {
  const resolved = await resolveFusion(fusionId, workspaceId, projectId);
  const first = resolved.models[0];
  return {
    system: buildFusionSystem(resolved),
    primary: first ? { provider: first.provider, modelId: first.modelId } : null,
    warnings: resolved.warnings,
  };
}
