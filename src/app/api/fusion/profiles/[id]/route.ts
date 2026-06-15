import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  apiSuccess,
  handleApiError,
  requireUser,
  requireRole,
  validateBody,
  ApiError,
} from "@/lib/api";
import { updateFusionProfile, deleteFusionProfile } from "@/lib/ai/fusion-profile";

type RouteContext = { params: Promise<{ id: string }> };

const panelistSchema = z.object({
  model: z.string().min(1).max(120),
  provider: z.string().min(1).max(40),
  temperature: z.number().min(0).max(2).optional(),
  skillSlugs: z.array(z.string().max(200)).max(50).optional(),
});

const updateSchema = z.object({
  workspaceId: z.string().min(1),
  name: z.string().min(1).max(80).optional(),
  panelSlug: z.string().max(64).optional(),
  panelists: z.array(panelistSchema).max(8).optional(),
  judge: z.object({ model: z.string().min(1).max(120), provider: z.string().min(1).max(40) }).optional(),
  skillSlugs: z.array(z.string().max(200)).max(100).optional(),
  trackAVerification: z
    .object({ validateSyntax: z.boolean(), runLint: z.boolean(), runTests: z.boolean() })
    .optional(),
  isDefault: z.boolean().optional(),
  systemPrompt: z.string().max(8000).nullable().optional(),
  teamId: z.string().max(60).nullable().optional(),
  routingId: z.string().max(60).nullable().optional(),
  judgeId: z.string().max(60).nullable().optional(),
  mcpServerIds: z.array(z.string().max(60)).max(50).optional(),
  memory: z.unknown().optional(),
});

const deleteSchema = z.object({ workspaceId: z.string().min(1) });

async function authorizeWorkspace(userId: string, workspaceId: string) {
  const member = await prisma.workspaceMember.findFirst({
    where: { workspaceId, userId },
    select: { role: true },
  });
  if (!member) {
    throw new ApiError("You do not have access to this workspace", 403, "FORBIDDEN");
  }
  return member;
}

// PATCH /api/fusion/profiles/:id -> update (or set default).
export async function PATCH(req: Request, ctx: RouteContext) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    const { workspaceId, ...input } = await validateBody(req, updateSchema);
    const member = await authorizeWorkspace(user.id, workspaceId);
    requireRole(member);
    const profile = await updateFusionProfile(workspaceId, id, input);
    return apiSuccess({ profile });
  } catch (err) {
    return handleApiError(err);
  }
}

// DELETE /api/fusion/profiles/:id
export async function DELETE(req: Request, ctx: RouteContext) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    const { workspaceId } = await validateBody(req, deleteSchema);
    const member = await authorizeWorkspace(user.id, workspaceId);
    requireRole(member);
    await deleteFusionProfile(workspaceId, id);
    return apiSuccess({ deleted: true });
  } catch (err) {
    return handleApiError(err);
  }
}
