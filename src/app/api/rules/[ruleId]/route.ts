import { prisma } from "@/lib/db";
import {
  apiSuccess,
  handleApiError,
  requireUser,
  validateBody,
  ApiError,
  type SessionUser,
} from "@/lib/api";
import { updateRuleSchema } from "@/lib/schemas/rulesKnowledge";

type RouteContext = { params: Promise<{ ruleId: string }> };

/**
 * Loads a rule and verifies the current user can manage it.
 *
 * Management rules:
 *   - GLOBAL: any authenticated user (no owner column on the model — shared).
 *   - WORKSPACE / PROJECT / FILE: requires membership in the owning workspace
 *     (resolved via the rule's workspaceId or its project's workspaceId).
 */
async function loadManageableRule(user: SessionUser, ruleId: string) {
  const rule = await prisma.rule.findUnique({
    where: { id: ruleId },
    include: { project: { select: { workspaceId: true } } },
  });

  if (!rule) {
    throw new ApiError("Rule not found", 404, "NOT_FOUND");
  }

  if (rule.scope !== "GLOBAL") {
    const workspaceId = rule.workspaceId ?? rule.project?.workspaceId ?? null;
    if (!workspaceId) {
      // Malformed scoped rule with no resolvable workspace -> deny.
      throw new ApiError("You cannot manage this rule", 403, "FORBIDDEN");
    }
    const member = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: user.id } },
    });
    if (!member) {
      throw new ApiError("You cannot manage this rule", 403, "FORBIDDEN");
    }
  }

  return rule;
}

// PATCH /api/rules/:ruleId -> update title/content/filePattern/enabled.
export async function PATCH(req: Request, ctx: RouteContext) {
  try {
    const user = await requireUser();
    const { ruleId } = await ctx.params;
    const body = await validateBody(req, updateRuleSchema);

    await loadManageableRule(user, ruleId);

    const rule = await prisma.rule.update({
      where: { id: ruleId },
      data: {
        ...(body.title !== undefined ? { title: body.title } : {}),
        ...(body.content !== undefined ? { content: body.content } : {}),
        ...(body.filePattern !== undefined
          ? { filePattern: body.filePattern }
          : {}),
        ...(body.enabled !== undefined ? { enabled: body.enabled } : {}),
      },
    });

    return apiSuccess({ rule });
  } catch (err) {
    return handleApiError(err);
  }
}

// DELETE /api/rules/:ruleId
export async function DELETE(_req: Request, ctx: RouteContext) {
  try {
    const user = await requireUser();
    const { ruleId } = await ctx.params;

    await loadManageableRule(user, ruleId);
    await prisma.rule.delete({ where: { id: ruleId } });

    return apiSuccess({ deleted: true, id: ruleId });
  } catch (err) {
    return handleApiError(err);
  }
}
