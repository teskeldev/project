"use client";

import { useEffect, useState } from "react";
import { Shield, AlertCircle, Check } from "lucide-react";
import {
  fetchProfile,
  updateProfile,
  type UserProfile,
} from "@/lib/client/settings";
import {
  Button,
  Input,
  Textarea,
  Card,
  CardContent,
  Separator,
} from "@/components/ui";

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
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

/* -------------------------------------------------------------------------- */
/* Component                                                                  */
/* -------------------------------------------------------------------------- */

export default function ProfileTab() {
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-gray-900" />
      </div>
    );
  }

  if (error && !profile) {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
        <AlertCircle size={16} />
        {error}
      </div>
    );
  }

  const initials = (name || email || "U")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="space-y-6">
      {/* Profile section */}
      <div>
        <h2 className="mb-4 text-lg font-medium text-gray-900">Profile</h2>
        <Card>
          <CardContent className="pt-6">
            <div className="mb-6 flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-900 text-2xl font-bold text-white">
                {initials}
              </div>
              <div>
                <Button variant="link" disabled className="px-0">
                  Change avatar{" "}
                  <span className="text-xs text-gray-400">(Coming soon)</span>
                </Button>
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
                <Input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Email
                </label>
                <Input type="email" value={email} disabled />
                <p className="mt-1 text-xs text-gray-400">
                  Contact support@teskel.dev to change your email.
                </p>
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Bio
                </label>
                <Textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  rows={3}
                />
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <StatusMessage message={success} type="success" />
              <StatusMessage message={error} type="error" />
              <Button onClick={handleSave} disabled={saving}>
                {saving ? "Saving..." : "Save changes"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Separator />

      {/* Security section */}
      <div>
        <h2 className="mb-4 text-lg font-medium text-gray-900">Security</h2>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-700">
                  Two-factor authentication
                </p>
                <p className="text-xs text-gray-400">
                  Add an extra layer of security to your account
                </p>
              </div>
              <Button variant="outline" disabled>
                <Shield size={14} />
                Enable 2FA{" "}
                <span className="text-xs text-gray-400">(Coming soon)</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Separator />

      {/* Danger zone */}
      <div>
        <h2 className="mb-4 text-lg font-medium text-red-600">Danger zone</h2>
        <Card className="border-red-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-700">
                  Delete account
                </p>
                <p className="text-xs text-gray-400">
                  Permanently delete your account and all data
                </p>
              </div>
              <Button variant="destructive" disabled>
                Delete account{" "}
                <span className="text-xs text-gray-400">(Coming soon)</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
