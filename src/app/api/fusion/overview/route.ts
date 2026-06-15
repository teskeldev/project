import { apiSuccess, handleApiError, requireWorkspaceAccess, ApiError } from "@/lib/api";
import { getOverview } from "@/lib/ai/fusion/store";

// GET /api/fusion/overview?workspaceId=
export async function GET(req: Request) {
  try {
    const workspaceId = new URL(req.url).searchParams.get("workspaceId");
    if (!workspaceId) throw new ApiError("workspaceId is required", 400, "BAD_REQUEST");
    await requireWorkspaceAccess(workspaceId);
    const overview = await getOverview(workspaceId);
    return apiSuccess(overview);
  } catch (err) {
    return handleApiError(err);
  }
}
