import { prisma } from "@/lib/db";
import {
  apiSuccess,
  handleApiError,
  requireUser,
  requireProjectAccess,
  validateBody,
  ApiError,
  type SessionUser,
} from "@/lib/api";
import { updateKnowledgeSchema } from "@/lib/schemas/rulesKnowledge";
import { Prisma, type KnowledgeType } from "@prisma/client";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Loads a knowledge item and verifies the user is a member of its workspace.
 * Users can never read/edit knowledge from workspaces they don't belong to.
 */
async function loadManageableItem(user: SessionUser, id: string) {
  const item = await prisma.knowledgeItem.findUnique({ where: { id } });
  if (!item) {
    throw new ApiError("Knowledge item not found", 404, "NOT_FOUND");
  }
  const member = await prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: { workspaceId: item.workspaceId, userId: user.id },
    },
  });
  if (!member) {
    throw new ApiError("You cannot manage this item", 403, "FORBIDDEN");
  }
  return item;
}

// PATCH /api/knowledge/:id
export async function PATCH(req: Request, ctx: RouteContext) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    const body = await validateBody(req, updateKnowledgeSchema);

    const existing = await loadManageableItem(user, id);

    // If reassigning to a project, verify access + same-workspace coherence.
    if (body.projectId) {
      const { project } = await requireProjectAccess(body.projectId);
      if (project!.workspaceId !== existing.workspaceId) {
        throw new ApiError(
          "Project does not belong to this item's workspace",
          400,
          "WORKSPACE_MISMATCH"
        );
      }
    }

    const nextType = (body.type ?? existing.type) as KnowledgeType;
    const nextContent = body.content ?? existing.content;

    const data: Prisma.KnowledgeItemUpdateInput = {};
    if (body.title !== undefined) data.title = body.title;
    if (body.type !== undefined) data.type = body.type as KnowledgeType;
    if (body.content !== undefined) data.content = body.content;
    if (body.projectId !== undefined) {
      data.project = body.projectId
        ? { connect: { id: body.projectId } }
        : { disconnect: true };
    }
    if (body.metadata !== undefined) {
      data.metadata =
        body.metadata === null
          ? Prisma.JsonNull
          : (body.metadata as Prisma.InputJsonValue);
    }

    // Keep metadata.url in sync for URL items when type/content change.
    if (
      nextType === "URL" &&
      (body.content !== undefined || body.type !== undefined) &&
      body.metadata === undefined
    ) {
      const base =
        existing.metadata && typeof existing.metadata === "object"
          ? (existing.metadata as Record<string, unknown>)
          : {};
      data.metadata = {
        ...base,
        url: nextContent,
      } as Prisma.InputJsonValue;
    }

    const item = await prisma.knowledgeItem.update({
      where: { id },
      data,
    });

    return apiSuccess({ item });
  } catch (err) {
    return handleApiError(err);
  }
}

// DELETE /api/knowledge/:id
export async function DELETE(_req: Request, ctx: RouteContext) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;

    await loadManageableItem(user, id);
    await prisma.knowledgeItem.delete({ where: { id } });

    return apiSuccess({ deleted: true, id });
  } catch (err) {
    return handleApiError(err);
  }
}
