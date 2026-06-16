/**
 * Client-side typed helpers for the Phase 5b git API.
 *
 * This is a STANDALONE module (it does not modify the shared `client/api.ts`).
 * It reuses `apiFetch` only for its envelope-unwrapping/error behaviour.
 */

import { apiFetch } from "@/lib/client/api";

/* ------------------------------- types ----------------------------------- */

export type GitFileStatus = {
  path: string;
  from?: string;
  index: string;
  working: string;
};

export type GitStatus = {
  isRepo: true;
  branch: string | null;
  ahead: number;
  behind: number;
  tracking: string | null;
  detached: boolean;
  staged: GitFileStatus[];
  unstaged: GitFileStatus[];
  untracked: GitFileStatus[];
  conflicted: GitFileStatus[];
  clean: boolean;
};

export type NotARepo = { isRepo: false };

export type GitStatusResult = GitStatus | NotARepo;

export type GitBranchInfo = {
  name: string;
  current: boolean;
  commit: string;
  label: string;
};

export type GitBranchesResult =
  | { isRepo: true; current: string | null; branches: GitBranchInfo[] }
  | NotARepo;

export type GitLogEntry = {
  hash: string;
  shortHash: string;
  message: string;
  author: string;
  email: string;
  date: string;
  filesChanged: number;
};

export type GitLogResult = { isRepo: true; commits: GitLogEntry[] } | NotARepo;

export type GitDiffResult = { isRepo: true; diff: string } | NotARepo;

export type GitCommitResult =
  | { isRepo: true; hash: string; branch: string }
  | NotARepo;

export type GitRemoteResult =
  | { ok: true; message: string }
  | { ok: false; message: string };

/* ----------------------------- endpoints --------------------------------- */

const base = (projectId: string) =>
  `/api/projects/${encodeURIComponent(projectId)}/git`;

export function getStatus(projectId: string): Promise<GitStatusResult> {
  return apiFetch(`${base(projectId)}/status`);
}

export function initRepo(projectId: string): Promise<GitStatus> {
  return apiFetch(`${base(projectId)}/init`, { method: "POST" });
}

export function stagePaths(
  projectId: string,
  paths: string[]
): Promise<GitStatusResult> {
  return apiFetch(`${base(projectId)}/stage`, {
    method: "POST",
    body: JSON.stringify({ paths }),
  });
}

export function unstagePaths(
  projectId: string,
  paths: string[]
): Promise<GitStatusResult> {
  return apiFetch(`${base(projectId)}/unstage`, {
    method: "POST",
    body: JSON.stringify({ paths }),
  });
}

export function commit(
  projectId: string,
  message: string,
  paths?: string[]
): Promise<GitCommitResult> {
  return apiFetch(`${base(projectId)}/commit`, {
    method: "POST",
    body: JSON.stringify(paths ? { message, paths } : { message }),
  });
}

export function getBranches(projectId: string): Promise<GitBranchesResult> {
  return apiFetch(`${base(projectId)}/branches`);
}

export function createBranch(
  projectId: string,
  name: string
): Promise<GitBranchesResult> {
  return apiFetch(`${base(projectId)}/branch`, {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export function checkoutBranch(
  projectId: string,
  name: string
): Promise<GitBranchesResult> {
  return apiFetch(`${base(projectId)}/checkout`, {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export function getLog(
  projectId: string,
  limit = 50
): Promise<GitLogResult> {
  return apiFetch(`${base(projectId)}/log?limit=${encodeURIComponent(limit)}`);
}

export function getDiff(
  projectId: string,
  opts: { path?: string; staged?: boolean } = {}
): Promise<GitDiffResult> {
  const qs = new URLSearchParams();
  if (opts.path) qs.set("path", opts.path);
  if (opts.staged) qs.set("staged", "true");
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return apiFetch(`${base(projectId)}/diff${suffix}`);
}

export function push(projectId: string): Promise<GitRemoteResult> {
  return apiFetch(`${base(projectId)}/push`, { method: "POST" });
}

export function pull(projectId: string): Promise<GitRemoteResult> {
  return apiFetch(`${base(projectId)}/pull`, { method: "POST" });
}

export function generateCommitMessage(projectId: string): Promise<{ message: string }> {
  return apiFetch(`${base(projectId)}/commit-message`, { method: "POST" });
}
