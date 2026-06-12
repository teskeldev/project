import { apiSuccess, handleApiError, requireProjectAccess } from "@/lib/api";
import { pull } from "@/lib/git/service";

type RouteContext = { params: Promise<{ projectId: string }> };

// POST /api/projects/:projectId/git/pull -> pull from remote (friendly error if none).
export async function POST(_req: Request, ctx: RouteContext) {
  try {
    const { projectId } = await ctx.params;
    const { project } = await requireProjectAccess(projectId);
    const result = await pull(project!.storageKey);
    return apiSuccess(result);
  } catch (err) {
    return handleApiError(err);
  }
}
