/**
 * Stripe billing service.
 *
 * Uses direct fetch calls to the Stripe API (no SDK dependency) following the
 * same pattern as the AI provider integrations.
 */

import { timingSafeEqual } from "crypto";

const STRIPE_API_BASE = "https://api.stripe.com/v1";
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY ?? "";
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? "";

export { STRIPE_WEBHOOK_SECRET };

/**
 * Returns the Stripe secret key, throwing if not configured.
 */
function requireStripeSecretKey(): string {
  if (!STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY environment variable must be set");
  }
  return STRIPE_SECRET_KEY;
}

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
/* Stripe API helpers                                                         */
/* -------------------------------------------------------------------------- */

interface StripeRequestOptions {
  method?: "GET" | "POST" | "DELETE";
  path: string;
  body?: Record<string, string | undefined>;
}

async function stripeRequest<T = unknown>(opts: StripeRequestOptions): Promise<T> {
  const { method = "POST", path, body } = opts;
  const key = requireStripeSecretKey();

  const headers: Record<string, string> = {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/x-www-form-urlencoded",
  };

  let encodedBody: string | undefined;
  if (body) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(body)) {
      if (value !== undefined) {
        params.append(key, value);
      }
    }
    encodedBody = params.toString();
  }

  const res = await fetch(`${STRIPE_API_BASE}${path}`, {
    method,
    headers,
    body: encodedBody,
  });

  const data = await res.json();

  if (!res.ok) {
    const message = data?.error?.message ?? `Stripe API error: ${res.status}`;
    throw new Error(message);
  }

  return data as T;
}

/* -------------------------------------------------------------------------- */
/* Customer management                                                        */
/* -------------------------------------------------------------------------- */

export interface StripeCustomer {
  id: string;
  email: string;
  name: string | null;
  metadata: Record<string, string>;
}

export async function createCustomer(params: {
  email: string;
  name: string;
  workspaceId: string;
}): Promise<StripeCustomer> {
  return stripeRequest<StripeCustomer>({
    path: "/customers",
    body: {
      email: params.email,
      name: params.name,
      "metadata[workspaceId]": params.workspaceId,
    },
  });
}

/* -------------------------------------------------------------------------- */
/* Checkout session                                                           */
/* -------------------------------------------------------------------------- */

export interface StripeCheckoutSession {
  id: string;
  url: string;
}

export async function createCheckoutSession(params: {
  customerId: string;
  priceId: string;
  successUrl: string;
  cancelUrl: string;
  workspaceId: string;
}): Promise<StripeCheckoutSession> {
  return stripeRequest<StripeCheckoutSession>({
    path: "/checkout/sessions",
    body: {
      customer: params.customerId,
      mode: "subscription",
      "line_items[0][price]": params.priceId,
      "line_items[0][quantity]": "1",
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      "metadata[workspaceId]": params.workspaceId,
    },
  });
}

/* -------------------------------------------------------------------------- */
/* Customer portal                                                            */
/* -------------------------------------------------------------------------- */

export interface StripePortalSession {
  id: string;
  url: string;
}

export async function createPortalSession(params: {
  customerId: string;
  returnUrl: string;
}): Promise<StripePortalSession> {
  return stripeRequest<StripePortalSession>({
    path: "/billing_portal/sessions",
    body: {
      customer: params.customerId,
      return_url: params.returnUrl,
    },
  });
}

/* -------------------------------------------------------------------------- */
/* Webhook signature verification                                             */
/* -------------------------------------------------------------------------- */

export async function verifyWebhookSignature(
  payload: string,
  signature: string
): Promise<boolean> {
  // Refuse to verify if the webhook secret is not configured – using an empty
  // HMAC key would allow any payload to pass verification.
  if (!STRIPE_WEBHOOK_SECRET) {
    console.error("[stripe] STRIPE_WEBHOOK_SECRET is not configured – rejecting webhook");
    return false;
  }

  // Stripe uses HMAC-SHA256 with the format: t=timestamp,v1=signature
  const parts = signature.split(",");
  const timestampPart = parts.find((p) => p.startsWith("t="));
  const sigPart = parts.find((p) => p.startsWith("v1="));

  if (!timestampPart || !sigPart) return false;

  const timestamp = timestampPart.slice(2);
  const expectedSig = sigPart.slice(3);

  // Check timestamp tolerance (5 minutes)
  const now = Math.floor(Date.now() / 1000);
  const parsedTimestamp = Number.parseInt(timestamp, 10);
  if (!Number.isFinite(parsedTimestamp)) return false;
  if (Math.abs(now - parsedTimestamp) > 300) return false;

  const signedPayload = `${timestamp}.${payload}`;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(STRIPE_WEBHOOK_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(signedPayload));
  const computedSig = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // Use timing-safe comparison to prevent timing attacks
  const computedBuffer = Buffer.from(computedSig, "utf8");
  const expectedBuffer = Buffer.from(expectedSig, "utf8");

  if (computedBuffer.length !== expectedBuffer.length) return false;

  return timingSafeEqual(computedBuffer, expectedBuffer);
}

/* -------------------------------------------------------------------------- */
/* Webhook event types                                                        */
/* -------------------------------------------------------------------------- */

export class StripeWebhookParseError extends Error {
  public readonly cause?: unknown;
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "StripeWebhookParseError";
    this.cause = cause;
  }
}

export interface StripeEvent {
  id: string;
  type: string;
  data: {
    object: Record<string, unknown>;
  };
}

export function parseStripeEvent(body: string): StripeEvent {
  try {
    return JSON.parse(body) as StripeEvent;
  } catch (err) {
    throw new StripeWebhookParseError(
      "Failed to parse Stripe webhook payload as JSON",
      err
    );
  }
}
