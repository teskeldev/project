import { apiSuccess, handleApiError, requireWorkspaceAccess, requireRole, validateBody } from "@/lib/api";
import { enforceRateLimit } from "@/lib/rate-limit";
import { playgroundRun } from "@/lib/ai/fusion/schemas";
import { runFusion } from "@/lib/ai/fusion/runner";

// POST /api/fusion/playground — run a saved Fusion against a prompt.
export async function POST(req: Request) {
  try {
    const { workspaceId, fusionId, prompt } = await validateBody(req, playgroundRun);
    const { user, member } = await requireWorkspaceAccess(workspaceId);
    requireRole(member);
    await enforceRateLimit(`fusion:playground:${user.id}`, 10, 60_000);
    const result = await runFusion({ fusionId, prompt, workspaceId, signal: req.signal });
    return apiSuccess({ result });
  } catch (err) {
    return handleApiError(err);
  }
}
