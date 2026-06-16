/**
 * GET    /api/combos/:id — get a single combo
 * PATCH  /api/combos/:id — update name/description/strategy/models
 * DELETE /api/combos/:id — remove
 */
import { prisma } from "@/lib/db";
import { apiSuccess, handleApiError, requireUser, ApiError } from "@/lib/api";
import { z } from "zod";

type RouteContext = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  description: z.string().max(200).optional().nullable(),
  strategy: z.enum(["fallback", "round-robin"]).optional(),
  models: z
    .array(z.object({ provider: z.string().min(1), model: z.string().min(1) }))
    .min(1)
    .max(20)
    .optional(),
});

async function getComboWithAccess(id: string, userId: string) {
  const combo = await prisma.combo.findUnique({
    where: { id },
    include: { models: { orderBy: { position: "asc" } } },
  });
  if (!combo) throw new ApiError("Combo not found", 404, "NOT_FOUND");

  const member = await prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: { workspaceId: combo.workspaceId, userId },
    },
  });
  if (!member) throw new ApiError("Forbidden", 403, "FORBIDDEN");
  return { combo, member };
}

export async function GET(_req: Request, ctx: RouteContext) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    const { combo } = await getComboWithAccess(id, user.id);
    return apiSuccess({ combo });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(req: Request, ctx: RouteContext) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    const { combo, member } = await getComboWithAccess(id, user.id);
    if (!["OWNER", "ADMIN", "MEMBER"].includes(member.role)) {
      throw new ApiError("Forbidden", 403, "FORBIDDEN");
    }

    const body = patchSchema.parse(await req.json());
    const { models, ...rest } = body;

    const updated = await prisma.combo.update({
      where: { id: combo.id },
      data: {
        ...rest,
        ...(models && {
          models: {
            deleteMany: {},
            create: models.map((m, i) => ({
              provider: m.provider,
              model: m.model,
              position: i,
            })),
          },
        }),
      },
      include: { models: { orderBy: { position: "asc" } } },
    });

    return apiSuccess({ combo: updated });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(_req: Request, ctx: RouteContext) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    const { combo, member } = await getComboWithAccess(id, user.id);
    if (!["OWNER", "ADMIN"].includes(member.role)) {
      throw new ApiError("Forbidden — ADMIN or OWNER required", 403, "FORBIDDEN");
    }

    await prisma.combo.delete({ where: { id: combo.id } });
    return apiSuccess({ deleted: true });
  } catch (err) {
    return handleApiError(err);
  }
}
