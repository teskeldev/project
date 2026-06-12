/**
 * Client-side helpers for the dashboard home summary endpoint.
 *
 * Kept separate from `@/lib/client/api` (per Phase 7d scope) to avoid adding
 * conflicting exports there. Reuses `apiFetch` for envelope unwrapping.
 */

import { apiFetch } from "@/lib/client/api";

export type AgentRunStatus =
  | "QUEUED"
  | "RUNNING"
  | "WAITING_APPROVAL"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED";

export type DashboardFocusProject = {
  id: string;
  name: string;
  slug: string;
  workspaceId: string;
  defaultBranch: string;
};

export type DashboardRecentProject = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  workspaceId: string;
  updatedAt: string;
};

export type DashboardRecentThread = {
  id: string;
  title: string;
  projectId: string;
  updatedAt: string;
};

export type DashboardRecentAgentRun = {
  id: string;
  goal: string;
  status: AgentRunStatus;
  projectId: string;
  updatedAt: string;
};

export type DashboardGit = {
  branch: string;
  dirtyCount: number;
  lastCommitHash: string | null;
};

export type DashboardCounts = {
  workspaces: number;
  projects: number;
  threads: number;
  agentRuns: number;
  pendingChanges: number;
};

export type DashboardSummary = {
  focusProject: DashboardFocusProject | null;
  recentProjects: DashboardRecentProject[];
  recentThreads: DashboardRecentThread[];
  recentAgentRuns: DashboardRecentAgentRun[];
  git: DashboardGit | null;
  counts: DashboardCounts;
};

/** Fetch the dashboard home summary, optionally focused on a project. */
export function getDashboardSummary(
  projectId?: string | null
): Promise<DashboardSummary> {
  const qs = projectId ? `?projectId=${encodeURIComponent(projectId)}` : "";
  return apiFetch(`/api/dashboard/summary${qs}`);
}
