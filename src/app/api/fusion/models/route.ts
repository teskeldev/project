import { apiSuccess, handleApiError, requireWorkspaceAccess, ApiError } from "@/lib/api";
import { listAvailableModels } from "@/lib/ai/fusion/models";

// GET /api/fusion/models?workspaceId= — READ-ONLY registry derived from Integrations.
export async function GET(req: Request) {
  try {
    const workspaceId = new URL(req.url).searchParams.get("workspaceId");
    if (!workspaceId) throw new ApiError("workspaceId is required", 400, "BAD_REQUEST");
    await requireWorkspaceAccess(workspaceId);
    const models = await listAvailableModels(workspaceId);
    return apiSuccess({ models });
  } catch (err) {
    return handleApiError(err);
  }
}
