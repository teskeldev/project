import { prisma } from "@/lib/db";
import {
  apiSuccess,
  handleApiError,
  requireProjectAccess,
  requireRole,
  validateBody,
  ApiError,
} from "@/lib/api";
import { updateFileChangeSchema } from "@/lib/validators";

type RouteContext = { params: Promise<{ fileChangeId: string }> };

// PATCH /api/file-changes/:fileChangeId
// Body: { status: "ACCEPTED" | "REJECTED" }
// Toggles a single file change's review status. Access verified via the parent
// changeset's project.
export async function PATCH(req: Request, ctx: RouteContext) {
  try {
    const { fileChangeId } = await ctx.params;
    const { status } = await validateBody(req, updateFileChangeSchema);

    const existing = await prisma.fileChange.findUnique({
      where: { id: fileChangeId },
      include: { changeSet: { select: { projectId: true, status: true } } },
    });
    if (!existing) {
      throw new ApiError("File change not found", 404, "NOT_FOUND");
    }

    const { member } = await requireProjectAccess(existing.changeSet.projectId);
    requireRole(member);

    if (existing.changeSet.status === "APPLIED") {
      throw new ApiError(
        "This changeset has already been applied",
        409,
        "ALREADY_APPLIED"
      );
    }

    const fileChange = await prisma.fileChange.update({
      where: { id: fileChangeId },
      data: { status },
    });

    return apiSuccess({ fileChange });
  } catch (err) {
    return handleApiError(err);
  }
}