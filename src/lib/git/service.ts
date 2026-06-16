import simpleGit, { type SimpleGit, type StatusResult } from "simple-git";
import { promises as fs } from "node:fs";
import path from "node:path";
import { getProjectRoot } from "@/lib/storage";
import { prisma } from "@/lib/db";

/**
 * REAL git service (Phase 5b). Thin, typed wrapper over simple-git that ALWAYS
 * operates inside a single project''s storage directory.
 *
 * SECURITY:
 *  - baseDir is pinned to getProjectRoot(storageKey); we never accept arbitrary
 *    working directories.
 *  - We only ever call simple-git''s structured API (no raw shell strings built
 *    from user input). The few `raw` calls below use fixed, validated argument
 *    arrays.
 *  - No force operations are exposed (no force push / hard reset).
 */

const DEFAULT_BRANCH = "main";
const DEFAULT_USER_NAME = "Teskel";
const DEFAULT_USER_EMAIL = "teskel@local";

/* ----------------------------- shared types ------------------------------ */

export type GitFileStatus = {
  /** Project-relative POSIX path. */
  path: string;
  /** Original path when renamed. */
  from?: string;
  /** First status code char (index / staged side). */
  index: string;
  /** Second status code char (working dir side). */
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

export type GitLogResult =
  | { isRepo: true; commits: GitLogEntry[] }
  | NotARepo;

export type GitDiffResult =
  | { isRepo: true; diff: string }
  | NotARepo;

export type GitCommitResult =
  | { isRepo: true; hash: string; branch: string }
  | NotARepo;

export type GitRemoteResult =
  | { ok: true; message: string }
  | { ok: false; message: string };

/* ------------------------------- helpers --------------------------------- */

/** simpleGit instance pinned to the project''s storage directory. */
export function getGit(storageKey: string): SimpleGit {
  const baseDir = getProjectRoot(storageKey);
  return simpleGit({ baseDir });
}

/** Whether the project directory is a git work tree. */
export async function isRepo(storageKey: string): Promise<boolean> {
  // Hot path: every git command calls this. We cache the result per
  // storageKey for the lifetime of the process. A workspace doesn't flip
  // between "is a git repo" and "is not a git repo" during a single session
  // except on explicit initRepo(); we invalidate on that call below.
  const cached = isRepoCache.get(storageKey);
  if (cached !== undefined) return cached;
  const result = await rawIsRepo(storageKey);
  isRepoCache.set(storageKey, result);
  return result;
}

// Invalidate the isRepo cache for a project. Called by initRepo() after the
// .git folder is created so subsequent isRepo() lookups return true.
function invalidateIsRepo(storageKey: string) {
  isRepoCache.delete(storageKey);
}

async function rawIsRepo(storageKey: string): Promise<boolean> {
  // Use a filesystem stat instead of spawning a git CLI. simple-git's
  // checkIsRepo() spawns `git rev-parse --is-inside-work-tree` which costs
  // ~50-100ms of process startup. `fs.stat` costs ~1ms.
  try {
    const gitDir = path.join(getProjectRoot(storageKey), ".git");
    const stat = await fs.stat(gitDir);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

const isRepoCache = new Map<string, boolean>();

/** Map a simple-git StatusResult into the shape the UI consumes. */
function mapStatus(s: StatusResult): GitStatus {
  const conflictedPaths = new Set(s.conflicted);

  const staged: GitFileStatus[] = [];
  const unstaged: GitFileStatus[] = [];
  const untracked: GitFileStatus[] = [];
  const conflicted: GitFileStatus[] = [];

  for (const f of s.files) {
    const entry: GitFileStatus = {
      path: f.path,
      index: f.index,
      working: f.working_dir,
    };
    if (f.from) entry.from = f.from;

    if (conflictedPaths.has(f.path)) {
      conflicted.push(entry);
      continue;
    }

    // Untracked: both git status codes are "?".
    if (f.index === "?" && f.working_dir === "?") {
      untracked.push(entry);
      continue;
    }

    // Index column populated (and not untracked) -> staged.
    if (f.index && f.index !== " " && f.index !== "?") {
      staged.push(entry);
    }
    // Working-dir column populated -> unstaged working change.
    if (f.working_dir && f.working_dir !== " " && f.working_dir !== "?") {
      unstaged.push(entry);
    }
  }

  return {
    isRepo: true,
    branch: s.current,
    ahead: s.ahead,
    behind: s.behind,
    tracking: s.tracking,
    detached: s.detached,
    staged,
    unstaged,
    untracked,
    conflicted,
    clean: s.isClean(),
  };
}

/** Persist a snapshot of git state for the project (best-effort). */
async function upsertGitState(
  projectId: string,
  branch: string,
  lastCommitHash: string | null,
  status: GitStatus | null
): Promise<void> {
  try {
    await prisma.gitState.upsert({
      where: { projectId },
      create: {
        projectId,
        branch,
        lastCommitHash: lastCommitHash ?? undefined,
        status: status ? (status as unknown as object) : undefined,
      },
      update: {
        branch,
        lastCommitHash: lastCommitHash ?? undefined,
        status: status ? (status as unknown as object) : undefined,
      },
    });
  } catch {
    // GitState is a convenience cache; never fail the git op because of it.
  }
}

/** Read status, returning {isRepo:false} when the dir is not a repo. */
export async function status(storageKey: string): Promise<GitStatusResult> {
  // Skip the explicit isRepo() call: getGit(...).status() naturally throws
  // when the directory is not a git repo. We let it fail fast and translate
  // to {isRepo: false} here. This saves one process spawn per request.
  try {
    const s = await getGit(storageKey).status();
    return mapStatus(s);
  } catch (err) {
    if (isNotARepositoryError(err)) return { isRepo: false };
    throw err;
  }
}

function isNotARepositoryError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes("not a git repository") ||
    msg.includes("Not a git repository") ||
    msg.includes("does not appear to be a git repository") ||
    msg.includes("ENOENT") && msg.includes(".git")
  );
}

/* -------------------------------- init ----------------------------------- */

/** git init + set default branch and a local identity so commits work. */
export async function initRepo(
  storageKey: string,
  projectId?: string
): Promise<GitStatus> {
  const git = getGit(storageKey);

  if (!(await git.checkIsRepo())) {
    await git.init(["-b", DEFAULT_BRANCH]);
    // Cache was seeded against a missing .git folder; refresh it now.
    invalidateIsRepo(storageKey);
  }

  // Set a repo-local identity if none is configured, so a fresh environment
  // can still create commits. Repo-local scope only; never touches globals.
  await ensureLocalIdentity(git);

  const mapped = mapStatus(await git.status());
  if (projectId) {
    await upsertGitState(
      projectId,
      mapped.branch ?? DEFAULT_BRANCH,
      null,
      mapped
    );
  }
  return mapped;
}

async function ensureLocalIdentity(git: SimpleGit): Promise<void> {
  try {
    const name = await git.getConfig("user.name");
    if (!name.value) {
      await git.addConfig("user.name", DEFAULT_USER_NAME);
    }
  } catch {
    await git.addConfig("user.name", DEFAULT_USER_NAME).catch(() => {});
  }
  try {
    const email = await git.getConfig("user.email");
    if (!email.value) {
      await git.addConfig("user.email", DEFAULT_USER_EMAIL);
    }
  } catch {
    await git.addConfig("user.email", DEFAULT_USER_EMAIL).catch(() => {});
  }
}

/* ------------------------------- staging --------------------------------- */

/**
 * Validates user-supplied paths before passing them to `git`. Rejects anything
 * that would be interpreted as a CLI flag (leading `-`) or that tries to escape
 * the repository root (`..` segment or absolute path). Throws a clear error.
 */
function assertSafePaths(paths: string[] | undefined): void {
  if (!paths) return;
  for (const p of paths) {
    if (typeof p !== "string" || p.length === 0) {
      throw new Error(`Invalid git path: ${JSON.stringify(p)}`);
    }
    if (p.startsWith("-")) {
      throw new Error(
        `Invalid git path (must not start with '-' to avoid flag injection): ${p}`
      );
    }
    if (p.includes("..") || p.startsWith("/") || /^[a-zA-Z]:[\\/]/.test(p)) {
      throw new Error(`Invalid git path (escape attempt): ${p}`);
    }
  }
}

export async function stage(
  storageKey: string,
  paths: string[]
): Promise<GitStatusResult> {
  if (!(await isRepo(storageKey))) return { isRepo: false };
  assertSafePaths(paths);
  const git = getGit(storageKey);
  await git.raw(paths.length ? ["add", "--", ...paths] : ["add", "-A"]);
  return mapStatus(await git.status());
}

export async function unstage(
  storageKey: string,
  paths: string[]
): Promise<GitStatusResult> {
  if (!(await isRepo(storageKey))) return { isRepo: false };
  assertSafePaths(paths);
  const git = getGit(storageKey);
  // `git reset HEAD -- <paths>`. Works even before the first commit when HEAD
  // is unborn (git falls back to clearing the index entry).
  const args = ["reset", "-q", "HEAD", "--", ...paths];
  try {
    await git.raw(args);
  } catch {
    // Unborn HEAD: `git rm --cached` clears staged entries safely.
    await git.raw(["rm", "--cached", "-r", "--", ...paths]).catch(() => {});
  }
  return mapStatus(await git.status());
}

/* -------------------------------- commit --------------------------------- */

export async function commit(
  storageKey: string,
  message: string,
  paths?: string[],
  projectId?: string
): Promise<GitCommitResult> {
  if (!(await isRepo(storageKey))) return { isRepo: false };
  assertSafePaths(paths);
  const git = getGit(storageKey);
  await ensureLocalIdentity(git);

  const res =
    paths && paths.length
      ? await git.raw(["commit", "-m", message, "--", ...paths])
      : await git.commit(message);

  const mapped = mapStatus(await git.status());
  const hash = (res && typeof res === "object" && "commit" in res ? res.commit : null) || (await git.revparse(["HEAD"])).trim();
  if (projectId) {
    await upsertGitState(
      projectId,
      mapped.branch ?? DEFAULT_BRANCH,
      hash,
      mapped
    );
  }
  return { isRepo: true, hash, branch: mapped.branch ?? DEFAULT_BRANCH };
}

/* ------------------------------- branches -------------------------------- */

export async function branches(
  storageKey: string
): Promise<GitBranchesResult> {
  if (!(await isRepo(storageKey))) return { isRepo: false };
  const git = getGit(storageKey);
  const summary = await git.branchLocal();

  const list: GitBranchInfo[] = Object.values(summary.branches).map((b) => ({
    name: b.name,
    current: b.current,
    commit: b.commit,
    label: b.label,
  }));

  return { isRepo: true, current: summary.current || null, branches: list };
}

export async function createBranch(
  storageKey: string,
  name: string,
  projectId?: string
): Promise<GitBranchesResult> {
  if (!(await isRepo(storageKey))) return { isRepo: false };
  const git = getGit(storageKey);
  await git.checkoutLocalBranch(name);
  if (projectId) {
    const mapped = mapStatus(await git.status());
    await upsertGitState(projectId, name, null, mapped);
  }
  return branches(storageKey);
}

export async function checkout(
  storageKey: string,
  name: string,
  projectId?: string
): Promise<GitBranchesResult> {
  if (!(await isRepo(storageKey))) return { isRepo: false };
  const git = getGit(storageKey);
  await git.checkout(name);
  if (projectId) {
    const mapped = mapStatus(await git.status());
    await upsertGitState(projectId, name, null, mapped);
  }
  return branches(storageKey);
}

/* --------------------------------- log ----------------------------------- */

export async function log(
  storageKey: string,
  limit = 50
): Promise<GitLogResult> {
  if (!(await isRepo(storageKey))) return { isRepo: false };
  const git = getGit(storageKey);

  // An unborn HEAD (no commits yet) makes `git log` error; treat as empty.
  try {
    await git.revparse(["HEAD"]);
  } catch {
    return { isRepo: true, commits: [] };
  }

  const result = await git.log({ maxCount: limit });
  const commits: GitLogEntry[] = result.all.map((c) => ({
    hash: c.hash,
    shortHash: c.hash.slice(0, 7),
    message: c.message,
    author: c.author_name,
    email: c.author_email,
    date: c.date,
    filesChanged: c.diff?.changed ?? 0,
  }));

  return { isRepo: true, commits };
}

/* --------------------------------- diff ---------------------------------- */

export async function diff(
  storageKey: string,
  opts: { path?: string; staged?: boolean } = {}
): Promise<GitDiffResult> {
  if (!(await isRepo(storageKey))) return { isRepo: false };
  const git = getGit(storageKey);

  const args: string[] = [];
  if (opts.staged) args.push("--staged");
  if (opts.path) {
    args.push("--", opts.path);
  }

  const text = await git.diff(args);
  return { isRepo: true, diff: text };
}

/* ------------------------- remote (optional) ----------------------------- */

async function hasRemote(git: SimpleGit): Promise<boolean> {
  try {
    const remotes = await git.getRemotes(false);
    return remotes.length > 0;
  } catch {
    return false;
  }
}

export async function push(storageKey: string): Promise<GitRemoteResult> {
  if (!(await isRepo(storageKey))) {
    return { ok: false, message: "Not a git repository" };
  }
  const git = getGit(storageKey);
  if (!(await hasRemote(git))) {
    return { ok: false, message: "No remote configured" };
  }
  try {
    // Plain push only. Force push is intentionally NOT supported.
    await git.push();
    return { ok: true, message: "Pushed to remote" };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Push failed",
    };
  }
}

export async function pull(storageKey: string): Promise<GitRemoteResult> {
  if (!(await isRepo(storageKey))) {
    return { ok: false, message: "Not a git repository" };
  }
  const git = getGit(storageKey);
  if (!(await hasRemote(git))) {
    return { ok: false, message: "No remote configured" };
  }
  try {
    await git.pull();
    return { ok: true, message: "Pulled from remote" };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Pull failed",
    };
  }
}
