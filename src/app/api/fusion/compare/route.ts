import { z } from "zod";
import { apiSuccess, handleApiError, requireWorkspaceAccess, requireRole, validateBody } from "@/lib/api";
import { enforceRateLimit } from "@/lib/rate-limit";
import { compareModels } from "@/lib/ai/fusion/compare";

const schema = z.object({
  workspaceId: z.string().min(1),
  prompt: z.string().min(1).max(8000),
  modelIds: z.array(z.string().min(1)).min(1).max(6),
});

// POST /api/fusion/compare — run a prompt across registered models in parallel.
export async function POST(req: Request) {
  try {
    const { workspaceId, prompt, modelIds } = await validateBody(req, schema);
    const { user, member } = await requireWorkspaceAccess(workspaceId);
    requireRole(member);
    await enforceRateLimit(`fusion:compare:${user.id}`, 10, 60_000);
    const results = await compareModels(workspaceId, prompt, modelIds);
    return apiSuccess({ results });
  } catch (err) {
    return handleApiError(err);
  }
}
