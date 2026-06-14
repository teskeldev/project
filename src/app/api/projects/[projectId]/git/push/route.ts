import { apiSuccess, handleApiError, requireProjectAccess, ApiError } from "@/lib/api";
import { enforceRateLimit } from "@/lib/rate-limit";
import { push } from "@/lib/git/service";

type RouteContext = { params: Promise<{ projectId: string }> };

// POST /api/projects/:projectId/git/push -> push to remote (friendly error if none).
export async function POST(_req: Request, ctx: RouteContext) {
  try {
    const { projectId } = await ctx.params;
    const { project, user, member } = await requireProjectAccess(projectId);

    // Role check: viewers cannot push
    if (member.role === "VIEWER") {
      throw new ApiError("Insufficient permissions", 403, "FORBIDDEN");
    }

    // Rate limit: 10 per minute
    await enforceRateLimit(`git:push:${user.id}`, 10, 60_000);

    const result = await push(project!.storageKey);
    return apiSuccess(result);
  } catch (err) {
    return handleApiError(err);
  }
}
