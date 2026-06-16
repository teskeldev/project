/**
 * GET  /api/model-aliases?workspaceId=... — list aliases
 * POST /api/model-aliases              — create alias
 */
import { prisma } from "@/lib/db";
import { apiSuccess, handleApiError, requireUser, ApiError } from "@/lib/api";
import { z } from "zod";

const createSchema = z.object({
  workspaceId: z.string().min(1),
  alias: z
    .string()
    .min(1)
    .max(80)
    .regex(/^[a-z0-9_:-]+$/i, "Alias may only contain letters, numbers, hyphens, underscores, and colons"),
  provider: z.string().min(1),
  model: z.string().min(1),
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

    const aliases = await prisma.modelAlias.findMany({
      where: { workspaceId },
      orderBy: { alias: "asc" },
    });

    return apiSuccess({ aliases });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const { workspaceId, alias, provider, model } = createSchema.parse(
      await req.json()
    );

    const member = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: user.id } },
    });
    if (!member || !["OWNER", "ADMIN", "MEMBER"].includes(member.role)) {
      throw new ApiError("Forbidden", 403, "FORBIDDEN");
    }

    const created = await prisma.modelAlias.create({
      data: { workspaceId, alias, provider, model },
    });

    return apiSuccess({ alias: created }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
