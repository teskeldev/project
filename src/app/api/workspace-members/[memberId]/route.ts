import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  ApiError,
  apiSuccess,
  handleApiError,
  requireUser,
  validateBody,
} from "@/lib/api";

const updateRoleSchema = z.object({
  role: z.enum(["OWNER", "ADMIN", "MEMBER", "VIEWER"]),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ memberId: string }> }
) {
  try {
    const user = await requireUser();
    const { memberId } = await params;
    const { role } = await validateBody(req, updateRoleSchema);

    // Get the target member
    const target = await prisma.workspaceMember.findUnique({
      where: { id: memberId },
    });

    if (!target) {
      throw new ApiError("Member not found", 404, "NOT_FOUND");
    }

    // Verify the current user is OWNER or ADMIN in the same workspace
    const currentMember = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: target.workspaceId,
          userId: user.id,
        },
      },
    });

    if (!currentMember || !["OWNER", "ADMIN"].includes(currentMember.role)) {
      throw new ApiError(
        "Only owners and admins can change roles",
        403,
        "FORBIDDEN"
      );
    }

    // Can't demote the last OWNER
    if (target.role === "OWNER" && role !== "OWNER") {
      const ownerCount = await prisma.workspaceMember.count({
        where: { workspaceId: target.workspaceId, role: "OWNER" },
      });
      if (ownerCount <= 1) {
        throw new ApiError(
          "Cannot demote the last owner",
          400,
          "LAST_OWNER"
        );
      }
    }

    const updated = await prisma.workspaceMember.update({
      where: { id: memberId },
      data: { role },
      include: {
        user: { select: { id: true, name: true, email: true, image: true } },
      },
    });

    return apiSuccess({
      member: {
        id: updated.id,
        userId: updated.user.id,
        name: updated.user.name,
        email: updated.user.email,
        image: updated.user.image,
        role: updated.role,
        createdAt: updated.createdAt,
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ memberId: string }> }
) {
  try {
    const user = await requireUser();
    const { memberId } = await params;

    const target = await prisma.workspaceMember.findUnique({
      where: { id: memberId },
    });

    if (!target) {
      throw new ApiError("Member not found", 404, "NOT_FOUND");
    }

    // Verify the current user is OWNER or ADMIN in the same workspace
    const currentMember = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: target.workspaceId,
          userId: user.id,
        },
      },
    });

    if (!currentMember || !["OWNER", "ADMIN"].includes(currentMember.role)) {
      throw new ApiError(
        "Only owners and admins can remove members",
        403,
        "FORBIDDEN"
      );
    }

    // Can't remove self if last OWNER
    if (target.userId === user.id && target.role === "OWNER") {
      const ownerCount = await prisma.workspaceMember.count({
        where: { workspaceId: target.workspaceId, role: "OWNER" },
      });
      if (ownerCount <= 1) {
        throw new ApiError(
          "Cannot remove yourself as the last owner",
          400,
          "LAST_OWNER"
        );
      }
    }

    await prisma.workspaceMember.delete({ where: { id: memberId } });

    return apiSuccess({ deleted: true, id: memberId });
  } catch (err) {
    return handleApiError(err);
  }
}
