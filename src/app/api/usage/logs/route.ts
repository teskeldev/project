/**
 * GET  /api/usage/logs?workspaceId=...&page=1&limit=50&provider=...&status=...
 * POST /api/usage/logs — create a log entry (called by AI pipeline internally)
 */
import { prisma } from "@/lib/db";
import { apiSuccess, handleApiError, requireUser, ApiError, NO_STORE_HEADERS } from "@/lib/api";
import { z } from "zod";

const PAGE_SIZE = 50;

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get("workspaceId")?.trim();
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const provider = searchParams.get("provider")?.trim() || undefined;
    const status = searchParams.get("status")?.trim() || undefined;

    if (!workspaceId) throw new ApiError("workspaceId is required", 400, "BAD_REQUEST");

    const member = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: user.id } },
    });
    if (!member) throw new ApiError("Forbidden", 403, "FORBIDDEN");

    const where = {
      workspaceId,
      ...(provider && { provider }),
      ...(status && { status }),
    };

    const [logs, total] = await Promise.all([
      prisma.aiRequestLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
      }),
      prisma.aiRequestLog.count({ where }),
    ]);

    return apiSuccess(
      { logs, total, page, pages: Math.ceil(total / PAGE_SIZE) },
      { headers: NO_STORE_HEADERS }
    );
  } catch (err) {
    return handleApiError(err);
  }
}

const createLogSchema = z.object({
  workspaceId: z.string().min(1),
  provider: z.string().min(1),
  model: z.string().min(1),
  inputTokens: z.number().int().nonnegative().default(0),
  outputTokens: z.number().int().nonnegative().default(0),
  costUsd: z.number().nonnegative().default(0),
  durationMs: z.number().int().nonnegative().default(0),
  status: z.enum(["success", "error", "timeout", "rate_limited"]).default("success"),
  errorType: z.string().optional(),
  errorMessage: z.string().optional(),
  source: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = createLogSchema.parse(await req.json());

    const member = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: { workspaceId: body.workspaceId, userId: user.id },
      },
    });
    if (!member) throw new ApiError("Forbidden", 403, "FORBIDDEN");

    const log = await prisma.aiRequestLog.create({ data: body });
    return apiSuccess({ log }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
