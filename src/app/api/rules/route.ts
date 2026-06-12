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
import { createRuleSchema, ruleScopeSchema } from "@/lib/schemas/rulesKnowledge";
import { Prisma, type RuleScope } from "@prisma/client";

/** Workspace ids the user is a member of. */
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

// GET /api/rules?projectId=&scope=
// Lists rules visible to the user: GLOBAL + rules in the user's workspaces +
// (when ?projectId is given) that project's project/file rules. The shape
// mirrors the AI context query in src/lib/ai/context.ts so the management UI
// shows exactly what can feed the agent.
export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const url = new URL(req.url);
    const projectId = url.searchParams.get("projectId") ?? undefined;
    const scopeParam = url.searchParams.get("scope") ?? undefined;

    const workspaceIds = await userWorkspaceIds(user.id);

    let where: Prisma.RuleWhereInput;

    if (projectId) {
      // Verify access, then mirror context.ts: GLOBAL + this workspace's
      // WORKSPACE rules + this project's PROJECT/FILE rules.
      const { project } = await requireProjectAccess(projectId);
      where = {
        OR: [
          { scope: "GLOBAL" },
          { scope: "WORKSPACE", workspaceId: project!.workspaceId },
          { projectId: project!.id },
        ],
      };
    } else {
      where = {
        OR: [
          { scope: "GLOBAL" },
          { workspaceId: { in: workspaceIds } },
          { project: { workspaceId: { in: workspaceIds } } },
        ],
      };
    }

    if (scopeParam) {
      const parsed = ruleScopeSchema.safeParse(scopeParam);
      if (!parsed.success) {
        throw new ApiError("Invalid scope filter", 400, "INVALID_SCOPE");
      }
      where = { AND: [where, { scope: parsed.data as RuleScope }] };
    }

    const rules = await prisma.rule.findMany({
      where,
      orderBy: [{ scope: "asc" }, { createdAt: "asc" }],
    });

    return apiSuccess({ rules });
  } catch (err) {
    return handleApiError(err);
  }
}

// POST /api/rules
// Creates a rule. Scope/id coherence is validated by the schema; this handler
// additionally verifies the user can write to the targeted workspace/project.
//
// NOTE: The Rule model has no owner column, so GLOBAL rules are shared across
// all users and any authenticated user can create them. Per-user GLOBAL rules
// would require a schema migration (ownerId). See report TODO.
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = await validateBody(req, createRuleSchema);

    // Authorize the target of the rule.
    if (body.scope === "PROJECT" || body.scope === "FILE") {
      if (body.projectId) {
        await requireProjectAccess(body.projectId);
      }
    }
    if (
      (body.scope === "WORKSPACE" || body.scope === "FILE") &&
      body.workspaceId
    ) {
      await assertWorkspaceMember(user, body.workspaceId);
    }

    const rule = await prisma.rule.create({
      data: {
        scope: body.scope as RuleScope,
        title: body.title,
        content: body.content,
        filePattern: body.filePattern ?? null,
        workspaceId: body.scope === "GLOBAL" ? null : body.workspaceId ?? null,
        projectId: body.scope === "GLOBAL" ? null : body.projectId ?? null,
        enabled: body.enabled ?? true,
      },
    });

    return apiSuccess({ rule }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
