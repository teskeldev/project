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
  pull as apiPull,
  type GitStatus,
  type GitFileStatus,
  type GitBranchInfo,
  type GitLogEntry,
} from "@/lib/client/git";

type GitTab = "changes" | "branches" | "commits" | "prs";

/** Human-friendly single-letter status + colour for a changed file. */
function statusBadge(f: GitFileStatus, staged: boolean): {
  letter: string;
  className: string;
} {
  const code = (staged ? f.index : f.working) || f.index || f.working;
  switch (code) {
    case "A":
      return { letter: "A", className: "text-green-600" };
    case "M":
      return { letter: "M", className: "text-amber-600" };
    case "D":
      return { letter: "D", className: "text-red-600" };
    case "R":
      return { letter: "R", className: "text-blue-600" };
    case "?":
      return { letter: "U", className: "text-green-600" };
    default:
      return { letter: code || "?", className: "text-gray-500" };
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

  // Selected file diff.
  const [diffPath, setDiffPath] = useState<string | null>(null);
  const [diffStaged, setDiffStaged] = useState(false);
  const [diffText, setDiffText] = useState<string | null>(null);
  const [diffLoading, setDiffLoading] = useState(false);

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

  useEffect(() => {
    setIsRepo(null);
    setStatus(null);
    setDiffPath(null);
    setDiffText(null);
    void refreshAll();
  }, [refreshAll]);

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
      <div className="flex h-full flex-col items-center justify-center bg-white text-center">
        <FolderGit2 size={32} className="mb-3 text-gray-300" />
        <p className="text-sm font-medium text-gray-700">No project selected</p>
        <p className="mt-1 text-xs text-gray-400">
          Choose a project to manage source control.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-white">
      {/* Top bar */}
      <div className="flex h-11 items-center justify-between border-b border-gray-200 px-4">
        <div className="flex items-center gap-3">
          <GitBranch size={16} className="text-blue-500" />
          <span className="text-sm font-medium text-gray-900">
            Source Control
          </span>
          {isRepo && (
            <div className="flex items-center gap-1 rounded-lg border border-gray-200 px-2 py-1">
              <GitBranch size={12} className="text-gray-500" />
              <span className="text-xs font-medium text-gray-700">
                {currentBranch ?? "(detached)"}
              </span>
              <ChevronDown size={12} className="text-gray-400" />
            </div>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => void refreshAll()}
            disabled={loading || busy}
            className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw
              size={14}
              className={loading ? "animate-spin" : undefined}
            />
          </button>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="flex items-center gap-2 border-b border-red-100 bg-red-50 px-4 py-2 text-xs text-red-700">
          <AlertCircle size={13} />
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">
            <X size={12} />
          </button>
        </div>
      )}
      {actionMsg && !error && (
        <div className="flex items-center gap-2 border-b border-blue-100 bg-blue-50 px-4 py-2 text-xs text-blue-700">
          <Check size={13} />
          <span className="flex-1">{actionMsg}</span>
          <button onClick={() => setActionMsg(null)} className="text-blue-400 hover:text-blue-600">
            <X size={12} />
          </button>
        </div>
      )}

      {/* Not-a-repo CTA */}
      {isRepo === false && (
        <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
          <FolderGit2 size={36} className="mb-4 text-gray-300" />
          <p className="text-sm font-medium text-gray-800">
            No git repository
          </p>
          <p className="mt-1 max-w-xs text-xs text-gray-400">
            This project isn&apos;t under version control yet. Initialise a git
            repository to start tracking changes.
          </p>
          <button
            onClick={() => void handleInit()}
            disabled={busy}
            className="mt-4 flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-xs font-medium text-white hover:bg-gray-800 disabled:opacity-50"
          >
            {busy ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <FolderGit2 size={14} />
            )}
            Initialize Git repository
          </button>
        </div>
      )}

      {/* Loading (initial) */}
      {isRepo === null && loading && (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 size={20} className="animate-spin text-gray-300" />
        </div>
      )}

      {/* Repo content */}
      {isRepo === true && (
        <>
          {/* Tabs */}
          <div className="flex border-b border-gray-200 px-4">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-xs font-medium transition-colors ${
                  activeTab === tab.id
                    ? "border-blue-500 text-gray-900"
                    : "border-transparent text-gray-500 hover:text-gray-700"
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
                      className="w-full resize-none rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-gray-300 focus:outline-none"
                      rows={2}
                    />
                    <div className="mt-2 flex items-center gap-2">
                      <button
                        onClick={() => void handleCommit()}
                        disabled={busy || stagedCount === 0 || !commitMessage.trim()}
                        className="flex-1 rounded-lg bg-gray-900 py-2 text-xs font-medium text-white hover:bg-gray-800 disabled:opacity-50"
                      >
                        <Check size={12} className="mr-1.5 inline" />
                        Commit ({stagedCount} staged)
                      </button>
                      <button
                        onClick={() => void handlePush()}
                        disabled={busy}
                        className="rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                      >
                        <ArrowUp size={12} className="mr-1 inline" />
                        Push
                      </button>
                      <button
                        onClick={() => void handlePull()}
                        disabled={busy}
                        className="rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                      >
                        <ArrowDown size={12} className="mr-1 inline" />
                        Pull
                      </button>
                    </div>
                    {(status?.ahead || status?.behind) && (
                      <div className="mt-2 flex items-center gap-3 text-[11px] text-gray-400">
                        {status.ahead > 0 && (
                          <span className="flex items-center gap-0.5 text-green-600">
                            <ArrowUp size={10} />
                            {status.ahead} ahead
                          </span>
                        )}
                        {status.behind > 0 && (
                          <span className="flex items-center gap-0.5 text-amber-600">
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
                      <ChevronDown size={14} className="text-gray-400" />
                      <span className="text-xs font-semibold text-gray-700">
                        Staged Changes
                      </span>
                      <span className="rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-medium text-green-700">
                        {stagedCount}
                      </span>
                    </div>
                    {stagedCount === 0 && (
                      <p className="px-3 py-1 text-[12px] text-gray-400">
                        Nothing staged.
                      </p>
                    )}
                    {status?.staged.map((f) => {
                      const badge = statusBadge(f, true);
                      return (
                        <div
                          key={`s-${f.path}`}
                          className={`group flex items-center gap-2 rounded-lg px-3 py-1.5 hover:bg-gray-50 ${
                            diffPath === f.path && diffStaged ? "bg-gray-100" : ""
                          }`}
                        >
                          <span className={`text-[10px] font-bold ${badge.className}`}>
                            {badge.letter}
                          </span>
                          <button
                            onClick={() => void openDiff(f.path, true)}
                            className="flex-1 truncate text-left text-[13px] text-gray-700 hover:text-gray-900"
                            title={f.path}
                          >
                            {f.path}
                          </button>
                          <button
                            onClick={() => void handleUnstage(f.path)}
                            disabled={busy}
                            className="rounded p-1 text-gray-400 opacity-0 hover:bg-gray-200 group-hover:opacity-100 disabled:opacity-50"
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
                      <ChevronDown size={14} className="text-gray-400" />
                      <span className="text-xs font-semibold text-gray-700">
                        Changes
                      </span>
                      <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500">
                        {unstagedAll.length}
                      </span>
                      {unstagedAll.length > 0 && (
                        <button
                          onClick={() => void handleStageAll()}
                          disabled={busy}
                          className="ml-auto rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-600 disabled:opacity-50"
                          title="Stage all"
                        >
                          <Plus size={13} />
                        </button>
                      )}
                    </div>
                    {unstagedAll.length === 0 && (
                      <p className="px-3 py-1 text-[12px] text-gray-400">
                        No changes.
                      </p>
                    )}
                    {unstagedAll.map((f) => {
                      const badge = statusBadge(f, false);
                      return (
                        <div
                          key={`u-${f.path}`}
                          className={`group flex items-center gap-2 rounded-lg px-3 py-1.5 hover:bg-gray-50 ${
                            diffPath === f.path && !diffStaged ? "bg-gray-100" : ""
                          }`}
                        >
                          <span className={`text-[10px] font-bold ${badge.className}`}>
                            {badge.letter}
                          </span>
                          <button
                            onClick={() => void openDiff(f.path, false)}
                            className="flex-1 truncate text-left text-[13px] text-gray-700 hover:text-gray-900"
                            title={f.path}
                          >
                            {f.path}
                          </button>
                          <button
                            onClick={() => void handleStage(f.path)}
                            disabled={busy}
                            className="rounded p-1 text-gray-400 opacity-0 hover:bg-gray-200 group-hover:opacity-100 disabled:opacity-50"
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
                  <div className="mb-4 flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2">
                    <Search size={14} className="text-gray-400" />
                    <input
                      type="text"
                      value={branchFilter}
                      onChange={(e) => setBranchFilter(e.target.value)}
                      placeholder="Filter branches..."
                      className="flex-1 bg-transparent text-sm placeholder:text-gray-400 focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    {filteredBranches.map((b) => (
                      <div
                        key={b.name}
                        className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 ${
                          b.current ? "bg-blue-50" : "hover:bg-gray-50"
                        }`}
                      >
                        <GitBranch
                          size={14}
                          className={b.current ? "text-blue-500" : "text-gray-400"}
                        />
                        <span
                          className={`flex-1 truncate text-sm ${
                            b.current ? "font-medium text-gray-900" : "text-gray-700"
                          }`}
                        >
                          {b.name}
                        </span>
                        {b.current ? (
                          <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-600">
                            current
                          </span>
                        ) : (
                          <button
                            onClick={() => void handleCheckout(b.name)}
                            disabled={busy}
                            className="rounded border border-gray-200 px-2 py-0.5 text-[10px] text-gray-600 opacity-0 hover:bg-gray-50 group-hover:opacity-100 disabled:opacity-50"
                          >
                            Checkout
                          </button>
                        )}
                      </div>
                    ))}
                    {filteredBranches.length === 0 && (
                      <p className="px-3 py-2 text-[12px] text-gray-400">
                        No branches match.
                      </p>
                    )}
                  </div>

                  {creatingBranch ? (
                    <div className="mt-4 flex items-center gap-2">
                      <input
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
                        className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-xs focus:border-gray-300 focus:outline-none"
                      />
                      <button
                        onClick={() => void handleCreateBranch()}
                        disabled={busy || !newBranchName.trim()}
                        className="rounded-lg bg-gray-900 px-3 py-2 text-xs font-medium text-white hover:bg-gray-800 disabled:opacity-50"
                      >
                        Create
                      </button>
                      <button
                        onClick={() => {
                          setCreatingBranch(false);
                          setNewBranchName("");
                        }}
                        className="rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-600 hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setCreatingBranch(true)}
                      className="mt-4 flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-xs text-gray-600 hover:bg-gray-50"
                    >
                      <Plus size={14} />
                      Create branch
                    </button>
                  )}
                </div>
              )}

              {activeTab === "commits" && (
                <div className="p-4">
                  {commits.length === 0 ? (
                    <p className="px-3 py-2 text-[12px] text-gray-400">
                      No commits yet.
                    </p>
                  ) : (
                    <div className="space-y-1">
                      {commits.map((c) => (
                        <div
                          key={c.hash}
                          className="flex items-start gap-3 rounded-lg px-3 py-3 hover:bg-gray-50"
                        >
                          <div className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-100">
                            <GitCommit size={12} className="text-gray-500" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-gray-900">
                              {c.message}
                            </p>
                            <div className="mt-1 flex items-center gap-3 text-[11px] text-gray-400">
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
                          <code className="mt-1 rounded bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-500">
                            {c.shortHash}
                          </code>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === "prs" && (
                <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
                  {/* TODO(phase-future): real PR integration once a remote /
                      GitHub connection is configured in Integrations. We do NOT
                      fabricate PR data here. */}
                  <GitPullRequest size={32} className="mb-3 text-gray-300" />
                  <p className="text-sm font-medium text-gray-700">
                    No pull requests
                  </p>
                  <p className="mt-1 max-w-xs text-xs text-gray-400">
                    Connect a remote/GitHub in Integrations to manage pull
                    requests from here.
                  </p>
                </div>
              )}
            </div>

            {/* Diff panel */}
            {(activeTab === "changes") && diffPath && (
              <div className="hidden w-1/2 flex-col border-l border-gray-200 md:flex">
                <div className="flex h-9 items-center justify-between border-b border-gray-200 px-3">
                  <span className="truncate text-[12px] font-medium text-gray-600">
                    {diffPath}
                    {diffStaged && (
                      <span className="ml-2 rounded bg-green-100 px-1.5 py-0.5 text-[10px] text-green-700">
                        staged
                      </span>
                    )}
                  </span>
                  <button
                    onClick={() => {
                      setDiffPath(null);
                      setDiffText(null);
                    }}
                    className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                  >
                    <X size={12} />
                  </button>
                </div>
                <div className="flex-1 overflow-auto bg-gray-50 p-3 font-mono text-[12px] leading-relaxed">
                  {diffLoading ? (
                    <div className="flex items-center gap-2 text-gray-400">
                      <Loader2 size={14} className="animate-spin" />
                      Loading diff...
                    </div>
                  ) : diffText ? (
                    <pre className="whitespace-pre-wrap break-all">
                      {diffText.split("\n").map((line, i) => {
                        let cls = "text-gray-600";
                        if (line.startsWith("+") && !line.startsWith("+++"))
                          cls = "bg-green-50 text-green-700";
                        else if (line.startsWith("-") && !line.startsWith("---"))
                          cls = "bg-red-50 text-red-700";
                        else if (line.startsWith("@@")) cls = "text-blue-500";
                        else if (
                          line.startsWith("diff ") ||
                          line.startsWith("index ") ||
                          line.startsWith("+++") ||
                          line.startsWith("---")
                        )
                          cls = "text-gray-400";
                        return (
                          <div key={i} className={cls}>
                            {line || " "}
                          </div>
                        );
                      })}
                    </pre>
                  ) : (
                    <p className="text-gray-400">
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
