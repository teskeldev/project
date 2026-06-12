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

type AgentStatus = AgentRunSummaryDTO["status"];
type FilterStatus = "all" | "RUNNING" | "WAITING_APPROVAL" | "COMPLETED" | "FAILED";

const statusConfig: Record<
  AgentStatus,
  { icon: typeof CheckCircle2; color: string; bg: string; label: string; spin?: boolean }
> = {
  QUEUED: { icon: Clock, color: "text-gray-500", bg: "bg-gray-50", label: "Queued" },
  RUNNING: { icon: Loader2, color: "text-blue-600", bg: "bg-blue-50", label: "Running", spin: true },
  WAITING_APPROVAL: { icon: Sparkles, color: "text-amber-600", bg: "bg-amber-50", label: "Awaiting review" },
  COMPLETED: { icon: CheckCircle2, color: "text-green-600", bg: "bg-green-50", label: "Completed" },
  FAILED: { icon: AlertCircle, color: "text-red-600", bg: "bg-red-50", label: "Failed" },
  CANCELLED: { icon: X, color: "text-gray-500", bg: "bg-gray-50", label: "Cancelled" },
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
          <Sparkles className="mx-auto mb-3 text-gray-300" size={32} />
          <p className="text-[14px] font-medium text-gray-900">No project selected</p>
          <p className="mt-1 text-[12px] text-gray-500">
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
      <div className="flex w-[360px] flex-col border-r border-gray-100">
        <div className="border-b border-gray-100 p-4">
          <h1 className="text-[15px] font-semibold text-gray-900">Background Agents</h1>
          <p className="mt-1 text-[12px] text-gray-500">
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
              className="w-full resize-none rounded-md border border-gray-200 px-3 py-2 text-[12px] text-gray-900 placeholder:text-gray-400 focus:border-gray-400 focus:outline-none"
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                  void handleCreate();
                }
              }}
            />
            <button
              onClick={() => void handleCreate()}
              disabled={creating || goal.trim().length < 4}
              className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-md bg-gray-900 px-3 py-1.5 text-[12px] font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {creating ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
              {creating ? "Starting..." : "New Agent"}
            </button>
            {createError && (
              <p className="mt-1.5 text-[11px] text-red-600">{createError}</p>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-1 border-b border-gray-100 p-3">
          {(["all", "RUNNING", "WAITING_APPROVAL", "COMPLETED", "FAILED"] as const).map(
            (f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
                  filter === f
                    ? "bg-gray-900 text-white"
                    : "text-gray-500 hover:bg-gray-100"
                }`}
              >
                {f === "all"
                  ? "All"
                  : f === "WAITING_APPROVAL"
                  ? "Review"
                  : statusConfig[f as AgentStatus].label}
              </button>
            )
          )}
        </div>

        {/* Items */}
        <div className="flex-1 space-y-1 overflow-auto p-2">
          {loading && runs.length === 0 && (
            <div className="flex items-center justify-center py-8 text-gray-400">
              <Loader2 size={16} className="animate-spin" />
            </div>
          )}
          {listError && (
            <p className="px-3 py-2 text-[12px] text-red-600">{listError}</p>
          )}
          {!loading && !listError && filtered.length === 0 && (
            <p className="px-3 py-8 text-center text-[12px] text-gray-400">
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
                    ? "bg-gray-50 ring-1 ring-gray-200"
                    : "hover:bg-gray-50"
                }`}
              >
                <div className={`mt-0.5 rounded-md p-1.5 ${config.bg}`}>
                  <Icon
                    size={14}
                    className={`${config.color} ${config.spin ? "animate-spin" : ""}`}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-gray-900">
                    {run.goal}
                  </p>
                  <div className="mt-1 flex items-center gap-2">
                    <span className={`text-[11px] ${config.color}`}>
                      {config.label}
                    </span>
                    <span className="text-gray-300">&middot;</span>
                    <span className="text-[11px] text-gray-400">
                      {run.stepCount} step{run.stepCount === 1 ? "" : "s"}
                    </span>
                    <span className="text-gray-300">&middot;</span>
                    <span className="text-[11px] text-gray-400">
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
          <div className="flex flex-1 items-center justify-center text-[13px] text-gray-400">
            Select an agent to view its progress.
          </div>
        ) : detailError ? (
          <div className="flex flex-1 items-center justify-center text-[13px] text-red-600">
            {detailError}
          </div>
        ) : !detail ? (
          <div className="flex flex-1 items-center justify-center text-gray-400">
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
      <div className="flex items-start justify-between border-b border-gray-100 px-6 py-4">
        <div className="min-w-0">
          <h2 className="truncate text-[15px] font-semibold text-gray-900">
            {detail.goal}
          </h2>
          <div className="mt-1 flex items-center gap-3">
            <span className={`flex items-center gap-1 text-[12px] ${config.color}`}>
              <config.icon
                size={12}
                className={config.spin ? "animate-spin" : ""}
              />
              {config.label}
            </span>
            <span className="text-[11px] text-gray-400">
              {relativeTime(detail.createdAt)}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {detail.status === "WAITING_APPROVAL" && (
            <Link
              href="/dashboard/composer"
              className="flex items-center gap-1.5 rounded-md bg-gray-900 px-3 py-1.5 text-[12px] font-medium text-white hover:bg-gray-800"
            >
              <ExternalLink size={12} />
              Review proposed changes
            </Link>
          )}
          {isActive(detail.status) && (
            <button
              onClick={onCancel}
              className="flex items-center gap-1.5 rounded-md border border-gray-200 px-3 py-1.5 text-[12px] font-medium text-gray-600 hover:bg-gray-50"
            >
              <X size={12} />
              Cancel
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {/* Failed error banner */}
        {detail.status === "FAILED" && detail.error && (
          <div className="mb-4 flex items-start gap-2 rounded-md border border-red-100 bg-red-50 p-3">
            <AlertCircle size={14} className="mt-0.5 text-red-600" />
            <p className="text-[12px] text-red-700">{detail.error}</p>
          </div>
        )}

        {/* Waiting-approval callout */}
        {detail.status === "WAITING_APPROVAL" && (
          <div className="mb-4 flex items-start gap-2 rounded-md border border-amber-100 bg-amber-50 p-3">
            <Sparkles size={14} className="mt-0.5 text-amber-600" />
            <div className="text-[12px] text-amber-800">
              <p className="font-medium">Changes proposed for review</p>
              <p className="mt-0.5">
                {detail.result?.message ??
                  "Open the Composer to review and apply the proposed changes."}
              </p>
            </div>
          </div>
        )}

        {/* Plan */}
        {detail.plan && detail.plan.steps.length > 0 && (
          <div className="mb-6 rounded-lg border border-gray-100 bg-gray-50 p-4">
            <p className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold text-gray-900">
              <GitBranch size={12} />
              Plan
            </p>
            {detail.plan.summary && (
              <p className="mb-2 text-[12px] text-gray-600">{detail.plan.summary}</p>
            )}
            <ol className="space-y-1">
              {detail.plan.steps.map((s, i) => (
                <li key={i} className="flex gap-2 text-[12px] text-gray-600">
                  <span className="text-gray-400">{i + 1}.</span>
                  <span>{s}</span>
                </li>
              ))}
            </ol>
          </div>
        )}

        {/* Step timeline */}
        <div className="space-y-0">
          {detail.steps.length === 0 ? (
            <p className="text-[12px] text-gray-400">Waiting for the agent to start...</p>
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
              ? "bg-green-100 text-green-700"
              : status === "RUNNING"
              ? "bg-blue-100 text-blue-700"
              : status === "FAILED"
              ? "bg-red-100 text-red-700"
              : "bg-gray-100 text-gray-400"
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
        {!isLast && <div className="mt-1 h-full min-h-[24px] w-px bg-gray-100" />}
      </div>
      <div className="pb-6">
        <div className="flex items-center gap-2">
          <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-gray-500">
            {STEP_LABEL[step.type] ?? step.type}
          </span>
          <p
            className={`text-[13px] font-medium ${
              status === "PENDING" ? "text-gray-400" : "text-gray-900"
            }`}
          >
            {step.title}
          </p>
        </div>
        {detail && <p className="mt-0.5 text-[12px] text-gray-500">{detail}</p>}
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
