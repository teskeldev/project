/**
 * Fusion Profiles — per-workspace, DB-backed Fusion configurations that "fuse"
 * chosen panelist models with chosen skills. The active (isDefault) profile
 * drives the fusion panel; Opus 4.8 always judges regardless of config.
 *
 * SERVER-ONLY (touches the DB + skill loaders).
 */
import { prisma } from "@/lib/db";
import { getSkillBySlug } from "@/lib/skills";
import { loadSkillContent } from "@/lib/skills-loader";
import { SKILLS_REGISTRY } from "@/data/skills-registry";
import { DEFAULT_CONFIG } from "./fusion-config";

export type FusionPanelistDef = {
  model: string;
  provider: string;
  temperature?: number;
  /** Skills injected only into this panelist (advanced / opt-in). */
  skillSlugs?: string[];
};

export type FusionProfileData = {
  id: string;
  name: string;
  isDefault: boolean;
  panelSlug: string;
  panelists: FusionPanelistDef[];
  judge: { model: string; provider: string };
  /** Skills injected into EVERY panelist (shared). */
  skillSlugs: string[];
  trackAVerification: { validateSyntax: boolean; runLint: boolean; runTests: boolean };
};

/** Total character cap for the concatenated skills block per panelist. */
const FUSION_SKILLS_MAX_CHARS = 8000;

/* --------------------------------- mapping -------------------------------- */

type FusionProfileRow = {
  id: string;
  name: string;
  isDefault: boolean;
  panelSlug: string;
  panelists: unknown;
  judge: unknown;
  skillSlugs: unknown;
  trackAVerification: unknown;
};

function mapRow(row: FusionProfileRow): FusionProfileData {
  return {
    id: row.id,
    name: row.name,
    isDefault: row.isDefault,
    panelSlug: row.panelSlug,
    panelists: Array.isArray(row.panelists) ? (row.panelists as FusionPanelistDef[]) : [],
    judge: (row.judge as { model: string; provider: string }) ?? DEFAULT_CONFIG.judge,
    skillSlugs: Array.isArray(row.skillSlugs) ? (row.skillSlugs as string[]) : [],
    trackAVerification:
      (row.trackAVerification as FusionProfileData["trackAVerification"]) ??
      DEFAULT_CONFIG.trackAVerification,
  };
}

/* ------------------------------- accessors -------------------------------- */

export async function listFusionProfiles(workspaceId: string): Promise<FusionProfileData[]> {
  const rows = await prisma.fusionProfile.findMany({
    where: { workspaceId },
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
  });
  return rows.map(mapRow);
}

/**
 * The active profile for a workspace (the default). On first use, seeds a
 * "Default" profile from DEFAULT_CONFIG so callers always get a usable config.
 */
export async function getActiveFusionProfile(
  workspaceId: string
): Promise<FusionProfileData> {
  const existing = await prisma.fusionProfile.findFirst({
    where: { workspaceId, isDefault: true },
  });
  if (existing) return mapRow(existing);

  // Fall back to any profile, else seed the default.
  const any = await prisma.fusionProfile.findFirst({ where: { workspaceId } });
  if (any) return mapRow(any);

  const seeded = await prisma.fusionProfile.create({
    data: {
      workspaceId,
      name: "Default",
      isDefault: true,
      panelSlug: DEFAULT_CONFIG.defaultPanelSlug,
      panelists: DEFAULT_CONFIG.panelists,
      judge: DEFAULT_CONFIG.judge,
      skillSlugs: [],
      trackAVerification: DEFAULT_CONFIG.trackAVerification,
    },
  });
  return mapRow(seeded);
}

export type FusionProfileInput = {
  name: string;
  panelSlug: string;
  panelists: FusionPanelistDef[];
  judge: { model: string; provider: string };
  skillSlugs: string[];
  trackAVerification: { validateSyntax: boolean; runLint: boolean; runTests: boolean };
  isDefault?: boolean;
};

export async function createFusionProfile(
  workspaceId: string,
  input: FusionProfileInput
): Promise<FusionProfileData> {
  const count = await prisma.fusionProfile.count({ where: { workspaceId } });
  const makeDefault = input.isDefault || count === 0; // first profile is the default

  const row = await prisma.$transaction(async (tx) => {
    if (makeDefault) {
      await tx.fusionProfile.updateMany({ where: { workspaceId }, data: { isDefault: false } });
    }
    return tx.fusionProfile.create({
      data: {
        workspaceId,
        name: input.name,
        isDefault: makeDefault,
        panelSlug: input.panelSlug,
        panelists: input.panelists,
        judge: input.judge,
        skillSlugs: input.skillSlugs,
        trackAVerification: input.trackAVerification,
      },
    });
  });
  return mapRow(row);
}

export async function updateFusionProfile(
  workspaceId: string,
  id: string,
  input: Partial<FusionProfileInput>
): Promise<FusionProfileData> {
  // Ensure the profile belongs to the workspace.
  const owned = await prisma.fusionProfile.findFirst({ where: { id, workspaceId }, select: { id: true } });
  if (!owned) throw new Error("Fusion profile not found");

  const row = await prisma.$transaction(async (tx) => {
    if (input.isDefault === true) {
      await tx.fusionProfile.updateMany({ where: { workspaceId }, data: { isDefault: false } });
    }
    return tx.fusionProfile.update({
      where: { id },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.panelSlug !== undefined && { panelSlug: input.panelSlug }),
        ...(input.panelists !== undefined && { panelists: input.panelists }),
        ...(input.judge !== undefined && { judge: input.judge }),
        ...(input.skillSlugs !== undefined && { skillSlugs: input.skillSlugs }),
        ...(input.trackAVerification !== undefined && {
          trackAVerification: input.trackAVerification,
        }),
        ...(input.isDefault === true && { isDefault: true }),
      },
    });
  });
  return mapRow(row);
}

export async function deleteFusionProfile(workspaceId: string, id: string): Promise<void> {
  const target = await prisma.fusionProfile.findFirst({ where: { id, workspaceId } });
  if (!target) throw new Error("Fusion profile not found");

  await prisma.$transaction(async (tx) => {
    await tx.fusionProfile.delete({ where: { id } });
    // If we removed the default, promote another profile so one stays active.
    if (target.isDefault) {
      const next = await tx.fusionProfile.findFirst({
        where: { workspaceId },
        orderBy: { createdAt: "asc" },
      });
      if (next) await tx.fusionProfile.update({ where: { id: next.id }, data: { isDefault: true } });
    }
  });
}

/* ----------------------------- skill resolution --------------------------- */

/**
 * Resolve a set of skill slugs into a single injectable "SKILLS" block.
 * Prefers a workspace/project DB Skill; falls back to the bundled registry.
 * Caps the total size so a large selection can't blow the context budget.
 */
export async function resolveSkillsContent(
  skillSlugs: string[],
  workspaceId: string,
  projectId?: string
): Promise<string> {
  const slugs = Array.from(new Set(skillSlugs.filter(Boolean)));
  if (slugs.length === 0) return "";

  const sections: string[] = [];
  for (const slug of slugs) {
    const content = await resolveOne(slug, workspaceId);
    if (content) sections.push(content);
  }
  void projectId; // reserved: project-scoped DB skills resolve via getSkillBySlug below

  if (sections.length === 0) return "";

  let block = "--- FUSED SKILLS ---\n" + sections.join("\n\n");
  if (block.length > FUSION_SKILLS_MAX_CHARS) {
    block = block.slice(0, FUSION_SKILLS_MAX_CHARS);
  }
  return block + "\n--- END SKILLS ---";
}

async function resolveOne(slug: string, workspaceId: string): Promise<string | null> {
  // 1. Workspace DB skill takes precedence.
  try {
    const dbSkill = await getSkillBySlug(workspaceId, slug);
    if (dbSkill) return `### Skill: ${dbSkill.name}\n${dbSkill.content}`;
  } catch {
    // ignore and try the registry
  }

  // 2. Bundled registry skill.
  const entry = SKILLS_REGISTRY.find((s) => s.slug === slug);
  if (entry) {
    try {
      const content = await loadSkillContent(entry.slug, entry.source);
      if (content) return `### Skill: ${entry.name}\n${content}`;
    } catch {
      // unreadable — skip
    }
  }
  return null;
}
