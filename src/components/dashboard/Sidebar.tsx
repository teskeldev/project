"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { signOut } from "next-auth/react";
import { motion } from "framer-motion";
import { useProject } from "@/lib/store/project";
import {
  ApiClientError,
  listThreads,
  createThread,
  type ProjectTemplate,
  type ChatThread,
} from "@/lib/client/api";
import {
  Search,
  PenLine,
  FolderOpen,
  Settings,
  ChevronDown,
  ChevronRight,
  MessageSquare,
  Keyboard,
  Code,
  Terminal,
  GitBranch,
  Puzzle,
  Layers,
  Bot,
  Plug,
  Brain,
  Sliders,
  LogOut,
  Plus,
  Check,
  Loader2,
  X,
  BarChart3,
} from "lucide-react";

// Custom event name for opening the command palette.
// Listeners (e.g. the CommandPalette component) should subscribe to this event.
export const OPEN_COMMAND_PALETTE_EVENT = "app:open-command-palette";

/** Dispatch a custom event to open the command palette. */
function openCommandPalette() {
  window.dispatchEvent(new CustomEvent(OPEN_COMMAND_PALETTE_EVENT));
}

/** Compact relative time label for thread list items. */
function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diffMs = Date.now() - then;
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return "now";
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d`;
  const wk = Math.floor(day / 7);
  if (wk < 5) return `${wk}w`;
  return new Date(iso).toLocaleDateString();
}

const workspaceLinks = [
  { href: "/dashboard/editor", icon: Code, label: "Editor" },
  { href: "/dashboard/composer", icon: Layers, label: "Review" },
  { href: "/dashboard/terminal", icon: Terminal, label: "Terminal" },
  { href: "/dashboard/git", icon: GitBranch, label: "Git" },
  { href: "/dashboard/extensions", icon: Puzzle, label: "Extensions" },
];

const aiLinks = [
  { href: "/dashboard/agents", icon: Bot, label: "Agents" },
  { href: "/dashboard/fusion/library", icon: Sliders, label: "Fusion" },
];

const platformLinks = [
  { href: "/dashboard/context", icon: Brain, label: "Context" },
  { href: "/dashboard/integrations", icon: Plug, label: "Providers" },
  { href: "/dashboard/usage", icon: BarChart3, label: "Analytics" },
];

function SidebarLink({
  href,
  icon: Icon,
  label,
  isActive,
}: {
  href: string;
  icon: React.ElementType;
  label: string;
  isActive: boolean;
}) {
  return (
    <Link
      href={href}
      className={`group relative flex items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] font-medium transition-colors ${
        isActive
          ? "text-slate-900 dark:text-white"
          : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
      }`}
    >
      {isActive && (
        <motion.div
          layoutId="sidebar-active"
          className="absolute inset-0 rounded-xl bg-white shadow-[0_2px_8px_rgba(0,0,0,0.04),0_0_0_1px_rgba(0,0,0,0.02)] dark:bg-white/10 dark:shadow-none"
          initial={false}
          transition={{ type: "spring" as const, stiffness: 350, damping: 30 }}
        />
      )}
      <Icon size={16} className={`relative z-10 transition-colors ${isActive ? "text-stone-900 dark:text-white" : "group-hover:text-slate-700 dark:group-hover:text-slate-300"}`} />
      <span className="relative z-10">{label}</span>
    </Link>
  );
}

function NewProjectModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (name: string, template: ProjectTemplate) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [template, setTemplate] = useState<ProjectTemplate>("blank");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await onCreate(name.trim(), template);
      onClose();
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.message : "Failed to create project"
      );
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center animate-fade-in">
      <div
        className="absolute inset-0 bg-black/20 backdrop-blur-md"
        onClick={onClose}
      />
      <form
        onSubmit={submit}
        className="animate-scale-in relative w-full max-w-sm overflow-hidden rounded-2xl border border-border/80 bg-surface/95 shadow-2xl backdrop-blur-xl"
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold text-foreground">New project</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-text-muted hover:bg-surface-soft hover:text-text-secondary"
          >
            <X size={14} />
          </button>
        </div>
        <div className="space-y-4 p-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-text-secondary">
              Project name
            </label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="my-app"
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-text-secondary">
              Template
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(["blank", "node"] as ProjectTemplate[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTemplate(t)}
                  className={`rounded-lg border px-3 py-2 text-sm capitalize transition-colors ${
                    template === t
                      ? "border-accent bg-accent-light text-accent"
                      : "border-border text-text-secondary hover:bg-surface-soft"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-border px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-sm text-text-secondary hover:bg-surface-soft"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!name.trim() || submitting}
            className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
          >
            {submitting && <Loader2 size={14} className="animate-spin" />}
            Create
          </button>
        </div>
      </form>
    </div>
  );
}

/**
 * Inner sidebar component that uses useSearchParams().
 * Extracted so it can be wrapped in a Suspense boundary.
 */
function SidebarContent() {
  const pathname = usePathname();
  const [reposOpen, setReposOpen] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const [showNewProject, setShowNewProject] = useState(false);

  const {
    projects,
    activeWorkspace,
    activeProject,
    loading,
    error,
    setActiveProject,
    createNewProject,
    refresh,
  } = useProject();

  const router = useRouter();
  const searchParams = useSearchParams();
  const currentThreadId = searchParams.get("thread");
  const activeProjectId = activeProject?.id ?? null;

  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [threadsLoading, setThreadsLoading] = useState(false);
  const [creatingChat, setCreatingChat] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

  const fetchIdRef = useRef(0);

  const loadThreads = useCallback(async () => {
    if (!activeProjectId) {
      setThreads([]);
      return;
    }
    const currentFetchId = ++fetchIdRef.current;
    setThreadsLoading(true);
    try {
      const { threads: t } = await listThreads(activeProjectId);
      if (fetchIdRef.current === currentFetchId) {
        setThreads(t);
      }
    } catch {
      if (fetchIdRef.current === currentFetchId) {
        setThreads([]);
      }
    } finally {
      if (fetchIdRef.current === currentFetchId) {
        setThreadsLoading(false);
      }
    }
  }, [activeProjectId]);

  // Refresh threads whenever the active project changes.
  useEffect(() => {
    void loadThreads();
  }, [loadThreads]);

  // Auto-clear chat error after a few seconds
  useEffect(() => {
    if (!chatError) return;
    const timer = setTimeout(() => setChatError(null), 4000);
    return () => clearTimeout(timer);
  }, [chatError]);

  const handleNewChat = useCallback(async () => {
    if (!activeProjectId || creatingChat) return;
    setCreatingChat(true);
    setChatError(null);
    try {
      const { thread } = await createThread(activeProjectId);
      setThreads((prev) => [thread, ...prev]);
      router.push(`/dashboard/chat?thread=${thread.id}`);
    } catch (err) {
      const message =
        err instanceof ApiClientError
          ? err.message
          : "Failed to create chat. Please try again.";
      console.warn("[Sidebar] handleNewChat failed:", message);
      setChatError(message);
    } finally {
      setCreatingChat(false);
    }
  }, [activeProjectId, creatingChat, router]);

  const handleCreate = useCallback(async (name: string, template: ProjectTemplate) => {
    await createNewProject({ name, template });
  }, [createNewProject]);

  if (collapsed) {
    return (
      <aside className="animate-slide-in-left flex h-screen w-12 flex-col items-center border-r border-border/60 bg-surface/80 py-3 backdrop-blur-xl">
        <button
          onClick={() => setCollapsed(false)}
          className="mb-3 rounded-lg p-2 text-text-muted transition-all duration-200 hover:bg-surface-soft hover:text-text-secondary"
          title="Expand sidebar" aria-label="Expand sidebar"
        >
          <ChevronRight size={16} />
        </button>
        <Link href="/dashboard" className="mb-1 rounded-lg p-2 text-text-muted hover:bg-surface-soft hover:text-text-secondary" title="New Agent" aria-label="New Agent">
          <PenLine size={16} />
        </Link>
        <button onClick={openCommandPalette} className="mb-1 rounded-lg p-2 text-text-muted hover:bg-surface-soft hover:text-text-secondary" title="Search (Ctrl+K)" aria-label="Search">
          <Search size={16} />
        </button>
        {workspaceLinks.map((link) => (
          <Link key={link.href} href={link.href} className={`mb-1 rounded-lg p-2 ${pathname === link.href ? "bg-surface-soft text-foreground" : "text-text-muted hover:bg-surface-soft hover:text-text-secondary"}`} title={link.label} aria-label={link.label}>
            <link.icon size={16} />
          </Link>
        ))}
        <div className="my-1 h-px w-6 bg-surface-soft" />
        {aiLinks.map((link) => (
          <Link key={link.href} href={link.href} className={`mb-1 rounded-lg p-2 ${pathname?.startsWith(link.href.split("?")[0]) ? "bg-surface-soft text-foreground" : "text-text-muted hover:bg-surface-soft hover:text-text-secondary"}`} title={link.label} aria-label={link.label}>
            <link.icon size={16} />
          </Link>
        ))}
        <div className="my-1 h-px w-6 bg-surface-soft" />
        {platformLinks.map((link) => (
          <Link key={link.href} href={link.href} className={`mb-1 rounded-lg p-2 ${pathname === link.href ? "bg-surface-soft text-foreground" : "text-text-muted hover:bg-surface-soft hover:text-text-secondary"}`} title={link.label} aria-label={link.label}>
            <link.icon size={16} />
          </Link>
        ))}
        <div className="flex-1" />
        <Link href="/dashboard/settings" className="rounded-lg p-2 text-text-muted hover:bg-surface-soft hover:text-text-secondary" title="Settings" aria-label="Settings">
          <Settings size={16} />
        </Link>
        <button
          onClick={() => signOut({ callbackUrl: "/" })}
          className="mt-1 rounded-lg p-2 text-text-muted hover:bg-surface-soft hover:text-text-secondary"
          title="Sign out" aria-label="Sign out"
        >
          <LogOut size={16} />
        </button>
      </aside>
    );
  }

  return (
    <aside className="relative flex h-screen w-64 flex-col border-r border-border/50 bg-[#FCFBF9] dark:bg-[#121212]">
      {/* Top actions */}
      <div className="space-y-1 p-4">
        <button
          onClick={() => setCollapsed(true)}
          className="group mb-4 flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-white/5 dark:hover:text-slate-200"
        >
          <ChevronDown size={16} className="-rotate-90 transition-transform group-hover:-translate-x-0.5" />
          <span>Collapse Sidebar</span>
        </button>

        <button onClick={openCommandPalette} className="group flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13px] font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-white/5 dark:hover:text-slate-200">
          <Search size={16} className="transition-colors group-hover:text-slate-700 dark:group-hover:text-slate-300" />
          <span>Search</span>
          <kbd className="ml-auto rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-slate-400 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            Ctrl+K
          </kbd>
        </button>

        <SidebarLink href="/dashboard" icon={PenLine} label="New Agent" isActive={pathname === "/dashboard"} />
        <SidebarLink href="/dashboard/chat" icon={MessageSquare} label="Chat" isActive={pathname === "/dashboard/chat"} />
      </div>

      {/* Project-provider error banner so empty dashboard state is not silent */}
      {error && !loading && (
        <div className="mx-3 mb-2 rounded-lg border border-red-200 bg-red-50 p-2 text-[11px] text-red-700">
          <p className="font-medium">Failed to load workspaces</p>
          <p className="mt-0.5 line-clamp-2 opacity-80">{error}</p>
          <button
            onClick={() => void refresh()}
            className="mt-1.5 text-[11px] font-medium underline hover:no-underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* Scrollable nav area — wraps all sections so they never overflow */}
      <div className="flex-1 overflow-y-auto">

      {/* Develop */}
      <div className="border-t border-border/50 px-3 py-3">
        <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
          Develop
        </p>
        <div className="space-y-0.5">
          {workspaceLinks.map((link) => (
            <SidebarLink key={link.href} href={link.href} icon={link.icon} label={link.label} isActive={pathname === link.href} />
          ))}
        </div>
      </div>

      {/* AI Studio */}
      <div className="border-t border-border/50 px-3 py-3">
        <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
          AI Studio
        </p>
        <div className="space-y-0.5">
          {aiLinks.map((link) => (
            <SidebarLink
              key={link.href}
              href={link.href}
              icon={link.icon}
              label={link.label}
              isActive={!!pathname?.startsWith(link.href.split("?")[0])}
            />
          ))}
        </div>
      </div>

      {/* Platform */}
      <div className="border-t border-border/50 px-3 py-3">
        <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
          Platform
        </p>
        <div className="space-y-0.5">
          {platformLinks.map((link) => (
            <SidebarLink key={link.href} href={link.href} icon={link.icon} label={link.label} isActive={pathname === link.href} />
          ))}
        </div>
      </div>

      {/* Projects (real workspace + project switcher) */}
      <div className="border-t border-border px-3 py-2">
        <div className="flex items-center justify-between px-3">
          <button
            onClick={() => setReposOpen(!reposOpen)}
            className="flex items-center gap-1 py-1.5 text-[10px] font-medium uppercase tracking-wider text-text-muted hover:text-text-secondary"
          >
            {reposOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            {activeWorkspace ? activeWorkspace.name : "Projects"}
          </button>
          <button
            onClick={() => setShowNewProject(true)}
            className="rounded p-1 text-text-muted hover:bg-surface-soft hover:text-text-secondary"
            title="New project"
          >
            <Plus size={12} />
          </button>
        </div>
        {reposOpen && (
          <div className="mt-1 space-y-0.5">
            {loading && projects.length === 0 ? (
              <div className="space-y-1 px-3 py-1">
                <div className="h-5 w-full animate-pulse rounded bg-surface-soft" />
                <div className="h-5 w-2/3 animate-pulse rounded bg-surface-soft" />
              </div>
            ) : projects.length === 0 ? (
              <button
                onClick={() => setShowNewProject(true)}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-text-muted hover:bg-surface-soft hover:text-text-secondary"
              >
                <Plus size={14} />
                <span>Create a project</span>
              </button>
            ) : (
              projects.map((project) => {
                const isActive = activeProject?.id === project.id;
                return (
                  <button
                    key={project.id}
                    onClick={() => setActiveProject(project.id)}
                    className={`flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left text-sm transition-colors ${
                      isActive
                        ? "text-foreground"
                        : "text-text-muted hover:bg-surface-soft hover:text-text-secondary"
                    }`}
                  >
                    <FolderOpen size={14} className="shrink-0" />
                    <span className="truncate">{project.name}</span>
                    {isActive && (
                      <Check size={12} className="ml-auto shrink-0 text-green-500" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Chat history (real threads for the active project) */}
      <div className="border-t border-border px-3 py-2">
        <div className="flex items-center justify-between px-3">
          <p className="py-1.5 text-[10px] font-medium uppercase tracking-wider text-text-muted">
            Chats
          </p>
          <button
            onClick={handleNewChat}
            disabled={!activeProjectId || creatingChat}
            className="rounded p-1 text-text-muted hover:bg-surface-soft hover:text-text-secondary disabled:opacity-40"
            title="New chat"
          >
            {creatingChat ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Plus size={12} />
            )}
          </button>
        </div>

        {chatError && (
          <p className="mx-3 mb-1 rounded bg-red-50 px-2 py-1 text-xs text-red-600">
            {chatError}
          </p>
        )}

        {!activeProjectId ? (
          <p className="px-3 py-2 text-xs text-text-muted">
            Select a project to see chats.
          </p>
        ) : threadsLoading && threads.length === 0 ? (
          <div className="space-y-1 px-3 py-1">
            <div className="h-6 w-full animate-pulse rounded bg-surface-soft" />
            <div className="h-6 w-4/5 animate-pulse rounded bg-surface-soft" />
            <div className="h-6 w-2/3 animate-pulse rounded bg-surface-soft" />
          </div>
        ) : threads.length === 0 ? (
          <button
            onClick={handleNewChat}
            disabled={creatingChat}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-text-muted hover:bg-surface-soft hover:text-text-secondary disabled:opacity-40"
          >
            <Plus size={14} className="shrink-0" />
            <span>Start a new chat</span>
          </button>
        ) : (
          <div className="space-y-0.5">
            {threads.map((thread) => {
              const isActive =
                pathname === "/dashboard/chat" &&
                currentThreadId === thread.id;
              return (
                <Link
                  key={thread.id}
                  href={`/dashboard/chat?thread=${thread.id}`}
                  className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                    isActive
                      ? "bg-surface-soft text-foreground"
                      : "text-text-muted hover:bg-surface-soft hover:text-text-secondary"
                  }`}
                >
                  <MessageSquare
                    size={14}
                    className="shrink-0 text-text-muted"
                  />
                  <span className="flex-1 truncate">{thread.title}</span>
                  <span className="shrink-0 text-[10px] text-text-muted">
                    {relativeTime(thread.updatedAt)}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      </div>{/* end scrollable nav area */}

      {/* Bottom */}
      <div className="border-t border-border p-3">
        <div className="mb-2 flex items-center gap-2 px-3">
          <Keyboard size={12} className="text-text-muted" />
          <span className="text-[10px] text-text-muted">
            Ctrl+K for commands
          </span>
        </div>
        <Link
          href="/dashboard/settings"
          className={`flex items-center gap-3 rounded-lg px-3 py-2 transition-colors ${
            pathname === "/dashboard/settings"
              ? "bg-surface-soft"
              : "hover:bg-surface-soft"
          }`}
        >
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-light text-xs font-bold text-accent">
            T
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">
              Teskel Dev
            </p>
            <p className="text-[11px] text-text-muted">Pro Plan</p>
          </div>
          <Settings size={14} className="text-text-muted" />
        </Link>
        <button
          onClick={() => signOut({ callbackUrl: "/" })}
          className="mt-1 flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-text-muted transition-colors hover:bg-surface-soft hover:text-text-secondary"
          title="Sign out"
        >
          <LogOut size={14} />
          <span>Sign out</span>
        </button>
      </div>

      {showNewProject && (
        <NewProjectModal
          onClose={() => setShowNewProject(false)}
          onCreate={handleCreate}
        />
      )}
    </aside>
  );
}

/**
 * Default export wraps SidebarContent in a Suspense boundary
 * because useSearchParams() requires it in Next.js App Router.
 */
export default function Sidebar() {
  return (
    <Suspense
      fallback={
        <aside className="flex h-screen w-60 flex-col border-r border-border/60 bg-surface/80 backdrop-blur-xl">
          <div className="flex flex-1 items-center justify-center">
            <Loader2 size={20} className="animate-spin text-text-muted" />
          </div>
        </aside>
      }
    >
      <SidebarContent />
    </Suspense>
  );
}
