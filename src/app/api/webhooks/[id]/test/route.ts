import { prisma } from "@/lib/db";
import {
  apiSuccess,
  handleApiError,
  requireUser,
  ApiError,
} from "@/lib/api";
import { enforceRateLimit } from "@/lib/rate-limit";
import { sendTestWebhook } from "@/lib/webhooks";

type RouteContext = { params: Promise<{ id: string }> };

// POST /api/webhooks/:id/test
// Send a test webhook delivery.
export async function POST(_req: Request, ctx: RouteContext) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;

    // Rate limit: 5 per minute
    await enforceRateLimit(`webhooks:test:${user.id}`, 5, 60_000);

    const webhook = await prisma.webhook.findUnique({ where: { id } });
    if (!webhook) {
      throw new ApiError("Webhook not found", 404, "NOT_FOUND");
    }

    const member = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: webhook.workspaceId,
          userId: user.id,
        },
      },
    });
    if (!member) {
      throw new ApiError(
        "You do not have access to this webhook",
        403,
        "FORBIDDEN"
      );
    }

    const result = await sendTestWebhook(id);

    return apiSuccess(result);
  } catch (err) {
    return handleApiError(err);
  }
}
