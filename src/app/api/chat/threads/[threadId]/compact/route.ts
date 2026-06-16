import { prisma } from "@/lib/db";
import {
  apiSuccess,
  handleApiError,
  requireProjectAccess,
  ApiError,
} from "@/lib/api";
import { forceCompactThread } from "@/lib/ai/compaction";
import { enforceRateLimit } from "@/lib/rate-limit";

type RouteContext = { params: Promise<{ threadId: string }> };

// POST /api/chat/threads/:threadId/compact
// Force compaction of a thread (even if below threshold).
export async function POST(req: Request, ctx: RouteContext) {
  try {
    const { threadId } = await ctx.params;

    const thread = await prisma.chatThread.findUnique({
      where: { id: threadId },
      select: { id: true, projectId: true },
    });
    if (!thread) {
      throw new ApiError("Thread not found", 404, "NOT_FOUND");
    }

    const { user, project } = await requireProjectAccess(thread.projectId);
    const workspaceId = project!.workspaceId;

    await enforceRateLimit(`chat:threads:compact:${user.id}`, 5, 60_000);

    const result = await forceCompactThread(threadId, { workspaceId });

    if (!result) {
      return apiSuccess({
        compacted: false,
        message: "Not enough messages to compact",
      });
    }

    return apiSuccess({
      compacted: true,
      summary: result.summary,
      compactedCount: result.compactedCount,
      remainingCount: result.remainingCount,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
