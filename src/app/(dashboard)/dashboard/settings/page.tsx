"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
  Copy,
  Loader2,
  AlertCircle,
  X,
} from "lucide-react";
import { useProject } from "@/lib/store/project";
import {
  fetchProfile,
  updateProfile,
  updatePreferences,
  fetchApiKeys,
  createApiKey,
  revokeApiKey,
  fetchMembers,
  inviteMember,
  updateMemberRole,
  removeMember,
  fetchDashboardSummary,
  type UserProfile,
  type UserPreferences,
  type ApiKeyMasked,
  type ApiKeyCreated,
  type WorkspaceMember,
  type DashboardSummary,
} from "@/lib/client/settings";

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

/* -------------------------------------------------------------------------- */
/* Utility hooks                                                              */
/* -------------------------------------------------------------------------- */

function useDebounce<T extends (...args: never[]) => void>(
  fn: T,
  delay: number
): T {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fnRef = useRef(fn);
  useEffect(() => { fnRef.current = fn; }, [fn]);

  return useCallback(
    (...args: Parameters<T>) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => fnRef.current(...args), delay);
    },
    [delay]
  ) as unknown as T;
}

/* -------------------------------------------------------------------------- */
/* Sub-components                                                             */
/* -------------------------------------------------------------------------- */

function StatusMessage({
  message,
  type,
}: {
  message: string | null;
  type: "success" | "error";
}) {
  if (!message) return null;
  return (
    <div
      className={`mt-3 flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
        type === "success"
          ? "bg-green-50 text-green-700"
          : "bg-red-50 text-red-700"
      }`}
    >
      {type === "error" && <AlertCircle size={14} />}
      {type === "success" && <Check size={14} />}
      {message}
    </div>
  );
}

function Toggle({
  on,
  onChange,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      className={`relative h-6 w-11 rounded-full transition-colors ${
        on ? "bg-gray-900" : "bg-gray-200"
      }`}
    >
      <span
        className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-all ${
          on ? "right-1" : "left-1"
        }`}
      />
    </button>
  );
}

function LoadingState() {
  return (
    <div className="flex items-center justify-center py-12">
      <Loader2 size={24} className="animate-spin text-gray-400" />
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
      <AlertCircle size={16} />
      {message}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Profile Tab                                                                */
/* -------------------------------------------------------------------------- */

function ProfileTab() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [bio, setBio] = useState("");

  useEffect(() => {
    fetchProfile()
      .then((u) => {
        setProfile(u);
        setName(u.name ?? "");
        setEmail(u.email ?? "");
        setBio(u.bio ?? "");
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const updated = await updateProfile({ name, bio });
      setProfile(updated);
      setSuccess("Profile saved successfully.");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingState />;
  if (error && !profile) return <ErrorState message={error} />;

  const initials = (name || email || "U")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-4 text-lg font-medium text-gray-900">Profile</h2>
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <div className="mb-6 flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-900 text-2xl font-bold text-white">
              {initials}
            </div>
            <div>
              <button
                disabled
                className="text-sm font-medium text-blue-600 opacity-50 cursor-not-allowed"
                title="Coming soon"
              >
                Change avatar <span className="text-xs text-gray-400">(Coming soon)</span>
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
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Email
              </label>
              <input
                type="email"
                value={email}
                disabled
                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-500"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Bio
              </label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={3}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="mt-6 flex items-center justify-end gap-3">
            <StatusMessage message={success} type="success" />
            <StatusMessage message={error} type="error" />
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save changes"}
            </button>
          </div>
        </div>
      </div>

      <div>
        <h2 className="mb-4 text-lg font-medium text-gray-900">Security</h2>
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
            <button
              disabled
              className="flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 opacity-50 cursor-not-allowed"
              title="Coming soon"
            >
              <Shield size={14} />
              Enable 2FA <span className="text-xs text-gray-400">(Coming soon)</span>
            </button>
          </div>
        </div>
      </div>

      <div>
        <h2 className="mb-4 text-lg font-medium text-red-600">Danger zone</h2>
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
            <button
              disabled
              className="rounded-lg border border-red-300 px-4 py-2 text-sm text-red-600 opacity-50 cursor-not-allowed"
              title="Coming soon"
            >
              Delete account <span className="text-xs text-gray-400">(Coming soon)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


/* -------------------------------------------------------------------------- */
/* Billing Tab                                                                */
/* -------------------------------------------------------------------------- */

function BillingTab() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboardSummary()
      .then(setSummary)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const threadCount = summary?.counts.threads ?? 0;
  const agentRunCount = summary?.counts.agentRuns ?? 0;
  const premiumLimit = 500;
  const premiumPct = Math.min(100, Math.round((agentRunCount / premiumLimit) * 100));

  return (
    <div>
      <h2 className="mb-4 text-lg font-medium text-gray-900">
        Billing & Plans
      </h2>

      <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
        <strong>Coming Soon</strong> &mdash; Billing and plan upgrades are not yet available. You are currently on the free tier.
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {plans.map((plan) => (
          <div
            key={plan.name}
            className={`rounded-xl border p-6 ${
              plan.current
                ? "border-blue-300 bg-blue-50/50"
                : "border-gray-200 bg-white"
            }`}
          >
            {plan.current && (
              <span className="mb-3 inline-block rounded-full bg-gray-900 px-2.5 py-0.5 text-xs font-medium text-white">
                Current plan
              </span>
            )}
            <h3 className="text-lg font-semibold text-gray-900">
              {plan.name}
            </h3>
            <p className="mt-1 text-2xl font-bold text-gray-900">
              {plan.price}
            </p>
            <p className="mt-1 text-xs text-gray-500">{plan.description}</p>
            <ul className="mt-4 space-y-2">
              {plan.features.map((f) => (
                <li
                  key={f}
                  className="flex items-center gap-2 text-xs text-gray-600"
                >
                  <Check size={14} className="text-green-500" />
                  {f}
                </li>
              ))}
            </ul>
            <button
              className={`mt-6 w-full rounded-lg px-4 py-2 text-sm font-medium ${
                plan.current
                  ? "border border-gray-200 text-gray-400"
                  : "bg-gray-900 text-white opacity-50 cursor-not-allowed"
              }`}
              disabled
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
        {loading ? (
          <LoadingState />
        ) : error ? (
          <ErrorState message={error} />
        ) : (
          <div className="space-y-4">
            <div>
              <div className="mb-1 flex justify-between text-xs">
                <span className="text-gray-500">Completions (threads)</span>
                <span className="text-gray-700">
                  {threadCount.toLocaleString()} / unlimited
                </span>
              </div>
              <div className="h-2 rounded-full bg-gray-100">
                <div
                  className="h-2 rounded-full bg-blue-500"
                  style={{ width: `${Math.min(100, Math.round((threadCount / 1000) * 100))}%` }}
                />
              </div>
            </div>
            <div>
              <div className="mb-1 flex justify-between text-xs">
                <span className="text-gray-500">
                  Agent runs (premium requests)
                </span>
                <span className="text-gray-700">
                  {agentRunCount} / {premiumLimit}
                </span>
              </div>
              <div className="h-2 rounded-full bg-gray-100">
                <div
                  className="h-2 rounded-full bg-amber-500"
                  style={{ width: `${premiumPct}%` }}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


/* -------------------------------------------------------------------------- */
/* Appearance Tab                                                             */
/* -------------------------------------------------------------------------- */

function AppearanceTab() {
  const [prefs, setPrefs] = useState<UserPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchProfile()
      .then((u) => {
        setPrefs((u.preferences as UserPreferences) ?? {});
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const persist = useCallback(
    (patch: Partial<UserPreferences>) => {
      setPrefs((prev) => ({ ...prev, ...patch }));
      updatePreferences(patch).catch(() => {});
    },
    []
  );

  const debouncedPersist = useDebounce(
    (patch: Partial<UserPreferences>) => {
      updatePreferences(patch).catch(() => {});
    },
    400
  );

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;

  const theme = prefs?.theme ?? "system";
  const fontSize = prefs?.fontSize ?? 14;
  const wordWrap = prefs?.wordWrap ?? true;
  const minimap = prefs?.minimap ?? false;
  const vim = prefs?.vim ?? false;

  return (
    <div>
      <h2 className="mb-4 text-lg font-medium text-gray-900">Appearance</h2>
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h3 className="mb-4 text-sm font-medium text-gray-700">Theme</h3>
        <div className="flex gap-4">
          {(
            [
              { id: "system", icon: Monitor, label: "System" },
              { id: "light", icon: Sun, label: "Light" },
              { id: "dark", icon: Moon, label: "Dark" },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              onClick={() => persist({ theme: t.id })}
              className={`flex flex-1 flex-col items-center gap-2 rounded-xl border p-4 transition-colors ${
                theme === t.id
                  ? "border-blue-300 bg-blue-50"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <t.icon
                size={20}
                className={theme === t.id ? "text-blue-500" : "text-gray-400"}
              />
              <span className="text-xs text-gray-600">{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-gray-200 bg-white p-6">
        <h3 className="mb-4 text-sm font-medium text-gray-700">Editor</h3>
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
              onChange={(e) => {
                const v = parseInt(e.target.value);
                setPrefs((prev) => ({ ...prev, fontSize: v }));
                debouncedPersist({ fontSize: v });
              }}
              className="w-full accent-blue-500"
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-700">Word wrap</p>
              <p className="text-xs text-gray-400">
                Wrap long lines in the editor
              </p>
            </div>
            <Toggle on={wordWrap} onChange={(v) => persist({ wordWrap: v })} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-700">Minimap</p>
              <p className="text-xs text-gray-400">
                Show code overview minimap
              </p>
            </div>
            <Toggle on={minimap} onChange={(v) => persist({ minimap: v })} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-700">Vim keybindings</p>
              <p className="text-xs text-gray-400">
                Use Vim-style keyboard shortcuts
              </p>
            </div>
            <Toggle on={vim} onChange={(v) => persist({ vim: v })} />
          </div>
        </div>
      </div>
    </div>
  );
}


/* -------------------------------------------------------------------------- */
/* Team Tab                                                                   */
/* -------------------------------------------------------------------------- */

function TeamTab() {
  const { activeWorkspace } = useProject();
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("MEMBER");
  const [inviting, setInviting] = useState(false);

  const loadMembers = useCallback(() => {
    if (!activeWorkspace) return;
    setLoading(true);
    fetchMembers(activeWorkspace.id)
      .then((r) => setMembers(r.members))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [activeWorkspace]);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  const handleInvite = async () => {
    if (!activeWorkspace || !inviteEmail.trim()) return;
    setInviting(true);
    try {
      await inviteMember(activeWorkspace.id, inviteEmail.trim(), inviteRole);
      setInviteEmail("");
      setShowInvite(false);
      loadMembers();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to invite");
    } finally {
      setInviting(false);
    }
  };

  const handleRoleChange = async (memberId: string, role: string) => {
    try {
      await updateMemberRole(memberId, role);
      setMembers((prev) =>
        prev.map((m) => (m.id === memberId ? { ...m, role } : m))
      );
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to update role");
    }
  };

  const handleRemove = async (memberId: string, memberName: string | null) => {
    if (!confirm(`Remove ${memberName ?? "this member"} from the workspace?`))
      return;
    try {
      await removeMember(memberId);
      setMembers((prev) => prev.filter((m) => m.id !== memberId));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to remove member");
    }
  };

  if (!activeWorkspace) {
    return <ErrorState message="No active workspace selected." />;
  }

  if (loading) return <LoadingState />;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-medium text-gray-900">Team Members</h2>
        <button
          onClick={() => setShowInvite(true)}
          className="flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
        >
          <Plus size={14} />
          Invite member
        </button>
      </div>

      {error && <StatusMessage message={error} type="error" />}

      {showInvite && (
        <div className="mb-4 rounded-xl border border-gray-200 bg-white p-4">
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <label className="mb-1 block text-xs text-gray-500">Email</label>
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="colleague@example.com"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-500">Role</label>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
              >
                <option value="MEMBER">Member</option>
                <option value="ADMIN">Admin</option>
                <option value="VIEWER">Viewer</option>
              </select>
            </div>
            <button
              onClick={handleInvite}
              disabled={inviting}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {inviting ? "Inviting..." : "Send invite"}
            </button>
            <button
              onClick={() => setShowInvite(false)}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-500 hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white">
        {members.map((member, i) => (
          <div
            key={member.id}
            className={`flex items-center justify-between px-6 py-4 ${
              i < members.length - 1 ? "border-b border-gray-200" : ""
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-sm font-medium text-gray-600">
                {(member.name ?? member.email)[0].toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700">
                  {member.name ?? member.email}
                </p>
                <p className="text-xs text-gray-400">{member.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {member.role === "OWNER" ? (
                <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-600">
                  Owner
                </span>
              ) : (
                <select
                  value={member.role}
                  onChange={(e) =>
                    handleRoleChange(member.id, e.target.value)
                  }
                  className="rounded-full border border-gray-200 px-2.5 py-0.5 text-xs"
                >
                  <option value="ADMIN">Admin</option>
                  <option value="MEMBER">Member</option>
                  <option value="VIEWER">Viewer</option>
                </select>
              )}
              {member.role !== "OWNER" && (
                <button
                  onClick={() => handleRemove(member.id, member.name)}
                  className="text-gray-300 hover:text-red-500"
                >
                  <MoreHorizontal size={16} />
                </button>
              )}
            </div>
          </div>
        ))}
        {members.length === 0 && (
          <p className="px-6 py-8 text-center text-sm text-gray-400">
            No members yet. Invite someone to get started.
          </p>
        )}
      </div>
    </div>
  );
}


/* -------------------------------------------------------------------------- */
/* API Keys Tab                                                               */
/* -------------------------------------------------------------------------- */

function KeysTab() {
  const [keys, setKeys] = useState<ApiKeyMasked[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [keyName, setKeyName] = useState("");
  const [creating, setCreating] = useState(false);

  const [newKey, setNewKey] = useState<ApiKeyCreated | null>(null);
  const [copied, setCopied] = useState(false);

  const loadKeys = useCallback(() => {
    setLoading(true);
    fetchApiKeys()
      .then((r) => setKeys(r.keys))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadKeys();
  }, [loadKeys]);

  const handleCreate = async () => {
    if (!keyName.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const created = await createApiKey(keyName.trim());
      setNewKey(created);
      setKeyName("");
      setShowCreate(false);
      loadKeys();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to create key");
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (keyId: string, keyNameStr: string) => {
    if (!confirm(`Revoke API key "${keyNameStr}"? This cannot be undone.`))
      return;
    try {
      await revokeApiKey(keyId);
      setKeys((prev) => prev.filter((k) => k.id !== keyId));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to revoke key");
    }
  };

  const handleCopy = async () => {
    if (!newKey) return;
    await navigator.clipboard.writeText(newKey.key);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div>
      <h2 className="mb-4 text-lg font-medium text-gray-900">API Keys</h2>

      {newKey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">
                API Key Created
              </h3>
              <button
                onClick={() => {
                  setNewKey(null);
                  setCopied(false);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={20} />
              </button>
            </div>
            <div className="mb-4 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
              <strong>Warning:</strong> This key will only be shown once. Copy
              it now and store it securely.
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
              <code className="flex-1 break-all text-xs text-gray-700">
                {newKey.key}
              </code>
              <button
                onClick={handleCopy}
                className="shrink-0 rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-600"
              >
                {copied ? (
                  <Check size={16} className="text-green-500" />
                ) : (
                  <Copy size={16} />
                )}
              </button>
            </div>
            <button
              onClick={() => {
                setNewKey(null);
                setCopied(false);
              }}
              className="mt-4 w-full rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
            >
              Done
            </button>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <p className="mb-4 text-sm text-gray-500">
          Use API keys to integrate Teskel with your own tools and workflows.
        </p>

        {error && <StatusMessage message={error} type="error" />}

        {showCreate ? (
          <div className="mb-4 flex items-end gap-3">
            <div className="flex-1">
              <label className="mb-1 block text-xs text-gray-500">
                Key name
              </label>
              <input
                type="text"
                value={keyName}
                onChange={(e) => setKeyName(e.target.value)}
                placeholder="e.g. Production key"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <button
              onClick={handleCreate}
              disabled={creating || !keyName.trim()}
              className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
            >
              {creating ? "Creating..." : "Create"}
            </button>
            <button
              onClick={() => setShowCreate(false)}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-500 hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
          >
            <Plus size={14} />
            Generate new key
          </button>
        )}

        {loading ? (
          <LoadingState />
        ) : (
          <div className="mt-6 space-y-3">
            {keys.map((k) => (
              <div
                key={k.id}
                className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium text-gray-700">
                    {k.name}
                  </p>
                  <p className="mt-0.5 font-mono text-xs text-gray-400">
                    {k.maskedKey}
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <span>
                    Created{" "}
                    {new Date(k.createdAt).toLocaleDateString()}
                  </span>
                  <button
                    onClick={() => handleRevoke(k.id, k.name)}
                    className="text-red-500 hover:text-red-600"
                  >
                    Revoke
                  </button>
                </div>
              </div>
            ))}
            {keys.length === 0 && !loading && (
              <p className="py-4 text-center text-sm text-gray-400">
                No API keys yet.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}


/* -------------------------------------------------------------------------- */
/* Notifications Tab                                                          */
/* -------------------------------------------------------------------------- */

function NotificationsTab() {
  const [prefs, setPrefs] = useState<{
    email: boolean;
    push: boolean;
    weeklyDigest: boolean;
    marketing: boolean;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchProfile()
      .then((u) => {
        const p = (u.preferences as UserPreferences) ?? {};
        const n = p.notifications ?? {};
        setPrefs({
          email: n.email ?? true,
          push: n.push ?? true,
          weeklyDigest: n.weeklyDigest ?? false,
          marketing: n.marketing ?? false,
        });
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const toggle = (key: "email" | "push" | "weeklyDigest" | "marketing") => {
    setPrefs((prev) => {
      if (!prev) return prev;
      const next = { ...prev, [key]: !prev[key] };
      updatePreferences({ notifications: next }).catch(() => {});
      return next;
    });
  };

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;
  if (!prefs) return null;

  const items = [
    {
      key: "email" as const,
      label: "Email notifications",
      desc: "Receive emails about activity on your account",
    },
    {
      key: "push" as const,
      label: "Push notifications",
      desc: "Receive push notifications in the app",
    },
    {
      key: "weeklyDigest" as const,
      label: "Weekly digest",
      desc: "Receive a weekly summary of your coding activity",
    },
    {
      key: "marketing" as const,
      label: "Marketing emails",
      desc: "Receive emails about new features and updates",
    },
  ];

  return (
    <div>
      <h2 className="mb-4 text-lg font-medium text-gray-900">Notifications</h2>
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="space-y-6">
          {items.map((item) => (
            <div
              key={item.key}
              className="flex items-center justify-between"
            >
              <div>
                <p className="text-sm text-gray-700">{item.label}</p>
                <p className="text-xs text-gray-400">{item.desc}</p>
              </div>
              <Toggle
                on={prefs[item.key]}
                onChange={() => toggle(item.key)}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Main Settings Page                                                         */
/* -------------------------------------------------------------------------- */

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("profile");

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
