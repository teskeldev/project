import { prisma } from "@/lib/db";
import {
  apiSuccess,
  handleApiError,
  requireProjectAccess,
  ApiError,
} from "@/lib/api";
import { killSession } from "@/lib/terminal/runner";

type RouteContext = { params: Promise<{ sessionId: string }> };

// DELETE /api/terminal/:sessionId -> mark the session CLOSED (and kill any
// running command). History rows are retained.
export async function DELETE(_req: Request, ctx: RouteContext) {
  try {
    const { sessionId } = await ctx.params;

    const session = await prisma.terminalSession.findUnique({
      where: { id: sessionId },
      select: { id: true, projectId: true, userId: true, status: true },
    });
    if (!session) {
      throw new ApiError("Terminal session not found", 404, "NOT_FOUND");
    }

    const { user } = await requireProjectAccess(session.projectId);

    // Verify session ownership - only the session creator can close the session
    if (!session.userId || session.userId !== user.id) {
      throw new ApiError("You do not own this terminal session", 403, "FORBIDDEN");
    }

    // Stop anything still executing for this session.
    killSession(sessionId);

    await prisma.terminalSession.update({
      where: { id: sessionId },
      data: { status: "CLOSED" },
    });

    return apiSuccess({ closed: true });
  } catch (err) {
    return handleApiError(err);
  }
}