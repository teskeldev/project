import { prisma } from "@/lib/db";
import {
  apiSuccess,
  handleApiError,
  requireProjectAccess,
  validateBody,
  ApiError,
} from "@/lib/api";
import { createMessageSchema } from "@/lib/validators";

type RouteContext = { params: Promise<{ threadId: string }> };

/** Load a thread (with its projectId) or throw 404. */
async function loadThread(threadId: string) {
  const thread = await prisma.chatThread.findUnique({
    where: { id: threadId },
    select: { id: true, projectId: true },
  });
  if (!thread) {
    throw new ApiError("Thread not found", 404, "NOT_FOUND");
  }
  return thread;
}

// GET /api/chat/threads/:threadId/messages -> messages, oldest first.
export async function GET(_req: Request, ctx: RouteContext) {
  try {
    const { threadId } = await ctx.params;
    const thread = await loadThread(threadId);
    // Access is gated by the thread's project.
    await requireProjectAccess(thread.projectId);

    const messages = await prisma.chatMessage.findMany({
      where: { threadId },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        threadId: true,
        role: true,
        content: true,
        metadata: true,
        createdAt: true,
      },
    });

    return apiSuccess({ messages });
  } catch (err) {
    return handleApiError(err);
  }
}

// POST /api/chat/threads/:threadId/messages -> append a USER message.
export async function POST(req: Request, ctx: RouteContext) {
  try {
    const { threadId } = await ctx.params;
    const thread = await loadThread(threadId);
    await requireProjectAccess(thread.projectId);

    const { content } = await validateBody(req, createMessageSchema);

    const message = await prisma.chatMessage.create({
      data: { threadId, role: "USER", content },
    });

    // Bump the thread so it sorts to the top of the list.
    await prisma.chatThread.update({
      where: { id: threadId },
      data: { updatedAt: new Date() },
    });

    return apiSuccess({ message }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}


