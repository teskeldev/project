/**
 * GitHub integration service.
 *
 * Uses the GitHub REST API via fetch (no octokit dependency).
 * Requires a personal access token or GitHub App token.
 *
 * SERVER-ONLY: This module reads tokens from integration config.
 * Never import from client components.
 */

const GITHUB_API = "https://api.github.com";

/** Valid pattern for GitHub owner and repo names. */
const VALID_PATH_PARAM = /^[a-zA-Z0-9._-]+$/;

/**
 * Validates that a path parameter (owner or repo) contains only safe characters.
 * Prevents path injection attacks.
 */
function validatePathParam(value: string, name: string): void {
  if (!value || !VALID_PATH_PARAM.test(value)) {
    throw new Error(
      `Invalid ${name}: must contain only alphanumeric characters, hyphens, underscores, and dots.`
    );
  }
}

export type GitHubPullRequest = {
  number: number;
  title: string;
  body: string | null;
  state: "open" | "closed";
  merged: boolean;
  url: string;
  htmlUrl: string;
  author: string;
  head: { ref: string; sha: string };
  base: { ref: string; sha: string };
  createdAt: string;
  updatedAt: string;
  mergedAt: string | null;
  draft: boolean;
  additions: number;
  deletions: number;
  changedFiles: number;
  comments: number;
};

export type GitHubComment = {
  id: number;
  body: string;
  author: string;
  createdAt: string;
  updatedAt: string;
};

export class GitHubError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "GitHubError";
    this.status = status;
  }
}

/* -------------------------------------------------------------------------- */
/* Internal helpers                                                           */
/* -------------------------------------------------------------------------- */

async function ghFetch<T>(
  token: string,
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const url = path.startsWith("http") ? path : `${GITHUB_API}${path}`;

  const res = await fetch(url, {
    ...options,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });

  if (!res.ok) {
    let message = `GitHub API error: ${res.status}`;
    try {
      const body = (await res.json()) as { message?: string };
      if (body.message) message = body.message;
    } catch {
      // ignore parse errors
    }
    throw new GitHubError(message, res.status);
  }

  // Some endpoints (204) return no body
  if (res.status === 204) return {} as T;

  return (await res.json()) as T;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function mapPullRequest(raw: any): GitHubPullRequest {
  return {
    number: raw.number,
    title: raw.title,
    body: raw.body ?? null,
    state: raw.state,
    merged: raw.merged ?? false,
    url: raw.url,
    htmlUrl: raw.html_url,
    author: raw.user?.login ?? "unknown",
    head: { ref: raw.head?.ref ?? "", sha: raw.head?.sha ?? "" },
    base: { ref: raw.base?.ref ?? "", sha: raw.base?.sha ?? "" },
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
    mergedAt: raw.merged_at ?? null,
    draft: raw.draft ?? false,
    additions: raw.additions ?? 0,
    deletions: raw.deletions ?? 0,
    changedFiles: raw.changed_files ?? 0,
    comments: raw.comments ?? 0,
  };
}

function mapComment(raw: any): GitHubComment {
  return {
    id: raw.id,
    body: raw.body ?? "",
    author: raw.user?.login ?? "unknown",
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/* -------------------------------------------------------------------------- */
/* Public API                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Create a pull request on a GitHub repository.
 */
export async function createPullRequest(
  token: string,
  owner: string,
  repo: string,
  head: string,
  base: string,
  title: string,
  body?: string
): Promise<GitHubPullRequest> {
  validatePathParam(owner, "owner");
  validatePathParam(repo, "repo");
  const raw = await ghFetch(token, `/repos/${owner}/${repo}/pulls`, {
    method: "POST",
    body: JSON.stringify({ title, body: body ?? "", head, base }),
  });
  return mapPullRequest(raw);
}

/**
 * List pull requests for a repository.
 */
export async function listPullRequests(
  token: string,
  owner: string,
  repo: string,
  state: "open" | "closed" | "all" = "open"
): Promise<GitHubPullRequest[]> {
  validatePathParam(owner, "owner");
  validatePathParam(repo, "repo");
  const raw = await ghFetch<unknown[]>(
    token,
    `/repos/${owner}/${repo}/pulls?state=${state}&per_page=30&sort=updated&direction=desc`
  );
  return raw.map(mapPullRequest);
}

/**
 * Get a single pull request by number.
 */
export async function getPullRequest(
  token: string,
  owner: string,
  repo: string,
  number: number
): Promise<GitHubPullRequest> {
  validatePathParam(owner, "owner");
  validatePathParam(repo, "repo");
  const raw = await ghFetch(token, `/repos/${owner}/${repo}/pulls/${number}`);
  return mapPullRequest(raw);
}

/**
 * Merge a pull request.
 */
export async function mergePullRequest(
  token: string,
  owner: string,
  repo: string,
  number: number,
  mergeMethod: "merge" | "squash" | "rebase" = "merge"
): Promise<{ merged: boolean; message: string; sha: string }> {
  validatePathParam(owner, "owner");
  validatePathParam(repo, "repo");
  const raw = await ghFetch<{ merged: boolean; message: string; sha: string }>(
    token,
    `/repos/${owner}/${repo}/pulls/${number}/merge`,
    {
      method: "PUT",
      body: JSON.stringify({ merge_method: mergeMethod }),
    }
  );
  return raw;
}

/**
 * Add a comment to a pull request (issue comment).
 */
export async function addComment(
  token: string,
  owner: string,
  repo: string,
  number: number,
  body: string
): Promise<GitHubComment> {
  validatePathParam(owner, "owner");
  validatePathParam(repo, "repo");
  const raw = await ghFetch(
    token,
    `/repos/${owner}/${repo}/issues/${number}/comments`,
    {
      method: "POST",
      body: JSON.stringify({ body }),
    }
  );
  return mapComment(raw);
}

/**
 * List comments on a pull request.
 */
export async function listComments(
  token: string,
  owner: string,
  repo: string,
  number: number
): Promise<GitHubComment[]> {
  validatePathParam(owner, "owner");
  validatePathParam(repo, "repo");
  const raw = await ghFetch<unknown[]>(
    token,
    `/repos/${owner}/${repo}/issues/${number}/comments?per_page=50`
  );
  return raw.map(mapComment);
}
