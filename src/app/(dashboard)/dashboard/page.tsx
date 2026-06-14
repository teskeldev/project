"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  Globe,
  Code,
  Terminal,
  FileText,
  ChevronDown,
  Mic,
  Plus,
  ArrowRight,
  Zap,
  Bug,
  Palette,
  Database,
  Shield,
  Rocket,
  MessageSquare,
  GitBranch,
  Layers,
  Bot,
  Loader2,
  AlertTriangle,
  FolderPlus,
} from "lucide-react";
import { useProject } from "@/lib/store/project";
import { createThread, ApiClientError } from "@/lib/client/api";
import {
  getDashboardSummary,
  type DashboardSummary,
  type AgentRunStatus,
} from "@/lib/client/dashboard";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const suggestions = [
  { icon: Zap, label: "Build a feature", prompt: "Build a new feature for my project", color: "text-amber-500" },
  { icon: Bug, label: "Fix a bug", prompt: "Help me debug and fix an issue", color: "text-red-500" },
  { icon: Palette, label: "Design a component", prompt: "Design and implement a UI component", color: "text-purple-500" },
  { icon: Database, label: "Set up database", prompt: "Set up database schema and queries", color: "text-blue-500" },
  { icon: Shield, label: "Add authentication", prompt: "Implement authentication and authorization", color: "text-green-500" },
  { icon: Rocket, label: "Deploy project", prompt: "Help me deploy my project to production", color: "text-blue-500" },
];

/** sessionStorage key the chat page can read to prefill the composer. */
export const PENDING_PROMPT_KEY = "teskel.pendingPrompt";

const AGENT_STATUS_VARIANT: Record<AgentRunStatus, "default" | "success" | "warning" | "destructive" | "outline"> = {
  QUEUED: "outline",
  RUNNING: "default",
  WAITING_APPROVAL: "warning",
  COMPLETED: "success",
  FAILED: "destructive",
  CANCELLED: "outline",
};

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diff = Date.now() - then;
  const min = Math.round(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  return `${day}d ago`;
}

export default function DashboardPage() {
  const router = useRouter();
  const {
    activeProject,
    loading: projectLoading,
    setActiveProject,
    createNewProject,
  } = useProject();

  const [inputValue, setInputValue] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [needsProject, setNeedsProject] = useState(false);

  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const model = "Auto";

  // Check onboarding status and redirect if not completed
  useEffect(() => {
    async function checkOnboarding() {
      try {
        const res = await fetch("/api/user/onboarding");
        const json = await res.json();
        if (json.success && !json.data.completed) {
          router.push("/dashboard/onboarding");
        }
      } catch {
        // Non-fatal: if check fails, stay on dashboard
      }
    }
    void checkOnboarding();
  }, [router]);

  const activeProjectId = activeProject?.id;

  const loadSummary = useCallback(async () => {
    setSummaryLoading(true);
    setSummaryError(null);
    try {
      const data = await getDashboardSummary(activeProjectId);
      setSummary(data);
    } catch (err) {
      setSummaryError(
        err instanceof ApiClientError ? err.message : "Failed to load dashboard"
      );
    } finally {
      setSummaryLoading(false);
    }
  }, [activeProjectId]);

  useEffect(() => {
    if (projectLoading) return;
    void loadSummary();
  }, [projectLoading, loadSummary]);

  const startChatWithPrompt = useCallback(
    async (projectId: string, prompt: string) => {
      const { thread } = await createThread(
        projectId,
        prompt.slice(0, 60) || undefined
      );
      try {
        sessionStorage.setItem(PENDING_PROMPT_KEY, prompt);
      } catch {
        // sessionStorage unavailable
      }
      const qs = `thread=${thread.id}&prompt=${encodeURIComponent(prompt)}`;
      router.push(`/dashboard/chat?${qs}`);
    },
    [router]
  );

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const prompt = inputValue.trim();
      if (!prompt || submitting) return;

      setSubmitError(null);

      if (!activeProject) {
        setNeedsProject(true);
        return;
      }

      setSubmitting(true);
      try {
        await startChatWithPrompt(activeProject.id, prompt);
      } catch (err) {
        setSubmitError(
          err instanceof ApiClientError ? err.message : "Failed to start chat"
        );
        setSubmitting(false);
      }
    },
    [inputValue, submitting, activeProject, startChatWithPrompt]
  );

  const handleCreateAndContinue = useCallback(async () => {
    const prompt = inputValue.trim();
    setSubmitting(true);
    setSubmitError(null);
    try {
      const project = await createNewProject({
        name: prompt ? prompt.slice(0, 40) : "My first project",
        template: "node",
      });
      setNeedsProject(false);
      if (prompt) {
        await startChatWithPrompt(project.id, prompt);
      } else {
        setSubmitting(false);
        void loadSummary();
      }
    } catch (err) {
      setSubmitError(
        err instanceof ApiClientError
          ? err.message
          : "Failed to create project"
      );
      setSubmitting(false);
    }
  }, [inputValue, createNewProject, startChatWithPrompt, loadSummary]);

  const handleSuggestion = (prompt: string) => {
    setInputValue(prompt);
    setNeedsProject(false);
  };

  const openProject = (projectId: string) => {
    setActiveProject(projectId);
    router.push("/dashboard/chat");
  };

  return (
    <div className="flex h-full flex-col items-center overflow-y-auto bg-surface/50 px-6 py-12 backdrop-blur-sm">
      <div className="w-full max-w-2xl">
        <div className="animate-fade-in-up mb-8 text-center">
          <div className="mb-4 inline-flex animate-float items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 p-3 shadow-lg shadow-blue-200/50 dark:shadow-blue-900/30">
            <Sparkles size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-semibold text-foreground">
            What do you want to build?
          </h1>
          <p className="mt-2 text-sm text-text-secondary">
            Teskel can write code, fix bugs, run commands, and search the web.
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="flex items-center gap-2 rounded-2xl border border-border bg-surface px-4 py-3.5 shadow-sm transition-all duration-300 focus-within:border-blue-200 focus-within:shadow-lg focus-within:shadow-blue-50 dark:focus-within:border-blue-800 dark:focus-within:shadow-blue-950/30">
            <Plus size={18} className="shrink-0 text-text-muted" />
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Ask Teskel anything..."
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-text-muted focus:outline-none"
              autoFocus
            />
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="gap-1 text-xs text-text-secondary"
              >
                {model}
                <ChevronDown size={12} />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-text-muted"
              >
                <Mic size={16} />
              </Button>
              {inputValue.trim() && (
                <Button
                  type="submit"
                  disabled={submitting}
                  size="icon"
                  className="h-7 w-7"
                >
                  {submitting ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <ArrowRight size={14} />
                  )}
                </Button>
              )}
            </div>
          </div>

          <div className="mt-2 flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" className="gap-1 text-[11px] text-text-muted hover:text-text-secondary">
                <Globe size={12} /> Web
              </Button>
              <Button variant="ghost" size="sm" className="gap-1 text-[11px] text-text-muted hover:text-text-secondary">
                <Code size={12} /> Code
              </Button>
              <Button variant="ghost" size="sm" className="gap-1 text-[11px] text-text-muted hover:text-text-secondary">
                <Terminal size={12} /> Terminal
              </Button>
              <Button variant="ghost" size="sm" className="gap-1 text-[11px] text-text-muted hover:text-text-secondary">
                <FileText size={12} /> Docs
              </Button>
            </div>
            <span className="text-[11px] text-text-muted">
              {activeProject ? activeProject.name : "Local"}
            </span>
          </div>
        </form>

        {/* No-project prompt-to-create + submit errors */}
        {needsProject && (
          <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 dark:border-blue-800 dark:bg-blue-950/30">
            <div className="flex items-center gap-2">
              <FolderPlus size={16} className="text-blue-500" />
              <p className="text-xs text-blue-700 dark:text-blue-300">
                You need a project to start. Create one to continue.
              </p>
            </div>
            <Button
              type="button"
              onClick={() => void handleCreateAndContinue()}
              disabled={submitting}
              size="sm"
              className="gap-1 bg-blue-600 hover:bg-blue-700"
            >
              {submitting ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
              Create project
            </Button>
          </div>
        )}
        {submitError && (
          <div className="mt-3 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 dark:border-red-800 dark:bg-red-950/30">
            <AlertTriangle size={14} className="text-red-500" />
            <p className="text-xs text-red-600 dark:text-red-400">{submitError}</p>
          </div>
        )}

        <div className="mt-8 grid grid-cols-3 gap-3">
          {suggestions.map((s, i) => (
            <Card
              key={s.label}
              className="animate-fade-in-up cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
              style={{ animationDelay: `${i * 0.06}s` }}
            >
              <button
                onClick={() => handleSuggestion(s.prompt)}
                className="group flex w-full items-center gap-3 px-4 py-3 text-left"
              >
                <s.icon size={18} className={`${s.color} transition-transform duration-200 group-hover:scale-110`} />
                <span className="text-xs font-medium text-text-secondary">{s.label}</span>
              </button>
            </Card>
          ))}
        </div>

        {/* Real activity */}
        <ActivitySection
          loading={summaryLoading || projectLoading}
          error={summaryError}
          summary={summary}
          onRetry={() => void loadSummary()}
          onOpenProject={openProject}
          onCreateProject={() => void handleCreateAndContinue()}
          creating={submitting}
        />
      </div>

      <div className="mt-10 text-center">
        <div className="flex items-center gap-3 text-[11px] text-text-muted">
          <span>Teskel v1.0</span>
          <span>&middot;</span>
          <button className="hover:text-text-secondary">Keyboard shortcuts</button>
          <span>&middot;</span>
          <button className="hover:text-text-secondary">Documentation</button>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Activity: real recent projects + contextual panels                         */
/* -------------------------------------------------------------------------- */

function ActivitySection({
  loading,
  error,
  summary,
  onRetry,
  onOpenProject,
  onCreateProject,
  creating,
}: {
  loading: boolean;
  error: string | null;
  summary: DashboardSummary | null;
  onRetry: () => void;
  onOpenProject: (id: string) => void;
  onCreateProject: () => void;
  creating: boolean;
}) {
  const router = useRouter();

  if (loading) {
    return (
      <div className="mt-10 flex items-center justify-center py-8">
        <Loader2 size={18} className="animate-spin text-text-muted" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-10 flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 dark:border-red-800 dark:bg-red-950/30">
        <div className="flex items-center gap-2">
          <AlertTriangle size={14} className="text-red-500" />
          <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
        </div>
        <Button
          onClick={onRetry}
          variant="outline"
          size="sm"
          className="border-red-200 text-red-600 hover:bg-red-100 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/50"
        >
          Retry
        </Button>
      </div>
    );
  }

  const hasProjects = (summary?.recentProjects.length ?? 0) > 0;

  if (!hasProjects) {
    return (
      <div className="mt-10 flex flex-col items-center rounded-2xl border border-dashed border-border bg-surface/60 px-6 py-10 text-center">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-950/30">
          <FolderPlus size={22} className="text-blue-500" />
        </div>
        <h3 className="text-sm font-semibold text-foreground">No projects yet</h3>
        <p className="mt-1 max-w-sm text-xs text-text-secondary">
          Create your first project to start chatting, running agents, and
          tracking changes.
        </p>
        <Button
          onClick={onCreateProject}
          disabled={creating}
          size="sm"
          className="mt-4 gap-1"
        >
          {creating ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
          New project
        </Button>
      </div>
    );
  }

  const s = summary!;

  return (
    <div className="mt-10 space-y-8">
      {/* Recent projects */}
      <div>
        <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-text-muted">
          Recent projects
        </h3>
        <div className="grid grid-cols-3 gap-3">
          {s.recentProjects.slice(0, 6).map((p) => (
            <Card
              key={p.id}
              className="cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
            >
              <button
                onClick={() => onOpenProject(p.id)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left"
              >
                <Code size={16} className="shrink-0 text-text-muted" />
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium text-foreground">
                    {p.name}
                  </p>
                  <p className="text-[11px] text-text-muted">
                    {relativeTime(p.updatedAt)}
                  </p>
                </div>
              </button>
            </Card>
          ))}
        </div>
      </div>

      {/* Contextual panels for the focus project */}
      <div className="grid grid-cols-2 gap-4">
        {/* Recent chats */}
        <Panel
          title="Recent chats"
          icon={MessageSquare}
          actionLabel="All chats"
          onAction={() => router.push("/dashboard/chat")}
        >
          {s.recentThreads.length === 0 ? (
            <EmptyHint text="No chats yet" />
          ) : (
            <ul className="space-y-1">
              {s.recentThreads.map((t) => (
                <li key={t.id}>
                  <button
                    onClick={() => router.push(`/dashboard/chat?thread=${t.id}`)}
                    className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-surface-soft"
                  >
                    <span className="truncate text-xs text-text-secondary">
                      {t.title}
                    </span>
                    <span className="shrink-0 text-[10px] text-text-muted">
                      {relativeTime(t.updatedAt)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {/* Recent agent runs */}
        <Panel
          title="Agent runs"
          icon={Bot}
          actionLabel="All runs"
          onAction={() => router.push("/dashboard/agents")}
        >
          {s.recentAgentRuns.length === 0 ? (
            <EmptyHint text="No agent runs yet" />
          ) : (
            <ul className="space-y-1">
              {s.recentAgentRuns.map((r) => (
                <li key={r.id}>
                  <button
                    onClick={() => router.push("/dashboard/agents")}
                    className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-surface-soft"
                  >
                    <span className="truncate text-xs text-text-secondary">
                      {r.goal}
                    </span>
                    <Badge variant={AGENT_STATUS_VARIANT[r.status]} className="shrink-0 text-[10px]">
                      {r.status.replace("_", " ").toLowerCase()}
                    </Badge>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {/* Pending changes */}
        <Card className="transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
          <button
            onClick={() => router.push("/dashboard/composer")}
            className="flex w-full items-center justify-between px-5 py-4 text-left"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50 dark:bg-amber-950/30">
                <Layers size={16} className="text-amber-500" />
              </div>
              <div>
                <p className="text-xs font-medium text-foreground">Pending changes</p>
                <p className="text-[11px] text-text-muted">Review in Composer</p>
              </div>
            </div>
            <span className="text-lg font-semibold text-foreground">
              {s.counts.pendingChanges}
            </span>
          </button>
        </Card>

        {/* Git summary */}
        <Card className="transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
          <button
            onClick={() => router.push("/dashboard/git")}
            className="flex w-full items-center justify-between px-5 py-4 text-left"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-950/30">
                <GitBranch size={16} className="text-blue-500" />
              </div>
              <div>
                <p className="text-xs font-medium text-foreground">
                  {s.git ? s.git.branch : "No git state"}
                </p>
                <p className="text-[11px] text-text-muted">
                  {s.git
                    ? s.git.dirtyCount > 0
                      ? `${s.git.dirtyCount} uncommitted`
                      : "Working tree clean"
                    : "Source control"}
                </p>
              </div>
            </div>
            {s.git && s.git.dirtyCount > 0 && (
              <Badge variant="warning" className="text-[10px]">
                {s.git.dirtyCount}
              </Badge>
            )}
          </button>
        </Card>
      </div>
    </div>
  );
}

function Panel({
  title,
  icon: Icon,
  actionLabel,
  onAction,
  children,
}: {
  title: string;
  icon: React.ElementType;
  actionLabel: string;
  onAction: () => void;
  children: React.ReactNode;
}) {
  return (
    <Card className="p-4">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon size={14} className="text-text-muted" />
          <h4 className="text-xs font-medium text-text-secondary">{title}</h4>
        </div>
        <button
          onClick={onAction}
          className="text-[11px] text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
        >
          {actionLabel}
        </button>
      </div>
      {children}
    </Card>
  );
}

function EmptyHint({ text }: { text: string }) {
  return <p className="px-2 py-3 text-center text-[11px] text-text-muted">{text}</p>;
}
