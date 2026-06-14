import { prisma } from "@/lib/db";
import {
  apiSuccess,
  handleApiError,
  requireUser,
  requireProjectAccess,
  validateBody,
  ApiError,
  NO_STORE_HEADERS,
  type SessionUser,
} from "@/lib/api";
import { createRuleSchema, ruleScopeSchema } from "@/lib/schemas/rulesKnowledge";
import { Prisma, type Role, type RuleScope } from "@prisma/client";
import { enforceRateLimit } from "@/lib/rate-limit";

/** Workspace ids the user is a member of. */
async function userWorkspaceIds(userId: string): Promise<string[]> {
  const memberships = await prisma.workspaceMember.findMany({
    where: { userId },
    select: { workspaceId: true },
  });
  return memberships.map((m) => m.workspaceId);
}

/** True if the user holds ADMIN or OWNER in at least one of their workspaces. */
async function userIsAdminAnywhere(userId: string): Promise<boolean> {
  const adminMembership = await prisma.workspaceMember.findFirst({
    where: { userId, role: { in: ["ADMIN", "OWNER"] } },
    select: { id: true },
  });
  return adminMembership !== null;
}

async function assertWorkspaceMember(
  user: SessionUser,
  workspaceId: string
): Promise<{ role: Role }> {
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
  return { role: member.role };
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

    return apiSuccess({ rules }, { headers: NO_STORE_HEADERS });
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

    const rulesWorkspaceId = body.workspaceId ?? "global";
    await enforceRateLimit(`rules:create:${rulesWorkspaceId}`, 30, 60_000);

    // Authorize the target of the rule.
    const memberRoles: Role[] = ["MEMBER", "ADMIN", "OWNER"];

    if (body.scope === "GLOBAL") {
      if (!(await userIsAdminAnywhere(user.id))) {
        throw new ApiError(
          "Only admins and owners can create global rules",
          403,
          "FORBIDDEN"
        );
      }
    } else if (body.scope === "PROJECT" && body.projectId) {
      const { role } = await requireProjectAccess(body.projectId);
      if (!memberRoles.includes(role)) {
        throw new ApiError("Insufficient permissions", 403, "FORBIDDEN");
      }
    } else if (body.scope === "WORKSPACE" && body.workspaceId) {
      const { role } = await assertWorkspaceMember(user, body.workspaceId);
      if (!memberRoles.includes(role)) {
        throw new ApiError("Insufficient permissions", 403, "FORBIDDEN");
      }
    } else if (body.scope === "FILE") {
      // FILE rules require a workspaceId; projectId is optional.
      if (!body.workspaceId) {
        throw new ApiError(
          "FILE-scoped rules require a workspaceId",
          422,
          "VALIDATION_ERROR"
        );
      }
      const { role } = await assertWorkspaceMember(user, body.workspaceId);
      if (!memberRoles.includes(role)) {
        throw new ApiError("Insufficient permissions", 403, "FORBIDDEN");
      }
      if (body.projectId) {
        const access = await requireProjectAccess(body.projectId);
        if (!memberRoles.includes(access.role)) {
          throw new ApiError("Insufficient permissions", 403, "FORBIDDEN");
        }
      }
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
