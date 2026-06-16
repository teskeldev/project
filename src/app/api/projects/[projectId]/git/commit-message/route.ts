import {
  apiSuccess,
  handleApiError,
  requireProjectAccess,
  ApiError,
} from "@/lib/api";
import { enforceRateLimit } from "@/lib/rate-limit";
import { generateCommitMessage } from "@/lib/ai/commit-message";

type RouteContext = { params: Promise<{ projectId: string }> };

// POST /api/projects/:projectId/git/commit-message
export async function POST(_req: Request, ctx: RouteContext) {
  try {
    const { projectId } = await ctx.params;
    const { project, member, user } = await requireProjectAccess(projectId);

    // Rate limit: 20 per minute
    await enforceRateLimit(`git:commit-message:${user.id}`, 20, 60_000);

    const message = await generateCommitMessage(project!.storageKey, {
      workspaceId: member.workspaceId,
    });

    return apiSuccess({ message });
  } catch (err) {
    if (err instanceof Error && err.message === "AI is not configured") {
      return handleApiError(
        new ApiError(
          "AI is not configured. Add an API key in Integrations to enable commit message generation.",
          503,
          "AI_NOT_CONFIGURED"
        )
      );
    }
    if (
      err instanceof Error &&
      err.message === "No staged changes to generate a message for"
    ) {
      return handleApiError(
        new ApiError(err.message, 400, "NO_STAGED_CHANGES")
      );
    }
    return handleApiError(err);
  }
}
