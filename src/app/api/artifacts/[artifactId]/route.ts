import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  apiSuccess,
  handleApiError,
  requireProjectAccess,
  validateBody,
  ApiError,
} from "@/lib/api";

type RouteContext = { params: Promise<{ artifactId: string }> };

async function getArtifactWithAccess(artifactId: string) {
  const artifact = await prisma.artifact.findUnique({
    where: { id: artifactId },
  });
  if (!artifact) {
    throw new ApiError("Artifact not found", 404, "NOT_FOUND");
  }
  await requireProjectAccess(artifact.projectId);
  return artifact;
}

// GET /api/artifacts/:artifactId
export async function GET(_req: Request, ctx: RouteContext) {
  try {
    const { artifactId } = await ctx.params;
    const artifact = await getArtifactWithAccess(artifactId);
    return apiSuccess({ artifact });
  } catch (err) {
    return handleApiError(err);
  }
}

const updateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.string().optional(),
  metadata: z.record(z.unknown()).nullable().optional(),
});

// PATCH /api/artifacts/:artifactId
export async function PATCH(req: Request, ctx: RouteContext) {
  try {
    const { artifactId } = await ctx.params;
    await getArtifactWithAccess(artifactId);
    const body = await validateBody(req, updateSchema);

    const artifact = await prisma.artifact.update({
      where: { id: artifactId },
      data: {
        ...(body.title !== undefined && { title: body.title }),
        ...(body.content !== undefined && { content: body.content }),
        ...(body.metadata !== undefined && { metadata: (body.metadata ?? undefined) as Prisma.InputJsonValue | undefined }),
      },
    });

    return apiSuccess({ artifact });
  } catch (err) {
    return handleApiError(err);
  }
}

// DELETE /api/artifacts/:artifactId
export async function DELETE(_req: Request, ctx: RouteContext) {
  try {
    const { artifactId } = await ctx.params;
    await getArtifactWithAccess(artifactId);

    await prisma.artifact.delete({ where: { id: artifactId } });

    return apiSuccess({ deleted: true, id: artifactId });
  } catch (err) {
    return handleApiError(err);
  }
}
