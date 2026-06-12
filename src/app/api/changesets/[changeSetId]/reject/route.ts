import { prisma } from "@/lib/db";
import {
  apiSuccess,
  handleApiError,
  requireProjectAccess,
  ApiError,
} from "@/lib/api";

type RouteContext = { params: Promise<{ changeSetId: string }> };

// POST /api/changesets/:changeSetId/reject
// Sets ChangeSet.status = REJECTED and all its PENDING file changes to REJECTED.
export async function POST(_req: Request, ctx: RouteContext) {
  try {
    const { changeSetId } = await ctx.params;

    const changeSet = await prisma.changeSet.findUnique({
      where: { id: changeSetId },
      select: { id: true, projectId: true, status: true },
    });
    if (!changeSet) {
      throw new ApiError("Changeset not found", 404, "NOT_FOUND");
    }

    await requireProjectAccess(changeSet.projectId);

    if (changeSet.status === "APPLIED") {
      throw new ApiError(
        "This changeset has already been applied",
        409,
        "ALREADY_APPLIED"
      );
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.fileChange.updateMany({
        where: { changeSetId, status: "PENDING" },
        data: { status: "REJECTED" },
      });
      return tx.changeSet.update({
        where: { id: changeSetId },
        data: { status: "REJECTED" },
        include: { fileChanges: true },
      });
    });

    return apiSuccess({ changeSet: updated });
  } catch (err) {
    return handleApiError(err);
  }
}