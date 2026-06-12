import { prisma } from "@/lib/db";
import { apiSuccess, handleApiError, requireProjectAccess, ApiError } from "@/lib/api";

type RouteContext = { params: Promise<{ sessionId: string }> };

/**
 * GET /api/design/sessions/[sessionId]
 * Get session detail with versions (newest first). Verifies access via project.
 */
export async function GET(
  _req: Request,
  context: RouteContext
): Promise<Response> {
  try {
    const { sessionId } = await context.params;

    const session = await prisma.designSession.findUnique({
      where: { id: sessionId },
      include: {
        versions: {
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!session) {
      throw new ApiError("Session not found", 404, "NOT_FOUND");
    }

    // Verify the caller has access to the project this session belongs to
    await requireProjectAccess(session.projectId);

    return apiSuccess({ session });
  } catch (err) {
    return handleApiError(err);
  }
}
