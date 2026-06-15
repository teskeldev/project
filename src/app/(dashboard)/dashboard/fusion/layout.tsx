"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Plug,
  Boxes,
  Users,
  UserCog,
  Sparkles,
  Route,
  Gavel,
  Server,
  Workflow,
  GitCompare,
  BarChart3,
  Settings,
} from "lucide-react";

const NAV = [
  { href: "/dashboard/fusion/overview", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/fusion/providers", label: "Providers", icon: Plug },
  { href: "/dashboard/fusion/models", label: "Models", icon: Boxes },
  { href: "/dashboard/fusion/teams", label: "Teams", icon: Users },
  { href: "/dashboard/fusion/profiles", label: "Profiles", icon: UserCog },
  { href: "/dashboard/fusion/skills", label: "Skills", icon: Sparkles },
  { href: "/dashboard/fusion/routing", label: "Routing", icon: Route },
  { href: "/dashboard/fusion/judges", label: "Judges", icon: Gavel },
  { href: "/dashboard/fusion/mcp", label: "MCP", icon: Server },
  { href: "/dashboard/fusion/workflows", label: "Workflows", icon: Workflow },
  { href: "/dashboard/fusion/compare", label: "Compare", icon: GitCompare },
  { href: "/dashboard/fusion/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/dashboard/fusion/settings", label: "Settings", icon: Settings },
];

export default function FusionLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-full bg-slate-50/50 dark:bg-slate-950">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 p-4 md:flex-row md:p-6">
        {/* Sub-nav */}
        <aside className="md:w-56 md:shrink-0">
          <div className="mb-4 px-2">
            <div className="bg-gradient-to-r from-accent to-purple-600 bg-clip-text text-lg font-extrabold tracking-tight text-transparent">
              AI Orchestration
            </div>
            <p className="text-xs text-slate-400">Fusion Hub</p>
          </div>
          <nav className="flex gap-1 overflow-x-auto pb-2 md:flex-col md:overflow-visible md:pb-0">
            {NAV.map(({ href, label, icon: Icon }) => {
              const active = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    active
                      ? "bg-accent/10 text-accent"
                      : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800/50"
                  }`}
                >
                  <Icon size={16} />
                  {label}
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* Content */}
        <main className="min-w-0 flex-1 text-slate-950 dark:text-slate-100">{children}</main>
      </div>
    </div>
  );
}
