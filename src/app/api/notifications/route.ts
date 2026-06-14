import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  apiSuccess,
  handleApiError,
  requireUser,
  validateBody,
  NO_STORE_HEADERS,
} from "@/lib/api";

// GET /api/notifications?read=true|false&limit=20&offset=0
// List notifications for the current user (paginated, filter by read/unread).
export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(req.url);

    const readParam = searchParams.get("read");
    const parsedLimit = Number.parseInt(searchParams.get("limit") ?? "20", 10);
    const limit = Number.isFinite(parsedLimit)
      ? Math.min(Math.max(parsedLimit, 1), 100)
      : 20;
    const parsedOffset = Number.parseInt(searchParams.get("offset") ?? "0", 10);
    const offset = Number.isFinite(parsedOffset) ? Math.max(parsedOffset, 0) : 0;

    const where: { userId: string; read?: boolean } = { userId: user.id };
    if (readParam === "true") where.read = true;
    if (readParam === "false") where.read = false;

    const [notifications, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({ where: { userId: user.id, read: false } }),
    ]);

    const safeNotifications = notifications.map((n) => {
      const result = notificationMetadataSchema.safeParse(n.metadata ?? {});
      return {
        ...n,
        metadata: result.success ? result.data : null,
      };
    });

    return apiSuccess(
      { notifications: safeNotifications, total, unreadCount },
      { headers: NO_STORE_HEADERS }
    );
  } catch (err) {
    return handleApiError(err);
  }
}

const markReadSchema = z.object({
  ids: z.array(z.string()).optional(),
  all: z.boolean().optional(),
}).refine((v) => v.all || (v.ids && v.ids.length > 0), {
  message: "Provide either 'ids' array or 'all: true'",
});

const notificationMetadataSchema = z.object({
  changeSetId: z.string().max(500).optional(),
  threadId: z.string().max(500).optional(),
  agentRunId: z.string().max(500).optional(),
  url: z.string().max(500).optional(),
});

// PATCH /api/notifications
// Mark notification(s) as read.
export async function PATCH(req: Request) {
  try {
    const user = await requireUser();
    const { ids, all } = await validateBody(req, markReadSchema);

    let updated: number;

    if (all) {
      const result = await prisma.notification.updateMany({
        where: { userId: user.id, read: false },
        data: { read: true },
      });
      updated = result.count;
    } else {
      const result = await prisma.notification.updateMany({
        where: { id: { in: ids! }, userId: user.id },
        data: { read: true },
      });
      updated = result.count;
    }

    return apiSuccess({ updated });
  } catch (err) {
    return handleApiError(err);
  }
}
