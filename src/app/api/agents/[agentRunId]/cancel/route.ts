import { prisma } from "@/lib/db";
import {
  apiSuccess,
  handleApiError,
  requireProjectAccess,
  ApiError,
} from "@/lib/api";
import { cancel } from "@/lib/agents/runner";

type RouteContext = { params: Promise<{ agentRunId: string }> };

// POST /api/agents/:agentRunId/cancel -> cancel a running/queued agent run.
export async function POST(_req: Request, ctx: RouteContext) {
  try {
    const { agentRunId } = await ctx.params;

    const run = await prisma.agentRun.findUnique({
      where: { id: agentRunId },
      select: { projectId: true },
    });
    if (!run) {
      throw new ApiError("Agent run not found", 404, "NOT_FOUND");
    }

    await requireProjectAccess(run.projectId);

    const cancelled = await cancel(agentRunId);
    return apiSuccess({ cancelled });
  } catch (err) {
    return handleApiError(err);
  }
}
