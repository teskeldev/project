import { apiSuccess, handleApiError, requireWorkspaceAccess, requireRole, validateBody } from "@/lib/api";
import { workspaceOnly } from "@/lib/ai/fusion/schemas";
import { checkProviderHealth } from "@/lib/ai/fusion/health";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const { workspaceId } = await validateBody(req, workspaceOnly);
    const { member } = await requireWorkspaceAccess(workspaceId);
    requireRole(member);
    const result = await checkProviderHealth(workspaceId, id);
    return apiSuccess({ result });
  } catch (err) {
    return handleApiError(err);
  }
}
