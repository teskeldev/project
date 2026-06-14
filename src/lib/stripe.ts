import Stripe from "stripe";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY ?? "";
export const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? "";

if (!STRIPE_SECRET_KEY && process.env.NODE_ENV !== "test") {
  console.warn("STRIPE_SECRET_KEY environment variable is not set");
}

export const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: "2023-10-16" as NonNullable<
    ConstructorParameters<typeof Stripe>[1]
  >["apiVersion"],
  typescript: true,
});

/* -------------------------------------------------------------------------- */
/* Plan configuration                                                         */
/* -------------------------------------------------------------------------- */

export type PlanTier = "FREE" | "PRO" | "TEAM" | "ENTERPRISE";

export interface PlanConfig {
  tier: PlanTier;
  name: string;
  priceId: string | null;
  limits: {
    aiTokens: number;
    computeMinutes: number;
    storageMb: number;
    members: number;
  };
}

export const PLAN_CONFIGS: Record<PlanTier, PlanConfig> = {
  FREE: {
    tier: "FREE",
    name: "Hobby",
    priceId: null,
    limits: {
      aiTokens: 50_000,
      computeMinutes: 60,
      storageMb: 500,
      members: 1,
    },
  },
  PRO: {
    tier: "PRO",
    name: "Pro",
    priceId: process.env.STRIPE_PRO_PRICE_ID ?? "",
    limits: {
      aiTokens: 500_000,
      computeMinutes: 600,
      storageMb: 5_000,
      members: 5,
    },
  },
  TEAM: {
    tier: "TEAM",
    name: "Team",
    priceId: process.env.STRIPE_TEAM_PRICE_ID ?? "",
    limits: {
      aiTokens: 2_000_000,
      computeMinutes: 3_000,
      storageMb: 50_000,
      members: 25,
    },
  },
  ENTERPRISE: {
    tier: "ENTERPRISE",
    name: "Enterprise",
    priceId: process.env.STRIPE_ENTERPRISE_PRICE_ID ?? "",
    limits: {
      aiTokens: Infinity,
      computeMinutes: Infinity,
      storageMb: Infinity,
      members: Infinity,
    },
  },
};

/* -------------------------------------------------------------------------- */
/* Customer management                                                        */
/* -------------------------------------------------------------------------- */

export async function createCustomer(params: {
  email: string;
  name: string;
  workspaceId: string;
}) {
  return stripe.customers.create({
    email: params.email,
    name: params.name,
    metadata: {
      workspaceId: params.workspaceId,
    },
  });
}

/* -------------------------------------------------------------------------- */
/* Checkout session                                                           */
/* -------------------------------------------------------------------------- */

export async function createCheckoutSession(params: {
  customerId: string;
  priceId: string;
  successUrl: string;
  cancelUrl: string;
  workspaceId: string;
}) {
  return stripe.checkout.sessions.create({
    customer: params.customerId,
    mode: "subscription",
    line_items: [
      {
        price: params.priceId,
        quantity: 1,
      },
    ],
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    metadata: {
      workspaceId: params.workspaceId,
    },
  });
}

/* -------------------------------------------------------------------------- */
/* Customer portal                                                            */
/* -------------------------------------------------------------------------- */

export async function createPortalSession(params: {
  customerId: string;
  returnUrl: string;
}) {
  return stripe.billingPortal.sessions.create({
    customer: params.customerId,
    return_url: params.returnUrl,
  });
}
