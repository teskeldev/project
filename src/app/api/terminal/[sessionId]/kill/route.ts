import { prisma } from "@/lib/db";
import {
  apiSuccess,
  handleApiError,
  requireProjectAccess,
  ApiError,
} from "@/lib/api";
import { killSession } from "@/lib/terminal/runner";

type RouteContext = { params: Promise<{ sessionId: string }> };

// POST /api/terminal/:sessionId/kill -> terminate the running command, if any.
export async function POST(_req: Request, ctx: RouteContext) {
  try {
    const { sessionId } = await ctx.params;

    const session = await prisma.terminalSession.findUnique({
      where: { id: sessionId },
      select: { id: true, projectId: true, userId: true },
    });
    if (!session) {
      throw new ApiError("Terminal session not found", 404, "NOT_FOUND");
    }

    // Access derived from the session's project.
    const { user } = await requireProjectAccess(session.projectId);

    // Verify session ownership - only the session creator can kill commands
    if (!session.userId || session.userId !== user.id) {
      throw new ApiError("You do not own this terminal session", 403, "FORBIDDEN");
    }

    const killed = killSession(sessionId);
    return apiSuccess({ killed });
  } catch (err) {
    return handleApiError(err);
  }
}