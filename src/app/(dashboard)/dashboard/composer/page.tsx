"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  File,
  Check,
  X,
  RotateCcw,
  Sparkles,
  GitBranch,
  ChevronDown,
  Columns2,
  AlignLeft,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  MessageSquare,
} from "lucide-react";
import { useProject } from "@/lib/store/project";
import {
  listChangeSets,
  getChangeSet,
  updateFileChange,
  applyChangeSet,
  rejectChangeSet,
  revertChangeSet,
  ApiClientError,
  type ChangeSetSummary,
  type ChangeSetDetail,
  type FileChange,
  type FileChangeType,
  type ApplyResult,
} from "@/lib/client/api";
import {
  requestAIReview,
  toggleReviewComment,
  listReviewComments,
  type ReviewComment,
} from "@/lib/client/review";
import {
  diffStat,
  parseUnifiedDiff,
  buildSideBySide,
} from "@/lib/diff";

type ViewMode = "unified" | "split";

const CHANGE_TYPE_STYLES: Record<
  FileChangeType,
  { label: string; badge: string; icon: string }
> = {
  CREATE: { label: "created", badge: "bg-green-100 text-green-700", icon: "text-green-500" },
  UPDATE: { label: "modified", badge: "bg-amber-100 text-amber-700", icon: "text-amber-500" },
  DELETE: { label: "deleted", badge: "bg-red-100 text-red-700", icon: "text-red-500" },
  RENAME: { label: "renamed", badge: "bg-accent-light text-accent", icon: "text-accent" },
};

export default function CodeReviewPage() {
  const { activeProject } = useProject();
  const projectId = activeProject?.id ?? null;

  const [changesets, setChangesets] = useState<ChangeSetSummary[]>([]);
  const [selectedChangeSetId, setSelectedChangeSetId] = useState<string | null>(
    null
  );
  const [detail, setDetail] = useState<ChangeSetDetail | null>(null);
  const [selectedFile, setSelectedFile] = useState(0);
  const [viewMode, setViewMode] = useState<ViewMode>("unified");

  const [loadingList, setLoadingList] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [applyResult, setApplyResult] = useState<ApplyResult | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // --- AI Review state ----------------------------------------------------
  const [reviewComments, setReviewComments] = useState<ReviewComment[]>([]);
  const [reviewing, setReviewing] = useState(false);
  const [showReviewPanel, setShowReviewPanel] = useState(false);

  // --- Undo/Revert state -------------------------------------------------
  const [appliedChangesets, setAppliedChangesets] = useState<ChangeSetSummary[]>([]);
  const [revertConfirmId, setRevertConfirmId] = useState<string | null>(null);

  // --- Data loading -------------------------------------------------------

  const loadList = useCallback(async () => {
    if (!projectId) return;
    setLoadingList(true);
    setError(null);
    try {
      const { changesets: rows } = await listChangeSets(
        projectId,
        "PENDING_REVIEW"
      );
      setChangesets(rows);
      setSelectedChangeSetId((prev) => {
        if (prev && rows.some((r) => r.id === prev)) return prev;
        return rows[0]?.id ?? null;
      });
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.message : "Failed to load changesets"
      );
    } finally {
      setLoadingList(false);
    }
  }, [projectId]);

  const loadApplied = useCallback(async () => {
    if (!projectId) return;
    try {
      const { changesets: rows } = await listChangeSets(projectId, "APPLIED");
      setAppliedChangesets(rows);
    } catch {
      /* non-critical */
    }
  }, [projectId]);

  const loadDetail = useCallback(async (id: string) => {
    setLoadingDetail(true);
    setError(null);
    try {
      const { changeSet } = await getChangeSet(id);
      setDetail(changeSet);
      setSelectedFile(0);
      // Load existing review comments
      const { comments } = await listReviewComments(id);
      setReviewComments(comments);
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.message : "Failed to load changeset"
      );
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  useEffect(() => {
    void loadList();
    void loadApplied();
  }, [loadList, loadApplied]);

  useEffect(() => {
    if (selectedChangeSetId) {
      void loadDetail(selectedChangeSetId);
      setApplyResult(null);
      setSuccessMessage(null);
    } else {
      setDetail(null);
      setReviewComments([]);
    }
  }, [selectedChangeSetId, loadDetail]);

  // --- Derived ------------------------------------------------------------

  const files = useMemo(() => detail?.fileChanges ?? [], [detail?.fileChanges]);
  const current: FileChange | undefined = files[selectedFile];

  const fileStats = useMemo(
    () => files.map((f) => diffStat(f.diff)),
    [files]
  );
  const totals = useMemo(
    () =>
      fileStats.reduce(
        (acc, s) => ({
          additions: acc.additions + s.additions,
          deletions: acc.deletions + s.deletions,
        }),
        { additions: 0, deletions: 0 }
      ),
    [fileStats]
  );

  const acceptedCount = files.filter((f) => f.status === "ACCEPTED").length;

  const conflictByFileChangeId = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of applyResult?.conflicts ?? []) {
      map.set(c.fileChangeId, c.reason);
    }
    return map;
  }, [applyResult]);

  const unresolvedCount = reviewComments.filter((c) => !c.resolved).length;

  const fileComments = useMemo(
    () =>
      current
        ? reviewComments.filter((c) => c.filePath === current.filePath)
        : [],
    [reviewComments, current]
  );

  // --- Actions ------------------------------------------------------------

  const handleFileStatus = async (
    fc: FileChange,
    status: "ACCEPTED" | "REJECTED"
  ) => {
    setBusy(true);
    setError(null);
    try {
      const { fileChange } = await updateFileChange(fc.id, status);
      setDetail((prev) =>
        prev
          ? {
              ...prev,
              fileChanges: prev.fileChanges.map((f) =>
                f.id === fileChange.id ? { ...f, status: fileChange.status } : f
              ),
            }
          : prev
      );
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.message : "Failed to update file"
      );
    } finally {
      setBusy(false);
    }
  };

  const handleApply = async (applyAll: boolean) => {
    if (!detail) return;
    setBusy(true);
    setError(null);
    setApplyResult(null);
    setSuccessMessage(null);
    try {
      const result = await applyChangeSet(detail.id, applyAll);
      setApplyResult(result);
      if (result.applied.length > 0) {
        setSuccessMessage(
          `${result.applied.length} file${
            result.applied.length === 1 ? "" : "s"
          } applied.`
        );
      }
      await loadDetail(detail.id);
      if (result.changeSetStatus === "APPLIED") {
        await loadList();
      }
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.message : "Failed to apply changes"
      );
    } finally {
      setBusy(false);
    }
  };

  const handleRejectAll = async () => {
    if (!detail) return;
    if (!window.confirm("Reject all changes in this changeset? This cannot be undone.")) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await rejectChangeSet(detail.id);
      await loadList();
      setDetail(null);
      setSelectedChangeSetId(null);
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.message : "Failed to reject changes"
      );
    } finally {
      setBusy(false);
    }
  };

  const handleRevert = async (changeSetId: string) => {
    setBusy(true);
    setError(null);
    try {
      await revertChangeSet(changeSetId);
      setSuccessMessage("Changeset reverted successfully.");
      setRevertConfirmId(null);
      await loadList();
      await loadApplied();
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.message : "Failed to revert changeset"
      );
    } finally {
      setBusy(false);
    }
  };

  const handleAIReview = async () => {
    if (!detail) return;
    setReviewing(true);
    setError(null);
    try {
      const { comments } = await requestAIReview(detail.id);
      setReviewComments((prev) => [...prev, ...comments]);
      setShowReviewPanel(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "AI review failed"
      );
    } finally {
      setReviewing(false);
    }
  };

  const handleResolveComment = async (commentId: string, currentResolved: boolean) => {
    try {
      const { comment } = await toggleReviewComment(commentId, !currentResolved);
      setReviewComments((prev) =>
        prev.map((c) => (c.id === comment.id ? comment : c))
      );
    } catch {
      // Optimistic toggle fallback
      setReviewComments((prev) =>
        prev.map((c) => (c.id === commentId ? { ...c, resolved: !currentResolved } : c))
      );
    }
  };

  // --- Empty states -------------------------------------------------------

  if (!activeProject) {
    return (
      <EmptyState
        title="No project selected"
        body="Select or create a project to review proposed changes."
      />
    );
  }

  if (loadingList && changesets.length === 0) {
    return (
      <div className="flex h-full items-center justify-center bg-surface text-sm text-text-muted">
        <Loader2 size={16} className="mr-2 animate-spin" /> Loading changes...
      </div>
    );
  }

  if (!loadingList && changesets.length === 0) {
    return (
      <EmptyState
        title="No pending changes"
        body="Ask the AI to generate changes from Chat."
        action={
          <Link
            href="/dashboard/chat"
            className="rounded-lg bg-foreground px-3 py-1.5 text-xs font-medium text-white hover:bg-foreground"
          >
            Go to Chat
          </Link>
        }
      />
    );
  }

  const selectedSummary = changesets.find((c) => c.id === selectedChangeSetId);

  return (
    <div className="flex h-full flex-col bg-surface">
      {/* Top bar */}
      <div className="flex h-11 items-center justify-between border-b border-border px-4">
        <div className="flex items-center gap-3">
          <Sparkles size={16} className="text-accent" />
          <span className="text-sm font-medium text-foreground">Code Review</span>
          {changesets.length > 1 ? (
            <div className="relative">
              <select
                value={selectedChangeSetId ?? ""}
                onChange={(e) => setSelectedChangeSetId(e.target.value)}
                className="appearance-none rounded-lg border border-border bg-surface py-1 pl-2 pr-7 text-xs text-text-secondary hover:bg-surface-soft focus:outline-none"
              >
                {changesets.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={12}
                className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-text-muted"
              />
            </div>
          ) : (
            selectedSummary && (
              <span className="text-sm text-text-secondary">
                {selectedSummary.title}
              </span>
            )
          )}
          <span className="rounded bg-surface-soft px-2 py-0.5 text-[10px] text-text-muted">
            {files.length} files
          </span>
          <span className="text-[10px] text-green-600">+{totals.additions}</span>
          <span className="text-[10px] text-red-500">-{totals.deletions}</span>
          {unresolvedCount > 0 && (
            <span className="flex items-center gap-1 rounded bg-purple-50 px-2 py-0.5 text-[10px] text-purple-600">
              <MessageSquare size={10} /> {unresolvedCount} unresolved
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* AI Review button */}
          <button
            onClick={() => void handleAIReview()}
            disabled={reviewing || !detail}
            className="flex items-center gap-1.5 rounded-lg border border-purple-200 px-3 py-1.5 text-xs font-medium text-purple-600 hover:bg-purple-50 disabled:opacity-50"
          >
            {reviewing ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Sparkles size={12} />
            )}
            AI Review
          </button>

          {/* Review panel toggle */}
          <button
            onClick={() => setShowReviewPanel(!showReviewPanel)}
            className={`flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px] ${
              showReviewPanel
                ? "border-purple-300 bg-purple-50 text-purple-700"
                : "border-border text-text-muted hover:bg-surface-soft"
            }`}
          >
            <MessageSquare size={11} />
            Comments
            {reviewComments.length > 0 && (
              <span className="ml-1 rounded-full bg-purple-100 px-1.5 text-[10px] text-purple-700">
                {reviewComments.length}
              </span>
            )}
          </button>

          {/* View toggle */}
          <div className="flex items-center rounded-lg border border-border p-0.5">
            <button
              onClick={() => setViewMode("unified")}
              className={`flex items-center gap-1 rounded-md px-2 py-1 text-[11px] ${
                viewMode === "unified"
                  ? "bg-foreground text-white"
                  : "text-text-muted hover:bg-surface-soft"
              }`}
            >
              <AlignLeft size={11} /> Unified
            </button>
            <button
              onClick={() => setViewMode("split")}
              className={`flex items-center gap-1 rounded-md px-2 py-1 text-[11px] ${
                viewMode === "split"
                  ? "bg-foreground text-white"
                  : "text-text-muted hover:bg-surface-soft"
              }`}
            >
              <Columns2 size={11} /> Split
            </button>
          </div>

          <button
            onClick={handleRejectAll}
            disabled={busy}
            className="rounded-lg border border-border px-3 py-1.5 text-xs text-text-secondary hover:bg-surface-soft disabled:opacity-50"
          >
            <RotateCcw size={12} className="mr-1.5 inline" />
            Reject all
          </button>
          {acceptedCount > 0 && (
            <button
              onClick={() => handleApply(false)}
              disabled={busy}
              className="rounded-lg border border-border-strong px-3 py-1.5 text-xs font-medium text-foreground hover:bg-surface-soft disabled:opacity-50"
            >
              Apply accepted ({acceptedCount})
            </button>
          )}
          <button
            onClick={() => handleApply(true)}
            disabled={busy}
            className="flex items-center rounded-lg bg-foreground px-3 py-1.5 text-xs font-medium text-white hover:bg-foreground disabled:opacity-50"
          >
            {busy ? (
              <Loader2 size={12} className="mr-1.5 animate-spin" />
            ) : (
              <Check size={12} className="mr-1.5" />
            )}
            Accept all ({files.length})
          </button>
        </div>
      </div>


      {/* Undo last applied changeset */}
      {appliedChangesets.length > 0 && !detail && (
        <div className="flex items-center gap-2 border-b border-border bg-surface-soft px-4 py-2">
          <RotateCcw size={13} className="text-text-muted" />
          <span className="text-xs text-text-secondary">
            {appliedChangesets.length} applied changeset{appliedChangesets.length === 1 ? "" : "s"}
          </span>
          <button
            onClick={() => setRevertConfirmId(appliedChangesets[0].id)}
            disabled={busy}
            className="ml-2 rounded-lg border border-amber-200 px-2.5 py-1 text-[11px] font-medium text-amber-700 hover:bg-amber-50 disabled:opacity-50"
          >
            Undo last change
          </button>
        </div>
      )}

      {/* Revert confirmation dialog */}
      {revertConfirmId && (
        <div className="flex items-center gap-3 border-b border-amber-200 bg-amber-50 px-4 py-2.5">
          <AlertTriangle size={14} className="shrink-0 text-amber-600" />
          <span className="flex-1 text-xs text-amber-800">
            This will revert all changes from this changeset. Are you sure?
          </span>
          <button
            onClick={() => void handleRevert(revertConfirmId)}
            disabled={busy}
            className="rounded-lg bg-amber-600 px-3 py-1 text-[11px] font-medium text-white hover:bg-amber-700 disabled:opacity-50"
          >
            {busy ? "Reverting..." : "Confirm Revert"}
          </button>
          <button
            onClick={() => setRevertConfirmId(null)}
            className="rounded-lg border border-border px-2.5 py-1 text-[11px] text-text-secondary hover:bg-surface-soft"
          >
            Cancel
          </button>
        </div>
      )}
      {/* Banners */}
      {error && (
        <div className="flex items-center gap-2 border-b border-red-200 bg-red-50 px-4 py-2 text-xs text-red-700">
          <AlertTriangle size={13} /> {error}
          <button onClick={() => setError(null)} className="ml-2 underline">
            Dismiss
          </button>
        </div>
      )}
      {successMessage && (
        <div className="flex items-center gap-2 border-b border-green-200 bg-green-50 px-4 py-2 text-xs text-green-700">
          <CheckCircle2 size={13} /> {successMessage}
        </div>
      )}
      {applyResult && applyResult.conflicts.length > 0 && (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800">
          <div className="flex items-center gap-2 font-medium">
            <AlertTriangle size={13} />
            {applyResult.conflicts.length} file
            {applyResult.conflicts.length === 1 ? "" : "s"} skipped due to
            conflicts
          </div>
        </div>
      )}
      {applyResult && applyResult.failures.length > 0 && (
        <div className="border-b border-red-200 bg-red-50 px-4 py-2 text-xs text-red-700">
          <div className="flex items-center gap-2 font-medium">
            <AlertTriangle size={13} />
            {applyResult.failures.length} file
            {applyResult.failures.length === 1 ? "" : "s"} failed to apply
          </div>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* File list */}
        <div className="w-64 shrink-0 overflow-y-auto border-r border-border bg-surface-soft">
          <div className="p-3">
            <div className="flex items-center gap-2 text-xs text-text-muted">
              <GitBranch size={12} />
              <span className="truncate font-medium">
                {activeProject.name}
              </span>
            </div>
          </div>
          <div className="space-y-0.5 px-2 pb-4">
            {files.map((f, i) => {
              const stat = fileStats[i];
              const ct = CHANGE_TYPE_STYLES[f.changeType];
              const conflict = conflictByFileChangeId.get(f.id);
              const commentCount = reviewComments.filter(
                (c) => c.filePath === f.filePath && !c.resolved
              ).length;
              return (
                <button
                  key={f.id}
                  onClick={() => setSelectedFile(i)}
                  className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[13px] transition-colors ${
                    selectedFile === i
                      ? "bg-surface text-foreground shadow-sm"
                      : "text-text-secondary hover:bg-surface-soft"
                  }`}
                >
                  <File size={14} className={ct.icon} />
                  <span className="flex-1 truncate">
                    {f.filePath.split("/").pop()}
                  </span>
                  {conflict && (
                    <AlertTriangle size={12} className="text-amber-500" />
                  )}
                  {commentCount > 0 && (
                    <span className="flex items-center gap-0.5 text-[10px] text-purple-500">
                      <MessageSquare size={10} />
                      {commentCount}
                    </span>
                  )}
                  {f.status === "ACCEPTED" && (
                    <Check size={12} className="text-green-600" />
                  )}
                  {f.status === "REJECTED" && (
                    <X size={12} className="text-red-500" />
                  )}
                  <div className="flex items-center gap-1">
                    {stat.additions > 0 && (
                      <span className="text-[10px] text-green-600">
                        +{stat.additions}
                      </span>
                    )}
                    {stat.deletions > 0 && (
                      <span className="text-[10px] text-red-500">
                        -{stat.deletions}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Diff view + review panel */}
        <div className="flex flex-1 overflow-hidden">
          {/* Main diff area */}
          <div className="flex flex-1 flex-col overflow-hidden">
            {loadingDetail ? (
              <div className="flex flex-1 items-center justify-center text-sm text-text-muted">
                <Loader2 size={16} className="mr-2 animate-spin" /> Loading diff...
              </div>
            ) : !current ? (
              <div className="flex flex-1 items-center justify-center text-sm text-text-muted">
                No file selected
              </div>
            ) : (
              <>
                {/* File header */}
                <div className="flex items-center justify-between border-b border-border bg-surface-soft px-4 py-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <code className="truncate text-sm text-text-secondary">
                      {current.changeType === "RENAME" && current.oldPath
                        ? `${current.oldPath} → ${current.filePath}`
                        : current.filePath}
                    </code>
                    <span
                      className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${
                        CHANGE_TYPE_STYLES[current.changeType].badge
                      }`}
                    >
                      {CHANGE_TYPE_STYLES[current.changeType].label}
                    </span>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {current.status === "ACCEPTED" ? (
                      <span className="flex items-center gap-1 text-xs text-green-600">
                        <Check size={12} /> Accepted
                        <button
                          onClick={() => handleFileStatus(current, "REJECTED")}
                          disabled={busy}
                          className="ml-1 text-text-muted hover:text-text-secondary"
                        >
                          Undo
                        </button>
                      </span>
                    ) : current.status === "REJECTED" ? (
                      <span className="flex items-center gap-1 text-xs text-red-500">
                        <X size={12} /> Rejected
                        <button
                          onClick={() => handleFileStatus(current, "ACCEPTED")}
                          disabled={busy}
                          className="ml-1 text-text-muted hover:text-text-secondary"
                        >
                          Undo
                        </button>
                      </span>
                    ) : (
                      <>
                        <button
                          onClick={() => handleFileStatus(current, "REJECTED")}
                          disabled={busy}
                          className="rounded-lg border border-border px-2.5 py-1 text-[11px] text-text-muted hover:bg-surface-soft disabled:opacity-50"
                        >
                          Reject
                        </button>
                        <button
                          onClick={() => handleFileStatus(current, "ACCEPTED")}
                          disabled={busy}
                          className="rounded-lg bg-foreground px-2.5 py-1 text-[11px] font-medium text-white hover:bg-foreground disabled:opacity-50"
                        >
                          Accept
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Conflict warning for this file */}
                {conflictByFileChangeId.has(current.id) && (
                  <div className="flex items-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800">
                    <AlertTriangle size={13} />
                    {conflictByFileChangeId.get(current.id)} Re-generate or resolve
                    before applying.
                  </div>
                )}

                {/* Diff content */}
                <div className="flex-1 overflow-auto">
                  {viewMode === "unified" ? (
                    <UnifiedDiff file={current} />
                  ) : (
                    <SplitDiff file={current} />
                  )}
                </div>
              </>
            )}
          </div>

          {/* AI Review comments panel */}
          {showReviewPanel && (
            <div className="w-80 shrink-0 overflow-y-auto border-l border-border bg-surface-soft">
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <h3 className="text-[13px] font-semibold text-foreground">
                  AI Review Comments
                </h3>
                <button
                  onClick={() => setShowReviewPanel(false)}
                  className="rounded p-1 text-text-muted hover:bg-surface-soft hover:text-text-secondary"
                >
                  <X size={14} />
                </button>
              </div>
              <div className="space-y-3 p-4">
                {fileComments.length === 0 && (
                  <p className="text-[12px] text-text-muted">
                    {reviewComments.length === 0
                      ? 'No comments yet. Click "AI Review" to generate.'
                      : "No comments for this file."}
                  </p>
                )}
                {fileComments.map((comment) => (
                  <div
                    key={comment.id}
                    className={`rounded-lg border p-3 ${
                      comment.resolved
                        ? "border-border bg-surface"
                        : "border-purple-100 bg-purple-50/30"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-[12px] font-medium text-foreground">
                          {comment.author}
                        </span>
                        <span className="text-[11px] text-text-muted">
                          line {comment.line}
                        </span>
                      </div>
                      <button
                        onClick={() =>
                          void handleResolveComment(comment.id, comment.resolved)
                        }
                        className={`rounded px-2 py-0.5 text-[11px] font-medium ${
                          comment.resolved
                            ? "bg-green-100 text-green-700"
                            : "bg-surface-soft text-text-secondary hover:bg-surface-soft"
                        }`}
                      >
                        {comment.resolved ? "Resolved" : "Resolve"}
                      </button>
                    </div>
                    <p className="mt-1.5 text-[12px] text-text-secondary">
                      {comment.content}
                    </p>
                    {comment.suggestion && (
                      <pre className="mt-2 overflow-x-auto rounded bg-foreground p-2 text-[11px] text-text-muted">
                        {comment.suggestion}
                      </pre>
                    )}
                  </div>
                ))}
                {/* Show all comments link when viewing file-specific */}
                {fileComments.length < reviewComments.length && (
                  <div className="border-t border-border pt-3">
                    <p className="text-[11px] text-text-muted">
                      Showing {fileComments.length} of {reviewComments.length} total
                      comments (filtered to current file)
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Diff renderers                                                             */
/* -------------------------------------------------------------------------- */

function UnifiedDiff({ file }: { file: FileChange }) {
  const lines = useMemo(() => {
    if (file.diff) return parseUnifiedDiff(file.diff);
    // Fallback: synthesize from old/new content.
    const rows = buildSideBySide(file.oldContent, file.newContent);
    return rows.map((r) => ({
      type:
        r.type === "context"
          ? ("context" as const)
          : r.type === "added"
            ? ("added" as const)
            : ("removed" as const),
      content: (r.type === "added" ? r.right.content : r.left.content) ?? "",
      oldLine: r.left.lineNumber,
      newLine: r.right.lineNumber,
    }));
  }, [file]);

  return (
    <div className="font-mono text-[13px]">
      {lines.map((line, i) => {
        if (line.type === "meta") {
          return (
            <div key={i} className="bg-surface-soft px-3 py-0.5 text-[11px] text-text-muted">
              {line.content}
            </div>
          );
        }
        return (
          <div
            key={i}
            className={`flex ${
              line.type === "added"
                ? "bg-green-50"
                : line.type === "removed"
                  ? "bg-red-50"
                  : "bg-surface"
            }`}
          >
            <span className="w-10 shrink-0 select-none px-1 py-0.5 text-right text-xs text-text-muted">
              {line.oldLine ?? ""}
            </span>
            <span className="w-10 shrink-0 select-none px-1 py-0.5 text-right text-xs text-text-muted">
              {line.newLine ?? ""}
            </span>
            <span
              className={`w-5 shrink-0 select-none px-1 py-0.5 text-center text-xs ${
                line.type === "added"
                  ? "text-green-600"
                  : line.type === "removed"
                    ? "text-red-600"
                    : "text-text-muted"
              }`}
            >
              {line.type === "added" ? "+" : line.type === "removed" ? "-" : " "}
            </span>
            <span
              className={`flex-1 whitespace-pre-wrap px-2 py-0.5 ${
                line.type === "added"
                  ? "text-green-800"
                  : line.type === "removed"
                    ? "text-red-800"
                    : "text-text-secondary"
              }`}
            >
              {line.content || "\u00A0"}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function SplitDiff({ file }: { file: FileChange }) {
  const rows = useMemo(
    () => buildSideBySide(file.oldContent, file.newContent),
    [file]
  );

  return (
    <div className="font-mono text-[13px]">
      {rows.map((row, i) => (
        <div key={i} className="flex">
          {/* Left (old) */}
          <div
            className={`flex w-1/2 border-r border-border ${
              row.type === "removed" || row.type === "changed"
                ? "bg-red-50"
                : "bg-surface"
            }`}
          >
            <span className="w-10 shrink-0 select-none px-1 py-0.5 text-right text-xs text-text-muted">
              {row.left.lineNumber ?? ""}
            </span>
            <span
              className={`flex-1 whitespace-pre-wrap px-2 py-0.5 ${
                row.left.content === null
                  ? "bg-surface-soft"
                  : row.type === "removed"
                    ? "text-red-800"
                    : "text-text-secondary"
              }`}
            >
              {row.left.content === null
                ? ""
                : row.left.content || "\u00A0"}
            </span>
          </div>
          {/* Right (new) */}
          <div
            className={`flex w-1/2 ${
              row.type === "added" || row.type === "changed"
                ? "bg-green-50"
                : "bg-surface"
            }`}
          >
            <span className="w-10 shrink-0 select-none px-1 py-0.5 text-right text-xs text-text-muted">
              {row.right.lineNumber ?? ""}
            </span>
            <span
              className={`flex-1 whitespace-pre-wrap px-2 py-0.5 ${
                row.right.content === null
                  ? "bg-surface-soft"
                  : row.type === "added"
                    ? "text-green-800"
                    : "text-text-secondary"
              }`}
            >
              {row.right.content === null
                ? ""
                : row.right.content || "\u00A0"}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Empty state                                                                */
/* -------------------------------------------------------------------------- */

function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center bg-surface px-6 text-center">
      <Sparkles size={28} className="mb-3 text-text-muted" />
      <h2 className="text-sm font-medium text-foreground">{title}</h2>
      <p className="mt-1 max-w-sm text-xs text-text-muted">{body}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
