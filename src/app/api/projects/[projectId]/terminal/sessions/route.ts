import { prisma } from "@/lib/db";
import {
  apiSuccess,
  handleApiError,
  requireProjectAccess,
  validateBody,
} from "@/lib/api";
import { createTerminalSessionSchema } from "@/lib/validators";
import { resolveProjectCwd } from "@/lib/terminal/runner";

type RouteContext = { params: Promise<{ projectId: string }> };

// GET /api/projects/:projectId/terminal/sessions
// -> ACTIVE terminal sessions for this project + current user, newest first.
export async function GET(_req: Request, ctx: RouteContext) {
  try {
    const { projectId } = await ctx.params;
    const { user } = await requireProjectAccess(projectId);

    const sessions = await prisma.terminalSession.findMany({
      where: { projectId, userId: user.id, status: "ACTIVE" },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        projectId: true,
        userId: true,
        title: true,
        cwd: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return apiSuccess({ sessions });
  } catch (err) {
    return handleApiError(err);
  }
}

// POST /api/projects/:projectId/terminal/sessions
// Body: { title?, cwd? } -> create a session. cwd defaults to project root and
// is validated to stay inside the project storage root.
export async function POST(req: Request, ctx: RouteContext) {
  try {
    const { projectId } = await ctx.params;
    const { user, project } = await requireProjectAccess(projectId);
    const { title, cwd } = await validateBody(req, createTerminalSessionSchema);

    // Validate any client-supplied cwd against the project root; store the
    // project-relative form ("" == root).
    const storageKey = project!.storageKey;
    let relCwd = "";
    if (cwd) {
      // Throws ApiError(400) if it would escape the root.
      resolveProjectCwd(storageKey, cwd);
      relCwd = cwd;
    }

    const count = await prisma.terminalSession.count({
      where: { projectId, userId: user.id, status: "ACTIVE" },
    });

    const session = await prisma.terminalSession.create({
      data: {
        projectId,
        userId: user.id,
        title: title ?? `Terminal ${count + 1}`,
        cwd: relCwd,
      },
      select: {
        id: true,
        projectId: true,
        userId: true,
        title: true,
        cwd: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return apiSuccess({ session }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
