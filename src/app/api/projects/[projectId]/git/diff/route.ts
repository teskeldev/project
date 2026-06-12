import { apiSuccess, handleApiError, requireProjectAccess } from "@/lib/api";
import { diff } from "@/lib/git/service";

type RouteContext = { params: Promise<{ projectId: string }> };

// GET /api/projects/:projectId/git/diff?path=&staged= -> unified diff text.
export async function GET(req: Request, ctx: RouteContext) {
  try {
    const { projectId } = await ctx.params;
    const { project } = await requireProjectAccess(projectId);

    const url = new URL(req.url);
    const path = url.searchParams.get("path") ?? undefined;
    const staged = url.searchParams.get("staged") === "true";

    const result = await diff(project!.storageKey, { path, staged });
    return apiSuccess(result);
  } catch (err) {
    return handleApiError(err);
  }
}
