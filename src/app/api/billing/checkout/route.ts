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
import {
  createCustomer,
  createCheckoutSession,
  PLAN_CONFIGS,
  type PlanTier,
} from "@/lib/stripe";

const checkoutSchema = z.object({
  workspaceId: z.string().min(1, "workspaceId is required"),
  plan: z.string().min(1, "plan is required"),
});

/**
 * POST /api/billing/checkout
 *
 * Creates a Stripe Checkout session for upgrading to a paid plan.
 * Body: { workspaceId: string, plan: PlanTier }
 */
export async function POST(req: Request) {
  try {
    const user = await requireUser();

    // Rate limit: 5 per minute
    await enforceRateLimit(`billing:checkout:${user.id}`, 5, 60_000);

    const { workspaceId, plan } = await validateBody(req, checkoutSchema);

    const tier = plan.toUpperCase() as PlanTier;
    const planConfig = PLAN_CONFIGS[tier];
    if (!planConfig || !planConfig.priceId) {
      throw new ApiError("Invalid plan tier", 422, "VALIDATION_ERROR");
    }

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

    // Get or create subscription record with Stripe customer
    let subscription = await prisma.subscription.findUnique({
      where: { workspaceId },
    });

    if (!subscription) {
      const workspace = await prisma.workspace.findUnique({
        where: { id: workspaceId },
      });
      if (!workspace) {
        throw new ApiError("Workspace not found", 404, "NOT_FOUND");
      }

      const customer = await createCustomer({
        email: user.email,
        name: workspace.name,
        workspaceId,
      });

      subscription = await prisma.subscription.create({
        data: {
          workspaceId,
          stripeCustomerId: customer.id,
          plan: "FREE",
          status: "ACTIVE",
        },
      });
    }

    const origin = new URL(req.url).origin;
    const session = await createCheckoutSession({
      customerId: subscription.stripeCustomerId,
      priceId: planConfig.priceId,
      successUrl: `${origin}/dashboard/billing?success=true`,
      cancelUrl: `${origin}/dashboard/billing?canceled=true`,
      workspaceId,
    });

    return apiSuccess({ url: session.url });
  } catch (err) {
    return handleApiError(err);
  }
}
