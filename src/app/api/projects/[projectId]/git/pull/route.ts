import { apiSuccess, handleApiError, requireProjectAccess } from "@/lib/api";
import { enforceRateLimit } from "@/lib/rate-limit";
import { pull } from "@/lib/git/service";

type RouteContext = { params: Promise<{ projectId: string }> };

// POST /api/projects/:projectId/git/pull -> pull from remote (friendly error if none).
export async function POST(_req: Request, ctx: RouteContext) {
  try {
    const { projectId } = await ctx.params;
    const { project, user } = await requireProjectAccess(projectId);

    // Rate limit: 10 per minute
    await enforceRateLimit(`git:pull:${user.id}`, 10, 60_000);

    const result = await pull(project!.storageKey);
    return apiSuccess(result);
  } catch (err) {
    return handleApiError(err);
  }
}
