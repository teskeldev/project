import { z } from "zod";
import { apiSuccess, handleApiError, requireWorkspaceAccess, requireRole, validateBody } from "@/lib/api";
import { enforceRateLimit } from "@/lib/rate-limit";
import { runPlayground } from "@/lib/ai/fusion/playground";

const schema = z.object({
  workspaceId: z.string().min(1),
  prompt: z.string().min(1).max(8000),
  modelRefs: z.array(z.string().min(1)).min(1).max(6),
  strategy: z.string().max(40).optional(),
  judgeMode: z.string().max(40).optional(),
  judgeModel: z.string().max(120).optional(),
});

// POST /api/fusion/playground — run a prompt across models + reconcile with a judge.
export async function POST(req: Request) {
  try {
    const body = await validateBody(req, schema);
    const { user, member } = await requireWorkspaceAccess(body.workspaceId);
    requireRole(member);
    await enforceRateLimit(`fusion:playground:${user.id}`, 10, 60_000);
    const result = await runPlayground({
      workspaceId: body.workspaceId,
      prompt: body.prompt,
      modelRefs: body.modelRefs,
      strategy: body.strategy,
      judgeMode: body.judgeMode,
      judgeModel: body.judgeModel,
    });
    return apiSuccess({ result });
  } catch (err) {
    return handleApiError(err);
  }
}
