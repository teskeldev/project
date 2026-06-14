import { prisma } from "@/lib/db";
import {
  apiSuccess,
  handleApiError,
  requireProjectAccess,
  validateBody,
  apiError,
} from "@/lib/api";
import { enforceRateLimit } from "@/lib/rate-limit";
import { isAIConfiguredAsync } from "@/lib/ai/provider";
import { createAgentRunSchema, type AgentRunSummaryDTO } from "@/lib/agents/schemas";
import { startAgentRun } from "@/lib/agents/runner";

type RouteContext = { params: Promise<{ projectId: string }> };

// GET /api/projects/:projectId/agents
// -> agent runs for the project, newest first, with step counts + status.
export async function GET(_req: Request, ctx: RouteContext) {
  try {
    const { projectId } = await ctx.params;
    await requireProjectAccess(projectId);

    const runs = await prisma.agentRun.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        projectId: true,
        threadId: true,
        userId: true,
        status: true,
        goal: true,
        error: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { steps: true } },
        changeSets: { select: { id: true }, take: 1 },
      },
    });

    const data: AgentRunSummaryDTO[] = runs.map((r) => ({
      id: r.id,
      projectId: r.projectId,
      threadId: r.threadId,
      userId: r.userId,
      status: r.status,
      goal: r.goal,
      error: r.error,
      stepCount: r._count.steps,
      changeSetId: r.changeSets[0]?.id ?? null,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }));

    return apiSuccess({ runs: data });
  } catch (err) {
    return handleApiError(err);
  }
}

// POST /api/projects/:projectId/agents
// Body: { goal, threadId? } -> create a QUEUED run. Execution is triggered when
// the client opens the events stream (see runner.ts driving model).
export async function POST(req: Request, ctx: RouteContext) {
  try {
    const { projectId } = await ctx.params;
    const { user, member } = await requireProjectAccess(projectId);
    const { goal, threadId } = await validateBody(req, createAgentRunSchema);

    // Throttle run creation per user (10/min). Production: back with Redis.
    await enforceRateLimit(`agents:create:${user.id}`, 10, 60_000);

    if (!await isAIConfiguredAsync(undefined, member.workspaceId)) {
      return apiError(
        "AI is not configured. Add an OpenAI key in Integrations to enable agents.",
        503,
        "AI_NOT_CONFIGURED"
      );
    }

    const run = await startAgentRun({
      projectId,
      userId: user.id,
      goal,
      threadId,
    });

    const data: AgentRunSummaryDTO = {
      id: run.id,
      projectId: run.projectId,
      threadId: run.threadId,
      userId: run.userId,
      status: run.status,
      goal: run.goal,
      error: run.error,
      stepCount: 0,
      changeSetId: null,
      createdAt: run.createdAt.toISOString(),
      updatedAt: run.updatedAt.toISOString(),
    };

    return apiSuccess({ run: data }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
