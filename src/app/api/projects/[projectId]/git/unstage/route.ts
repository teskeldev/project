import {
  apiSuccess,
  handleApiError,
  requireProjectAccess,
  validateBody,
} from "@/lib/api";
import { gitPathsSchema } from "@/lib/validators";
import { unstage } from "@/lib/git/service";

type RouteContext = { params: Promise<{ projectId: string }> };

// POST /api/projects/:projectId/git/unstage { paths[] }
export async function POST(req: Request, ctx: RouteContext) {
  try {
    const { projectId } = await ctx.params;
    const { project } = await requireProjectAccess(projectId);
    const { paths } = await validateBody(req, gitPathsSchema);
    const result = await unstage(project!.storageKey, paths);
    return apiSuccess(result);
  } catch (err) {
    return handleApiError(err);
  }
}
