"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Plus,
  MoreHorizontal,
  AlertCircle,
  Check,
  Loader2,
} from "lucide-react";
import { useProject } from "@/lib/store/project";
import {
  fetchMembers,
  inviteMember,
  updateMemberRole,
  removeMember,
  type WorkspaceMember,
} from "@/lib/client/settings";
import {
  Button,
  Input,
  Card,
  CardContent,
  Badge,
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

export default function TeamTab() {
  const { activeWorkspace } = useProject();
  const workspaceId = activeWorkspace?.id ?? null;
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("MEMBER");
  const [inviting, setInviting] = useState(false);

  const loadMembers = useCallback(() => {
    if (!workspaceId) { setLoading(false); return; }
    setLoading(true);
    fetchMembers(workspaceId)
      .then((r) => setMembers(r.members))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [workspaceId]);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  const handleInvite = async () => {
    if (!workspaceId || !inviteEmail.trim()) return;
    setInviting(true);
    try {
      await inviteMember(workspaceId, inviteEmail.trim(), inviteRole);
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
        prev.map((m) => (m.id === memberId ? { ...m, role } : m)),
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
    return (
      <div className="flex items-center gap-2 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
        <AlertCircle size={16} />
        No active workspace selected.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 size={24} className="animate-spin text-text-muted" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-medium text-foreground">Team Members</h2>
        <Button onClick={() => setShowInvite(true)}>
          <Plus size={14} />
          Invite member
        </Button>
      </div>

      {error && <StatusMessage message={error} type="error" />}

      {showInvite && (
        <Card className="mb-4">
          <CardContent className="pt-4">
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <label className="mb-1 block text-xs text-text-muted">
                  Email
                </label>
                <Input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="colleague@example.com"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-text-muted">
                  Role
                </label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="rounded-lg border border-border px-3 py-2 text-sm"
                >
                  <option value="MEMBER">Member</option>
                  <option value="ADMIN">Admin</option>
                  <option value="VIEWER">Viewer</option>
                </select>
              </div>
              <Button
                onClick={handleInvite}
                disabled={inviting}
                className="bg-accent hover:bg-accent-hover"
              >
                {inviting ? "Inviting..." : "Send invite"}
              </Button>
              <Button variant="outline" onClick={() => setShowInvite(false)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        {members.map((member, i) => (
          <div key={member.id}>
            <div className="flex items-center justify-between px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-soft text-sm font-medium text-text-secondary">
                  {(member.name ?? member.email)[0].toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-medium text-text-secondary">
                    {member.name ?? member.email}
                  </p>
                  <p className="text-xs text-text-muted">{member.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                {member.role === "OWNER" ? (
                  <Badge variant="default">Owner</Badge>
                ) : (
                  <select
                    value={member.role}
                    onChange={(e) =>
                      handleRoleChange(member.id, e.target.value)
                    }
                    className="rounded-full border border-border px-2.5 py-0.5 text-xs"
                  >
                    <option value="ADMIN">Admin</option>
                    <option value="MEMBER">Member</option>
                    <option value="VIEWER">Viewer</option>
                  </select>
                )}
                {member.role !== "OWNER" && (
                  <button
                    onClick={() => handleRemove(member.id, member.name)}
                    className="text-text-muted hover:text-red-500"
                  >
                    <MoreHorizontal size={16} />
                  </button>
                )}
              </div>
            </div>
            {i < members.length - 1 && <Separator />}
          </div>
        ))}
        {members.length === 0 && (
          <p className="px-6 py-8 text-center text-sm text-text-muted">
            No members yet. Invite someone to get started.
          </p>
        )}
      </Card>
    </div>
  );
}
