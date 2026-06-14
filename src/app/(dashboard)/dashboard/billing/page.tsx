"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CreditCard,
  Zap,
  Cpu,
  HardDrive,
  ArrowUpRight,
  Check,
  Loader2,
  AlertTriangle,
  Crown,
} from "lucide-react";
import { useProject } from "@/lib/store/project";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

interface UsageMeter {
  used: number;
  limit: number;
}

interface BillingData {
  plan: string;
  planName: string;
  status: string;
  currentPeriodStart: string;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  usage: {
    aiTokens: UsageMeter;
    computeMinutes: UsageMeter;
    storageMb: UsageMeter;
  };
}

/* -------------------------------------------------------------------------- */
/* Plan cards                                                                 */
/* -------------------------------------------------------------------------- */

const plans = [
  {
    tier: "FREE",
    name: "Hobby",
    price: "Free",
    description: "For personal projects and learning",
    features: [
      "50K AI tokens/month",
      "60 compute minutes",
      "500 MB storage",
      "1 member",
    ],
  },
  {
    tier: "PRO",
    name: "Pro",
    price: "$20/mo",
    description: "For professional developers",
    popular: true,
    features: [
      "500K AI tokens/month",
      "600 compute minutes",
      "5 GB storage",
      "5 members",
    ],
  },
  {
    tier: "TEAM",
    name: "Team",
    price: "$40/mo",
    description: "For teams and organizations",
    features: [
      "2M AI tokens/month",
      "3,000 compute minutes",
      "50 GB storage",
      "25 members",
    ],
  },
  {
    tier: "ENTERPRISE",
    name: "Enterprise",
    price: "Custom",
    description: "For large organizations",
    features: [
      "Unlimited AI tokens",
      "Unlimited compute",
      "Unlimited storage",
      "Unlimited members",
    ],
  },
];

/* -------------------------------------------------------------------------- */
/* Component                                                                  */
/* -------------------------------------------------------------------------- */

export default function BillingPage() {
  const { activeProject } = useProject();
  const workspaceId = activeProject?.workspaceId;

  const [billing, setBilling] = useState<BillingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const loadBilling = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/billing/usage?workspaceId=${encodeURIComponent(workspaceId)}`
      );
      if (!res.ok) {
        throw new Error(`Request failed: ${res.status}`);
      }
      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error?.message ?? "Failed to load billing");
      }
      setBilling(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load billing");
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    void loadBilling();
  }, [loadBilling]);

  const handleUpgrade = async (tier: string) => {
    if (!workspaceId) return;
    setActionLoading(tier);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId, plan: tier }),
      });
      if (!res.ok) {
        throw new Error(`Request failed: ${res.status}`);
      }
      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error?.message ?? "Failed to create checkout");
      }
      window.location.assign(json.data.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start checkout");
    } finally {
      setActionLoading(null);
    }
  };

  const handleManageBilling = async () => {
    if (!workspaceId) return;
    setActionLoading("portal");
    try {
      const res = await fetch("/api/billing/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId }),
      });
      if (!res.ok) {
        throw new Error(`Request failed: ${res.status}`);
      }
      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error?.message ?? "Failed to open portal");
      }
      window.location.assign(json.data.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to open portal");
    } finally {
      setActionLoading(null);
    }
  };

  if (!workspaceId) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-text-secondary">
          Select a project to view billing information.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 size={20} className="animate-spin text-text-muted" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3">
        <div className="flex items-center gap-2 text-red-500">
          <AlertTriangle size={16} />
          <p className="text-sm">{error}</p>
        </div>
        <Button
          onClick={() => void loadBilling()}
          variant="outline"
          size="sm"
        >
          Retry
        </Button>
      </div>
    );
  }

  const currentPlan = billing?.plan ?? "FREE";

  const statusVariant: "success" | "warning" | "outline" =
    billing?.status === "ACTIVE"
      ? "success"
      : billing?.status === "PAST_DUE"
        ? "warning"
        : "outline";

  return (
    <div className="h-full overflow-y-auto px-8 py-8">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-xl font-semibold text-foreground">Billing</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Manage your subscription, usage, and payment methods.
          </p>
        </div>

        {/* Current plan banner */}
        <Card className="mb-8">
          <CardContent className="flex items-center justify-between px-6 py-5">
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-950/30">
                <Crown size={18} className="text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold text-foreground">
                    {billing?.planName ?? "Hobby"} Plan
                  </h2>
                  <Badge variant={statusVariant}>
                    {billing?.status?.replace("_", " ").toLowerCase() ?? "active"}
                  </Badge>
                </div>
                <p className="mt-0.5 text-xs text-text-secondary">
                  {billing?.cancelAtPeriodEnd
                    ? "Cancels at end of period"
                    : billing?.currentPeriodEnd
                      ? `Renews ${new Date(billing.currentPeriodEnd).toLocaleDateString()}`
                      : "Current billing period"}
                </p>
              </div>
            </div>
            <Button
              onClick={() => void handleManageBilling()}
              disabled={actionLoading === "portal" || currentPlan === "FREE"}
              variant="outline"
              size="sm"
              className="gap-1.5"
            >
              {actionLoading === "portal" ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <CreditCard size={12} />
              )}
              Manage billing
              <ArrowUpRight size={10} />
            </Button>
          </CardContent>
        </Card>

        {/* Usage meters */}
        <div className="mb-8">
          <h3 className="mb-4 text-sm font-medium text-text-secondary">
            Current usage
          </h3>
          <div className="grid grid-cols-3 gap-4">
            <UsageMeterCard
              icon={Zap}
              label="AI Tokens"
              used={billing?.usage.aiTokens.used ?? 0}
              limit={billing?.usage.aiTokens.limit ?? 0}
              format={formatTokens}
              color="blue"
            />
            <UsageMeterCard
              icon={Cpu}
              label="Compute"
              used={billing?.usage.computeMinutes.used ?? 0}
              limit={billing?.usage.computeMinutes.limit ?? 0}
              format={formatMinutes}
              color="purple"
            />
            <UsageMeterCard
              icon={HardDrive}
              label="Storage"
              used={billing?.usage.storageMb.used ?? 0}
              limit={billing?.usage.storageMb.limit ?? 0}
              format={formatStorage}
              color="amber"
            />
          </div>
        </div>

        {/* Plan cards */}
        <div className="mb-8">
          <h3 className="mb-4 text-sm font-medium text-text-secondary">
            Available plans
          </h3>
          <div className="grid grid-cols-4 gap-4">
            {plans.map((plan) => {
              const isCurrent = plan.tier === currentPlan;
              const isDowngrade =
                plans.findIndex((p) => p.tier === currentPlan) >
                plans.findIndex((p) => p.tier === plan.tier);

              return (
                <Card
                  key={plan.tier}
                  className={`relative p-5 transition-all ${
                    isCurrent
                      ? "border-blue-200 ring-1 ring-blue-100 dark:border-blue-800 dark:ring-blue-900/30"
                      : ""
                  }`}
                >
                  {plan.popular && (
                    <Badge className="absolute -top-2.5 left-4">
                      Popular
                    </Badge>
                  )}
                  <h4 className="text-sm font-semibold text-foreground">
                    {plan.name}
                  </h4>
                  <p className="mt-1 text-lg font-bold text-foreground">
                    {plan.price}
                  </p>
                  <p className="mt-1 text-[11px] text-text-secondary">
                    {plan.description}
                  </p>
                  <ul className="mt-4 space-y-1.5">
                    {plan.features.map((f) => (
                      <li
                        key={f}
                        className="flex items-center gap-1.5 text-[11px] text-text-secondary"
                      >
                        <Check size={10} className="text-green-500" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Button
                    onClick={() => void handleUpgrade(plan.tier)}
                    disabled={
                      isCurrent ||
                      isDowngrade ||
                      plan.tier === "ENTERPRISE" ||
                      actionLoading === plan.tier
                    }
                    variant={isCurrent ? "secondary" : "outline"}
                    size="sm"
                    className={`mt-4 w-full ${
                      isCurrent
                        ? "border-blue-200 bg-blue-50 text-blue-600 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-400"
                        : ""
                    }`}
                  >
                    {actionLoading === plan.tier ? (
                      <Loader2 size={12} className="mx-auto animate-spin" />
                    ) : isCurrent ? (
                      "Current plan"
                    ) : plan.tier === "ENTERPRISE" ? (
                      "Contact sales"
                    ) : isDowngrade ? (
                      "Downgrade via portal"
                    ) : (
                      "Upgrade"
                    )}
                  </Button>
                </Card>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Usage meter card                                                           */
/* -------------------------------------------------------------------------- */

function UsageMeterCard({
  icon: Icon,
  label,
  used,
  limit,
  format,
  color,
}: {
  icon: React.ElementType;
  label: string;
  used: number;
  limit: number;
  format: (n: number) => string;
  color: "blue" | "purple" | "amber";
}) {
  const percentage = limit === Infinity || limit === 0 ? 0 : Math.min((used / limit) * 100, 100);
  const isHigh = percentage > 80;

  const colorMap = {
    blue: {
      bg: "bg-blue-50 dark:bg-blue-950/30",
      icon: "text-blue-500",
      bar: "bg-blue-500",
      barHigh: "bg-red-500",
    },
    purple: {
      bg: "bg-purple-50 dark:bg-purple-950/30",
      icon: "text-purple-500",
      bar: "bg-purple-500",
      barHigh: "bg-red-500",
    },
    amber: {
      bg: "bg-amber-50 dark:bg-amber-950/30",
      icon: "text-amber-500",
      bar: "bg-amber-500",
      barHigh: "bg-red-500",
    },
  };

  const c = colorMap[color];

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center gap-2">
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${c.bg}`}>
          <Icon size={14} className={c.icon} />
        </div>
        <span className="text-xs font-medium text-text-secondary">{label}</span>
      </div>
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-lg font-bold text-foreground">{format(used)}</span>
        <span className="text-[11px] text-text-muted">
          / {limit === Infinity ? "∞" : format(limit)}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-surface-soft">
        <div
          className={`h-full rounded-full transition-all ${isHigh ? c.barHigh : c.bar}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/* Formatters                                                                 */
/* -------------------------------------------------------------------------- */

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toString();
}

function formatMinutes(n: number): string {
  if (n >= 60) return `${(n / 60).toFixed(1)}h`;
  return `${n}m`;
}

function formatStorage(n: number): string {
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)} GB`;
  return `${n} MB`;
}
