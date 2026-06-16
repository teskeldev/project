"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import {
  fetchProfile,
  updatePreferences,
  type UserPreferences,
} from "@/lib/client/settings";
import {
  Card,
  CardContent,
  Toggle,
  Separator,
} from "@/components/ui";

/* -------------------------------------------------------------------------- */
/* Component                                                                  */
/* -------------------------------------------------------------------------- */

export default function NotificationsTab() {
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 size={24} className="animate-spin text-text-muted" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
        <AlertCircle size={16} />
        {error}
      </div>
    );
  }

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
      <h2 className="mb-4 text-lg font-medium text-foreground">Notifications</h2>
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-6">
            {items.map((item, i) => (
              <div key={item.key}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-text-secondary">{item.label}</p>
                    <p className="text-xs text-text-muted">{item.desc}</p>
                  </div>
                  <Toggle
                    checked={prefs[item.key]}
                    onCheckedChange={() => toggle(item.key)}
                  />
                </div>
                {i < items.length - 1 && <Separator className="mt-6" />}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
