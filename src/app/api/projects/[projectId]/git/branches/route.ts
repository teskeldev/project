import { apiSuccess, handleApiError, requireProjectAccess } from "@/lib/api";
import { branches } from "@/lib/git/service";

type RouteContext = { params: Promise<{ projectId: string }> };

// GET /api/projects/:projectId/git/branches -> local branches w/ current flag.
export async function GET(_req: Request, ctx: RouteContext) {
  try {
    const { projectId } = await ctx.params;
    const { project } = await requireProjectAccess(projectId);
    const result = await branches(project!.storageKey);
    return apiSuccess(result);
  } catch (err) {
    return handleApiError(err);
  }
}
