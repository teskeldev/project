"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  GitPullRequest,
  MessageSquare,
  Check,
  X,
  ChevronDown,
  Plus,
  Minus,
  Loader2,
  Sparkles,
  FolderOpen,
} from "lucide-react";
import { useProject } from "@/lib/store/project";
import {
  listChangeSets,
  getChangeSet,
  applyChangeSet,
  rejectChangeSet,
  type ChangeSetSummary,
  type ChangeSetDetail,
} from "@/lib/client/api";
import {
  requestAIReview,
  toggleReviewComment,
  listReviewComments,
  type ReviewComment,
} from "@/lib/client/review";
import { parseUnifiedDiff, diffStat, type ParsedDiffLine } from "@/lib/diff";

export default function ReviewPage() {
  const { activeProject } = useProject();

  const [changesets, setChangesets] = useState<ChangeSetSummary[]>([]);
  const [selectedChangeset, setSelectedChangeset] = useState<ChangeSetDetail | null>(null);
  const [activeFilePath, setActiveFilePath] = useState<string | null>(null);
  const [reviewComments, setReviewComments] = useState<ReviewComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [applying, setApplying] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedRef = useRef(selectedChangeset);
  useEffect(() => { selectedRef.current = selectedChangeset; }, [selectedChangeset]);

  const loadChangesetDetail = useCallback(async (id: string) => {
    setLoadingDetail(true);
    try {
      const { changeSet } = await getChangeSet(id);
      setSelectedChangeset(changeSet);
      if (changeSet.fileChanges.length > 0) {
        setActiveFilePath(changeSet.fileChanges[0].filePath);
      }
      // Load existing comments
      const { comments } = await listReviewComments(id);
      setReviewComments(comments);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load changeset");
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  // Fetch pending changesets
  const fetchChangesets = useCallback(async () => {
    if (!activeProject) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { changesets: cs } = await listChangeSets(activeProject.id, "PENDING_REVIEW");
      setChangesets(cs);
      // Auto-select the most recent one if nothing selected
      if (cs.length > 0 && !selectedRef.current) {
        await loadChangesetDetail(cs[0].id);
      } else if (cs.length === 0) {
        setSelectedChangeset(null);
        setActiveFilePath(null);
        setReviewComments([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load changesets");
    } finally {
      setLoading(false);
    }
  }, [activeProject, loadChangesetDetail]);

  useEffect(() => {
    void fetchChangesets();
  }, [fetchChangesets]);

  const handleAIReview = async () => {
    if (!selectedChangeset) return;
    setReviewing(true);
    try {
      const { comments } = await requestAIReview(selectedChangeset.id);
      setReviewComments((prev) => [...prev, ...comments]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI review failed");
    } finally {
      setReviewing(false);
    }
  };

  const handleResolve = async (commentId: string, currentResolved: boolean) => {
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

  const handleApprove = async () => {
    if (!selectedChangeset) return;
    setApplying(true);
    try {
      await applyChangeSet(selectedChangeset.id, true);
      setSelectedChangeset(null);
      setActiveFilePath(null);
      setReviewComments([]);
      await fetchChangesets();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Apply failed");
    } finally {
      setApplying(false);
    }
  };

  const handleReject = async () => {
    if (!selectedChangeset) return;
    setRejecting(true);
    try {
      await rejectChangeSet(selectedChangeset.id);
      setSelectedChangeset(null);
      setActiveFilePath(null);
      setReviewComments([]);
      await fetchChangesets();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reject failed");
    } finally {
      setRejecting(false);
    }
  };

  // No active project
  if (!activeProject) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <FolderOpen size={48} className="mx-auto mb-4 text-gray-300" />
          <h2 className="text-lg font-medium text-gray-700">No active project</h2>
          <p className="mt-1 text-sm text-gray-500">
            Select a project from the{" "}
            <Link href="/dashboard/projects" className="text-blue-600 hover:underline">
              projects page
            </Link>
          </p>
        </div>
      </div>
    );
  }

  // Loading
  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 size={24} className="animate-spin text-gray-400" />
      </div>
    );
  }

  // Empty state
  if (changesets.length === 0 && !selectedChangeset) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <GitPullRequest size={48} className="mx-auto mb-4 text-gray-300" />
          <h2 className="text-lg font-medium text-gray-700">No pending changes to review</h2>
          <p className="mt-1 text-sm text-gray-500">
            Generate changes from the{" "}
            <Link href="/dashboard/chat" className="text-blue-600 hover:underline">
              chat page
            </Link>
          </p>
        </div>
      </div>
    );
  }

  const activeFileChange = selectedChangeset?.fileChanges.find(
    (fc) => fc.filePath === activeFilePath
  ) ?? null;

  const diffLines = activeFileChange ? parseUnifiedDiff(activeFileChange.diff) : [];
  const fileComments = reviewComments.filter((c) => c.filePath === activeFilePath);

  const totalAdditions = selectedChangeset?.fileChanges.reduce((sum, fc) => {
    const s = diffStat(fc.diff);
    return sum + s.additions;
  }, 0) ?? 0;

  const totalDeletions = selectedChangeset?.fileChanges.reduce((sum, fc) => {
    const s = diffStat(fc.diff);
    return sum + s.deletions;
  }, 0) ?? 0;

  return (
    <div className="flex h-full">
      {/* File tree */}
      <div className="w-[300px] border-r border-gray-100">
        <div className="border-b border-gray-100 p-4">
          <div className="flex items-center gap-2">
            <GitPullRequest size={16} className="text-green-600" />
            <h1 className="text-[14px] font-semibold text-gray-900 truncate">
              {selectedChangeset?.title ?? "Review"}
            </h1>
          </div>
          {selectedChangeset?.description && (
            <p className="mt-1 text-[12px] text-gray-500 truncate">
              {selectedChangeset.description}
            </p>
          )}
          {/* Changeset selector if multiple */}
          {changesets.length > 1 && (
            <select
              className="mt-2 w-full rounded border border-gray-200 px-2 py-1 text-[11px] text-gray-700"
              value={selectedChangeset?.id ?? ""}
              onChange={(e) => void loadChangesetDetail(e.target.value)}
            >
              {changesets.map((cs) => (
                <option key={cs.id} value={cs.id}>
                  {cs.title}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 border-b border-gray-100 px-4 py-3">
          <span className="flex items-center gap-1 text-[12px] text-green-600">
            <Plus size={12} />
            {totalAdditions}
          </span>
          <span className="flex items-center gap-1 text-[12px] text-red-500">
            <Minus size={12} />
            {totalDeletions}
          </span>
          <span className="flex items-center gap-1 text-[12px] text-gray-500">
            <MessageSquare size={12} />
            {reviewComments.filter((c) => !c.resolved).length} unresolved
          </span>
        </div>

        {/* Files */}
        <div className="p-2">
          {loadingDetail ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={16} className="animate-spin text-gray-400" />
            </div>
          ) : (
            selectedChangeset?.fileChanges.map((file) => {
              const stat = diffStat(file.diff);
              return (
                <button
                  key={file.id}
                  onClick={() => setActiveFilePath(file.filePath)}
                  className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[12px] transition-colors ${
                    activeFilePath === file.filePath
                      ? "bg-blue-50 text-blue-700"
                      : "text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  <span
                    className={`h-2 w-2 rounded-full ${
                      file.changeType === "CREATE"
                        ? "bg-green-500"
                        : file.changeType === "DELETE"
                        ? "bg-red-500"
                        : "bg-yellow-500"
                    }`}
                  />
                  <span className="flex-1 truncate font-mono">
                    {file.filePath.split("/").pop()}
                  </span>
                  <span className="text-[10px] text-gray-400">
                    +{stat.additions} -{stat.deletions}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Diff view */}
      <div className="flex flex-1 flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-3">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[13px] text-gray-700">
              {activeFilePath ?? "Select a file"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => void handleAIReview()}
              disabled={reviewing}
              className="flex items-center gap-1.5 rounded-md border border-purple-200 px-3 py-1.5 text-[12px] font-medium text-purple-600 hover:bg-purple-50 disabled:opacity-50"
            >
              {reviewing ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Sparkles size={12} />
              )}
              AI Review
            </button>
            <button className="rounded-md border border-gray-200 px-3 py-1.5 text-[12px] font-medium text-gray-600 hover:bg-gray-50">
              Unified
              <ChevronDown size={12} className="ml-1 inline" />
            </button>
            <button
              onClick={() => void handleApprove()}
              disabled={applying}
              className="flex items-center gap-1.5 rounded-md bg-green-600 px-3 py-1.5 text-[12px] font-medium text-white hover:bg-green-700 disabled:opacity-50"
            >
              {applying ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
              Approve
            </button>
            <button
              onClick={() => void handleReject()}
              disabled={rejecting}
              className="flex items-center gap-1.5 rounded-md border border-red-200 px-3 py-1.5 text-[12px] font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              {rejecting ? <Loader2 size={12} className="animate-spin" /> : <X size={12} />}
              Request Changes
            </button>
          </div>
        </div>

        {/* Error banner */}
        {error && (
          <div className="border-b border-red-100 bg-red-50 px-6 py-2 text-[12px] text-red-700">
            {error}
            <button onClick={() => setError(null)} className="ml-2 underline">
              Dismiss
            </button>
          </div>
        )}

        {/* Diff content */}
        <div className="flex-1 overflow-auto">
          <div className="font-mono text-[12px]">
            {diffLines.length === 0 && activeFileChange && (
              <div className="px-6 py-8 text-center text-gray-400 text-[12px]">
                No diff available for this file
              </div>
            )}
            {diffLines.map((line, idx) => (
              <DiffLine key={idx} line={line} />
            ))}
          </div>
        </div>

        {/* Comments panel */}
        <div className="border-t border-gray-100">
          <div className="px-6 py-3">
            <h3 className="text-[13px] font-semibold text-gray-900">AI Review Comments</h3>
          </div>
          <div className="max-h-[200px] space-y-3 overflow-auto px-6 pb-4">
            {fileComments.length === 0 && (
              <p className="text-[12px] text-gray-400">
                No comments for this file. Click &quot;AI Review&quot; to generate.
              </p>
            )}
            {fileComments.map((comment) => (
              <div
                key={comment.id}
                className={`rounded-lg border p-3 ${
                  comment.resolved
                    ? "border-gray-100 bg-gray-50"
                    : "border-blue-100 bg-blue-50/30"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] font-medium text-gray-900">
                      {comment.author}
                    </span>
                    <span className="text-[11px] text-gray-400">line {comment.line}</span>
                  </div>
                  <button
                    onClick={() => void handleResolve(comment.id, comment.resolved)}
                    className={`rounded px-2 py-0.5 text-[11px] font-medium ${
                      comment.resolved
                        ? "bg-green-100 text-green-700"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {comment.resolved ? "Resolved" : "Resolve"}
                  </button>
                </div>
                <p className="mt-1.5 text-[12px] text-gray-600">{comment.content}</p>
                {comment.suggestion && (
                  <pre className="mt-2 rounded bg-gray-900 p-2 text-[11px] text-gray-300">
                    {comment.suggestion}
                  </pre>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function DiffLine({ line }: { line: ParsedDiffLine }) {
  const bg =
    line.type === "added"
      ? "bg-green-50"
      : line.type === "removed"
      ? "bg-red-50"
      : "";
  const textColor =
    line.type === "added"
      ? "text-green-800"
      : line.type === "removed"
      ? "text-red-800"
      : line.type === "meta"
      ? "text-gray-500"
      : "text-gray-700";
  const prefix =
    line.type === "added"
      ? "+"
      : line.type === "removed"
      ? "-"
      : line.type === "meta"
      ? ""
      : " ";
  const prefixColor =
    line.type === "added"
      ? "text-green-600"
      : line.type === "removed"
      ? "text-red-500"
      : "text-gray-400";

  const lineNum = line.newLine ?? line.oldLine;

  return (
    <div className={`flex ${bg} border-b border-gray-50`}>
      <span className="w-12 shrink-0 px-2 py-0.5 text-right text-[11px] text-gray-400">
        {lineNum ?? ""}
      </span>
      <span className={`w-5 shrink-0 text-center py-0.5 ${prefixColor}`}>{prefix}</span>
      <span className={`flex-1 px-2 py-0.5 ${textColor}`}>
        {line.content || "\u00A0"}
      </span>
    </div>
  );
}
