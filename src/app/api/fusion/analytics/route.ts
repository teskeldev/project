import { apiSuccess, handleApiError, requireWorkspaceAccess, ApiError } from "@/lib/api";
import { getAnalytics, type AnalyticsRange } from "@/lib/ai/fusion/logging";

const RANGES: AnalyticsRange[] = ["24h", "7d", "30d", "90d"];

// GET /api/fusion/analytics?workspaceId=&range=7d
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const workspaceId = url.searchParams.get("workspaceId");
    if (!workspaceId) throw new ApiError("workspaceId is required", 400, "BAD_REQUEST");
    await requireWorkspaceAccess(workspaceId);
    const rangeParam = url.searchParams.get("range") as AnalyticsRange | null;
    const range = rangeParam && RANGES.includes(rangeParam) ? rangeParam : "7d";
    const analytics = await getAnalytics(workspaceId, range);
    return apiSuccess(analytics);
  } catch (err) {
    return handleApiError(err);
  }
}
