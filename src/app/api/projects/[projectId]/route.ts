import { prisma } from "@/lib/db";
import {
  apiSuccess,
  handleApiError,
  requireProjectAccess,
  validateBody,
  ApiError,
} from "@/lib/api";
import { updateProjectSchema } from "@/lib/validators";
import { deletePath } from "@/lib/storage";

type RouteContext = { params: Promise<{ projectId: string }> };

// GET /api/projects/:projectId -> project detail.
export async function GET(_req: Request, ctx: RouteContext) {
  try {
    const { projectId } = await ctx.params;
    const { project } = await requireProjectAccess(projectId);
    return apiSuccess({ project });
  } catch (err) {
    return handleApiError(err);
  }
}

// PATCH /api/projects/:projectId -> update name/description/defaultBranch.
export async function PATCH(req: Request, ctx: RouteContext) {
  try {
    const { projectId } = await ctx.params;
    await requireProjectAccess(projectId);
    const data = await validateBody(req, updateProjectSchema);

    const project = await prisma.project.update({
      where: { id: projectId },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.description !== undefined
          ? { description: data.description }
          : {}),
        ...(data.defaultBranch !== undefined
          ? { defaultBranch: data.defaultBranch }
          : {}),
      },
    });

    return apiSuccess({ project });
  } catch (err) {
    return handleApiError(err);
  }
}

// DELETE /api/projects/:projectId -> remove project (OWNER/ADMIN only).
export async function DELETE(_req: Request, ctx: RouteContext) {
  try {
    const { projectId } = await ctx.params;
    const { project, role } = await requireProjectAccess(projectId);

    if (role !== "OWNER" && role !== "ADMIN") {
      throw new ApiError(
        "Only workspace owners or admins can delete projects",
        403,
        "FORBIDDEN"
      );
    }

    // requireProjectAccess guarantees project is non-null here.
    const storageKey = project!.storageKey;

    // Remove DB rows first (FileNode cascades via project relation).
    await prisma.project.delete({ where: { id: projectId } });

    // Best-effort disk cleanup; don't fail the request if disk removal errors.
    try {
      await deletePath(storageKey, "");
    } catch {
      // swallow - DB record is already gone; orphan dir can be GC'd later.
    }

    return apiSuccess({ deleted: true });
  } catch (err) {
    return handleApiError(err);
  }
}
