import { prisma } from "@/lib/db";
import {
  apiSuccess,
  handleApiError,
  requireProjectAccess,
  ApiError,
} from "@/lib/api";
import type {
  AgentPlan,
  AgentRunResult,
  AgentRunDetailDTO,
  AgentStepDTO,
} from "@/lib/agents/schemas";

type RouteContext = { params: Promise<{ agentRunId: string }> };

// GET /api/agents/:agentRunId
// -> full run: ordered steps, plan, result, linked changeSet id. Access is
// verified via the run's project.
export async function GET(_req: Request, ctx: RouteContext) {
  try {
    const { agentRunId } = await ctx.params;

    const run = await prisma.agentRun.findUnique({
      where: { id: agentRunId },
      include: {
        steps: { orderBy: { createdAt: "asc" } },
        changeSets: { select: { id: true }, take: 1 },
      },
    });
    if (!run) {
      throw new ApiError("Agent run not found", 404, "NOT_FOUND");
    }

    // Authorize via the run's project.
    await requireProjectAccess(run.projectId);

    const steps: AgentStepDTO[] = run.steps.map((s) => ({
      id: s.id,
      type: s.type,
      title: s.title,
      status: s.status,
      input: s.input,
      output: s.output,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
    }));

    const data: AgentRunDetailDTO = {
      id: run.id,
      projectId: run.projectId,
      threadId: run.threadId,
      userId: run.userId,
      status: run.status,
      goal: run.goal,
      error: run.error,
      stepCount: run.steps.length,
      changeSetId: run.changeSets[0]?.id ?? null,
      createdAt: run.createdAt.toISOString(),
      updatedAt: run.updatedAt.toISOString(),
      plan: (run.plan as AgentPlan | null) ?? null,
      result: (run.result as AgentRunResult | null) ?? null,
      steps,
    };

    return apiSuccess({ run: data });
  } catch (err) {
    return handleApiError(err);
  }
}
