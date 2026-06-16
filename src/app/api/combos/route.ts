/**
 * GET  /api/combos?workspaceId=... — list all combos with their models
 * POST /api/combos              — create a new combo
 */
import { prisma } from "@/lib/db";
import { apiSuccess, handleApiError, requireUser, ApiError } from "@/lib/api";
import { z } from "zod";

const createSchema = z.object({
  workspaceId: z.string().min(1),
  name: z.string().min(1).max(80),
  description: z.string().max(200).optional(),
  strategy: z.enum(["fallback", "round-robin"]).default("fallback"),
  models: z
    .array(z.object({ provider: z.string().min(1), model: z.string().min(1) }))
    .min(1)
    .max(20),
});

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get("workspaceId")?.trim();
    if (!workspaceId) throw new ApiError("workspaceId is required", 400, "BAD_REQUEST");

    const member = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: user.id } },
    });
    if (!member) throw new ApiError("Forbidden", 403, "FORBIDDEN");

    const combos = await prisma.combo.findMany({
      where: { workspaceId },
      include: { models: { orderBy: { position: "asc" } } },
      orderBy: { createdAt: "asc" },
    });

    return apiSuccess({ combos });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = await req.json();
    const { workspaceId, name, description, strategy, models } =
      createSchema.parse(body);

    const member = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: user.id } },
    });
    if (!member || !["OWNER", "ADMIN", "MEMBER"].includes(member.role)) {
      throw new ApiError("Forbidden", 403, "FORBIDDEN");
    }

    const combo = await prisma.combo.create({
      data: {
        workspaceId,
        name,
        description,
        strategy,
        models: {
          create: models.map((m, i) => ({
            provider: m.provider,
            model: m.model,
            position: i,
          })),
        },
      },
      include: { models: { orderBy: { position: "asc" } } },
    });

    return apiSuccess({ combo }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
