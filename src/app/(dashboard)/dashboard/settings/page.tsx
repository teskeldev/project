"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  SlidersHorizontal,
  Users,
  CreditCard,
  Code2,
  Shield,
  Loader2,
} from "lucide-react";

import GeneralTab from "./tabs/GeneralTab";
import TeamTab from "./tabs/TeamTab";
import BillingTab from "./tabs/BillingTab";
import DeveloperTab from "./tabs/DeveloperTab";
import SecurityTab from "./tabs/SecurityTab";

type Tab = "general" | "team" | "billing" | "developer" | "security";

const VALID_TABS: Tab[] = ["general", "team", "billing", "developer", "security"];

const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "general", label: "General", icon: SlidersHorizontal },
  { id: "team", label: "Team", icon: Users },
  { id: "billing", label: "Billing", icon: CreditCard },
  { id: "developer", label: "Developer", icon: Code2 },
  { id: "security", label: "Security", icon: Shield },
];

function SettingsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");

  const legacyMap: Record<string, Tab> = {
    profile: "general",
    appearance: "general",
    notifications: "general",
    keys: "developer",
    advanced: "developer",
  };

  const resolvedParam = legacyMap[tabParam ?? ""] ?? tabParam;
  const activeTab: Tab = (VALID_TABS as string[]).includes(resolvedParam ?? "")
    ? (resolvedParam as Tab)
    : "general";

  const setActiveTab = (tab: Tab) =>
    router.push(`/dashboard/settings?tab=${tab}`, { scroll: false });

  return (
    <div className="flex gap-8">
      <div className="w-48 shrink-0">
        <nav className="space-y-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                activeTab === tab.id
                  ? "bg-accent-light text-accent"
                  : "text-text-muted hover:bg-surface-soft hover:text-text-secondary"
              }`}
            >
              <tab.icon size={16} />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="flex-1">
        {activeTab === "general" && <GeneralTab />}
        {activeTab === "team" && <TeamTab />}
        {activeTab === "billing" && <BillingTab />}
        {activeTab === "developer" && <DeveloperTab />}
        {activeTab === "security" && <SecurityTab />}
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <div className="p-8">
      <div className="mx-auto max-w-5xl">
        <h1 className="mb-8 text-2xl font-semibold text-foreground">Settings</h1>
        <Suspense
          fallback={
            <div className="flex items-center justify-center py-20">
              <Loader2 size={20} className="animate-spin text-text-muted" />
            </div>
          }
        >
          <SettingsContent />
        </Suspense>
      </div>
    </div>
  );
}
