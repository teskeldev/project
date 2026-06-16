import {
  apiSuccess,
  handleApiError,
  requireProjectAccess,
  validateBody,
  ApiError,
} from "@/lib/api";
import { enforceRateLimit } from "@/lib/rate-limit";
import { gitCommitSchema } from "@/lib/validators";
import { commit } from "@/lib/git/service";

type RouteContext = { params: Promise<{ projectId: string }> };

// POST /api/projects/:projectId/git/commit { message, paths? }
export async function POST(req: Request, ctx: RouteContext) {
  try {
    const { projectId } = await ctx.params;
    const { project, user, member } = await requireProjectAccess(projectId);

    // Role check: viewers cannot commit
    if (member.role === "VIEWER") {
      throw new ApiError("Insufficient permissions", 403, "FORBIDDEN");
    }

    // Rate limit: 20 per minute
    await enforceRateLimit(`git:commit:${user.id}`, 20, 60_000);

    const { message, paths } = await validateBody(req, gitCommitSchema);
    const result = await commit(project!.storageKey, message, paths, projectId);
    return apiSuccess(result);
  } catch (err) {
    return handleApiError(err);
  }
}
