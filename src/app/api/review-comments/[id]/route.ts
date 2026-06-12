import { prisma } from "@/lib/db";
import { apiSuccess, handleApiError, requireUser, ApiError } from "@/lib/api";

type RouteContext = { params: Promise<{ id: string }> };

// PATCH /api/review-comments/:id
// Body: { resolved: boolean }
// Toggles the resolved state of a review comment.
export async function PATCH(req: Request, ctx: RouteContext) {
  try {
    await requireUser();
    const { id } = await ctx.params;

    let body: { resolved?: boolean };
    try {
      body = (await req.json()) as { resolved?: boolean };
    } catch {
      throw new ApiError("Invalid JSON body", 400, "INVALID_JSON");
    }

    if (typeof body.resolved !== "boolean") {
      throw new ApiError("resolved (boolean) is required", 400, "MISSING_FIELD");
    }

    const existing = await prisma.reviewComment.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existing) {
      throw new ApiError("Review comment not found", 404, "NOT_FOUND");
    }

    const updated = await prisma.reviewComment.update({
      where: { id },
      data: { resolved: body.resolved },
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
