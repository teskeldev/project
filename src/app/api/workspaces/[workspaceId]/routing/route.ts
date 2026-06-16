/**
 * GET   /api/workspaces/:workspaceId/routing — get routing strategy settings
 * PATCH /api/workspaces/:workspaceId/routing — update routing strategy settings
 */
import { prisma } from "@/lib/db";
import { apiSuccess, handleApiError, requireUser, ApiError } from "@/lib/api";
import { z } from "zod";

type RouteContext = { params: Promise<{ workspaceId: string }> };

const patchSchema = z.object({
  routingStrategy: z.enum(["fill-first", "round-robin"]).optional(),
  stickyLimit: z.number().int().min(1).max(100).optional(),
});

export async function GET(_req: Request, ctx: RouteContext) {
  try {
    const user = await requireUser();
    const { workspaceId } = await ctx.params;

    const member = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: user.id } },
    });
    if (!member) throw new ApiError("Forbidden", 403, "FORBIDDEN");

    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { routingStrategy: true, stickyLimit: true },
    });
    if (!workspace) throw new ApiError("Workspace not found", 404, "NOT_FOUND");

    return apiSuccess(workspace);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(req: Request, ctx: RouteContext) {
  try {
    const user = await requireUser();
    const { workspaceId } = await ctx.params;

    const member = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: user.id } },
    });
    if (!member || !["OWNER", "ADMIN"].includes(member.role)) {
      throw new ApiError("Forbidden — ADMIN or OWNER required", 403, "FORBIDDEN");
    }

    const data = patchSchema.parse(await req.json());
    const workspace = await prisma.workspace.update({
      where: { id: workspaceId },
      data,
      select: { routingStrategy: true, stickyLimit: true },
    });

    return apiSuccess(workspace);
  } catch (err) {
    return handleApiError(err);
  }
}
