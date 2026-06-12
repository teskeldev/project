import { apiSuccess, handleApiError, requireProjectAccess } from "@/lib/api";
import { initRepo } from "@/lib/git/service";

type RouteContext = { params: Promise<{ projectId: string }> };

// POST /api/projects/:projectId/git/init -> initialise a git repo on disk.
export async function POST(_req: Request, ctx: RouteContext) {
  try {
    const { projectId } = await ctx.params;
    const { project } = await requireProjectAccess(projectId);
    const result = await initRepo(project!.storageKey, projectId);
    return apiSuccess(result);
  } catch (err) {
    return handleApiError(err);
  }
}
