import { z } from "zod";
import { prisma } from "@/lib/db";
import { apiSuccess, handleApiError, requireUser, requireProjectAccess, validateBody, ApiError } from "@/lib/api";

const updateReviewCommentSchema = z.object({
  resolved: z.boolean(),
  body: z.string().max(2000).optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

// PATCH /api/review-comments/:id
// Body: { resolved: boolean }
// Toggles the resolved state of a review comment.
export async function PATCH(req: Request, ctx: RouteContext) {
  try {
    await requireUser();
    const { id } = await ctx.params;

    const { resolved, body: commentBody } = await validateBody(req, updateReviewCommentSchema);

    const existing = await prisma.reviewComment.findUnique({
      where: { id },
      include: { changeSet: { select: { projectId: true } } },
    });

    if (!existing) {
      throw new ApiError("Review comment not found", 404, "NOT_FOUND");
    }

    // Verify the user has access to the project that owns this review comment
    await requireProjectAccess(existing.changeSet.projectId);

    const updateData: { resolved: boolean; content?: string } = { resolved };
    if (commentBody !== undefined) {
      updateData.content = commentBody;
    }

    const updated = await prisma.reviewComment.update({
      where: { id },
      data: updateData,
    });

    return apiSuccess({
      comment: {
        id: updated.id,
        changeSetId: updated.changeSetId,
        filePath: updated.filePath,
        line: updated.line,
        author: updated.author,
        content: updated.content,
        suggestion: updated.suggestion,
        resolved: updated.resolved,
        createdAt: updated.createdAt.toISOString(),
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
