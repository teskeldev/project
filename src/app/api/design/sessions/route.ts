import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  apiSuccess,
  handleApiError,
  requireProjectAccess,
  validateBody,
} from "@/lib/api";

/**
 * GET /api/design/sessions?projectId=...
 * List design sessions for a project, newest first.
 */
export async function GET(req: Request): Promise<Response> {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");

    if (!projectId) {
      return Response.json(
        { success: false, error: { message: "projectId is required", code: "MISSING_PARAM" } },
        { status: 400 }
      );
    }

    await requireProjectAccess(projectId);

    const sessions = await prisma.designSession.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { versions: true } },
      },
    });

    return apiSuccess({ sessions });
  } catch (err) {
    return handleApiError(err);
  }
}

const createSchema = z.object({
  projectId: z.string().min(1),
  title: z.string().min(1).max(200).optional(),
});

/**
 * POST /api/design/sessions
 * Create a new design session.
 */
export async function POST(req: Request): Promise<Response> {
  try {
    const body = await validateBody(req, createSchema);
    const { user } = await requireProjectAccess(body.projectId);

    const session = await prisma.designSession.create({
      data: {
        projectId: body.projectId,
        userId: user.id,
        title: body.title ?? "Untitled Design",
      },
    });

    return apiSuccess({ session }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
