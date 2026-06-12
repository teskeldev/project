import { apiSuccess, handleApiError, requireProjectAccess } from "@/lib/api";
import { status } from "@/lib/git/service";

type RouteContext = { params: Promise<{ projectId: string }> };

// GET /api/projects/:projectId/git/status -> structured status or {isRepo:false}
export async function GET(_req: Request, ctx: RouteContext) {
  try {
    const { projectId } = await ctx.params;
    const { project } = await requireProjectAccess(projectId);
    const result = await status(project!.storageKey);
    return apiSuccess(result);
  } catch (err) {
    return handleApiError(err);
  }
}
