import { prisma } from "@/lib/db";
import {
  apiSuccess,
  handleApiError,
  requireUser,
  validateBody,
  ApiError,
  type SessionUser,
} from "@/lib/api";
import { encryptJson } from "@/lib/crypto";
import {
  parseProviderConfig,
  type ProviderId,
} from "@/lib/integrations/providers";
import {
  createIntegrationSchema,
  toSafeIntegration,
} from "@/lib/integrations/server";

/**
 * Ensure the user is a member of the workspace. Throws 403 otherwise.
 * Returns the membership for callers that need the role.
 */
async function requireWorkspaceMember(user: SessionUser, workspaceId: string) {
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
  return member;
}

// GET /api/integrations[?workspaceId=...]
// Lists integrations across the user's workspaces. NEVER returns decrypted
// secrets — only masked hints (last 4 chars) and which fields are configured.
export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get("workspaceId")?.trim() || undefined;

    // The set of workspaces this user belongs to.
    const memberships = await prisma.workspaceMember.findMany({
      where: { userId: user.id },
      select: { workspaceId: true },
    });
    const memberWorkspaceIds = memberships.map((m) => m.workspaceId);

    if (workspaceId && !memberWorkspaceIds.includes(workspaceId)) {
      throw new ApiError(
        "You do not have access to this workspace",
        403,
        "FORBIDDEN"
      );
    }

    const rows = await prisma.integration.findMany({
      where: {
        workspaceId: workspaceId ? workspaceId : { in: memberWorkspaceIds },
      },
      orderBy: { createdAt: "asc" },
    });

    return apiSuccess({ integrations: rows.map(toSafeIntegration) });
  } catch (err) {
    return handleApiError(err);
  }
}

// POST /api/integrations
// Create an integration. The config JSON is validated per-provider, then
// encrypted (AES-256-GCM) before being stored in `encryptedConfig`.
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const { workspaceId, provider, name, config } = await validateBody(
      req,
      createIntegrationSchema
    );

    await requireWorkspaceMember(user, workspaceId);

    // Validate the config shape for this specific provider.
    let parsedConfig: Record<string, unknown>;
    try {
      parsedConfig = parseProviderConfig(provider as ProviderId, config);
    } catch {
      throw new ApiError(
        "Invalid configuration for this provider",
        422,
        "VALIDATION_ERROR"
      );
    }

    const encryptedConfig = encryptJson(parsedConfig);

    const created = await prisma.integration.create({
      data: { workspaceId, provider, name, encryptedConfig, enabled: true },
    });

    return apiSuccess(
      { integration: toSafeIntegration(created) },
      { status: 201 }
    );
  } catch (err) {
    return handleApiError(err);
  }
}