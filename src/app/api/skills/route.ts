import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  apiSuccess,
  handleApiError,
  requireUser,
  validateBody,
  ApiError,
  NO_STORE_HEADERS,
  type SessionUser,
} from "@/lib/api";
import type { Role } from "@prisma/client";

async function assertWorkspaceMember(
  user: SessionUser,
  workspaceId: string
): Promise<{ role: Role }> {
  const member = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: user.id } },
  });
  if (!member) {
    throw new ApiError(
      "You do not have access to this workspace",
      403,
      "FORBIDDEN"
    );
  }
  return { role: member.role };
}

async function userWorkspaceIds(userId: string): Promise<string[]> {
  const memberships = await prisma.workspaceMember.findMany({
    where: { userId },
    select: { workspaceId: true },
  });
  return memberships.map((m) => m.workspaceId);
}

const createSkillSchema = z.object({
  workspaceId: z.string().min(1, "workspaceId is required"),
  projectId: z.string().min(1).nullable().optional(),
  name: z.string().trim().min(1, "Name is required").max(100),
  slug: z
    .string()
    .trim()
    .min(1, "Slug is required")
    .max(100)
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens"),
  description: z.string().trim().min(1, "Description is required").max(500),
  content: z.string().min(1, "Content is required").max(100000),
  enabled: z.boolean().optional().default(true),
});

// GET /api/skills?workspaceId=&projectId=
export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const url = new URL(req.url);
    const workspaceId = url.searchParams.get("workspaceId") ?? undefined;
    const projectId = url.searchParams.get("projectId") ?? undefined;

    let where;
    if (workspaceId) {
      await assertWorkspaceMember(user, workspaceId);
      where = projectId
        ? {
            OR: [
              { workspaceId, projectId: null },
              { workspaceId, projectId },
            ],
          }
        : { workspaceId };
    } else {
      const wsIds = await userWorkspaceIds(user.id);
      where = { workspaceId: { in: wsIds } };
    }

    const skills = await prisma.skill.findMany({
      where,
      orderBy: { createdAt: "asc" },
    });

    return apiSuccess({ skills }, { headers: NO_STORE_HEADERS });
  } catch (err) {
    return handleApiError(err);
  }
}

// POST /api/skills
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = await validateBody(req, createSkillSchema);

    const { role } = await assertWorkspaceMember(user, body.workspaceId);

    const allowedRoles: Role[] = ["MEMBER", "ADMIN", "OWNER"];
    if (!allowedRoles.includes(role)) {
      throw new ApiError("Insufficient permissions", 403, "FORBIDDEN");
    }

    const skill = await prisma.skill.create({
      data: {
        workspaceId: body.workspaceId,
        projectId: body.projectId ?? null,
        name: body.name,
        slug: body.slug,
        description: body.description,
        content: body.content,
        enabled: body.enabled,
      },
    });

    return apiSuccess({ skill }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
