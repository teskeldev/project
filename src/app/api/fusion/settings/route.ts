import { z } from "zod";
import { apiSuccess, handleApiError, requireWorkspaceAccess, requireRole, validateBody, ApiError } from "@/lib/api";
import { getSettings, updateSettings } from "@/lib/ai/fusion/store";

// GET /api/fusion/settings?workspaceId=
export async function GET(req: Request) {
  try {
    const workspaceId = new URL(req.url).searchParams.get("workspaceId");
    if (!workspaceId) throw new ApiError("workspaceId is required", 400, "BAD_REQUEST");
    await requireWorkspaceAccess(workspaceId);
    const settings = await getSettings(workspaceId);
    return apiSuccess({ settings });
  } catch (err) {
    return handleApiError(err);
  }
}

const patchSchema = z.object({
  workspaceId: z.string().min(1),
  defaults: z.unknown().optional(),
  featureFlags: z.unknown().optional(),
});

// PATCH /api/fusion/settings
export async function PATCH(req: Request) {
  try {
    const { workspaceId, defaults, featureFlags } = await validateBody(req, patchSchema);
    const { member } = await requireWorkspaceAccess(workspaceId);
    requireRole(member);
    const settings = await updateSettings(workspaceId, { defaults, featureFlags });
    return apiSuccess({ settings });
  } catch (err) {
    return handleApiError(err);
  }
}
