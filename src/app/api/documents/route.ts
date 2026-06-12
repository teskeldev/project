import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  apiSuccess,
  handleApiError,
  requireProjectAccess,
  validateBody,
  ApiError,
} from "@/lib/api";

// GET /api/documents?projectId=
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const projectId = url.searchParams.get("projectId");
    if (!projectId) {
      throw new ApiError("projectId query parameter is required", 400, "MISSING_PARAM");
    }

    await requireProjectAccess(projectId);

    const documents = await prisma.document.findMany({
      where: { projectId },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        projectId: true,
        userId: true,
        title: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return apiSuccess({ documents });
  } catch (err) {
    return handleApiError(err);
  }
}

const createSchema = z.object({
  projectId: z.string().min(1),
  title: z.string().min(1).max(200),
  content: z.string().optional(),
});

// POST /api/documents
export async function POST(req: Request) {
  try {
    const body = await validateBody(req, createSchema);
    const { user } = await requireProjectAccess(body.projectId);

    const document = await prisma.document.create({
      data: {
        projectId: body.projectId,
        userId: user.id,
        title: body.title,
        content: body.content ?? "",
      },
    });

    return apiSuccess({ document }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
