import {
  apiSuccess,
  handleApiError,
  requireProjectAccess,
  validateBody,
} from "@/lib/api";
import { gitCommitSchema } from "@/lib/validators";
import { commit } from "@/lib/git/service";

type RouteContext = { params: Promise<{ projectId: string }> };

// POST /api/projects/:projectId/git/commit { message, paths? }
export async function POST(req: Request, ctx: RouteContext) {
  try {
    const { projectId } = await ctx.params;
    const { project } = await requireProjectAccess(projectId);
    const { message, paths } = await validateBody(req, gitCommitSchema);
    const result = await commit(project!.storageKey, message, paths, projectId);
    return apiSuccess(result);
  } catch (err) {
    return handleApiError(err);
  }
}
