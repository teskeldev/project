import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  apiSuccess,
  handleApiError,
  requireUser,
  requireProjectAccess,
  validateBody,
  ApiError,
} from "@/lib/api";
import { enforceRateLimit } from "@/lib/rate-limit";

const forkThreadSchema = z.object({
  title: z.string().min(1).max(200).optional(),
});

type RouteContext = { params: Promise<{ threadId: string }> };

// POST /api/chat/threads/:threadId/fork { messageId?: string }
export async function POST(req: Request, ctx: RouteContext) {
  try {
    const { threadId } = await ctx.params;
    const user = await requireUser();

    // 1. Find original thread
    const originalThread = await prisma.chatThread.findUnique({
      where: { id: threadId },
    });
    if (!originalThread) {
      throw new ApiError("Thread not found", 404, "NOT_FOUND");
    }

    // 2. Verify access via project
    await requireProjectAccess(originalThread.projectId);

    await enforceRateLimit(`chat:threads:fork:${user.id}`, 10, 60_000);

    // 3. Parse body for optional title
    const { title } = await validateBody(req, forkThreadSchema);

    // 4. Load all messages (fork from latest)
    const messagesToCopy = await prisma.chatMessage.findMany({
      where: { threadId },
      orderBy: { createdAt: "asc" },
    });

    // 5. Create new thread
    const newThread = await prisma.chatThread.create({
      data: {
        projectId: originalThread.projectId,
        userId: user.id,
        title: title ?? `[Fork] ${originalThread.title}`,
      },
    });

    // 6. Copy messages
    if (messagesToCopy.length > 0) {
      await prisma.chatMessage.createMany({
        data: messagesToCopy.map((m) => ({
          threadId: newThread.id,
          role: m.role,
          content: m.content,
          metadata: m.metadata ?? undefined,
        })),
      });
    }

    // 7. Return the new thread
    const thread = {
      id: newThread.id,
      title: newThread.title,
      projectId: newThread.projectId,
      userId: newThread.userId,
      createdAt: newThread.createdAt.toISOString(),
      updatedAt: newThread.updatedAt.toISOString(),
    };

    return apiSuccess({ thread }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
