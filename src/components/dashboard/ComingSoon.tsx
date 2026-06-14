"use client";

import { Sparkles, ArrowRight, Check } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

/**
 * Reusable "Coming Soon" placeholder used on dashboard pages whose real
 * implementation is on the roadmap. Renders an honest empty state that
 * links to a real, working part of the app so users are never stranded
 * on a non-functional screen.
 *
 * Props:
 *   feature    – the friendly feature name shown in the headline
 *   description – one sentence explaining what this will do
 *   icon       – lucide icon component (default: Sparkles)
 *   cta        – optional override for the primary CTA { label, href }
 */
export function ComingSoon({
  feature,
  description,
  icon: Icon = Sparkles,
  cta,
}: {
  feature: string;
  description: string;
  icon?: React.ComponentType<{ size?: number; className?: string }>;
  cta?: { label: string; href: string };
}) {
  return (
    <div className="flex h-full items-center justify-center px-6 py-12">
      <div className="w-full max-w-xl text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-200/50 dark:shadow-blue-900/30">
          <Icon size={28} className="text-white" />
        </div>
        <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-medium text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
          <Sparkles size={12} />
          Coming soon
        </div>
        <h1 className="mt-4 text-2xl font-semibold text-foreground">{feature}</h1>
        <p className="mt-2 text-sm text-text-secondary">{description}</p>

        <div className="mx-auto mt-8 max-w-md rounded-2xl border border-border bg-surface p-5 text-left">
          <p className="mb-3 text-xs font-medium uppercase tracking-wider text-text-muted">
            What you can use today
          </p>
          <ul className="space-y-2">
            <li className="flex items-start gap-2 text-sm text-text-secondary">
              <Check size={14} className="mt-0.5 shrink-0 text-emerald-500" />
              <span>Code editor with AI chat &amp; AI agents</span>
            </li>
            <li className="flex items-start gap-2 text-sm text-text-secondary">
              <Check size={14} className="mt-0.5 shrink-0 text-emerald-500" />
              <span>Composer for reviewing and applying AI changesets</span>
            </li>
            <li className="flex items-start gap-2 text-sm text-text-secondary">
              <Check size={14} className="mt-0.5 shrink-0 text-emerald-500" />
              <span>Safe terminal runner and git integration</span>
            </li>
          </ul>
        </div>

        <div className="mt-8 flex items-center justify-center gap-3">
          {cta ? (
            <Button asChild>
              <Link href={cta.href} className="flex items-center gap-1.5">
                {cta.label}
                <ArrowRight size={14} />
              </Link>
            </Button>
          ) : (
            <Button asChild>
              <Link href="/dashboard" className="flex items-center gap-1.5">
                Back to dashboard
                <ArrowRight size={14} />
              </Link>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
