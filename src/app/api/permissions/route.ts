import {
  apiSuccess,
  handleApiError,
  requireUser,
  ApiError,
} from "@/lib/api";
import { prisma } from "@/lib/db";
import {
  listPermissions,
  createPermission,
  type AITool,
} from "@/lib/ai/permissions";
import { z } from "zod";
import { enforceRateLimit } from "@/lib/rate-limit";

const createPermissionSchema = z.object({
  workspaceId: z.string().min(1, "workspaceId is required"),
  tool: z.enum([
    "file_edit",
    "file_delete",
    "file_create",
    "terminal",
    "git_commit",
    "git_push",
    "agent_run",
    "changeset_apply",
    "web_fetch",
    "search",
  ]),
  pattern: z.string().min(1).default("*"),
  action: z.enum(["ALLOW", "ASK", "DENY"]),
});

// GET /api/permissions?workspaceId=...
export async function GET(req: Request) {
  try {
    const user = await requireUser();

    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get("workspaceId");

    if (!workspaceId) {
      throw new ApiError("workspaceId query param is required", 400, "MISSING_PARAM");
    }

    // Verify user has access to this workspace
    const member = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: { workspaceId, userId: user.id },
      },
    });
    if (!member) {
      throw new ApiError("Access denied", 403, "FORBIDDEN");
    }

    const permissions = await listPermissions(workspaceId);
    return apiSuccess({ permissions });
  } catch (err) {
    return handleApiError(err);
  }
}

// POST /api/permissions
export async function POST(req: Request) {
  try {
    const user = await requireUser();

    let json: unknown;
    try {
      json = await req.json();
    } catch {
      throw new ApiError("Invalid JSON body", 400, "INVALID_JSON");
    }

    const result = createPermissionSchema.safeParse(json);
    if (!result.success) {
      throw new ApiError(
        "Validation failed",
        422,
        "VALIDATION_ERROR",
        result.error.flatten()
      );
    }

    const { workspaceId, tool, pattern, action } = result.data;

    await enforceRateLimit(`permissions:create:${workspaceId}`, 20, 60_000);

    // Verify user has access to this workspace
    const member = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: { workspaceId, userId: user.id },
      },
    });
    if (!member) {
      throw new ApiError("Access denied", 403, "FORBIDDEN");
    }

    // Only OWNER/ADMIN can manage permissions
    if (member.role !== "OWNER" && member.role !== "ADMIN") {
      throw new ApiError(
        "Only workspace owners and admins can manage permissions",
        403,
        "INSUFFICIENT_ROLE"
      );
    }

    const permission = await createPermission(workspaceId, {
      tool: tool as AITool,
      pattern,
      action,
    });

    return apiSuccess({ permission }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
