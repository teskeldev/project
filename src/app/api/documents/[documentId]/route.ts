import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  apiSuccess,
  handleApiError,
  requireProjectAccess,
  validateBody,
  ApiError,
} from "@/lib/api";

type RouteContext = { params: Promise<{ documentId: string }> };

async function getDocumentWithAccess(documentId: string) {
  const document = await prisma.document.findUnique({
    where: { id: documentId },
  });
  if (!document) {
    throw new ApiError("Document not found", 404, "NOT_FOUND");
  }
  await requireProjectAccess(document.projectId);
  return document;
}

// GET /api/documents/:documentId
export async function GET(_req: Request, ctx: RouteContext) {
  try {
    const { documentId } = await ctx.params;
    const document = await getDocumentWithAccess(documentId);
    return apiSuccess({ document });
  } catch (err) {
    return handleApiError(err);
  }
}

const updateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.string().optional(),
});

// PATCH /api/documents/:documentId
export async function PATCH(req: Request, ctx: RouteContext) {
  try {
    const { documentId } = await ctx.params;
    await getDocumentWithAccess(documentId);
    const body = await validateBody(req, updateSchema);

    const document = await prisma.document.update({
      where: { id: documentId },
      data: {
        ...(body.title !== undefined && { title: body.title }),
        ...(body.content !== undefined && { content: body.content }),
      },
    });

    return apiSuccess({ document });
  } catch (err) {
    return handleApiError(err);
  }
}

// DELETE /api/documents/:documentId
export async function DELETE(_req: Request, ctx: RouteContext) {
  try {
    const { documentId } = await ctx.params;
    await getDocumentWithAccess(documentId);

    await prisma.document.delete({ where: { id: documentId } });

    return apiSuccess({ deleted: true, id: documentId });
  } catch (err) {
    return handleApiError(err);
  }
}
