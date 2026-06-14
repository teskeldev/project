"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Play,
  ExternalLink,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  Sparkles,
  GitBranch,
} from "lucide-react";
import { useProject } from "@/lib/store/project";
import {
  listAgentRuns,
  getAgentRun,
  createAgentRun,
  cancelAgentRun,
  streamAgentEvents,
  AgentClientError,
  type AgentRunSummaryDTO,
  type AgentRunDetailDTO,
  type AgentStepDTO,
} from "@/lib/client/agents";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type AgentStatus = AgentRunSummaryDTO["status"];
type FilterStatus = "all" | "RUNNING" | "WAITING_APPROVAL" | "COMPLETED" | "FAILED";

const statusConfig: Record<
  AgentStatus,
  { icon: typeof CheckCircle2; color: string; bg: string; label: string; badgeVariant: "default" | "success" | "warning" | "destructive" | "outline"; spin?: boolean }
> = {
  QUEUED: { icon: Clock, color: "text-[var(--text-secondary)]", bg: "bg-[var(--surface-soft)]", label: "Queued", badgeVariant: "outline" },
  RUNNING: { icon: Loader2, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-900/30", label: "Running", badgeVariant: "default", spin: true },
  WAITING_APPROVAL: { icon: Sparkles, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-900/30", label: "Awaiting review", badgeVariant: "warning" },
  COMPLETED: { icon: CheckCircle2, color: "text-green-600 dark:text-green-400", bg: "bg-green-50 dark:bg-green-900/30", label: "Completed", badgeVariant: "success" },
  FAILED: { icon: AlertCircle, color: "text-red-600 dark:text-red-400", bg: "bg-red-50 dark:bg-red-900/30", label: "Failed", badgeVariant: "destructive" },
  CANCELLED: { icon: X, color: "text-[var(--text-secondary)]", bg: "bg-[var(--surface-soft)]", label: "Cancelled", badgeVariant: "outline" },
};

const STEP_LABEL: Record<string, string> = {
  THINK: "Plan",
  READ_FILE: "Read",
  WRITE_FILE: "Write",
  RUN_COMMAND: "Command",
  SEARCH: "Search",
  GIT: "Git",
  DIFF: "Diff",
  REVIEW: "Review",
};

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(iso).toLocaleDateString();
}

function isActive(status: AgentStatus): boolean {
  return status === "QUEUED" || status === "RUNNING";
}

export default function BackgroundAgentsPage() {
  const { activeProject } = useProject();
  const projectId = activeProject?.id ?? null;

  const [runs, setRuns] = useState<AgentRunSummaryDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterStatus>("all");

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<AgentRunDetailDTO | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);

  const [goal, setGoal] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const streamRef = useRef<{ abort: () => void } | null>(null);

  /* ------------------------------- list ------------------------------- */
  const loadRuns = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setListError(null);
    try {
      const { runs: data } = await listAgentRuns(projectId);
      setRuns(data);
      setSelectedId((prev) => prev ?? data[0]?.id ?? null);
    } catch (err) {
      setListError(
        err instanceof AgentClientError ? err.message : "Failed to load agents"
      );
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    setRuns([]);
    setSelectedId(null);
    setDetail(null);
    if (projectId) void loadRuns();
  }, [projectId, loadRuns]);

  /* ------------------------------ detail ------------------------------ */
  const refreshDetail = useCallback(async (id: string) => {
    try {
      const { run } = await getAgentRun(id);
      setDetail(run);
      setDetailError(null);
      // Keep the list summary in sync.
      setRuns((prev) =>
        prev.map((r) =>
          r.id === id
            ? {
                ...r,
                status: run.status,
                error: run.error,
                stepCount: run.stepCount,
                changeSetId: run.changeSetId,
                updatedAt: run.updatedAt,
              }
            : r
        )
      );
    } catch (err) {
      setDetailError(
        err instanceof AgentClientError ? err.message : "Failed to load run"
      );
    }
  }, []);

  // Load detail + subscribe to live events whenever the selection changes.
  useEffect(() => {
    streamRef.current?.abort();
    streamRef.current = null;
    setDetail(null);
    setDetailError(null);
    if (!selectedId) return;

    let cancelled = false;
    void (async () => {
      await refreshDetail(selectedId);
      if (cancelled) return;

      // Open the live stream (also drives execution for QUEUED runs).
      const { abort } = streamAgentEvents(selectedId, {
        onEvent: (event) => {
          if (
            event.type === "step_started" ||
            event.type === "step_completed" ||
            event.type === "completed" ||
            event.type === "failed" ||
            event.type === "cancelled" ||
            event.type === "waiting_approval" ||
            event.type === "planning" ||
            event.type === "generating_diff" ||
            event.type === "status"
          ) {
            // Re-pull authoritative state from the DB on meaningful events.
            void refreshDetail(selectedId);
          }
          if (event.type === "end") {
            void loadRuns();
          }
        },
        onError: () => {
          /* surfaced via detail refresh */
        },
      });
      streamRef.current = { abort };
    })();

    return () => {
      cancelled = true;
      streamRef.current?.abort();
      streamRef.current = null;
    };
  }, [selectedId, refreshDetail, loadRuns]);

  /* ------------------------------ create ------------------------------ */
  const handleCreate = useCallback(async () => {
    if (!projectId || goal.trim().length < 4 || creating) return;
    setCreating(true);
    setCreateError(null);
    try {
      const { run } = await createAgentRun(projectId, { goal: goal.trim() });
      setGoal("");
      setRuns((prev) => [run, ...prev]);
      setSelectedId(run.id);
    } catch (err) {
      setCreateError(
        err instanceof AgentClientError ? err.message : "Failed to start agent"
      );
    } finally {
      setCreating(false);
    }
  }, [projectId, goal, creating]);

  const handleCancel = useCallback(
    async (id: string) => {
      try {
        await cancelAgentRun(id);
        await refreshDetail(id);
      } catch {
        /* ignore; status will reconcile on next refresh */
      }
    },
    [refreshDetail]
  );

  /* ------------------------------ render ------------------------------ */
  if (!projectId) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <Sparkles className="mx-auto mb-3 text-[var(--text-muted)]" size={32} />
          <p className="text-[14px] font-medium text-[var(--foreground)]">No project selected</p>
          <p className="mt-1 text-[12px] text-[var(--text-secondary)]">
            Choose a project to run background agents.
          </p>
        </div>
      </div>
    );
  }

  const filtered =
    filter === "all" ? runs : runs.filter((r) => r.status === filter);

  return (
    <div className="flex h-full">
      {/* Agent list */}
      <div className="flex w-[360px] flex-col border-r border-[var(--border)]">
        <div className="border-b border-[var(--border)] p-4">
          <h1 className="text-[15px] font-semibold text-[var(--foreground)]">Background Agents</h1>
          <p className="mt-1 text-[12px] text-[var(--text-secondary)]">
            Agents propose changes for your review &mdash; they never apply edits
            or run commands automatically.
          </p>

          {/* New agent */}
          <div className="mt-3">
            <textarea
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="Describe a goal, e.g. Add a dark mode toggle to the navbar"
              rows={2}
              className="w-full resize-none rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[12px] text-[var(--foreground)] placeholder:text-[var(--text-muted)] focus:border-[var(--border-focus,var(--accent))] focus:outline-none"
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                  void handleCreate();
                }
              }}
            />
            <Button
              onClick={() => void handleCreate()}
              disabled={creating || goal.trim().length < 4}
              className="mt-2 w-full"
              size="sm"
            >
              {creating ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
              {creating ? "Starting..." : "New Agent"}
            </Button>
            {createError && (
              <p className="mt-1.5 text-[11px] text-red-600 dark:text-red-400">{createError}</p>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-1 border-b border-[var(--border)] p-3">
          {(["all", "RUNNING", "WAITING_APPROVAL", "COMPLETED", "FAILED"] as const).map(
            (f) => (
              <Button
                key={f}
                onClick={() => setFilter(f)}
                variant={filter === f ? "default" : "ghost"}
                size="sm"
                className="text-[11px]"
              >
                {f === "all"
                  ? "All"
                  : f === "WAITING_APPROVAL"
                  ? "Review"
                  : statusConfig[f as AgentStatus].label}
              </Button>
            )
          )}
        </div>

        {/* Items */}
        <div className="flex-1 space-y-1 overflow-auto p-2">
          {loading && runs.length === 0 && (
            <div className="flex items-center justify-center py-8 text-[var(--text-muted)]">
              <Loader2 size={16} className="animate-spin" />
            </div>
          )}
          {listError && (
            <p className="px-3 py-2 text-[12px] text-red-600 dark:text-red-400">{listError}</p>
          )}
          {!loading && !listError && filtered.length === 0 && (
            <p className="px-3 py-8 text-center text-[12px] text-[var(--text-muted)]">
              No agents yet. Describe a goal above to start one.
            </p>
          )}
          {filtered.map((run) => {
            const config = statusConfig[run.status];
            const Icon = config.icon;
            return (
              <button
                key={run.id}
                onClick={() => setSelectedId(run.id)}
                className={`flex w-full items-start gap-3 rounded-lg p-3 text-left transition-colors ${
                  selectedId === run.id
                    ? "bg-[var(--surface-soft)] ring-1 ring-[var(--border)]"
                    : "hover:bg-[var(--surface-soft)]"
                }`}
              >
                <div className={`mt-0.5 rounded-md p-1.5 ${config.bg}`}>
                  <Icon
                    size={14}
                    className={`${config.color} ${config.spin ? "animate-spin" : ""}`}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-[var(--foreground)]">
                    {run.goal}
                  </p>
                  <div className="mt-1 flex items-center gap-2">
                    <span className={`text-[11px] ${config.color}`}>
                      {config.label}
                    </span>
                    <span className="text-[var(--text-muted)]">&middot;</span>
                    <span className="text-[11px] text-[var(--text-muted)]">
                      {run.stepCount} step{run.stepCount === 1 ? "" : "s"}
                    </span>
                    <span className="text-[var(--text-muted)]">&middot;</span>
                    <span className="text-[11px] text-[var(--text-muted)]">
                      {relativeTime(run.createdAt)}
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Detail */}
      <div className="flex flex-1 flex-col">
        {!selectedId ? (
          <div className="flex flex-1 items-center justify-center text-[13px] text-[var(--text-muted)]">
            Select an agent to view its progress.
          </div>
        ) : detailError ? (
          <div className="flex flex-1 items-center justify-center text-[13px] text-red-600 dark:text-red-400">
            {detailError}
          </div>
        ) : !detail ? (
          <div className="flex flex-1 items-center justify-center text-[var(--text-muted)]">
            <Loader2 size={18} className="animate-spin" />
          </div>
        ) : (
          <AgentDetail
            detail={detail}
            onCancel={() => void handleCancel(detail.id)}
          />
        )}
      </div>
    </div>
  );
}

function AgentDetail({
  detail,
  onCancel,
}: {
  detail: AgentRunDetailDTO;
  onCancel: () => void;
}) {
  const config = statusConfig[detail.status];

  return (
    <>
      <div className="flex items-start justify-between border-b border-[var(--border)] px-6 py-4">
        <div className="min-w-0">
          <h2 className="truncate text-[15px] font-semibold text-[var(--foreground)]">
            {detail.goal}
          </h2>
          <div className="mt-1 flex items-center gap-3">
            <Badge variant={config.badgeVariant} className="gap-1">
              <config.icon
                size={12}
                className={config.spin ? "animate-spin" : ""}
              />
              {config.label}
            </Badge>
            <span className="text-[11px] text-[var(--text-muted)]">
              {relativeTime(detail.createdAt)}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {detail.status === "WAITING_APPROVAL" && (
            <Button asChild size="sm">
              <Link href="/dashboard/composer" className="gap-1.5">
                <ExternalLink size={12} />
                Review proposed changes
              </Link>
            </Button>
          )}
          {isActive(detail.status) && (
            <Button
              onClick={onCancel}
              variant="outline"
              size="sm"
            >
              <X size={12} />
              Cancel
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {/* Failed error banner */}
        {detail.status === "FAILED" && detail.error && (
          <Card className="mb-4 border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-900/20">
            <CardContent className="flex items-start gap-2 p-3">
              <AlertCircle size={14} className="mt-0.5 text-red-600 dark:text-red-400" />
              <p className="text-[12px] text-red-700 dark:text-red-300">{detail.error}</p>
            </CardContent>
          </Card>
        )}

        {/* Waiting-approval callout */}
        {detail.status === "WAITING_APPROVAL" && (
          <Card className="mb-4 border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-900/20">
            <CardContent className="flex items-start gap-2 p-3">
              <Sparkles size={14} className="mt-0.5 text-amber-600 dark:text-amber-400" />
              <div className="text-[12px] text-amber-800 dark:text-amber-300">
                <p className="font-medium">Changes proposed for review</p>
                <p className="mt-0.5">
                  {detail.result?.message ??
                    "Open the Composer to review and apply the proposed changes."}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Plan */}
        {detail.plan && detail.plan.steps.length > 0 && (
          <Card className="mb-6 bg-[var(--surface-soft)]">
            <CardContent className="p-4">
              <p className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold text-[var(--foreground)]">
                <GitBranch size={12} />
                Plan
              </p>
              {detail.plan.summary && (
                <p className="mb-2 text-[12px] text-[var(--text-secondary)]">{detail.plan.summary}</p>
              )}
              <ol className="space-y-1">
                {detail.plan.steps.map((s, i) => (
                  <li key={i} className="flex gap-2 text-[12px] text-[var(--text-secondary)]">
                    <span className="text-[var(--text-muted)]">{i + 1}.</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        )}

        {/* Step timeline */}
        <div className="space-y-0">
          {detail.steps.length === 0 ? (
            <p className="text-[12px] text-[var(--text-muted)]">Waiting for the agent to start...</p>
          ) : (
            detail.steps.map((step, i) => (
              <StepItem
                key={step.id}
                step={step}
                index={i + 1}
                isLast={i === detail.steps.length - 1}
              />
            ))
          )}
        </div>
      </div>
    </>
  );
}

function StepItem({
  step,
  index,
  isLast,
}: {
  step: AgentStepDTO;
  index: number;
  isLast: boolean;
}) {
  const detail = stepDetail(step);
  const status = step.status;
  return (
    <div className="flex gap-4">
      <div className="flex flex-col items-center">
        <div
          className={`flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-medium ${
            status === "COMPLETED"
              ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
              : status === "RUNNING"
              ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
              : status === "FAILED"
              ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
              : "bg-[var(--surface-soft)] text-[var(--text-muted)]"
          }`}
        >
          {status === "COMPLETED" ? (
            <CheckCircle2 size={14} />
          ) : status === "RUNNING" ? (
            <Loader2 size={14} className="animate-spin" />
          ) : status === "FAILED" ? (
            <AlertCircle size={14} />
          ) : (
            index
          )}
        </div>
        {!isLast && <div className="mt-1 h-full min-h-[24px] w-px bg-[var(--border)]" />}
      </div>
      <div className="pb-6">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
            {STEP_LABEL[step.type] ?? step.type}
          </Badge>
          <p
            className={`text-[13px] font-medium ${
              status === "PENDING" ? "text-[var(--text-muted)]" : "text-[var(--foreground)]"
            }`}
          >
            {step.title}
          </p>
        </div>
        {detail && <p className="mt-0.5 text-[12px] text-[var(--text-secondary)]">{detail}</p>}
      </div>
    </div>
  );
}

/** Derive a short human-readable detail from a step's output JSON. */
function stepDetail(step: AgentStepDTO): string | null {
  const out = step.output as Record<string, unknown> | null;
  if (!out) return null;
  if (step.type === "SEARCH" && Array.isArray(out.matches)) {
    const matches = out.matches as string[];
    return matches.length
      ? `Found ${matches.length} relevant file(s)`
      : "No matching files";
  }
  if (step.type === "READ_FILE" && Array.isArray(out.read)) {
    return `Read ${(out.read as string[]).length} file(s)`;
  }
  if (step.type === "GIT" && typeof out.summary === "string") {
    return out.summary;
  }
  if (step.type === "DIFF" && typeof out.fileCount === "number") {
    return `Proposed ${out.fileCount} file change(s)`;
  }
  if (step.type === "REVIEW" && typeof out.changeSetId === "string") {
    return "Proposed changes ready for review";
  }
  return null;
}
