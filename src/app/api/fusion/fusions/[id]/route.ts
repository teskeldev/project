import {
  apiSuccess,
  handleApiError,
  requireWorkspaceAccess,
  requireRole,
  validateBody,
  ApiError,
} from "@/lib/api";
import { getFusion, updateFusion, deleteFusion } from "@/lib/ai/fusion/store";
import { fusionUpdate, workspaceOnly } from "@/lib/ai/fusion/schemas";

type Ctx = { params: Promise<{ id: string }> };

// GET /api/fusion/fusions/:id?workspaceId=
export async function GET(req: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const workspaceId = new URL(req.url).searchParams.get("workspaceId");
    if (!workspaceId) throw new ApiError("workspaceId is required", 400, "BAD_REQUEST");
    await requireWorkspaceAccess(workspaceId);
    const fusion = await getFusion(workspaceId, id);
    if (!fusion) throw new ApiError("Fusion not found", 404, "NOT_FOUND");
    return apiSuccess({ fusion });
  } catch (err) {
    return handleApiError(err);
  }
}

// PATCH /api/fusion/fusions/:id  (edit, archive via status)
export async function PATCH(req: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const body = await validateBody(req, fusionUpdate);
    const { member } = await requireWorkspaceAccess(body.workspaceId);
    requireRole(member);
    const { workspaceId, ...input } = body;
    const fusion = await updateFusion(workspaceId, id, input);
    return apiSuccess({ fusion });
  } catch (err) {
    return handleApiError(err);
  }
}

// DELETE /api/fusion/fusions/:id  (prefer archive; hard delete available)
export async function DELETE(req: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const { workspaceId } = await validateBody(req, workspaceOnly);
    const { member } = await requireWorkspaceAccess(workspaceId);
    requireRole(member);
    await deleteFusion(workspaceId, id);
    return apiSuccess({ deleted: true });
  } catch (err) {
    return handleApiError(err);
  }
}
