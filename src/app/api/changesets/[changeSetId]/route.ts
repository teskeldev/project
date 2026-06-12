import { prisma } from "@/lib/db";
import {
  apiSuccess,
  handleApiError,
  requireProjectAccess,
  ApiError,
} from "@/lib/api";

type RouteContext = { params: Promise<{ changeSetId: string }> };

// GET /api/changesets/:changeSetId
// Full changeset with all fileChanges. Access verified via the changeset's
// project (workspace membership).
export async function GET(_req: Request, ctx: RouteContext) {
  try {
    const { changeSetId } = await ctx.params;

    const changeSet = await prisma.changeSet.findUnique({
      where: { id: changeSetId },
      include: {
        fileChanges: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            filePath: true,
            oldPath: true,
            changeType: true,
            oldContent: true,
            newContent: true,
            diff: true,
            status: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });

    if (!changeSet) {
      throw new ApiError("Changeset not found", 404, "NOT_FOUND");
    }

    // Authorize via the owning project.
    await requireProjectAccess(changeSet.projectId);

    return apiSuccess({ changeSet });
  } catch (err) {
    return handleApiError(err);
  }
}