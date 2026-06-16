/**
 * DELETE /api/model-aliases/:id
 * PATCH  /api/model-aliases/:id — update alias, provider, or model
 */
import { prisma } from "@/lib/db";
import { apiSuccess, handleApiError, requireUser, ApiError } from "@/lib/api";
import { z } from "zod";

type RouteContext = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  alias: z
    .string()
    .min(1)
    .max(80)
    .regex(/^[a-z0-9_:-]+$/i)
    .optional(),
  provider: z.string().min(1).optional(),
  model: z.string().min(1).optional(),
});

export async function PATCH(req: Request, ctx: RouteContext) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;

    const record = await prisma.modelAlias.findUnique({ where: { id } });
    if (!record) throw new ApiError("Alias not found", 404, "NOT_FOUND");

    const member = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: { workspaceId: record.workspaceId, userId: user.id },
      },
    });
    if (!member || !["OWNER", "ADMIN", "MEMBER"].includes(member.role)) {
      throw new ApiError("Forbidden", 403, "FORBIDDEN");
    }

    const data = patchSchema.parse(await req.json());
    const updated = await prisma.modelAlias.update({ where: { id }, data });

    return apiSuccess({ alias: updated });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(_req: Request, ctx: RouteContext) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;

    const record = await prisma.modelAlias.findUnique({ where: { id } });
    if (!record) throw new ApiError("Alias not found", 404, "NOT_FOUND");

    const member = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: { workspaceId: record.workspaceId, userId: user.id },
      },
    });
    if (!member || !["OWNER", "ADMIN"].includes(member.role)) {
      throw new ApiError("Forbidden — ADMIN or OWNER required", 403, "FORBIDDEN");
    }

    await prisma.modelAlias.delete({ where: { id } });
    return apiSuccess({ deleted: true });
  } catch (err) {
    return handleApiError(err);
  }
}
