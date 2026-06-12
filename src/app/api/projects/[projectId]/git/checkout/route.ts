import {
  apiSuccess,
  handleApiError,
  requireProjectAccess,
  validateBody,
} from "@/lib/api";
import { gitCheckoutSchema } from "@/lib/validators";
import { checkout } from "@/lib/git/service";

type RouteContext = { params: Promise<{ projectId: string }> };

// POST /api/projects/:projectId/git/checkout { name } -> switch branch.
export async function POST(req: Request, ctx: RouteContext) {
  try {
    const { projectId } = await ctx.params;
    const { project } = await requireProjectAccess(projectId);
    const { name } = await validateBody(req, gitCheckoutSchema);
    const result = await checkout(project!.storageKey, name, projectId);
    return apiSuccess(result);
  } catch (err) {
    return handleApiError(err);
  }
}
