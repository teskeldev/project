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
import {
  listFusionProfiles,
  createFusionProfile,
} from "@/lib/ai/fusion-profile";

const panelistSchema = z.object({
  model: z.string().min(1).max(120),
  provider: z.string().min(1).max(40),
  temperature: z.number().min(0).max(2).optional(),
  skillSlugs: z.array(z.string().max(200)).max(50).optional(),
});

const profileInputSchema = z.object({
  name: z.string().min(1).max(80),
  panelSlug: z.string().max(64),
  panelists: z.array(panelistSchema).max(8),
  judge: z.object({ model: z.string().min(1).max(120), provider: z.string().min(1).max(40) }),
  skillSlugs: z.array(z.string().max(200)).max(100),
  trackAVerification: z.object({
    validateSyntax: z.boolean(),
    runLint: z.boolean(),
    runTests: z.boolean(),
  }),
  isDefault: z.boolean().optional(),
});

const createSchema = profileInputSchema.extend({ workspaceId: z.string().min(1) });

/** Verify the caller is a writing member of the workspace. */
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

// GET /api/fusion/profiles?workspaceId= -> list profiles for a workspace.
export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const workspaceId = new URL(req.url).searchParams.get("workspaceId");
    if (!workspaceId) {
      throw new ApiError("workspaceId is required", 400, "BAD_REQUEST");
    }
    await authorizeWorkspace(user.id, workspaceId);
    const profiles = await listFusionProfiles(workspaceId);
    return apiSuccess({ profiles });
  } catch (err) {
    return handleApiError(err);
  }
}

// POST /api/fusion/profiles -> create a profile.
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const { workspaceId, ...input } = await validateBody(req, createSchema);
    const member = await authorizeWorkspace(user.id, workspaceId);
    requireRole(member);
    const profile = await createFusionProfile(workspaceId, input);
    return apiSuccess({ profile }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
