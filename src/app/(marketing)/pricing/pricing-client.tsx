"use client";

import { useState } from "react";
import { Check, Minus } from "lucide-react";
import { motion } from "framer-motion";
import Link from "next/link";
import { Button, Card, Badge } from "@/components/ui";

const plans = [
  {
    name: "Hobby",
    price: { monthly: "Free", yearly: "Free" },
    description: "Perfect for personal projects and learning",
    cta: "Get started",
    ctaVariant: "outline" as const,
    features: [
      { name: "2,000 completions/month", included: true },
      { name: "50 slow premium requests/month", included: true },
      { name: "Community support", included: true },
      { name: "Basic AI chat", included: true },
      { name: "Fast premium requests", included: false },
      { name: "Custom models", included: false },
      { name: "Team features", included: false },
      { name: "SSO & SAML", included: false },
    ],
  },
  {
    name: "Pro",
    price: { monthly: "$20", yearly: "$16" },
    description: "For professional developers who want more",
    cta: "Start free trial",
    ctaVariant: "default" as const,
    popular: true,
    features: [
      { name: "Unlimited completions", included: true },
      { name: "500 fast premium requests/month", included: true },
      { name: "Unlimited slow premium requests", included: true },
      { name: "Advanced AI chat", included: true },
      { name: "Priority support", included: true },
      { name: "Custom models", included: false },
      { name: "Team features", included: false },
      { name: "SSO & SAML", included: false },
    ],
  },
  {
    name: "Business",
    price: { monthly: "$40", yearly: "$32" },
    description: "For teams and organizations",
    cta: "Contact sales",
    ctaVariant: "outline" as const,
    features: [
      { name: "Everything in Pro", included: true },
      { name: "Unlimited fast premium requests", included: true },
      { name: "Admin dashboard & analytics", included: true },
      { name: "Custom models", included: true },
      { name: "Team management", included: true },
      { name: "SSO & SAML", included: true },
      { name: "Dedicated support", included: true },
      { name: "SLA guarantee", included: true },
    ],
  },
];

export default function PricingPage() {
  const [yearly, setYearly] = useState(false);

  return (
    <div className="px-6 py-20">
      <div className="mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-16 text-center"
        >
          <h1 className="text-4xl font-semibold tracking-tight text-foreground md:text-5xl">
            Pricing
          </h1>
          <p className="mx-auto mt-4 max-w-lg text-base text-text-secondary">
            Start for free, upgrade when you need more. All plans include a
            14-day free trial.
          </p>

          {/* Toggle */}
          <div className="mt-8 inline-flex items-center gap-3 rounded-full border border-border bg-surface p-1">
            <button
              onClick={() => setYearly(false)}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                !yearly
                  ? "bg-primary text-background"
                  : "text-text-secondary hover:text-foreground"
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setYearly(true)}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                yearly
                  ? "bg-primary text-background"
                  : "text-text-secondary hover:text-foreground"
              }`}
            >
              Yearly
              <Badge className="ml-1.5 bg-accent-light text-accent">
                Save 20%
              </Badge>
            </button>
          </div>
        </motion.div>

        <div className="grid gap-6 md:grid-cols-3">
          {plans.map((plan, i) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
            >
              <Card
                className={`relative rounded-2xl p-8 ${
                  plan.popular
                    ? "border-accent shadow-lg"
                    : ""
                }`}
              >
                {plan.popular && (
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">
                    Most popular
                  </Badge>
                )}

                <h3 className="text-lg font-semibold text-foreground">
                  {plan.name}
                </h3>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-4xl font-bold text-foreground">
                    {yearly ? plan.price.yearly : plan.price.monthly}
                  </span>
                  {plan.price.monthly !== "Free" && (
                    <span className="text-sm text-text-secondary">/month</span>
                  )}
                </div>
                <p className="mt-2 text-sm text-text-secondary">
                  {plan.description}
                </p>

                <Button
                  variant={plan.ctaVariant}
                  className="mt-6 w-full"
                  asChild
                >
                  <Link href="/signup">{plan.cta}</Link>
                </Button>

                <ul className="mt-8 space-y-3">
                  {plan.features.map((feature) => (
                    <li
                      key={feature.name}
                      className="flex items-center gap-3 text-sm"
                    >
                      {feature.included ? (
                        <Check size={16} className="text-emerald-500" />
                      ) : (
                        <Minus size={16} className="text-text-muted" />
                      )}
                      <span
                        className={
                          feature.included
                            ? "text-foreground"
                            : "text-text-muted"
                        }
                      >
                        {feature.name}
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* FAQ */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="mt-24"
        >
          <h2 className="mb-8 text-center text-2xl font-semibold text-foreground">
            Frequently asked questions
          </h2>
          <div className="mx-auto max-w-2xl space-y-4">
            {[
              {
                q: "What counts as a completion?",
                a: "Each time Teskel suggests code as you type (Tab completions), it counts as one completion. Multi-line suggestions also count as one.",
              },
              {
                q: "What are premium requests?",
                a: "Premium requests include AI chat messages, agent actions, and code generation tasks that use our most powerful models.",
              },
              {
                q: "Can I cancel anytime?",
                a: "Yes, you can cancel your subscription at any time. You'll retain access until the end of your billing period.",
              },
              {
                q: "Do you offer student discounts?",
                a: "Yes! Students and educators get 50% off Pro plans. Verify with your .edu email to get started.",
              },
            ].map((faq) => (
              <Card key={faq.q} className="rounded-xl p-6">
                <h3 className="text-sm font-semibold text-foreground">
                  {faq.q}
                </h3>
                <p className="mt-2 text-sm text-text-secondary">{faq.a}</p>
              </Card>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
