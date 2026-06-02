"use client";

import { useState } from "react";
import {
  GitBranch,
  GitCommit,
  GitPullRequest,
  GitMerge,
  ChevronDown,

  Plus,
  RefreshCw,
  Check,
  X,
  File,
  MoreHorizontal,
  ArrowUp,
  ArrowDown,
  Search,
  Clock,
  User,
} from "lucide-react";

type GitTab = "changes" | "branches" | "commits" | "prs";

interface ChangedFile {
  name: string;
  path: string;
  status: "modified" | "added" | "deleted" | "renamed";
  staged: boolean;
}

const changedFiles: ChangedFile[] = [
  { name: "jwt.ts", path: "src/lib/auth/jwt.ts", status: "added", staged: true },
  { name: "password.ts", path: "src/lib/auth/password.ts", status: "added", staged: true },
  { name: "route.ts", path: "src/app/api/auth/login/route.ts", status: "added", staged: true },
  { name: "route.ts", path: "src/app/api/auth/signup/route.ts", status: "added", staged: false },
  { name: "middleware.ts", path: "src/middleware.ts", status: "added", staged: false },
  { name: "package.json", path: "package.json", status: "modified", staged: false },
  { name: "rate-limit.ts", path: "src/lib/rate-limit.ts", status: "added", staged: false },
];

const branches = [
  { name: "main", current: false, behind: 0, ahead: 0 },
  { name: "feature/auth-system", current: true, behind: 0, ahead: 5 },
  { name: "feature/dashboard-ui", current: false, behind: 2, ahead: 0 },
  { name: "fix/login-redirect", current: false, behind: 3, ahead: 1 },
  { name: "dev", current: false, behind: 1, ahead: 8 },
];

const commits = [
  {
    hash: "a3f2c1d",
    message: "feat: add rate limiting to auth endpoints",
    author: "Teskel Dev",
    time: "2 minutes ago",
    files: 3,
  },
  {
    hash: "8b4e7f2",
    message: "feat: implement JWT auth with login/signup",
    author: "Teskel Dev",
    time: "15 minutes ago",
    files: 5,
  },
  {
    hash: "5d1a9c3",
    message: "feat: add middleware for protected routes",
    author: "Teskel Dev",
    time: "22 minutes ago",
    files: 2,
  },
  {
    hash: "2e6f8b1",
    message: "refactor: rebuild workspace to cursor style",
    author: "Teskel Dev",
    time: "1 hour ago",
    files: 4,
  },
  {
    hash: "f44827b",
    message: "feat: final build — 17 pages ready",
    author: "Teskel Dev",
    time: "2 hours ago",
    files: 7,
  },
  {
    hash: "6679eac",
    message: "feat: switch dashboard to light theme",
    author: "Teskel Dev",
    time: "3 hours ago",
    files: 4,
  },
  {
    hash: "b2d4f1a",
    message: "feat: add full app (auth, dashboard, marketing)",
    author: "Teskel Dev",
    time: "5 hours ago",
    files: 14,
  },
];

const pullRequests = [
  {
    number: 6,
    title: "feat: add auth system with JWT & rate limiting",
    author: "teskel-dev",
    status: "open",
    reviewers: 2,
    comments: 3,
    branch: "feature/auth-system",
  },
  {
    number: 5,
    title: "feat: final build — startup-grade workspace",
    author: "teskel-dev",
    status: "merged",
    reviewers: 1,
    comments: 0,
    branch: "devin/final-build",
  },
  {
    number: 4,
    title: "feat: rebuild workspace to match cursor.com",
    author: "teskel-dev",
    status: "merged",
    reviewers: 1,
    comments: 1,
    branch: "devin/cursor-workspace",
  },
];

export default function GitPage() {
  const [activeTab, setActiveTab] = useState<GitTab>("changes");
  const [commitMessage, setCommitMessage] = useState("");
  const [stagedFiles, setStagedFiles] = useState<Set<string>>(
    new Set(changedFiles.filter((f) => f.staged).map((f) => f.path))
  );

  const toggleStage = (path: string) => {
    const next = new Set(stagedFiles);
    if (next.has(path)) next.delete(path);
    else next.add(path);
    setStagedFiles(next);
  };

  const tabs: { id: GitTab; label: string; icon: React.ElementType }[] = [
    { id: "changes", label: "Changes", icon: File },
    { id: "branches", label: "Branches", icon: GitBranch },
    { id: "commits", label: "History", icon: GitCommit },
    { id: "prs", label: "Pull Requests", icon: GitPullRequest },
  ];

  return (
    <div className="flex h-full flex-col bg-white">
      {/* Top bar */}
      <div className="flex h-11 items-center justify-between border-b border-gray-200 px-4">
        <div className="flex items-center gap-3">
          <GitBranch size={16} className="text-rose-500" />
          <span className="text-sm font-medium text-gray-900">
            Source Control
          </span>
          <div className="flex items-center gap-1 rounded-lg border border-gray-200 px-2 py-1">
            <GitBranch size={12} className="text-gray-500" />
            <span className="text-xs font-medium text-gray-700">
              feature/auth-system
            </span>
            <ChevronDown size={12} className="text-gray-400" />
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
            <RefreshCw size={14} />
          </button>
          <button className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
            <MoreHorizontal size={14} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 px-4">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-xs font-medium transition-colors ${
              activeTab === tab.id
                ? "border-rose-500 text-gray-900"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            <tab.icon size={14} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
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
                <button className="flex-1 rounded-lg bg-rose-600 py-2 text-xs font-medium text-white hover:bg-rose-700">
                  <Check size={12} className="mr-1.5 inline" />
                  Commit ({stagedFiles.size} staged)
                </button>
                <button className="rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-600 hover:bg-gray-50">
                  <ArrowUp size={12} className="mr-1 inline" />
                  Push
                </button>
                <button className="rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-600 hover:bg-gray-50">
                  <ArrowDown size={12} className="mr-1 inline" />
                  Pull
                </button>
              </div>
            </div>

            {/* Staged */}
            <div className="mb-4">
              <div className="mb-2 flex items-center gap-2">
                <ChevronDown size={14} className="text-gray-400" />
                <span className="text-xs font-semibold text-gray-700">
                  Staged Changes
                </span>
                <span className="rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-medium text-green-700">
                  {stagedFiles.size}
                </span>
              </div>
              {changedFiles
                .filter((f) => stagedFiles.has(f.path))
                .map((f) => (
                  <div
                    key={f.path}
                    className="group flex items-center gap-2 rounded-lg px-3 py-1.5 hover:bg-gray-50"
                  >
                    <span
                      className={`text-[10px] font-bold ${
                        f.status === "added"
                          ? "text-green-600"
                          : f.status === "modified"
                            ? "text-amber-600"
                            : "text-red-600"
                      }`}
                    >
                      {f.status[0].toUpperCase()}
                    </span>
                    <span className="flex-1 text-[13px] text-gray-700">
                      {f.path}
                    </span>
                    <button
                      onClick={() => toggleStage(f.path)}
                      className="rounded p-1 text-gray-400 opacity-0 hover:bg-gray-200 group-hover:opacity-100"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
            </div>

            {/* Unstaged */}
            <div>
              <div className="mb-2 flex items-center gap-2">
                <ChevronDown size={14} className="text-gray-400" />
                <span className="text-xs font-semibold text-gray-700">
                  Changes
                </span>
                <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500">
                  {changedFiles.length - stagedFiles.size}
                </span>
              </div>
              {changedFiles
                .filter((f) => !stagedFiles.has(f.path))
                .map((f) => (
                  <div
                    key={f.path}
                    className="group flex items-center gap-2 rounded-lg px-3 py-1.5 hover:bg-gray-50"
                  >
                    <span
                      className={`text-[10px] font-bold ${
                        f.status === "added"
                          ? "text-green-600"
                          : f.status === "modified"
                            ? "text-amber-600"
                            : "text-red-600"
                      }`}
                    >
                      {f.status[0].toUpperCase()}
                    </span>
                    <span className="flex-1 text-[13px] text-gray-700">
                      {f.path}
                    </span>
                    <button
                      onClick={() => toggleStage(f.path)}
                      className="rounded p-1 text-gray-400 opacity-0 hover:bg-gray-200 group-hover:opacity-100"
                      title="Stage file"
                    >
                      <Plus size={12} />
                    </button>
                  </div>
                ))}
            </div>
          </div>
        )}

        {activeTab === "branches" && (
          <div className="p-4">
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2">
              <Search size={14} className="text-gray-400" />
              <input
                type="text"
                placeholder="Filter branches..."
                className="flex-1 bg-transparent text-sm placeholder:text-gray-400 focus:outline-none"
              />
            </div>
            <div className="space-y-1">
              {branches.map((b) => (
                <div
                  key={b.name}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 ${
                    b.current ? "bg-rose-50" : "hover:bg-gray-50"
                  }`}
                >
                  <GitBranch
                    size={14}
                    className={b.current ? "text-rose-500" : "text-gray-400"}
                  />
                  <span
                    className={`flex-1 text-sm ${b.current ? "font-medium text-gray-900" : "text-gray-700"}`}
                  >
                    {b.name}
                  </span>
                  {b.current && (
                    <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-medium text-rose-600">
                      current
                    </span>
                  )}
                  {b.ahead > 0 && (
                    <span className="flex items-center gap-0.5 text-[11px] text-green-600">
                      <ArrowUp size={10} />
                      {b.ahead}
                    </span>
                  )}
                  {b.behind > 0 && (
                    <span className="flex items-center gap-0.5 text-[11px] text-amber-600">
                      <ArrowDown size={10} />
                      {b.behind}
                    </span>
                  )}
                </div>
              ))}
            </div>
            <button className="mt-4 flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-xs text-gray-600 hover:bg-gray-50">
              <Plus size={14} />
              Create branch
            </button>
          </div>
        )}

        {activeTab === "commits" && (
          <div className="p-4">
            <div className="space-y-1">
              {commits.map((c) => (
                <div
                  key={c.hash}
                  className="flex items-start gap-3 rounded-lg px-3 py-3 hover:bg-gray-50"
                >
                  <div className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-100">
                    <GitCommit size={12} className="text-gray-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">
                      {c.message}
                    </p>
                    <div className="mt-1 flex items-center gap-3 text-[11px] text-gray-400">
                      <span className="flex items-center gap-1">
                        <User size={10} /> {c.author}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock size={10} /> {c.time}
                      </span>
                      <span>{c.files} files</span>
                    </div>
                  </div>
                  <code className="mt-1 rounded bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-500">
                    {c.hash}
                  </code>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "prs" && (
          <div className="p-4">
            <div className="space-y-2">
              {pullRequests.map((pr) => (
                <div
                  key={pr.number}
                  className="rounded-xl border border-gray-200 p-4 hover:border-gray-300"
                >
                  <div className="flex items-start gap-3">
                    {pr.status === "open" ? (
                      <GitPullRequest
                        size={16}
                        className="mt-0.5 text-green-500"
                      />
                    ) : (
                      <GitMerge
                        size={16}
                        className="mt-0.5 text-purple-500"
                      />
                    )}
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">
                        {pr.title}
                      </p>
                      <div className="mt-1 flex items-center gap-3 text-[11px] text-gray-400">
                        <span>#{pr.number}</span>
                        <span>by {pr.author}</span>
                        <span className="flex items-center gap-1">
                          <GitBranch size={10} /> {pr.branch}
                        </span>
                      </div>
                    </div>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        pr.status === "open"
                          ? "bg-green-100 text-green-700"
                          : "bg-purple-100 text-purple-700"
                      }`}
                    >
                      {pr.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <button className="mt-4 flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-xs font-medium text-white hover:bg-rose-700">
              <Plus size={14} />
              New Pull Request
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
