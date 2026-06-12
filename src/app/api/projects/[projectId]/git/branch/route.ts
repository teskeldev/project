import {
  apiSuccess,
  handleApiError,
  requireProjectAccess,
  validateBody,
} from "@/lib/api";
import { gitBranchSchema } from "@/lib/validators";
import { createBranch } from "@/lib/git/service";

type RouteContext = { params: Promise<{ projectId: string }> };

// POST /api/projects/:projectId/git/branch { name } -> create + checkout branch.
export async function POST(req: Request, ctx: RouteContext) {
  try {
    const { projectId } = await ctx.params;
    const { project } = await requireProjectAccess(projectId);
    const { name } = await validateBody(req, gitBranchSchema);
    const result = await createBranch(project!.storageKey, name, projectId);
    return apiSuccess(result);
  } catch (err) {
    return handleApiError(err);
  }
}
