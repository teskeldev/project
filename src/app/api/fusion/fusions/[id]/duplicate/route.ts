import { apiSuccess, handleApiError, requireWorkspaceAccess, requireRole, validateBody } from "@/lib/api";
import { duplicateFusion } from "@/lib/ai/fusion/store";
import { workspaceOnly } from "@/lib/ai/fusion/schemas";

type Ctx = { params: Promise<{ id: string }> };

// POST /api/fusion/fusions/:id/duplicate
export async function POST(req: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const { workspaceId } = await validateBody(req, workspaceOnly);
    const { user, member } = await requireWorkspaceAccess(workspaceId);
    requireRole(member);
    const fusion = await duplicateFusion(workspaceId, id, user.id);
    return apiSuccess({ fusion }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
