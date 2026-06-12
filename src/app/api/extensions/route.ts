import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  apiSuccess,
  handleApiError,
  requireUser,
  validateBody,
  ApiError,
} from "@/lib/api";

// GET /api/extensions?workspaceId=
export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const url = new URL(req.url);
    const workspaceId = url.searchParams.get("workspaceId");

    if (!workspaceId) {
      throw new ApiError("workspaceId query parameter is required", 400, "MISSING_PARAM");
    }

    // Verify workspace membership
    const member = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId: user.id,
        },
      },
    });

    if (!member) {
      throw new ApiError("You do not have access to this workspace", 403, "FORBIDDEN");
    }

    const extensions = await prisma.extension.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
    });

    return apiSuccess({ extensions });
  } catch (err) {
    return handleApiError(err);
  }
}

const installSchema = z.object({
  workspaceId: z.string().min(1),
  registryId: z.string().min(1),
  name: z.string().min(1).max(200),
  author: z.string().min(1).max(200),
  version: z.string().min(1).max(50),
});

// POST /api/extensions - install an extension
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = await validateBody(req, installSchema);

    // Verify workspace membership
    const member = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: body.workspaceId,
          userId: user.id,
        },
      },
    });

    if (!member) {
      throw new ApiError("You do not have access to this workspace", 403, "FORBIDDEN");
    }

    const extension = await prisma.extension.create({
      data: {
        workspaceId: body.workspaceId,
        registryId: body.registryId,
        name: body.name,
        author: body.author,
        version: body.version,
      },
    });

    return apiSuccess({ extension }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
