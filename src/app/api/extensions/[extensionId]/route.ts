import { prisma } from "@/lib/db";
import {
  apiSuccess,
  handleApiError,
  requireUser,
  ApiError,
} from "@/lib/api";

type RouteContext = { params: Promise<{ extensionId: string }> };

// DELETE /api/extensions/:extensionId - uninstall
export async function DELETE(_req: Request, ctx: RouteContext) {
  try {
    const user = await requireUser();
    const { extensionId } = await ctx.params;

    const extension = await prisma.extension.findUnique({
      where: { id: extensionId },
    });

    if (!extension) {
      throw new ApiError("Extension not found", 404, "NOT_FOUND");
    }

    // Verify workspace membership
    const member = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: extension.workspaceId,
          userId: user.id,
        },
      },
    });

    if (!member) {
      throw new ApiError("You do not have access to this workspace", 403, "FORBIDDEN");
    }

    await prisma.extension.delete({ where: { id: extensionId } });

    return apiSuccess({ deleted: true, id: extensionId });
  } catch (err) {
    return handleApiError(err);
  }
}
