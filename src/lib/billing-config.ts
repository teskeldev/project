/**
 * Plan tier definitions — no Stripe client, safe to import anywhere.
 * The Stripe client lives in lib/stripe.ts which must only be imported
 * from server-side billing routes (never from quota/AI pipelines).
 */

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
