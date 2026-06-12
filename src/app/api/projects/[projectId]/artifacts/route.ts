import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  apiSuccess,
  handleApiError,
  requireProjectAccess,
  validateBody,
} from "@/lib/api";

type RouteContext = { params: Promise<{ projectId: string }> };

// GET /api/projects/:projectId/artifacts?type=CODE|DOCUMENT|...
export async function GET(req: Request, ctx: RouteContext) {
  try {
    const { projectId } = await ctx.params;
    await requireProjectAccess(projectId);

    const url = new URL(req.url);
    const typeFilter = url.searchParams.get("type");

    const where: { projectId: string; type?: "CODE" | "DOCUMENT" | "CHART" | "WEBAPP" | "IMAGE" } = { projectId };
    if (typeFilter && ["CODE", "DOCUMENT", "CHART", "WEBAPP", "IMAGE"].includes(typeFilter)) {
      where.type = typeFilter as "CODE" | "DOCUMENT" | "CHART" | "WEBAPP" | "IMAGE";
    }

    const artifacts = await prisma.artifact.findMany({
      where,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        projectId: true,
        userId: true,
        title: true,
        type: true,
        language: true,
        metadata: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return apiSuccess({ artifacts });
  } catch (err) {
    return handleApiError(err);
  }
}

const createSchema = z.object({
  title: z.string().min(1).max(200),
  type: z.enum(["CODE", "DOCUMENT", "CHART", "WEBAPP", "IMAGE"]),
  content: z.string(),
  language: z.string().max(50).optional(),
  metadata: z.record(z.unknown()).optional(),
});

// POST /api/projects/:projectId/artifacts
export async function POST(req: Request, ctx: RouteContext) {
  try {
    const { projectId } = await ctx.params;
    const { user } = await requireProjectAccess(projectId);
    const body = await validateBody(req, createSchema);

    const artifact = await prisma.artifact.create({
      data: {
        projectId,
        userId: user.id,
        title: body.title,
        type: body.type,
        content: body.content,
        language: body.language ?? null,
        metadata: (body.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });

    return apiSuccess({ artifact }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
