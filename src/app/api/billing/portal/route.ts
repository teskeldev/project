import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  apiSuccess,
  handleApiError,
  requireUser,
  validateBody,
  ApiError,
} from "@/lib/api";
import { enforceRateLimit } from "@/lib/rate-limit";
import { createPortalSession } from "@/lib/stripe";

const portalSchema = z.object({
  workspaceId: z.string().min(1, "workspaceId is required"),
});

/**
 * POST /api/billing/portal
 *
 * Creates a Stripe Customer Portal session for managing subscription,
 * payment methods, and billing history.
 * Body: { workspaceId: string }
 */
export async function POST(req: Request) {
  try {
    const user = await requireUser();

    // Rate limit: 5 per minute
    await enforceRateLimit(`billing:portal:${user.id}`, 5, 60_000);

    const { workspaceId } = await validateBody(req, portalSchema);

    // Verify workspace membership
    const member = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: user.id } },
    });
    if (!member) {
      throw new ApiError(
        "You do not have access to this workspace",
        403,
        "FORBIDDEN"
      );
    }

    // Only OWNER or ADMIN can manage billing
    if (member.role !== "OWNER" && member.role !== "ADMIN") {
      throw new ApiError(
        "Only workspace owners and admins can manage billing",
        403,
        "FORBIDDEN"
      );
    }

    const subscription = await prisma.subscription.findUnique({
      where: { workspaceId },
    });

    if (!subscription) {
      throw new ApiError(
        "No billing account found. Please upgrade first.",
        404,
        "NOT_FOUND"
      );
    }

    const origin = new URL(req.url).origin;
    const session = await createPortalSession({
      customerId: subscription.stripeCustomerId,
      returnUrl: `${origin}/dashboard/billing`,
    });

    return apiSuccess({ url: session.url });
  } catch (err) {
    return handleApiError(err);
  }
}
