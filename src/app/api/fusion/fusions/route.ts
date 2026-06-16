import {
  apiSuccess,
  handleApiError,
  requireWorkspaceAccess,
  requireRole,
  validateBody,
  ApiError,
} from "@/lib/api";
import { listFusions, createFusion } from "@/lib/ai/fusion/store";
import { fusionCreate } from "@/lib/ai/fusion/schemas";

// GET /api/fusion/fusions?workspaceId=&includeArchived=
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const workspaceId = url.searchParams.get("workspaceId");
    if (!workspaceId) throw new ApiError("workspaceId is required", 400, "BAD_REQUEST");
    await requireWorkspaceAccess(workspaceId);
    const fusions = await listFusions(workspaceId, {
      includeArchived: url.searchParams.get("includeArchived") === "true",
    });
    return apiSuccess({ fusions });
  } catch (err) {
    return handleApiError(err);
  }
}

// POST /api/fusion/fusions
export async function POST(req: Request) {
  try {
    const body = await validateBody(req, fusionCreate);
    const { user, member } = await requireWorkspaceAccess(body.workspaceId);
    requireRole(member);
    const { workspaceId, ...input } = body;
    const fusion = await createFusion(workspaceId, user.id, input);
    return apiSuccess({ fusion }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
