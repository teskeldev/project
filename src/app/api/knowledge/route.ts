import { prisma } from "@/lib/db";
import {
  apiSuccess,
  handleApiError,
  requireUser,
  requireProjectAccess,
  validateBody,
  ApiError,
  type SessionUser,
} from "@/lib/api";
import { createKnowledgeSchema } from "@/lib/schemas/rulesKnowledge";
import { Prisma, type KnowledgeType } from "@prisma/client";

async function userWorkspaceIds(userId: string): Promise<string[]> {
  const memberships = await prisma.workspaceMember.findMany({
    where: { userId },
    select: { workspaceId: true },
  });
  return memberships.map((m) => m.workspaceId);
}

async function assertWorkspaceMember(
  user: SessionUser,
  workspaceId: string
): Promise<void> {
  const member = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: user.id } },
  });
  if (!member) {
    throw new ApiError(
      "You do not have access to this workspace",
      403,
      "FORBIDDEN"
    );
  }
}

// GET /api/knowledge?projectId=
// Lists knowledge for the user's workspaces. When ?projectId is given, mirrors
// the AI context query in src/lib/ai/context.ts: the workspace's workspace-wide
// items (projectId null) plus the project's own items.
export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const url = new URL(req.url);
    const projectId = url.searchParams.get("projectId") ?? undefined;

    const workspaceIds = await userWorkspaceIds(user.id);

    let where: Prisma.KnowledgeItemWhereInput;

    if (projectId) {
      const { project } = await requireProjectAccess(projectId);
      where = {
        OR: [
          { workspaceId: project!.workspaceId, projectId: null },
          { projectId: project!.id },
        ],
      };
    } else {
      where = { workspaceId: { in: workspaceIds } };
    }

    const items = await prisma.knowledgeItem.findMany({
      where,
      orderBy: { updatedAt: "desc" },
    });

    return apiSuccess({ items });
  } catch (err) {
    return handleApiError(err);
  }
}

// POST /api/knowledge
// Creates a knowledge item. Requires membership in the target workspace and,
// when projectId is given, access to that project (which must belong to the
// same workspace).
//
// TODO(file-upload): FILE items accept text content only (pasted markdown/txt/
// json). A binary upload + extraction pipeline is future work.
// TODO(url-fetch): URL items store the url as content/metadata.url as a
// placeholder; fetching/scraping the page is future work.
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = await validateBody(req, createKnowledgeSchema);

    await assertWorkspaceMember(user, body.workspaceId);

    if (body.projectId) {
      const { project } = await requireProjectAccess(body.projectId);
      if (project!.workspaceId !== body.workspaceId) {
        throw new ApiError(
          "Project does not belong to the given workspace",
          400,
          "WORKSPACE_MISMATCH"
        );
      }
    }

    // For URL items, mirror the url into metadata.url so context.ts (which only
    // reads title/type/content) still surfaces it, while keeping structured
    // access for future fetching.
    let metadata = body.metadata ?? undefined;
    if (body.type === "URL") {
      metadata = { ...(metadata ?? {}), url: body.content };
    }

    const item = await prisma.knowledgeItem.create({
      data: {
        workspaceId: body.workspaceId,
        projectId: body.projectId ?? null,
        title: body.title,
        type: body.type as KnowledgeType,
        content: body.content,
        metadata:
          metadata === undefined
            ? Prisma.JsonNull
            : (metadata as Prisma.InputJsonValue),
      },
    });

    return apiSuccess({ item }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
