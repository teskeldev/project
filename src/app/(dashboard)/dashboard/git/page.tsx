"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  GitBranch,
  GitCommit,
  GitPullRequest,
  ChevronDown,
  Plus,
  RefreshCw,
  Check,
  X,
  File,
  ArrowUp,
  ArrowDown,
  Search,
  Clock,
  User,
  FolderGit2,
  Loader2,
  AlertCircle,
  ExternalLink,
  GitMerge,
  MessageSquare,
  Sparkles,
} from "lucide-react";
import { useProject } from "@/lib/store/project";
import { ApiClientError } from "@/lib/client/api";
import {
  getStatus,
  initRepo,
  stagePaths,
  unstagePaths,
  commit as apiCommit,
  getBranches,
  createBranch as apiCreateBranch,
  checkoutBranch,
  getLog,
  getDiff,
  push as apiPush,
  generateCommitMessage as apiGenerateCommitMessage,
  pull as apiPull,
  type GitStatus,
  type GitFileStatus,
  type GitBranchInfo,
  type GitLogEntry,
} from "@/lib/client/git";
import { apiFetch } from "@/lib/client/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

type GitTab = "changes" | "branches" | "commits" | "prs";

/* -------------------------------------------------------------------------- */
/* Pull Request types                                                         */
/* -------------------------------------------------------------------------- */

type PullRequest = {
  number: number;
  title: string;
  body: string | null;
  state: "open" | "closed";
  merged: boolean;
  htmlUrl: string;
  author: string;
  head: { ref: string; sha: string };
  base: { ref: string; sha: string };
  createdAt: string;
  updatedAt: string;
  draft: boolean;
  additions: number;
  deletions: number;
  changedFiles: number;
  comments: number;
};

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

/** Human-friendly single-letter status + colour for a changed file. */
function statusBadge(f: GitFileStatus, staged: boolean): {
  letter: string;
  className: string;
} {
  const code = (staged ? f.index : f.working) || f.index || f.working;
  switch (code) {
    case "A":
      return { letter: "A", className: "text-green-600 dark:text-green-400" };
    case "M":
      return { letter: "M", className: "text-amber-600 dark:text-amber-400" };
    case "D":
      return { letter: "D", className: "text-red-600 dark:text-red-400" };
    case "R":
      return { letter: "R", className: "text-blue-600 dark:text-blue-400" };
    case "?":
      return { letter: "U", className: "text-green-600 dark:text-green-400" };
    default:
      return { letter: code || "?", className: "text-[var(--text-secondary)]" };
  }
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return iso;
  const diffMs = Date.now() - then;
  const sec = Math.round(diffMs / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  return `${day}d ago`;
}

export default function GitPage() {
  const { activeProject } = useProject();
  const projectId = activeProject?.id ?? null;

  const [activeTab, setActiveTab] = useState<GitTab>("changes");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const [isRepo, setIsRepo] = useState<boolean | null>(null);
  const [status, setStatus] = useState<GitStatus | null>(null);
  const [branches, setBranches] = useState<GitBranchInfo[]>([]);
  const [currentBranch, setCurrentBranch] = useState<string | null>(null);
  const [commits, setCommits] = useState<GitLogEntry[]>([]);

  const [commitMessage, setCommitMessage] = useState("");
  const [branchFilter, setBranchFilter] = useState("");
  const [newBranchName, setNewBranchName] = useState("");
  const [creatingBranch, setCreatingBranch] = useState(false);
  const [busy, setBusy] = useState(false);
  const [generating, setGenerating] = useState(false);

  // Selected file diff.
  const [diffPath, setDiffPath] = useState<string | null>(null);
  const [diffStaged, setDiffStaged] = useState(false);
  const [diffText, setDiffText] = useState<string | null>(null);
  const [diffLoading, setDiffLoading] = useState(false);

  // Pull Requests state
  const [pullRequests, setPullRequests] = useState<PullRequest[]>([]);
  const [prsLoading, setPrsLoading] = useState(false);
  const [prsError, setPrsError] = useState<string | null>(null);
  const [showCreatePr, setShowCreatePr] = useState(false);
  const [prTitle, setPrTitle] = useState("");
  const [prBody, setPrBody] = useState("");
  const [prBase, setPrBase] = useState("main");
  const [prCreating, setPrCreating] = useState(false);
  const [selectedPr, setSelectedPr] = useState<PullRequest | null>(null);
  const [merging, setMerging] = useState(false);

  const refreshAll = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    try {
      const s = await getStatus(projectId);
      if (!s.isRepo) {
        setIsRepo(false);
        setStatus(null);
        setBranches([]);
        setCommits([]);
        setCurrentBranch(null);
        return;
      }
      setIsRepo(true);
      setStatus(s);
      setCurrentBranch(s.branch);

      const [b, l] = await Promise.all([
        getBranches(projectId),
        getLog(projectId, 50),
      ]);
      if (b.isRepo) {
        setBranches(b.branches);
        setCurrentBranch(b.current);
      }
      if (l.isRepo) setCommits(l.commits);
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.message : "Failed to load git state"
      );
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  const refreshPRs = useCallback(async () => {
    if (!projectId) return;
    setPrsLoading(true);
    setPrsError(null);
    try {
      const data = await apiFetch<{ pullRequests: PullRequest[] }>(
        `/api/projects/${encodeURIComponent(projectId)}/git/pull-request`
      );
      setPullRequests(data.pullRequests);
    } catch (err) {
      setPrsError(
        err instanceof ApiClientError ? err.message : "Failed to load pull requests"
      );
    } finally {
      setPrsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    setIsRepo(null);
    setStatus(null);
    setDiffPath(null);
    setDiffText(null);
    void refreshAll();
  }, [refreshAll]);

  useEffect(() => {
    if (activeTab === "prs" && projectId) {
      void refreshPRs();
    }
  }, [activeTab, projectId, refreshPRs]);

  const handleInit = useCallback(async () => {
    if (!projectId) return;
    setBusy(true);
    setError(null);
    try {
      await initRepo(projectId);
      await refreshAll();
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.message : "Failed to initialise repo"
      );
    } finally {
      setBusy(false);
    }
  }, [projectId, refreshAll]);

  const runAction = useCallback(
    async (fn: () => Promise<void>, successMsg?: string) => {
      if (!projectId) return;
      setBusy(true);
      setError(null);
      setActionMsg(null);
      try {
        await fn();
        if (successMsg) setActionMsg(successMsg);
      } catch (err) {
        setError(
          err instanceof ApiClientError ? err.message : "Git operation failed"
        );
      } finally {
        setBusy(false);
      }
    },
    [projectId]
  );

  const handleStage = (path: string) =>
    runAction(async () => {
      if (!projectId) return;
      const s = await stagePaths(projectId, [path]);
      if (s.isRepo) setStatus(s);
    });

  const handleUnstage = (path: string) =>
    runAction(async () => {
      if (!projectId) return;
      const s = await unstagePaths(projectId, [path]);
      if (s.isRepo) setStatus(s);
    });

  const handleStageAll = () =>
    runAction(async () => {
      if (!projectId || !status) return;
      const paths = [
        ...status.unstaged.map((f) => f.path),
        ...status.untracked.map((f) => f.path),
      ];
      if (!paths.length) return;
      const s = await stagePaths(projectId, paths);
      if (s.isRepo) setStatus(s);
    });

  const handleCommit = () =>
    runAction(async () => {
      if (!projectId) return;
      const msg = commitMessage.trim();
      if (!msg) {
        setError("Commit message is required");
        return;
      }
      const res = await apiCommit(projectId, msg);
      if (res.isRepo) {
        setCommitMessage("");
        setDiffPath(null);
        setDiffText(null);
        await refreshAll();
      }
    }, "Commit created");

  const handleGenerateMessage = useCallback(async () => {
    if (!projectId || generating) return;
    setGenerating(true);
    setError(null);
    try {
      const { message } = await apiGenerateCommitMessage(projectId);
      setCommitMessage(message);
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.message : "Failed to generate commit message"
      );
    } finally {
      setGenerating(false);
    }
  }, [projectId, generating]);

  const handleCreateBranch = () =>
    runAction(async () => {
      if (!projectId) return;
      const name = newBranchName.trim();
      if (!name) return;
      const b = await apiCreateBranch(projectId, name);
      if (b.isRepo) {
        setBranches(b.branches);
        setCurrentBranch(b.current);
      }
      setNewBranchName("");
      setCreatingBranch(false);
      await refreshAll();
    }, "Branch created");

  const handleCheckout = (name: string) =>
    runAction(async () => {
      if (!projectId) return;
      const b = await checkoutBranch(projectId, name);
      if (b.isRepo) {
        setBranches(b.branches);
        setCurrentBranch(b.current);
      }
      await refreshAll();
    }, `Switched to ${name}`);

  const handlePush = () =>
    runAction(async () => {
      if (!projectId) return;
      const r = await apiPush(projectId);
      setActionMsg(r.message);
      if (!r.ok) setError(r.message);
    });

  const handlePull = () =>
    runAction(async () => {
      if (!projectId) return;
      const r = await apiPull(projectId);
      setActionMsg(r.message);
      if (!r.ok) setError(r.message);
      else await refreshAll();
    });

  const openDiff = useCallback(
    async (path: string, staged: boolean) => {
      if (!projectId) return;
      setDiffPath(path);
      setDiffStaged(staged);
      setDiffLoading(true);
      setDiffText(null);
      try {
        const d = await getDiff(projectId, { path, staged });
        setDiffText(d.isRepo ? d.diff : null);
      } catch (err) {
        setDiffText(
          err instanceof ApiClientError
            ? `Failed to load diff: ${err.message}`
            : "Failed to load diff"
        );
      } finally {
        setDiffLoading(false);
      }
    },
    [projectId]
  );

  const handleCreatePR = async () => {
    if (!projectId || !prTitle.trim() || !currentBranch) return;
    setPrCreating(true);
    setError(null);
    try {
      await apiFetch(
        `/api/projects/${encodeURIComponent(projectId)}/git/pull-request`,
        {
          method: "POST",
          body: JSON.stringify({
            title: prTitle.trim(),
            body: prBody.trim() || undefined,
            head: currentBranch,
            base: prBase.trim() || "main",
          }),
        }
      );
      setPrTitle("");
      setPrBody("");
      setShowCreatePr(false);
      setActionMsg("Pull request created");
      void refreshPRs();
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.message : "Failed to create PR"
      );
    } finally {
      setPrCreating(false);
    }
  };

  const handleMergePR = async (prNumber: number) => {
    if (!projectId) return;
    setMerging(true);
    setError(null);
    try {
      await apiFetch(
        `/api/projects/${encodeURIComponent(projectId)}/git/pull-request/${prNumber}`,
        { method: "POST" }
      );
      setActionMsg("Pull request merged");
      setSelectedPr(null);
      void refreshPRs();
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.message : "Failed to merge PR"
      );
    } finally {
      setMerging(false);
    }
  };

  const stagedCount = status?.staged.length ?? 0;
  const unstagedAll = useMemo(
    () => [...(status?.unstaged ?? []), ...(status?.untracked ?? [])],
    [status]
  );

  const filteredBranches = useMemo(
    () =>
      branches.filter((b) =>
        b.name.toLowerCase().includes(branchFilter.toLowerCase())
      ),
    [branches, branchFilter]
  );

  const tabs: { id: GitTab; label: string; icon: React.ElementType }[] = [
    { id: "changes", label: "Changes", icon: File },
    { id: "branches", label: "Branches", icon: GitBranch },
    { id: "commits", label: "History", icon: GitCommit },
    { id: "prs", label: "Pull Requests", icon: GitPullRequest },
  ];

  // ----------------------------- empty state -----------------------------
  if (!activeProject) {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-[var(--surface)] text-center">
        <FolderGit2 size={32} className="mb-3 text-[var(--text-muted)]" />
        <p className="text-sm font-medium text-[var(--foreground)]">No project selected</p>
        <p className="mt-1 text-xs text-[var(--text-muted)]">
          Choose a project to manage source control.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-[var(--surface)]">
      {/* Top bar */}
      <div className="flex h-11 items-center justify-between border-b border-[var(--border)] px-4">
        <div className="flex items-center gap-3">
          <GitBranch size={16} className="text-blue-500 dark:text-blue-400" />
          <span className="text-sm font-medium text-[var(--foreground)]">
            Source Control
          </span>
          {isRepo && (
            <div className="flex items-center gap-1 rounded-lg border border-[var(--border)] px-2 py-1">
              <GitBranch size={12} className="text-[var(--text-secondary)]" />
              <span className="text-xs font-medium text-[var(--foreground)]">
                {currentBranch ?? "(detached)"}
              </span>
              <ChevronDown size={12} className="text-[var(--text-muted)]" />
            </div>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            onClick={() => void refreshAll()}
            disabled={loading || busy}
            variant="ghost"
            size="icon"
            title="Refresh"
          >
            <RefreshCw
              size={14}
              className={loading ? "animate-spin" : undefined}
            />
          </Button>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="flex items-center gap-2 border-b border-red-200 bg-red-50 px-4 py-2 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300">
          <AlertCircle size={13} />
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600 dark:text-red-500 dark:hover:text-red-300">
            <X size={12} />
          </button>
        </div>
      )}
      {actionMsg && !error && (
        <div className="flex items-center gap-2 border-b border-blue-200 bg-blue-50 px-4 py-2 text-xs text-blue-700 dark:border-blue-900/50 dark:bg-blue-900/20 dark:text-blue-300">
          <Check size={13} />
          <span className="flex-1">{actionMsg}</span>
          <button onClick={() => setActionMsg(null)} className="text-blue-400 hover:text-blue-600 dark:text-blue-500 dark:hover:text-blue-300">
            <X size={12} />
          </button>
        </div>
      )}

      {/* Not-a-repo CTA */}
      {isRepo === false && (
        <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
          <FolderGit2 size={36} className="mb-4 text-[var(--text-muted)]" />
          <p className="text-sm font-medium text-[var(--foreground)]">
            No git repository
          </p>
          <p className="mt-1 max-w-xs text-xs text-[var(--text-muted)]">
            This project isn&apos;t under version control yet. Initialise a git
            repository to start tracking changes.
          </p>
          <Button
            onClick={() => void handleInit()}
            disabled={busy}
            className="mt-4"
          >
            {busy ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <FolderGit2 size={14} />
            )}
            Initialize Git repository
          </Button>
        </div>
      )}

      {/* Loading (initial) */}
      {isRepo === null && loading && (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 size={20} className="animate-spin text-[var(--text-muted)]" />
        </div>
      )}

      {/* Repo content */}
      {isRepo === true && (
        <>
          {/* Tabs */}
          <div className="flex border-b border-[var(--border)] px-4">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-xs font-medium transition-colors ${
                  activeTab === tab.id
                    ? "border-[var(--accent)] text-[var(--foreground)]"
                    : "border-transparent text-[var(--text-secondary)] hover:text-[var(--foreground)]"
                }`}
              >
                <tab.icon size={14} />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="flex flex-1 overflow-hidden">
            <div className="flex-1 overflow-y-auto">
              {activeTab === "changes" && (
                <div className="p-4">
                  {/* Commit box */}
                  <div className="mb-4">
                    <textarea
                      value={commitMessage}
                      onChange={(e) => setCommitMessage(e.target.value)}
                      placeholder="Commit message..."
                      className="w-full resize-none rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--text-muted)] focus:border-[var(--border-focus,var(--accent))] focus:outline-none"
                      rows={2}
                    />
                    <div className="mt-1 flex justify-end">
                      <Button
                        onClick={() => void handleGenerateMessage()}
                        disabled={generating || busy || stagedCount === 0}
                        variant="ghost"
                        size="sm"
                        title="Generate commit message with AI"
                      >
                        {generating ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <Sparkles size={12} />
                        )}
                        {generating ? "Generating..." : "Generate"}
                      </Button>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <Button
                        onClick={() => void handleCommit()}
                        disabled={busy || stagedCount === 0 || !commitMessage.trim()}
                        className="flex-1"
                        size="sm"
                      >
                        <Check size={12} />
                        Commit ({stagedCount} staged)
                      </Button>
                      <Button
                        onClick={() => void handlePush()}
                        disabled={busy}
                        variant="outline"
                        size="sm"
                      >
                        <ArrowUp size={12} />
                        Push
                      </Button>
                      <Button
                        onClick={() => void handlePull()}
                        disabled={busy}
                        variant="outline"
                        size="sm"
                      >
                        <ArrowDown size={12} />
                        Pull
                      </Button>
                    </div>
                    {(status?.ahead || status?.behind) && (
                      <div className="mt-2 flex items-center gap-3 text-[11px] text-[var(--text-muted)]">
                        {status.ahead > 0 && (
                          <span className="flex items-center gap-0.5 text-green-600 dark:text-green-400">
                            <ArrowUp size={10} />
                            {status.ahead} ahead
                          </span>
                        )}
                        {status.behind > 0 && (
                          <span className="flex items-center gap-0.5 text-amber-600 dark:text-amber-400">
                            <ArrowDown size={10} />
                            {status.behind} behind
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Staged */}
                  <div className="mb-4">
                    <div className="mb-2 flex items-center gap-2">
                      <ChevronDown size={14} className="text-[var(--text-muted)]" />
                      <span className="text-xs font-semibold text-[var(--foreground)]">
                        Staged Changes
                      </span>
                      <Badge variant="success" className="text-[10px]">
                        {stagedCount}
                      </Badge>
                    </div>
                    {stagedCount === 0 && (
                      <p className="px-3 py-1 text-[12px] text-[var(--text-muted)]">
                        Nothing staged.
                      </p>
                    )}
                    {status?.staged.map((f) => {
                      const badge = statusBadge(f, true);
                      return (
                        <div
                          key={`s-${f.path}`}
                          className={`group flex items-center gap-2 rounded-lg px-3 py-1.5 hover:bg-[var(--surface-soft)] ${
                            diffPath === f.path && diffStaged ? "bg-[var(--surface-soft)]" : ""
                          }`}
                        >
                          <span className={`text-[10px] font-bold ${badge.className}`}>
                            {badge.letter}
                          </span>
                          <button
                            onClick={() => void openDiff(f.path, true)}
                            className="flex-1 truncate text-left text-[13px] text-[var(--foreground)] hover:text-[var(--foreground)]"
                            title={f.path}
                          >
                            {f.path}
                          </button>
                          <button
                            onClick={() => void handleUnstage(f.path)}
                            disabled={busy}
                            className="rounded p-1 text-[var(--text-muted)] opacity-0 hover:bg-[var(--border)] group-hover:opacity-100 disabled:opacity-50"
                            title="Unstage file"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  {/* Unstaged + untracked */}
                  <div>
                    <div className="mb-2 flex items-center gap-2">
                      <ChevronDown size={14} className="text-[var(--text-muted)]" />
                      <span className="text-xs font-semibold text-[var(--foreground)]">
                        Changes
                      </span>
                      <Badge variant="outline" className="text-[10px]">
                        {unstagedAll.length}
                      </Badge>
                      {unstagedAll.length > 0 && (
                        <button
                          onClick={() => void handleStageAll()}
                          disabled={busy}
                          className="ml-auto rounded p-1 text-[var(--text-muted)] hover:bg-[var(--surface-soft)] hover:text-[var(--text-secondary)] disabled:opacity-50"
                          title="Stage all"
                        >
                          <Plus size={13} />
                        </button>
                      )}
                    </div>
                    {unstagedAll.length === 0 && (
                      <p className="px-3 py-1 text-[12px] text-[var(--text-muted)]">
                        No changes.
                      </p>
                    )}
                    {unstagedAll.map((f) => {
                      const badge = statusBadge(f, false);
                      return (
                        <div
                          key={`u-${f.path}`}
                          className={`group flex items-center gap-2 rounded-lg px-3 py-1.5 hover:bg-[var(--surface-soft)] ${
                            diffPath === f.path && !diffStaged ? "bg-[var(--surface-soft)]" : ""
                          }`}
                        >
                          <span className={`text-[10px] font-bold ${badge.className}`}>
                            {badge.letter}
                          </span>
                          <button
                            onClick={() => void openDiff(f.path, false)}
                            className="flex-1 truncate text-left text-[13px] text-[var(--foreground)] hover:text-[var(--foreground)]"
                            title={f.path}
                          >
                            {f.path}
                          </button>
                          <button
                            onClick={() => void handleStage(f.path)}
                            disabled={busy}
                            className="rounded p-1 text-[var(--text-muted)] opacity-0 hover:bg-[var(--border)] group-hover:opacity-100 disabled:opacity-50"
                            title="Stage file"
                          >
                            <Plus size={12} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {activeTab === "branches" && (
                <div className="p-4">
                  <div className="mb-4 flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
                    <Search size={14} className="text-[var(--text-muted)]" />
                    <input
                      type="text"
                      value={branchFilter}
                      onChange={(e) => setBranchFilter(e.target.value)}
                      placeholder="Filter branches..."
                      className="flex-1 bg-transparent text-sm text-[var(--foreground)] placeholder:text-[var(--text-muted)] focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    {filteredBranches.map((b) => (
                      <div
                        key={b.name}
                        className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 ${
                          b.current ? "bg-blue-50 dark:bg-blue-900/20" : "hover:bg-[var(--surface-soft)]"
                        }`}
                      >
                        <GitBranch
                          size={14}
                          className={b.current ? "text-blue-500 dark:text-blue-400" : "text-[var(--text-muted)]"}
                        />
                        <span
                          className={`flex-1 truncate text-sm ${
                            b.current ? "font-medium text-[var(--foreground)]" : "text-[var(--foreground)]"
                          }`}
                        >
                          {b.name}
                        </span>
                        {b.current ? (
                          <Badge variant="default" className="text-[10px]">
                            current
                          </Badge>
                        ) : (
                          <Button
                            onClick={() => void handleCheckout(b.name)}
                            disabled={busy}
                            variant="outline"
                            size="sm"
                            className="opacity-0 group-hover:opacity-100 text-[10px]"
                          >
                            Checkout
                          </Button>
                        )}
                      </div>
                    ))}
                    {filteredBranches.length === 0 && (
                      <p className="px-3 py-2 text-[12px] text-[var(--text-muted)]">
                        No branches match.
                      </p>
                    )}
                  </div>

                  {creatingBranch ? (
                    <div className="mt-4 flex items-center gap-2">
                      <Input
                        autoFocus
                        type="text"
                        value={newBranchName}
                        onChange={(e) => setNewBranchName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") void handleCreateBranch();
                          if (e.key === "Escape") {
                            setCreatingBranch(false);
                            setNewBranchName("");
                          }
                        }}
                        placeholder="new-branch-name"
                        className="flex-1 text-xs"
                      />
                      <Button
                        onClick={() => void handleCreateBranch()}
                        disabled={busy || !newBranchName.trim()}
                        size="sm"
                      >
                        Create
                      </Button>
                      <Button
                        onClick={() => {
                          setCreatingBranch(false);
                          setNewBranchName("");
                        }}
                        variant="outline"
                        size="sm"
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <Button
                      onClick={() => setCreatingBranch(true)}
                      variant="outline"
                      size="sm"
                      className="mt-4"
                    >
                      <Plus size={14} />
                      Create branch
                    </Button>
                  )}
                </div>
              )}

              {activeTab === "commits" && (
                <div className="p-4">
                  {commits.length === 0 ? (
                    <p className="px-3 py-2 text-[12px] text-[var(--text-muted)]">
                      No commits yet.
                    </p>
                  ) : (
                    <div className="space-y-1">
                      {commits.map((c) => (
                        <div
                          key={c.hash}
                          className="flex items-start gap-3 rounded-lg px-3 py-3 hover:bg-[var(--surface-soft)]"
                        >
                          <div className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--surface-soft)]">
                            <GitCommit size={12} className="text-[var(--text-secondary)]" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-[var(--foreground)]">
                              {c.message}
                            </p>
                            <div className="mt-1 flex items-center gap-3 text-[11px] text-[var(--text-muted)]">
                              <span className="flex items-center gap-1">
                                <User size={10} /> {c.author}
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock size={10} /> {relativeTime(c.date)}
                              </span>
                              {c.filesChanged > 0 && (
                                <span>{c.filesChanged} files</span>
                              )}
                            </div>
                          </div>
                          <code className="mt-1 rounded bg-[var(--surface-soft)] px-2 py-0.5 text-[11px] font-medium text-[var(--text-secondary)]">
                            {c.shortHash}
                          </code>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === "prs" && (
                <div className="p-4">
                  {/* PR Detail View */}
                  {selectedPr ? (
                    <div>
                      <button
                        onClick={() => setSelectedPr(null)}
                        className="mb-4 flex items-center gap-1 text-xs text-[var(--text-secondary)] hover:text-[var(--foreground)]"
                      >
                        ← Back to list
                      </button>
                      <Card>
                        <CardContent className="p-5">
                          <div className="flex items-start justify-between">
                            <div>
                              <h3 className="text-base font-semibold text-[var(--foreground)]">
                                #{selectedPr.number} {selectedPr.title}
                              </h3>
                              <div className="mt-2 flex items-center gap-3 text-xs text-[var(--text-secondary)]">
                                <span className="flex items-center gap-1">
                                  <User size={11} /> {selectedPr.author}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Clock size={11} /> {relativeTime(selectedPr.createdAt)}
                                </span>
                                <span className="flex items-center gap-1">
                                  <GitBranch size={11} /> {selectedPr.head.ref} → {selectedPr.base.ref}
                                </span>
                              </div>
                            </div>
                            <Badge
                              variant={
                                selectedPr.merged
                                  ? "default"
                                  : selectedPr.state === "open"
                                  ? "success"
                                  : "destructive"
                              }
                              className={selectedPr.merged ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" : ""}
                            >
                              {selectedPr.merged ? "Merged" : selectedPr.state}
                            </Badge>
                          </div>

                          {selectedPr.body && (
                            <p className="mt-4 whitespace-pre-wrap text-sm text-[var(--text-secondary)]">
                              {selectedPr.body}
                            </p>
                          )}

                          <div className="mt-4 flex items-center gap-4 text-xs text-[var(--text-secondary)]">
                            <span className="text-green-600 dark:text-green-400">+{selectedPr.additions}</span>
                            <span className="text-red-600 dark:text-red-400">-{selectedPr.deletions}</span>
                            <span>{selectedPr.changedFiles} files</span>
                            <span className="flex items-center gap-1">
                              <MessageSquare size={11} /> {selectedPr.comments}
                            </span>
                          </div>

                          <div className="mt-5 flex items-center gap-3">
                            {selectedPr.state === "open" && !selectedPr.merged && (
                              <Button
                                onClick={() => void handleMergePR(selectedPr.number)}
                                disabled={merging}
                                className="bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600"
                              >
                                {merging ? (
                                  <Loader2 size={13} className="animate-spin" />
                                ) : (
                                  <GitMerge size={13} />
                                )}
                                Merge Pull Request
                              </Button>
                            )}
                            <Button asChild variant="outline" size="sm">
                              <a
                                href={selectedPr.htmlUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <ExternalLink size={12} />
                                View on GitHub
                              </a>
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  ) : (
                    <>
                      {/* Create PR form */}
                      {showCreatePr && (
                        <Card className="mb-6 bg-[var(--surface-soft)]">
                          <CardContent className="p-4">
                            <h3 className="mb-3 text-sm font-semibold text-[var(--foreground)]">
                              Create Pull Request
                            </h3>
                            <div className="space-y-3">
                              <Input
                                type="text"
                                value={prTitle}
                                onChange={(e) => setPrTitle(e.target.value)}
                                placeholder="PR title..."
                              />
                              <textarea
                                value={prBody}
                                onChange={(e) => setPrBody(e.target.value)}
                                placeholder="Description (optional)..."
                                className="w-full resize-none rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--text-muted)] focus:border-[var(--border-focus,var(--accent))] focus:outline-none"
                                rows={3}
                              />
                              <div className="flex items-center gap-3">
                                <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                                  <GitBranch size={12} />
                                  <span className="font-medium">{currentBranch}</span>
                                  <span>→</span>
                                  <Input
                                    type="text"
                                    value={prBase}
                                    onChange={(e) => setPrBase(e.target.value)}
                                    className="w-24 text-xs"
                                  />
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Button
                                  onClick={() => void handleCreatePR()}
                                  disabled={prCreating || !prTitle.trim()}
                                  className="bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600"
                                  size="sm"
                                >
                                  {prCreating ? (
                                    <Loader2 size={13} className="animate-spin" />
                                  ) : (
                                    <GitPullRequest size={13} />
                                  )}
                                  Create PR
                                </Button>
                                <Button
                                  onClick={() => setShowCreatePr(false)}
                                  variant="outline"
                                  size="sm"
                                >
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      )}

                      {/* Header */}
                      <div className="mb-4 flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-[var(--foreground)]">
                          Open Pull Requests
                        </h3>
                        <Button
                          onClick={() => setShowCreatePr(true)}
                          disabled={!currentBranch || currentBranch === "main"}
                          size="sm"
                          title={
                            currentBranch === "main"
                              ? "Switch to a feature branch to create a PR"
                              : "Create pull request"
                          }
                        >
                          <Plus size={12} />
                          New PR
                        </Button>
                      </div>

                      {/* Loading */}
                      {prsLoading && (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 size={18} className="animate-spin text-[var(--text-muted)]" />
                        </div>
                      )}

                      {/* Error */}
                      {prsError && !prsLoading && (
                        <Card className="border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-900/20">
                          <CardContent className="px-4 py-3 text-xs text-amber-700 dark:text-amber-300">
                            <p className="font-medium">Could not load pull requests</p>
                            <p className="mt-1 text-amber-600 dark:text-amber-400">{prsError}</p>
                          </CardContent>
                        </Card>
                      )}

                      {/* PR List */}
                      {!prsLoading && !prsError && pullRequests.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                          <GitPullRequest size={32} className="mb-3 text-[var(--text-muted)]" />
                          <p className="text-sm font-medium text-[var(--foreground)]">
                            No open pull requests
                          </p>
                          <p className="mt-1 max-w-xs text-xs text-[var(--text-muted)]">
                            Create a pull request from a feature branch to propose changes.
                          </p>
                        </div>
                      )}

                      {!prsLoading && pullRequests.length > 0 && (
                        <div className="space-y-2">
                          {pullRequests.map((pr) => (
                            <Card
                              key={pr.number}
                              className="cursor-pointer transition-colors hover:bg-[var(--surface-soft)]"
                              onClick={() => setSelectedPr(pr)}
                            >
                              <CardContent className="flex items-start gap-3 px-4 py-3">
                                <GitPullRequest
                                  size={16}
                                  className={
                                    pr.merged
                                      ? "mt-0.5 text-purple-500 dark:text-purple-400"
                                      : pr.state === "open"
                                      ? "mt-0.5 text-green-500 dark:text-green-400"
                                      : "mt-0.5 text-red-500 dark:text-red-400"
                                  }
                                />
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-sm font-medium text-[var(--foreground)]">
                                    {pr.title}
                                  </p>
                                  <div className="mt-1 flex items-center gap-3 text-[11px] text-[var(--text-muted)]">
                                    <span>#{pr.number}</span>
                                    <span className="flex items-center gap-1">
                                      <User size={10} /> {pr.author}
                                    </span>
                                    <span className="flex items-center gap-1">
                                      <Clock size={10} /> {relativeTime(pr.createdAt)}
                                    </span>
                                    {pr.draft && (
                                      <Badge variant="outline" className="text-[10px]">
                                        Draft
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 text-[11px] text-[var(--text-muted)]">
                                  <span className="text-green-600 dark:text-green-400">+{pr.additions}</span>
                                  <span className="text-red-600 dark:text-red-400">-{pr.deletions}</span>
                                  {pr.comments > 0 && (
                                    <span className="flex items-center gap-0.5">
                                      <MessageSquare size={10} /> {pr.comments}
                                    </span>
                                  )}
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Diff panel */}
            {(activeTab === "changes") && diffPath && (
              <div className="hidden w-1/2 flex-col border-l border-[var(--border)] md:flex">
                <div className="flex h-9 items-center justify-between border-b border-[var(--border)] px-3">
                  <span className="truncate text-[12px] font-medium text-[var(--text-secondary)]">
                    {diffPath}
                    {diffStaged && (
                      <Badge variant="success" className="ml-2 text-[10px]">
                        staged
                      </Badge>
                    )}
                  </span>
                  <button
                    onClick={() => {
                      setDiffPath(null);
                      setDiffText(null);
                    }}
                    className="rounded p-1 text-[var(--text-muted)] hover:bg-[var(--surface-soft)] hover:text-[var(--text-secondary)]"
                  >
                    <X size={12} />
                  </button>
                </div>
                <div className="flex-1 overflow-auto bg-[var(--surface-soft)] p-3 font-mono text-[12px] leading-relaxed">
                  {diffLoading ? (
                    <div className="flex items-center gap-2 text-[var(--text-muted)]">
                      <Loader2 size={14} className="animate-spin" />
                      Loading diff...
                    </div>
                  ) : diffText ? (
                    <pre className="whitespace-pre-wrap break-all">
                      {diffText.split("\n").map((line, i) => {
                        let cls = "text-[var(--text-secondary)]";
                        if (line.startsWith("+") && !line.startsWith("+++"))
                          cls = "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400";
                        else if (line.startsWith("-") && !line.startsWith("---"))
                          cls = "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400";
                        else if (line.startsWith("@@")) cls = "text-blue-500 dark:text-blue-400";
                        else if (
                          line.startsWith("diff ") ||
                          line.startsWith("index ") ||
                          line.startsWith("+++") ||
                          line.startsWith("---")
                        )
                          cls = "text-[var(--text-muted)]";
                        return (
                          <div key={i} className={cls}>
                            {line || " "}
                          </div>
                        );
                      })}
                    </pre>
                  ) : (
                    <p className="text-[var(--text-muted)]">
                      No diff available (binary or untracked file).
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
