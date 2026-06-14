import { prisma } from "@/lib/db";
import {
  apiSuccess,
  handleApiError,
  requireProjectAccess,
  validateBody,
} from "@/lib/api";
import { createThreadSchema } from "@/lib/validators";
import { enforceRateLimit } from "@/lib/rate-limit";

type RouteContext = { params: Promise<{ projectId: string }> };

// GET /api/projects/:projectId/chat/threads -> threads for project, newest first.
export async function GET(_req: Request, ctx: RouteContext) {
  try {
    const { projectId } = await ctx.params;
    await requireProjectAccess(projectId);

    const threads = await prisma.chatThread.findMany({
      where: { projectId },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        title: true,
        projectId: true,
        userId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return apiSuccess({ threads });
  } catch (err) {
    return handleApiError(err);
  }
}

// POST /api/projects/:projectId/chat/threads -> create a thread.
export async function POST(req: Request, ctx: RouteContext) {
  try {
    const { projectId } = await ctx.params;
    const { user } = await requireProjectAccess(projectId);
    await enforceRateLimit(`chat:threads:create:${user.id}`, 30, 60_000);
    const { title } = await validateBody(req, createThreadSchema);

    const thread = await prisma.chatThread.create({
      data: {
        projectId,
        userId: user.id,
        title: title ?? "New chat",
      },
    });

    return apiSuccess({ thread }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
