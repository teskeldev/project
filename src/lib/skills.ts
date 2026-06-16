/**
 * Skills system — domain-specific instruction sets loadable on-demand.
 *
 * Skills are markdown documents with metadata that provide specialized
 * knowledge to the AI (e.g., "nextjs-app-router", "prisma-migrations",
 * "react-testing"). They are injected into the AI context when activated.
 */
import { prisma } from "@/lib/db";

/** Maximum total characters for concatenated active skills content. */
const MAX_SKILLS_CHARS = 8000;

export type SkillSummary = {
  id: string;
  name: string;
  slug: string;
  description: string;
  enabled: boolean;
};

export type SkillDetail = SkillSummary & {
  content: string;
  projectId: string | null;
  workspaceId: string | null;
};

/**
 * List available skills for a workspace/project.
 * Returns skills scoped to the workspace, optionally filtered by project.
 */
export async function listSkills(
  workspaceId: string,
  projectId?: string
): Promise<SkillSummary[]> {
  const where = projectId
    ? {
        OR: [
          { workspaceId, projectId: null },
          { workspaceId, projectId },
        ],
      }
    : { workspaceId };

  const skills = await prisma.skill.findMany({
    where,
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      enabled: true,
    },
    orderBy: { createdAt: "asc" },
  });

  return skills;
}

/**
 * Get skill content by slug within a workspace.
 */
export async function getSkillBySlug(
  workspaceId: string,
  slug: string
): Promise<SkillDetail | null> {
  const skill = await prisma.skill.findUnique({
    where: { workspaceId_slug: { workspaceId, slug } },
  });

  if (!skill) return null;

  return {
    id: skill.id,
    name: skill.name,
    slug: skill.slug,
    description: skill.description,
    enabled: skill.enabled,
    content: skill.content,
    projectId: skill.projectId,
    workspaceId: skill.workspaceId,
  };
}

/**
 * Load active skills for AI context injection.
 * Returns a formatted string of all enabled skills for the workspace/project.
 * Truncates the result to MAX_SKILLS_CHARS to prevent oversized context.
 */
export async function loadActiveSkills(
  workspaceId: string,
  projectId?: string
): Promise<string> {
  const where = projectId
    ? {
        enabled: true,
        OR: [
          { workspaceId, projectId: null },
          { workspaceId, projectId },
        ],
      }
    : { workspaceId, enabled: true };

  const skills = await prisma.skill.findMany({
    where,
    select: { name: true, content: true },
    orderBy: { createdAt: "asc" },
  });

  if (skills.length === 0) return "";

  let result = "";
  for (const s of skills) {
    const section = `### Skill: ${s.name}\n${s.content}`;
    if (result.length === 0) {
      result = section;
    } else {
      result += "\n\n" + section;
    }

    if (result.length >= MAX_SKILLS_CHARS) {
      result = result.slice(0, MAX_SKILLS_CHARS);
      break;
    }
  }

  return result;
}

/**
 * Create a new skill.
 */
export async function createSkill(data: {
  workspaceId: string;
  projectId?: string | null;
  name: string;
  slug: string;
  description: string;
  content: string;
  enabled?: boolean;
}): Promise<SkillDetail> {
  const skill = await prisma.skill.create({
    data: {
      workspaceId: data.workspaceId,
      projectId: data.projectId ?? null,
      name: data.name,
      slug: data.slug,
      description: data.description,
      content: data.content,
      enabled: data.enabled ?? true,
    },
  });

  return {
    id: skill.id,
    name: skill.name,
    slug: skill.slug,
    description: skill.description,
    enabled: skill.enabled,
    content: skill.content,
    projectId: skill.projectId,
    workspaceId: skill.workspaceId,
  };
}

/**
 * Update an existing skill.
 */
export async function updateSkill(
  id: string,
  data: {
    name?: string;
    slug?: string;
    description?: string;
    content?: string;
    enabled?: boolean;
  }
): Promise<SkillDetail> {
  const skill = await prisma.skill.update({
    where: { id },
    data: {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.slug !== undefined ? { slug: data.slug } : {}),
      ...(data.description !== undefined ? { description: data.description } : {}),
      ...(data.content !== undefined ? { content: data.content } : {}),
      ...(data.enabled !== undefined ? { enabled: data.enabled } : {}),
    },
  });

  return {
    id: skill.id,
    name: skill.name,
    slug: skill.slug,
    description: skill.description,
    enabled: skill.enabled,
    content: skill.content,
    projectId: skill.projectId,
    workspaceId: skill.workspaceId,
  };
}

/**
 * Delete a skill by id.
 */
export async function deleteSkill(id: string): Promise<void> {
  await prisma.skill.delete({ where: { id } });
}
