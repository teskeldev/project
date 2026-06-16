"use client";

import Link from "next/link";
import { Library, LayoutTemplate } from "lucide-react";

/** Horizontal segmented tabs for the Fusion home (Library / Templates). */
export function FusionTopTabs({ active }: { active: "library" | "templates" }) {
  const tabs = [
    { key: "library", label: "Library", href: "/dashboard/fusion/library", icon: Library },
    { key: "templates", label: "Templates", href: "/dashboard/fusion/templates", icon: LayoutTemplate },
  ] as const;
  return (
    <div className="mb-5 inline-flex rounded-xl border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-slate-900/60">
      {tabs.map((t) => {
        const on = active === t.key;
        const Icon = t.icon;
        return (
          <Link
            key={t.key}
            href={t.href}
            className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors ${
              on ? "bg-accent text-white shadow-sm" : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"
            }`}
          >
            <Icon size={15} />
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
