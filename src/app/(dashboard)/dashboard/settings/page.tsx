"use client";

import { useState } from "react";
import {
  User,
  CreditCard,
  Palette,
  Users,
  Key,
  Bell,
  Shield,
  Monitor,
  Moon,
  Sun,
  Check,
  Plus,
  MoreHorizontal,
} from "lucide-react";

type Tab = "profile" | "billing" | "appearance" | "team" | "keys" | "notifications";

const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "profile", label: "Profile", icon: User },
  { id: "billing", label: "Billing", icon: CreditCard },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "team", label: "Team", icon: Users },
  { id: "keys", label: "API Keys", icon: Key },
  { id: "notifications", label: "Notifications", icon: Bell },
];

const plans = [
  {
    name: "Hobby",
    price: "Free",
    description: "For personal projects and learning",
    features: [
      "2,000 completions/month",
      "50 slow premium requests/month",
      "Community support",
    ],
    current: false,
  },
  {
    name: "Pro",
    price: "$20/mo",
    description: "For professional developers",
    features: [
      "Unlimited completions",
      "500 fast premium requests/month",
      "Unlimited slow premium requests",
      "Priority support",
    ],
    current: true,
  },
  {
    name: "Business",
    price: "$40/mo",
    description: "For teams and organizations",
    features: [
      "Everything in Pro",
      "Admin dashboard",
      "SSO & SAML",
      "Usage analytics",
      "Custom models",
    ],
    current: false,
  },
];

const teamMembers = [
  { name: "Teskel Dev", email: "teskel@example.com", role: "Owner", avatar: "T" },
  { name: "Sarah Chen", email: "sarah@example.com", role: "Admin", avatar: "S" },
  { name: "Alex Kim", email: "alex@example.com", role: "Member", avatar: "A" },
  { name: "Maya Patel", email: "maya@example.com", role: "Member", avatar: "M" },
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("profile");
  const [theme, setTheme] = useState<"system" | "light" | "dark">("system");
  const [fontSize, setFontSize] = useState(14);

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
                      ? "bg-rose-50 text-rose-700"
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
            {activeTab === "profile" && (
              <div className="space-y-6">
                <div>
                  <h2 className="mb-4 text-lg font-medium text-gray-900">
                    Profile
                  </h2>
                  <div className="rounded-xl border border-gray-200 bg-white p-6">
                    <div className="mb-6 flex items-center gap-4">
                      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-rose-600 text-2xl font-bold text-white">
                        T
                      </div>
                      <div>
                        <button className="text-sm font-medium text-rose-600 hover:text-rose-700">
                          Change avatar
                        </button>
                        <p className="text-xs text-gray-400">
                          JPG, PNG or GIF. Max 2MB.
                        </p>
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-gray-700">
                          Full name
                        </label>
                        <input
                          type="text"
                          defaultValue="Teskel Dev"
                          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500"
                        />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-gray-700">
                          Email
                        </label>
                        <input
                          type="email"
                          defaultValue="teskel@example.com"
                          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="mb-1.5 block text-sm font-medium text-gray-700">
                          Bio
                        </label>
                        <textarea
                          defaultValue="Building the future of coding with AI."
                          rows={3}
                          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500"
                        />
                      </div>
                    </div>

                    <div className="mt-6 flex justify-end">
                      <button className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700">
                        Save changes
                      </button>
                    </div>
                  </div>
                </div>

                <div>
                  <h2 className="mb-4 text-lg font-medium text-gray-900">
                    Security
                  </h2>
                  <div className="rounded-xl border border-gray-200 bg-white p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-700">
                          Two-factor authentication
                        </p>
                        <p className="text-xs text-gray-400">
                          Add an extra layer of security to your account
                        </p>
                      </div>
                      <button className="flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">
                        <Shield size={14} />
                        Enable 2FA
                      </button>
                    </div>
                  </div>
                </div>

                <div>
                  <h2 className="mb-4 text-lg font-medium text-red-600">
                    Danger zone
                  </h2>
                  <div className="rounded-xl border border-red-200 bg-white p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-700">
                          Delete account
                        </p>
                        <p className="text-xs text-gray-400">
                          Permanently delete your account and all data
                        </p>
                      </div>
                      <button className="rounded-lg border border-red-300 px-4 py-2 text-sm text-red-600 hover:bg-red-50">
                        Delete account
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "billing" && (
              <div>
                <h2 className="mb-4 text-lg font-medium text-gray-900">
                  Billing & Plans
                </h2>
                <div className="grid gap-4 sm:grid-cols-3">
                  {plans.map((plan) => (
                    <div
                      key={plan.name}
                      className={`rounded-xl border p-6 ${
                        plan.current
                          ? "border-rose-300 bg-rose-50/50"
                          : "border-gray-200 bg-white"
                      }`}
                    >
                      {plan.current && (
                        <span className="mb-3 inline-block rounded-full bg-rose-600 px-2.5 py-0.5 text-xs font-medium text-white">
                          Current plan
                        </span>
                      )}
                      <h3 className="text-lg font-semibold text-gray-900">
                        {plan.name}
                      </h3>
                      <p className="mt-1 text-2xl font-bold text-gray-900">
                        {plan.price}
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        {plan.description}
                      </p>
                      <ul className="mt-4 space-y-2">
                        {plan.features.map((f) => (
                          <li
                            key={f}
                            className="flex items-center gap-2 text-xs text-gray-600"
                          >
                            <Check
                              size={14}
                              className="text-green-500"
                            />
                            {f}
                          </li>
                        ))}
                      </ul>
                      <button
                        className={`mt-6 w-full rounded-lg px-4 py-2 text-sm font-medium ${
                          plan.current
                            ? "border border-gray-200 text-gray-400"
                            : "bg-rose-600 text-white hover:bg-rose-700"
                        }`}
                        disabled={plan.current}
                      >
                        {plan.current ? "Current plan" : "Upgrade"}
                      </button>
                    </div>
                  ))}
                </div>

                <div className="mt-8 rounded-xl border border-gray-200 bg-white p-6">
                  <h3 className="mb-4 text-sm font-medium text-gray-900">
                    Usage this month
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <div className="mb-1 flex justify-between text-xs">
                        <span className="text-gray-500">Completions</span>
                        <span className="text-gray-700">12,847 / unlimited</span>
                      </div>
                      <div className="h-2 rounded-full bg-gray-100">
                        <div className="h-2 w-1/3 rounded-full bg-rose-500" />
                      </div>
                    </div>
                    <div>
                      <div className="mb-1 flex justify-between text-xs">
                        <span className="text-gray-500">
                          Premium requests (fast)
                        </span>
                        <span className="text-gray-700">342 / 500</span>
                      </div>
                      <div className="h-2 rounded-full bg-gray-100">
                        <div className="h-2 w-2/3 rounded-full bg-amber-500" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "appearance" && (
              <div>
                <h2 className="mb-4 text-lg font-medium text-gray-900">
                  Appearance
                </h2>
                <div className="rounded-xl border border-gray-200 bg-white p-6">
                  <h3 className="mb-4 text-sm font-medium text-gray-700">
                    Theme
                  </h3>
                  <div className="flex gap-4">
                    {[
                      { id: "system" as const, icon: Monitor, label: "System" },
                      { id: "light" as const, icon: Sun, label: "Light" },
                      { id: "dark" as const, icon: Moon, label: "Dark" },
                    ].map((t) => (
                      <button
                        key={t.id}
                        onClick={() => setTheme(t.id)}
                        className={`flex flex-1 flex-col items-center gap-2 rounded-xl border p-4 transition-colors ${
                          theme === t.id
                            ? "border-rose-300 bg-rose-50"
                            : "border-gray-200 hover:border-gray-300"
                        }`}
                      >
                        <t.icon
                          size={20}
                          className={
                            theme === t.id
                              ? "text-rose-500"
                              : "text-gray-400"
                          }
                        />
                        <span className="text-xs text-gray-600">
                          {t.label}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-6 rounded-xl border border-gray-200 bg-white p-6">
                  <h3 className="mb-4 text-sm font-medium text-gray-700">
                    Editor
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="mb-1.5 block text-xs text-gray-500">
                        Font size: {fontSize}px
                      </label>
                      <input
                        type="range"
                        min={10}
                        max={24}
                        value={fontSize}
                        onChange={(e) =>
                          setFontSize(parseInt(e.target.value))
                        }
                        className="w-full accent-rose-500"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-700">Word wrap</p>
                        <p className="text-xs text-gray-400">
                          Wrap long lines in the editor
                        </p>
                      </div>
                      <button className="relative h-6 w-11 rounded-full bg-rose-600">
                        <span className="absolute right-1 top-1 h-4 w-4 rounded-full bg-white" />
                      </button>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-700">
                          Minimap
                        </p>
                        <p className="text-xs text-gray-400">
                          Show code overview minimap
                        </p>
                      </div>
                      <button className="relative h-6 w-11 rounded-full bg-gray-200">
                        <span className="absolute left-1 top-1 h-4 w-4 rounded-full bg-white" />
                      </button>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-700">
                          Vim keybindings
                        </p>
                        <p className="text-xs text-gray-400">
                          Use Vim-style keyboard shortcuts
                        </p>
                      </div>
                      <button className="relative h-6 w-11 rounded-full bg-gray-200">
                        <span className="absolute left-1 top-1 h-4 w-4 rounded-full bg-white" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "team" && (
              <div>
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-lg font-medium text-gray-900">
                    Team Members
                  </h2>
                  <button className="flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700">
                    <Plus size={14} />
                    Invite member
                  </button>
                </div>
                <div className="rounded-xl border border-gray-200 bg-white">
                  {teamMembers.map((member, i) => (
                    <div
                      key={member.email}
                      className={`flex items-center justify-between px-6 py-4 ${
                        i < teamMembers.length - 1
                          ? "border-b border-gray-200"
                          : ""
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-sm font-medium text-gray-600">
                          {member.avatar}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-700">
                            {member.name}
                          </p>
                          <p className="text-xs text-gray-400">
                            {member.email}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            member.role === "Owner"
                              ? "bg-rose-100 text-rose-600"
                              : member.role === "Admin"
                                ? "bg-blue-100 text-blue-600"
                                : "bg-gray-100 text-gray-500"
                          }`}
                        >
                          {member.role}
                        </span>
                        <button className="text-gray-300 hover:text-gray-500">
                          <MoreHorizontal size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === "keys" && (
              <div>
                <h2 className="mb-4 text-lg font-medium text-gray-900">
                  API Keys
                </h2>
                <div className="rounded-xl border border-gray-200 bg-white p-6">
                  <p className="mb-4 text-sm text-gray-500">
                    Use API keys to integrate Teskel with your own tools and
                    workflows.
                  </p>
                  <button className="flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700">
                    <Plus size={14} />
                    Generate new key
                  </button>

                  <div className="mt-6 space-y-3">
                    <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-gray-700">
                          Production key
                        </p>
                        <p className="mt-0.5 font-mono text-xs text-gray-400">
                          tsk_live_****...****7f3a
                        </p>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        <span>Created 2 weeks ago</span>
                        <button className="text-red-500 hover:text-red-600">
                          Revoke
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-gray-700">
                          Development key
                        </p>
                        <p className="mt-0.5 font-mono text-xs text-gray-400">
                          tsk_dev_****...****2b1e
                        </p>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        <span>Created 1 month ago</span>
                        <button className="text-red-500 hover:text-red-600">
                          Revoke
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "notifications" && (
              <div>
                <h2 className="mb-4 text-lg font-medium text-gray-900">
                  Notifications
                </h2>
                <div className="rounded-xl border border-gray-200 bg-white p-6">
                  <div className="space-y-6">
                    {[
                      {
                        label: "Email notifications",
                        desc: "Receive emails about activity on your account",
                        on: true,
                      },
                      {
                        label: "Push notifications",
                        desc: "Receive push notifications in the app",
                        on: true,
                      },
                      {
                        label: "Weekly digest",
                        desc: "Receive a weekly summary of your coding activity",
                        on: false,
                      },
                      {
                        label: "Marketing emails",
                        desc: "Receive emails about new features and updates",
                        on: false,
                      },
                    ].map((notif) => (
                      <div
                        key={notif.label}
                        className="flex items-center justify-between"
                      >
                        <div>
                          <p className="text-sm text-gray-700">{notif.label}</p>
                          <p className="text-xs text-gray-400">{notif.desc}</p>
                        </div>
                        <button
                          className={`relative h-6 w-11 rounded-full ${
                            notif.on ? "bg-rose-600" : "bg-gray-200"
                          }`}
                        >
                          <span
                            className={`absolute top-1 h-4 w-4 rounded-full bg-white ${
                              notif.on ? "right-1" : "left-1"
                            }`}
                          />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
