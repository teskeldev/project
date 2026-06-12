import { apiFetch } from "@/lib/client/api";

/* -------------------------------------------------------------------------- */
/* Review Comments                                                            */
/* -------------------------------------------------------------------------- */

export type ReviewComment = {
  id: string;
  changeSetId: string;
  filePath: string;
  line: number;
  author: string;
  content: string;
  suggestion: string | null;
  resolved: boolean;
  createdAt: string;
};

/** Trigger an AI review for a changeset. Returns generated comments. */
export function requestAIReview(
  changeSetId: string
): Promise<{ comments: ReviewComment[] }> {
  return apiFetch("/api/ai/review", {
    method: "POST",
    body: JSON.stringify({ changeSetId }),
  });
}

/** Toggle the resolved state of a review comment. */
export function toggleReviewComment(
  commentId: string,
  resolved: boolean
): Promise<{ comment: ReviewComment }> {
  return apiFetch(`/api/review-comments/${commentId}`, {
    method: "PATCH",
    body: JSON.stringify({ resolved }),
  });
}

/** Fetch all review comments for a changeset. */
export function listReviewComments(
  changeSetId: string
): Promise<{ comments: ReviewComment[] }> {
  return apiFetch(`/api/ai/review?changeSetId=${encodeURIComponent(changeSetId)}`);
}
