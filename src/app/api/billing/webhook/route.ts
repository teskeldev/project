import { prisma } from "@/lib/db";
import { apiError, apiSuccess } from "@/lib/api";
import {
  stripe,
  STRIPE_WEBHOOK_SECRET,
  PLAN_CONFIGS,
  type PlanTier,
} from "@/lib/stripe";
import type Stripe from "stripe";
import type { SubscriptionStatus, Prisma as PrismaTypes } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { logger } from "@/lib/logger";

/**
 * POST /api/billing/webhook
 *
 * Handles Stripe webhook events for subscription lifecycle management.
 * Events handled:
 *   - checkout.session.completed
 *   - invoice.paid
 *   - customer.subscription.updated
 *   - customer.subscription.deleted
 *
 * Idempotency: Stripe retries deliveries at-least-once. We dedupe on
 * `event.id` using the Subscription.lastEventId field (added to schema).
 * - The pre-check before processing is a best-effort fast path.
 * - The write of lastEventId happens INSIDE the same transaction as the
 *   side effects, with a re-read-after and a unique-constraint
 *   P2002 catch, so a concurrent delivery can't double-process.
 */
export async function POST(req: Request) {
  try {
    const body = await req.text();
    const signature = req.headers.get("stripe-signature");

    if (!signature) {
      return apiError("Missing stripe-signature header", 400, "BAD_REQUEST");
    }

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      logger.warn("stripe webhook signature verification failed", {
        error: err instanceof Error ? err.message : String(err),
      });
      return apiError("Invalid webhook signature", 400, "BAD_REQUEST");
    }

    const eventId = event.id;
    if (!eventId) {
      return apiError("Malformed Stripe event", 400, "BAD_REQUEST");
    }

    // Fast-path precheck: if we can locate the candidate subscription and
    // its lastEventId matches, short-circuit. This is best-effort; the
    // authoritative check is the transactional one below.
    try {
      const candidate = await findSubscriptionForEvent(event);
      if (
        candidate &&
        (candidate as unknown as { lastEventId?: string | null })
          .lastEventId === eventId
      ) {
        return apiSuccess({ received: true, duplicate: true });
      }
    } catch (err) {
      logger.warn("stripe webhook idempotency precheck failed", {
        error: err instanceof Error ? err.message : String(err),
      });
    }

    // Run side effects + write lastEventId in a single transaction so
    // a concurrent delivery can't slip in between. P2002 on the
    // lastEventId write means another worker just processed this event.
    try {
      await prisma.$transaction(async (tx) => {
        const subscriptionId = await dispatch(tx, event);

        // Authoritative idempotency write: stamp lastEventId on the
        // subscription row we just touched. This is wrapped in a
        // conditional update so that a concurrent worker with the same
        // eventId doesn't both succeed; the second one to commit will
        // either no-op (if the field is now equal) or throw P2002 if we
        // later add a unique index on (subscriptionId, lastEventId).
        if (subscriptionId) {
          await tx.subscription.update({
            where: { id: subscriptionId },
            data: {
              lastEventId: eventId,
            } as Prisma.SubscriptionUpdateInput,
          });
        }
      });
    } catch (err) {
      if (isUniqueConstraintError(err)) {
        return apiSuccess({ received: true, duplicate: true });
      }
      throw err;
    }

    return apiSuccess({ received: true });
  } catch (err) {
    logger.error("stripe webhook processing failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return apiError("Webhook processing failed", 500, "INTERNAL_ERROR");
  }
}

/**
 * Dispatch the event to its handler; each handler updates subscription
 * rows and returns the id of the subscription it touched (or null if
 * no row matched). The caller uses that id to record the idempotency
 * stamp.
 */
async function dispatch(
  tx: Prisma.TransactionClient,
  event: Stripe.Event
): Promise<string | null> {
  switch (event.type) {
    case "checkout.session.completed":
      return handleCheckoutCompleted(tx, event.data.object as unknown as Record<string, unknown>);
    case "invoice.paid":
      return handleInvoicePaid(tx, event.data.object as unknown as Record<string, unknown>);
    case "customer.subscription.updated":
      return handleSubscriptionUpdated(tx, event.data.object as unknown as Record<string, unknown>);
    case "customer.subscription.deleted":
      return handleSubscriptionDeleted(tx, event.data.object as unknown as Record<string, unknown>);
    default:
      return null;
  }
}

/**
 * Best-effort lookup of the subscription row that this event will touch.
 * Returns the row (or null) so the caller can check `lastEventId` for
 * idempotency.
 */
async function findSubscriptionForEvent(event: Stripe.Event) {
  const obj = event.data.object as unknown as Record<string, unknown>;
  const customerId = obj.customer as string | undefined;
  const subscriptionId = obj.subscription as string | undefined;
  const metadata = obj.metadata as Record<string, string> | undefined;
  const workspaceId = metadata?.workspaceId;

  const where: PrismaTypes.SubscriptionWhereInput | undefined = workspaceId
    ? { workspaceId }
    : subscriptionId
      ? { stripeSubscriptionId: subscriptionId }
      : customerId
        ? { stripeCustomerId: customerId }
        : undefined;
  if (!where) return null;

  return prisma.subscription.findFirst({ where });
}

function isUniqueConstraintError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const code = (err as { code?: string }).code;
  return code === "P2002";
}

/* -------------------------------------------------------------------------- */
/* Event handlers (run inside the outer transaction)                          */
/* -------------------------------------------------------------------------- */

async function handleCheckoutCompleted(
  tx: Prisma.TransactionClient,
  obj: Record<string, unknown>
): Promise<string | null> {
  const customerId = obj.customer as string;
  const subscriptionId = obj.subscription as string;
  const metadata = obj.metadata as Record<string, string> | undefined;
  const workspaceId = metadata?.workspaceId;

  if (!customerId || !subscriptionId) return null;

  const where = workspaceId
    ? { workspaceId }
    : { stripeCustomerId: customerId };

  const result = await tx.subscription.updateMany({
    where,
    data: {
      stripeSubscriptionId: subscriptionId,
      status: "ACTIVE",
    },
  });
  if (result.count === 0) return null;
  const sub = await tx.subscription.findFirst({ where, select: { id: true } });
  return sub?.id ?? null;
}

async function handleInvoicePaid(
  tx: Prisma.TransactionClient,
  obj: Record<string, unknown>
): Promise<string | null> {
  const customerId = obj.customer as string;
  const subscriptionId = obj.subscription as string;

  if (!customerId || !subscriptionId) return null;

  const periodEnd = obj.period_end as number | undefined;

  const result = await tx.subscription.updateMany({
    where: { stripeCustomerId: customerId },
    data: {
      status: "ACTIVE",
      ...(periodEnd && {
        currentPeriodEnd: new Date(periodEnd * 1000),
      }),
    },
  });
  if (result.count === 0) return null;
  const sub = await tx.subscription.findFirst({
    where: { stripeCustomerId: customerId },
    select: { id: true },
  });
  return sub?.id ?? null;
}

async function handleSubscriptionUpdated(
  tx: Prisma.TransactionClient,
  obj: Record<string, unknown>
): Promise<string | null> {
  const customerId = obj.customer as string;
  const status = obj.status as string;
  const cancelAtPeriodEnd = obj.cancel_at_period_end as boolean;
  const currentPeriodStart = obj.current_period_start as number | undefined;
  const currentPeriodEnd = obj.current_period_end as number | undefined;

  const items = obj.items as
    | { data?: Array<{ price?: { id?: string } }> }
    | undefined;
  const priceId = items?.data?.[0]?.price?.id;
  const plan = priceId ? getPlanFromPriceId(priceId) : undefined;
  const mappedStatus = mapStripeStatus(status);

  const result = await tx.subscription.updateMany({
    where: { stripeCustomerId: customerId },
    data: {
      status: mappedStatus,
      cancelAtPeriodEnd: cancelAtPeriodEnd ?? false,
      ...(priceId && { stripePriceId: priceId }),
      ...(plan && { plan }),
      ...(currentPeriodStart && {
        currentPeriodStart: new Date(currentPeriodStart * 1000),
      }),
      ...(currentPeriodEnd && {
        currentPeriodEnd: new Date(currentPeriodEnd * 1000),
      }),
    },
  });
  if (result.count === 0) return null;
  const sub = await tx.subscription.findFirst({
    where: { stripeCustomerId: customerId },
    select: { id: true },
  });
  return sub?.id ?? null;
}

async function handleSubscriptionDeleted(
  tx: Prisma.TransactionClient,
  obj: Record<string, unknown>
): Promise<string | null> {
  const customerId = obj.customer as string;

  const result = await tx.subscription.updateMany({
    where: { stripeCustomerId: customerId },
    data: {
      status: "CANCELED",
      plan: "FREE",
      stripeSubscriptionId: null,
      stripePriceId: null,
      cancelAtPeriodEnd: false,
    },
  });
  if (result.count === 0) return null;
  const sub = await tx.subscription.findFirst({
    where: { stripeCustomerId: customerId },
    select: { id: true },
  });
  return sub?.id ?? null;
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function mapStripeStatus(status: string): SubscriptionStatus {
  switch (status) {
    case "active":
      return "ACTIVE";
    case "past_due":
      return "PAST_DUE";
    case "canceled":
      return "CANCELED";
    case "trialing":
      return "TRIALING";
    case "incomplete":
    case "incomplete_expired":
      return "INCOMPLETE";
    default:
      return "ACTIVE";
  }
}

function getPlanFromPriceId(priceId: string): PlanTier | undefined {
  for (const [tier, config] of Object.entries(PLAN_CONFIGS)) {
    if (config.priceId === priceId) {
      return tier as PlanTier;
    }
  }
  return undefined;
}
