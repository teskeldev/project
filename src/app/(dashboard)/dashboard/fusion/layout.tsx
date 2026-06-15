"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Library, Wrench, LayoutTemplate, FlaskConical } from "lucide-react";

const NAV = [
  { href: "/dashboard/fusion/library", label: "Library", icon: Library },
  { href: "/dashboard/fusion/builder", label: "Builder", icon: Wrench },
  { href: "/dashboard/fusion/templates", label: "Templates", icon: LayoutTemplate },
  { href: "/dashboard/fusion/playground", label: "Playground", icon: FlaskConical },
];

export default function FusionLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="min-h-full bg-slate-50/50 dark:bg-slate-950">
      <div className="mx-auto flex max-w-5xl flex-col gap-6 p-4 md:flex-row md:p-6">
        <aside className="md:w-52 md:shrink-0">
          <div className="mb-4 px-2">
            <div className="bg-gradient-to-r from-accent to-purple-600 bg-clip-text text-lg font-extrabold tracking-tight text-transparent">
              Fusion
            </div>
            <p className="text-xs text-slate-400">Reusable AI Teams</p>
          </div>
          <nav className="flex gap-1 overflow-x-auto pb-2 md:flex-col md:overflow-visible md:pb-0">
            {NAV.map(({ href, label, icon: Icon }) => {
              const active = pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    active ? "bg-accent/10 text-accent" : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800/50"
                  }`}
                >
                  <Icon size={16} />
                  {label}
                </Link>
              );
            })}
          </nav>
        </aside>
        <main className="min-w-0 flex-1 text-slate-950 dark:text-slate-100">{children}</main>
      </div>
    </div>
  );
}
