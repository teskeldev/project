import Stripe from "stripe";
export { PLAN_CONFIGS, type PlanConfig, type PlanTier } from "@/lib/billing-config";

export const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? "";

let _stripe: Stripe | undefined;

export function getStripe(): Stripe {
  if (_stripe) return _stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not configured");
  _stripe = new Stripe(key, {
    apiVersion: "2023-10-16" as NonNullable<
      ConstructorParameters<typeof Stripe>[1]
    >["apiVersion"],
    typescript: true,
  });
  return _stripe;
}

export const stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    return Reflect.get(getStripe(), prop);
  },
});

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
