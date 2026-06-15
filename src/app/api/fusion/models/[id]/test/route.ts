import { z } from "zod";
import { prisma } from "@/lib/db";
import { apiSuccess, handleApiError, requireWorkspaceAccess, requireRole, validateBody, ApiError } from "@/lib/api";
import { chat } from "@/lib/ai/provider";
import { getProviderCatalog } from "@/lib/ai/fusion/catalog";
import { recordFusionRequest } from "@/lib/ai/fusion/logging";

type Ctx = { params: Promise<{ id: string }> };

const schema = z.object({ workspaceId: z.string().min(1), prompt: z.string().max(2000).optional() });

// POST /api/fusion/models/:id/test — single-completion probe for a registered model.
export async function POST(req: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const { workspaceId, prompt } = await validateBody(req, schema);
    const { member } = await requireWorkspaceAccess(workspaceId);
    requireRole(member);

    const model = await prisma.fusionModel.findFirst({
      where: { id, workspaceId },
      include: { provider: true },
    });
    if (!model) throw new ApiError("Model not found", 404, "NOT_FOUND");

    const baseUrl = model.provider.baseUrl || getProviderCatalog(model.provider.kind)?.baseUrl || undefined;
    const start = Date.now();
    try {
      const out = await chat(
        [{ role: "user", content: prompt || "Reply with the single word: OK" }],
        { model: model.modelId, provider: model.provider.kind, baseUrl, workspaceId, maxTokens: 32, signal: AbortSignal.timeout(30000) }
      );
      const latencyMs = Date.now() - start;
      void recordFusionRequest(workspaceId, { provider: model.provider.kind, modelId: model.modelId, latencyMs, success: true });
      return apiSuccess({ ok: true, latencyMs, sample: out.slice(0, 200) });
    } catch (err) {
      const latencyMs = Date.now() - start;
      const message = err instanceof Error ? err.message : String(err);
      void recordFusionRequest(workspaceId, { provider: model.provider.kind, modelId: model.modelId, latencyMs, success: false, error: message });
      return apiSuccess({ ok: false, latencyMs, error: message });
    }
  } catch (err) {
    return handleApiError(err);
  }
}
