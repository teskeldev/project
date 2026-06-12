import { apiFetch } from "@/lib/client/api";

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

export type UserProfile = {
  id: string;
  name: string | null;
  email: string;
  bio: string | null;
  image: string | null;
  preferences: UserPreferences | null;
};

export type UserPreferences = {
  theme?: "system" | "light" | "dark";
  fontSize?: number;
  wordWrap?: boolean;
  minimap?: boolean;
  vim?: boolean;
  plan?: string;
  notifications?: NotificationPrefs;
};

export type NotificationPrefs = {
  email?: boolean;
  push?: boolean;
  weeklyDigest?: boolean;
  marketing?: boolean;
};

export type ApiKeyMasked = {
  id: string;
  name: string;
  maskedKey: string;
  lastUsedAt: string | null;
  createdAt: string;
};

export type ApiKeyCreated = {
  key: string;
  id: string;
  name: string;
  createdAt: string;
};

export type WorkspaceMember = {
  id: string;
  userId: string;
  name: string | null;
  email: string;
  image: string | null;
  role: string;
  createdAt: string;
};

export type DashboardSummary = {
  counts: {
    workspaces: number;
    projects: number;
    threads: number;
    agentRuns: number;
    pendingChanges: number;
  };
  focusProject: unknown;
  recentProjects: unknown[];
  recentThreads: unknown[];
  recentAgentRuns: unknown[];
  git: unknown;
};

/* -------------------------------------------------------------------------- */
/* Profile                                                                    */
/* -------------------------------------------------------------------------- */

export function fetchProfile(): Promise<UserProfile> {
  return apiFetch<UserProfile>("/api/user/profile");
}

export function updateProfile(
  data: Partial<Pick<UserProfile, "name" | "bio" | "image">>
): Promise<UserProfile> {
  return apiFetch<UserProfile>("/api/user/profile", {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

/* -------------------------------------------------------------------------- */
/* Preferences                                                                */
/* -------------------------------------------------------------------------- */

export function updatePreferences(
  prefs: Partial<UserPreferences>
): Promise<{ id: string; preferences: UserPreferences }> {
  return apiFetch("/api/user/preferences", {
    method: "PATCH",
    body: JSON.stringify(prefs),
  });
}

/* -------------------------------------------------------------------------- */
/* API Keys                                                                   */
/* -------------------------------------------------------------------------- */

export function fetchApiKeys(): Promise<{ keys: ApiKeyMasked[] }> {
  return apiFetch("/api/keys");
}

export function createApiKey(name: string): Promise<ApiKeyCreated> {
  return apiFetch("/api/keys", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export function revokeApiKey(keyId: string): Promise<{ deleted: boolean }> {
  return apiFetch(`/api/keys/${keyId}`, { method: "DELETE" });
}

/* -------------------------------------------------------------------------- */
/* Team / Workspace Members                                                   */
/* -------------------------------------------------------------------------- */

export function fetchMembers(
  workspaceId: string
): Promise<{ members: WorkspaceMember[] }> {
  return apiFetch(`/api/workspaces/${workspaceId}/members`);
}

export function inviteMember(
  workspaceId: string,
  email: string,
  role: string
): Promise<{ member: WorkspaceMember }> {
  return apiFetch(`/api/workspaces/${workspaceId}/members`, {
    method: "POST",
    body: JSON.stringify({ email, role }),
  });
}

export function updateMemberRole(
  memberId: string,
  role: string
): Promise<{ member: WorkspaceMember }> {
  return apiFetch(`/api/workspace-members/${memberId}`, {
    method: "PATCH",
    body: JSON.stringify({ role }),
  });
}

export function removeMember(
  memberId: string
): Promise<{ deleted: boolean }> {
  return apiFetch(`/api/workspace-members/${memberId}`, {
    method: "DELETE",
  });
}

/* -------------------------------------------------------------------------- */
/* Dashboard Summary (for billing usage stats)                                */
/* -------------------------------------------------------------------------- */

export function fetchDashboardSummary(): Promise<DashboardSummary> {
  return apiFetch("/api/dashboard/summary");
}
