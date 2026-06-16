import {
  apiSuccess,
  handleApiError,
  requireUser,
  ApiError,
} from "@/lib/api";
import { prisma } from "@/lib/db";
import { updatePermission, deletePermission } from "@/lib/ai/permissions";
import { z } from "zod";

type RouteContext = { params: Promise<{ id: string }> };

const updatePermissionSchema = z.object({
  action: z.enum(["ALLOW", "ASK", "DENY"]),
});

// PATCH /api/permissions/:id
export async function PATCH(req: Request, ctx: RouteContext) {
  try {
    const { id } = await ctx.params;
    const user = await requireUser();

    const permission = await prisma.aIPermission.findUnique({
      where: { id },
    });
    if (!permission) {
      throw new ApiError("Permission rule not found", 404, "NOT_FOUND");
    }

    // Verify user has access
    const member = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: permission.workspaceId,
          userId: user.id,
        },
      },
    });
    if (!member) {
      throw new ApiError("Access denied", 403, "FORBIDDEN");
    }
    if (member.role !== "OWNER" && member.role !== "ADMIN") {
      throw new ApiError(
        "Only workspace owners and admins can manage permissions",
        403,
        "INSUFFICIENT_ROLE"
      );
    }

    let json: unknown;
    try {
      json = await req.json();
    } catch {
      throw new ApiError("Invalid JSON body", 400, "INVALID_JSON");
    }

    const result = updatePermissionSchema.safeParse(json);
    if (!result.success) {
      throw new ApiError(
        "Validation failed",
        422,
        "VALIDATION_ERROR",
        result.error.flatten()
      );
    }

    const updated = await updatePermission(id, { action: result.data.action });
    return apiSuccess({ permission: updated });
  } catch (err) {
    return handleApiError(err);
  }
}

// DELETE /api/permissions/:id
export async function DELETE(req: Request, ctx: RouteContext) {
  try {
    const { id } = await ctx.params;
    const user = await requireUser();

    const permission = await prisma.aIPermission.findUnique({
      where: { id },
    });
    if (!permission) {
      throw new ApiError("Permission rule not found", 404, "NOT_FOUND");
    }

    // Verify user has access
    const member = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: permission.workspaceId,
          userId: user.id,
        },
      },
    });
    if (!member) {
      throw new ApiError("Access denied", 403, "FORBIDDEN");
    }
    if (member.role !== "OWNER" && member.role !== "ADMIN") {
      throw new ApiError(
        "Only workspace owners and admins can manage permissions",
        403,
        "INSUFFICIENT_ROLE"
      );
    }

    await deletePermission(id);
    return apiSuccess({ deleted: true });
  } catch (err) {
    return handleApiError(err);
  }
}
