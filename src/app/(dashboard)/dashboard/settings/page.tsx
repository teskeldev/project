"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
  User,
  CreditCard,
  Palette,
  Users,
  Key,
  Bell,
} from "lucide-react";

import ProfileTab from "./tabs/ProfileTab";
import BillingTab from "./tabs/BillingTab";
import AppearanceTab from "./tabs/AppearanceTab";
import TeamTab from "./tabs/TeamTab";
import KeysTab from "./tabs/KeysTab";
import NotificationsTab from "./tabs/NotificationsTab";

/* -------------------------------------------------------------------------- */
/* Types & constants                                                          */
/* -------------------------------------------------------------------------- */

type Tab =
  | "profile"
  | "billing"
  | "appearance"
  | "team"
  | "keys"
  | "notifications";

const VALID_TABS: Tab[] = [
  "profile",
  "billing",
  "appearance",
  "team",
  "keys",
  "notifications",
];

const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "profile", label: "Profile", icon: User },
  { id: "billing", label: "Billing", icon: CreditCard },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "team", label: "Team", icon: Users },
  { id: "keys", label: "API Keys", icon: Key },
  { id: "notifications", label: "Notifications", icon: Bell },
];

/* -------------------------------------------------------------------------- */
/* Main Settings Page                                                         */
/* -------------------------------------------------------------------------- */

export default function SettingsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const activeTab: Tab = (VALID_TABS as string[]).includes(tabParam ?? "")
    ? (tabParam as Tab)
    : "profile";
  const setActiveTab = (tab: Tab) =>
    router.push(`/dashboard/settings?tab=${tab}`, { scroll: false });

  return (
    <div className="p-8">
      <div className="mx-auto max-w-5xl">
        <h1 className="mb-8 text-2xl font-semibold text-gray-900">Settings</h1>

        <div className="flex gap-8">
          {/* Sidebar tabs */}
          <div className="w-48 shrink-0">
            <nav className="space-y-1">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                    activeTab === tab.id
                      ? "bg-blue-50 text-blue-700"
                      : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                  }`}
                >
                  <tab.icon size={16} />
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Content */}
          <div className="flex-1">
            {activeTab === "profile" && <ProfileTab />}
            {activeTab === "billing" && <BillingTab />}
            {activeTab === "appearance" && <AppearanceTab />}
            {activeTab === "team" && <TeamTab />}
            {activeTab === "keys" && <KeysTab />}
            {activeTab === "notifications" && <NotificationsTab />}
          </div>
        </div>
      </div>
    </div>
  );
}
