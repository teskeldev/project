import { apiSuccess, handleApiError, requireProjectAccess } from "@/lib/api";
import { log } from "@/lib/git/service";

type RouteContext = { params: Promise<{ projectId: string }> };

// GET /api/projects/:projectId/git/log?limit= -> commit history.
export async function GET(req: Request, ctx: RouteContext) {
  try {
    const { projectId } = await ctx.params;
    const { project } = await requireProjectAccess(projectId);

    const url = new URL(req.url);
    const raw = url.searchParams.get("limit");
    const parsed = raw ? Number.parseInt(raw, 10) : 50;
    const limit =
      Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 500) : 50;

    const result = await log(project!.storageKey, limit);
    return apiSuccess(result);
  } catch (err) {
    return handleApiError(err);
  }
}
