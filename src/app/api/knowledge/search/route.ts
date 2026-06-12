import { prisma } from "@/lib/db";
import {
  apiSuccess,
  handleApiError,
  requireUser,
  requireProjectAccess,
  validateBody,
} from "@/lib/api";
import { knowledgeSearchSchema } from "@/lib/schemas/rulesKnowledge";
import { Prisma } from "@prisma/client";

async function userWorkspaceIds(userId: string): Promise<string[]> {
  const memberships = await prisma.workspaceMember.findMany({
    where: { userId },
    select: { workspaceId: true },
  });
  return memberships.map((m) => m.workspaceId);
}

// POST /api/knowledge/search { q, projectId? }
// Case-insensitive keyword search over title + content, restricted to the
// accessible scope (same visibility rules as GET /api/knowledge).
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const { q, projectId } = await validateBody(req, knowledgeSearchSchema);

    let scopeWhere: Prisma.KnowledgeItemWhereInput;
    if (projectId) {
      const { project } = await requireProjectAccess(projectId);
      scopeWhere = {
        OR: [
          { workspaceId: project!.workspaceId, projectId: null },
          { projectId: project!.id },
        ],
      };
    } else {
      const workspaceIds = await userWorkspaceIds(user.id);
      scopeWhere = { workspaceId: { in: workspaceIds } };
    }

    const items = await prisma.knowledgeItem.findMany({
      where: {
        AND: [
          scopeWhere,
          {
            OR: [
              { title: { contains: q, mode: "insensitive" } },
              { content: { contains: q, mode: "insensitive" } },
            ],
          },
        ],
      },
      orderBy: { updatedAt: "desc" },
      take: 50,
    });

    return apiSuccess({ items });
  } catch (err) {
    return handleApiError(err);
  }
}
