import { prisma } from "@/lib/db";
import {
  apiSuccess,
  handleApiError,
  requireUser,
  ApiError,
} from "@/lib/api";

type RouteContext = { params: Promise<{ id: string }> };

// DELETE /api/notifications/:id
// Delete a notification.
export async function DELETE(_req: Request, ctx: RouteContext) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;

    const notification = await prisma.notification.findUnique({
      where: { id },
    });

    if (!notification) {
      throw new ApiError("Notification not found", 404, "NOT_FOUND");
    }

    if (notification.userId !== user.id) {
      throw new ApiError("Forbidden", 403, "FORBIDDEN");
    }

    await prisma.notification.delete({ where: { id } });

    return apiSuccess({ deleted: true, id });
  } catch (err) {
    return handleApiError(err);
  }
}
