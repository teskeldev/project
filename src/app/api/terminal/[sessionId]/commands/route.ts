import { prisma } from "@/lib/db";
import {
  apiSuccess,
  handleApiError,
  requireProjectAccess,
  ApiError,
} from "@/lib/api";

type RouteContext = { params: Promise<{ sessionId: string }> };

// GET /api/terminal/:sessionId/commands -> prior command history (oldest first)
// so the UI can restore a session on open.
export async function GET(_req: Request, ctx: RouteContext) {
  try {
    const { sessionId } = await ctx.params;

    const session = await prisma.terminalSession.findUnique({
      where: { id: sessionId },
      select: { id: true, projectId: true, userId: true },
    });
    if (!session) {
      throw new ApiError("Terminal session not found", 404, "NOT_FOUND");
    }

    const { user } = await requireProjectAccess(session.projectId);

    // Verify session ownership - only the session creator can view command history
    if (!session.userId || session.userId !== user.id) {
      throw new ApiError("You do not own this terminal session", 403, "FORBIDDEN");
    }

    const commands = await prisma.terminalCommand.findMany({
      where: { sessionId },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        sessionId: true,
        command: true,
        output: true,
        exitCode: true,
        createdAt: true,
      },
    });

    return apiSuccess({ commands });
  } catch (err) {
    return handleApiError(err);
  }
}