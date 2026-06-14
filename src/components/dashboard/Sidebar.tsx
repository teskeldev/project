"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { signOut } from "next-auth/react";
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
  Sliders,
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
  BookOpen,
  FileText,
  PenTool,
  SearchCode,
  Sparkles,
  Palette,
  LogOut,
  Plus,
  Check,
  Loader2,
  X,
  Webhook,
  Shield,
  Zap,
  TerminalSquare,
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
  { href: "/dashboard/composer", icon: Layers, label: "Code Review" },
  { href: "/dashboard/terminal", icon: Terminal, label: "Terminal" },
  { href: "/dashboard/git", icon: GitBranch, label: "Git" },
  { href: "/dashboard/extensions", icon: Puzzle, label: "Extensions" },
];

const aiLinks = [
  { href: "/dashboard/agents", icon: Bot, label: "Background Agents" },
  { href: "/dashboard/artifacts", icon: Sparkles, label: "Artifacts" },
  { href: "/dashboard/design", icon: Palette, label: "Design" },
  { href: "/dashboard/canvas", icon: PenTool, label: "Canvas" },
  { href: "/dashboard/search", icon: SearchCode, label: "Search" },
];

const configLinks = [
  { href: "/dashboard/knowledge", icon: BookOpen, label: "Knowledge" },
  { href: "/dashboard/rules", icon: FileText, label: "Rules" },
  { href: "/dashboard/skills", icon: Zap, label: "Skills" },
  { href: "/dashboard/commands", icon: TerminalSquare, label: "Commands" },
  { href: "/dashboard/integrations", icon: Plug, label: "Integrations" },
  { href: "/dashboard/webhooks", icon: Webhook, label: "Webhooks" },
  { href: "/dashboard/permissions", icon: Shield, label: "Permissions" },
];

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
        className="animate-scale-in relative w-full max-w-sm overflow-hidden rounded-2xl border border-gray-200/80 bg-white/95 shadow-2xl backdrop-blur-xl"
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-gray-900">New project</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <X size={14} />
          </button>
        </div>
        <div className="space-y-4 p-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">
              Project name
            </label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="my-app"
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">
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
                      ? "border-blue-400 bg-blue-50 text-blue-700"
                      : "border-gray-200 text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-gray-200 px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!name.trim() || submitting}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
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
    setActiveProject,
    createNewProject,
  } = useProject();

  const router = useRouter();
  const searchParams = useSearchParams();
  const currentThreadId = searchParams.get("thread");
  const activeProjectId = activeProject?.id ?? null;

  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [threadsLoading, setThreadsLoading] = useState(false);
  const [creatingChat, setCreatingChat] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

  const loadThreads = useCallback(async () => {
    if (!activeProjectId) {
      setThreads([]);
      return;
    }
    setThreadsLoading(true);
    try {
      const { threads: t } = await listThreads(activeProjectId);
      setThreads(t);
    } catch {
      // Non-fatal: leave the list empty if threads can't be loaded.
      setThreads([]);
    } finally {
      setThreadsLoading(false);
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

  const handleNewChat = async () => {
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
  };

  const handleCreate = async (name: string, template: ProjectTemplate) => {
    await createNewProject({ name, template });
  };

  if (collapsed) {
    return (
      <aside className="animate-slide-in-left flex h-screen w-12 flex-col items-center border-r border-[#E5E7EB]/60 bg-white/80 py-3 backdrop-blur-xl">
        <button
          onClick={() => setCollapsed(false)}
          className="mb-3 rounded-lg p-2 text-gray-400 transition-all duration-200 hover:bg-gray-100 hover:text-gray-600"
          title="Expand sidebar" aria-label="Expand sidebar"
        >
          <ChevronRight size={16} />
        </button>
        <Link href="/dashboard" className="mb-1 rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600" title="New Agent" aria-label="New Agent">
          <PenLine size={16} />
        </Link>
        <button onClick={openCommandPalette} className="mb-1 rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600" title="Search (Ctrl+K)" aria-label="Search">
          <Search size={16} />
        </button>
        {workspaceLinks.map((link) => (
          <Link key={link.href} href={link.href} className={`mb-1 rounded-lg p-2 ${pathname === link.href ? "bg-gray-100 text-gray-900" : "text-gray-400 hover:bg-gray-100 hover:text-gray-600"}`} title={link.label} aria-label={link.label}>
            <link.icon size={16} />
          </Link>
        ))}
        <div className="my-1 h-px w-6 bg-gray-200" />
        {aiLinks.map((link) => (
          <Link key={link.href} href={link.href} className={`mb-1 rounded-lg p-2 ${pathname === link.href ? "bg-gray-100 text-gray-900" : "text-gray-400 hover:bg-gray-100 hover:text-gray-600"}`} title={link.label} aria-label={link.label}>
            <link.icon size={16} />
          </Link>
        ))}
        <div className="my-1 h-px w-6 bg-gray-200" />
        {configLinks.map((link) => (
          <Link key={link.href} href={link.href} className={`mb-1 rounded-lg p-2 ${pathname === link.href ? "bg-gray-100 text-gray-900" : "text-gray-400 hover:bg-gray-100 hover:text-gray-600"}`} title={link.label} aria-label={link.label}>
            <link.icon size={16} />
          </Link>
        ))}
        <div className="flex-1" />
        <Link href="/dashboard/settings" className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600" title="Settings" aria-label="Settings">
          <Settings size={16} />
        </Link>
        <button
          onClick={() => signOut({ callbackUrl: "/" })}
          className="mt-1 rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          title="Sign out" aria-label="Sign out"
        >
          <LogOut size={16} />
        </button>
      </aside>
    );
  }

  return (
    <aside className="animate-slide-in-left flex h-screen w-60 flex-col border-r border-[#E5E7EB]/60 bg-white/80 backdrop-blur-xl">
      {/* Top actions */}
      <div className="space-y-0.5 p-3">
        <button
          onClick={() => setCollapsed(true)}
          className="mb-2 flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
        >
          <ChevronDown size={16} className="-rotate-90" />
          <span className="text-xs">Collapse</span>
        </button>

        <button onClick={openCommandPalette} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700">
          <Search size={16} />
          <span>Search</span>
          <kbd className="ml-auto rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-[10px] text-gray-400">
            Ctrl+K
          </kbd>
        </button>

        <Link
          href="/dashboard"
          className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
            pathname === "/dashboard"
              ? "bg-gray-100 text-gray-900"
              : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
          }`}
        >
          <PenLine size={16} />
          <span>New Agent</span>
          <kbd className="ml-auto rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-[10px] text-gray-400">
            Ctrl+N
          </kbd>
        </Link>
        <Link href="/dashboard/chat" className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900">
          <MessageSquare size={16} />
          <span>Chat</span>
        </Link>

        <Link href="/dashboard/settings" className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900">
          <Sliders size={16} />
          <span>Customize</span>
        </Link>
      </div>

      {/* Workspace tools */}
      <div className="border-t border-gray-100 px-3 py-2">
        <p className="mb-1 px-3 text-[10px] font-medium uppercase tracking-wider text-gray-400">
          Workspace
        </p>
        {workspaceLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-sm transition-colors ${
              pathname === link.href
                ? "bg-gray-100 text-gray-900"
                : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"
            }`}
          >
            <link.icon size={14} />
            <span>{link.label}</span>
          </Link>
        ))}
      </div>

      {/* AI Tools */}
      <div className="border-t border-gray-100 px-3 py-2">
        <p className="mb-1 px-3 text-[10px] font-medium uppercase tracking-wider text-gray-400">
          AI Tools
        </p>
        {aiLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-sm transition-colors ${
              pathname === link.href
                ? "bg-gray-100 text-gray-900"
                : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"
            }`}
          >
            <link.icon size={14} />
            <span>{link.label}</span>
          </Link>
        ))}
      </div>

      {/* Configuration */}
      <div className="border-t border-gray-100 px-3 py-2">
        <p className="mb-1 px-3 text-[10px] font-medium uppercase tracking-wider text-gray-400">
          Configuration
        </p>
        {configLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-sm transition-colors ${
              pathname === link.href
                ? "bg-gray-100 text-gray-900"
                : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"
            }`}
          >
            <link.icon size={14} />
            <span>{link.label}</span>
          </Link>
        ))}
      </div>

      {/* Projects (real workspace + project switcher) */}
      <div className="border-t border-gray-100 px-3 py-2">
        <div className="flex items-center justify-between px-3">
          <button
            onClick={() => setReposOpen(!reposOpen)}
            className="flex items-center gap-1 py-1.5 text-[10px] font-medium uppercase tracking-wider text-gray-400 hover:text-gray-600"
          >
            {reposOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            {activeWorkspace ? activeWorkspace.name : "Projects"}
          </button>
          <button
            onClick={() => setShowNewProject(true)}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            title="New project"
          >
            <Plus size={12} />
          </button>
        </div>
        {reposOpen && (
          <div className="mt-1 space-y-0.5">
            {loading && projects.length === 0 ? (
              <div className="space-y-1 px-3 py-1">
                <div className="h-5 w-full animate-pulse rounded bg-gray-100" />
                <div className="h-5 w-2/3 animate-pulse rounded bg-gray-100" />
              </div>
            ) : projects.length === 0 ? (
              <button
                onClick={() => setShowNewProject(true)}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-gray-400 hover:bg-gray-100 hover:text-gray-600"
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
                        ? "text-gray-900"
                        : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"
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
      <div className="flex-1 overflow-y-auto border-t border-gray-100 px-3 py-2">
        <div className="flex items-center justify-between px-3">
          <p className="py-1.5 text-[10px] font-medium uppercase tracking-wider text-gray-400">
            Chats
          </p>
          <button
            onClick={handleNewChat}
            disabled={!activeProjectId || creatingChat}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-40"
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
          <p className="px-3 py-2 text-xs text-gray-400">
            Select a project to see chats.
          </p>
        ) : threadsLoading && threads.length === 0 ? (
          <div className="space-y-1 px-3 py-1">
            <div className="h-6 w-full animate-pulse rounded bg-gray-100" />
            <div className="h-6 w-4/5 animate-pulse rounded bg-gray-100" />
            <div className="h-6 w-2/3 animate-pulse rounded bg-gray-100" />
          </div>
        ) : threads.length === 0 ? (
          <button
            onClick={handleNewChat}
            disabled={creatingChat}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-40"
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
                      ? "bg-gray-100 text-gray-900"
                      : "text-gray-500 hover:bg-gray-50 hover:text-gray-700"
                  }`}
                >
                  <MessageSquare
                    size={14}
                    className="shrink-0 text-gray-400"
                  />
                  <span className="flex-1 truncate">{thread.title}</span>
                  <span className="shrink-0 text-[10px] text-gray-400">
                    {relativeTime(thread.updatedAt)}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Bottom */}
      <div className="border-t border-gray-200 p-3">
        <div className="mb-2 flex items-center gap-2 px-3">
          <Keyboard size={12} className="text-gray-400" />
          <span className="text-[10px] text-gray-400">
            Ctrl+K for commands
          </span>
        </div>
        <Link
          href="/dashboard/settings"
          className={`flex items-center gap-3 rounded-lg px-3 py-2 transition-colors ${
            pathname === "/dashboard/settings"
              ? "bg-gray-100"
              : "hover:bg-gray-100"
          }`}
        >
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-bold text-blue-600">
            T
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-gray-900">
              Teskel Dev
            </p>
            <p className="text-[11px] text-gray-400">Pro Plan</p>
          </div>
          <Settings size={14} className="text-gray-400" />
        </Link>
        <button
          onClick={() => signOut({ callbackUrl: "/" })}
          className="mt-1 flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
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
        <aside className="flex h-screen w-60 flex-col border-r border-[#E5E7EB]/60 bg-white/80 backdrop-blur-xl">
          <div className="flex flex-1 items-center justify-center">
            <Loader2 size={20} className="animate-spin text-gray-300" />
          </div>
        </aside>
      }
    >
      <SidebarContent />
    </Suspense>
  );
}
