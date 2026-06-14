import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  apiSuccess,
  handleApiError,
  requireUser,
  validateBody,
  ApiError,
  type SessionUser,
} from "@/lib/api";
import type { Role } from "@prisma/client";

type RouteContext = { params: Promise<{ id: string }> };

type LoadedSkill = {
  skill: NonNullable<Awaited<ReturnType<typeof prisma.skill.findUnique>>>;
  member: { role: Role } | null;
};

async function loadManageableSkill(
  user: SessionUser,
  skillId: string
): Promise<LoadedSkill> {
  const skill = await prisma.skill.findUnique({
    where: { id: skillId },
  });

  if (!skill) {
    throw new ApiError("Skill not found", 404, "NOT_FOUND");
  }

  if (skill.workspaceId) {
    const member = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: { workspaceId: skill.workspaceId, userId: user.id },
      },
    });
    if (!member) {
      throw new ApiError("You cannot manage this skill", 403, "FORBIDDEN");
    }
    return { skill, member: { role: member.role } };
  }

  return { skill, member: null };
}

const updateSkillSchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    slug: z
      .string()
      .trim()
      .min(1)
      .max(100)
      .regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens")
      .optional(),
    description: z.string().trim().min(1).max(500).optional(),
    content: z.string().min(1).max(100000).optional(),
    enabled: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: "No fields to update",
  });

// GET /api/skills/:id
export async function GET(_req: Request, ctx: RouteContext) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    const { skill } = await loadManageableSkill(user, id);
    return apiSuccess({ skill });
  } catch (err) {
    return handleApiError(err);
  }
}

// PATCH /api/skills/:id
export async function PATCH(req: Request, ctx: RouteContext) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    const body = await validateBody(req, updateSkillSchema);

    const { skill, member } = await loadManageableSkill(user, id);

    // PATCH/DELETE require MEMBER+. Skills without a workspace have no role
    // binding, so only authenticated members can mutate them in the calling
    // workspace context.
    if (skill.workspaceId && member) {
      const allowedRoles: Role[] = ["MEMBER", "ADMIN", "OWNER"];
      if (!allowedRoles.includes(member.role)) {
        throw new ApiError("Insufficient permissions", 403, "FORBIDDEN");
      }
    }

    const updated = await prisma.skill.update({
      where: { id },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.slug !== undefined ? { slug: body.slug } : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
        ...(body.content !== undefined ? { content: body.content } : {}),
        ...(body.enabled !== undefined ? { enabled: body.enabled } : {}),
      },
    });

    return apiSuccess({ skill: updated });
  } catch (err) {
    return handleApiError(err);
  }
}

// DELETE /api/skills/:id
export async function DELETE(_req: Request, ctx: RouteContext) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;

    const { skill, member } = await loadManageableSkill(user, id);

    if (skill.workspaceId && member) {
      const allowedRoles: Role[] = ["MEMBER", "ADMIN", "OWNER"];
      if (!allowedRoles.includes(member.role)) {
        throw new ApiError("Insufficient permissions", 403, "FORBIDDEN");
      }
    }

    await prisma.skill.delete({ where: { id } });

    return apiSuccess({ deleted: true, id });
  } catch (err) {
    return handleApiError(err);
  }
}
