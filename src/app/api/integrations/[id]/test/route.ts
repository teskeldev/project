import { prisma } from "@/lib/db";
import {
  apiSuccess,
  handleApiError,
  requireUser,
  ApiError,
} from "@/lib/api";
import { decryptJson } from "@/lib/crypto";
import {
  isSupportedProvider,
  type ProviderId,
} from "@/lib/integrations/providers";
import { testConnection } from "@/lib/integrations/test-connection";

type RouteContext = { params: Promise<{ id: string }> };

// POST /api/integrations/:id/test
// Decrypts the stored config and runs a provider-specific connection test.
// Returns only { ok, message } — the secret is NEVER returned or logged.
export async function POST(_req: Request, ctx: RouteContext) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;

    const integration = await prisma.integration.findUnique({
      where: { id },
    });
    if (!integration) {
      throw new ApiError("Integration not found", 404, "NOT_FOUND");
    }

    const member = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: integration.workspaceId,
          userId: user.id,
        },
      },
    });
    if (!member) {
      throw new ApiError(
        "You do not have access to this integration",
        403,
        "FORBIDDEN"
      );
    }

    if (!isSupportedProvider(integration.provider)) {
      return apiSuccess({
        ok: false,
        message: "Testing is not supported for this provider.",
      });
    }

    let config: Record<string, unknown>;
    try {
      config = decryptJson<Record<string, unknown>>(
        integration.encryptedConfig
      );
    } catch {
      throw new ApiError(
        "Stored configuration could not be read.",
        500,
        "DECRYPT_FAILED"
      );
    }

    const result = await testConnection(
      integration.provider as ProviderId,
      config
    );

    // result is { ok, message } — safe by construction (no secrets).
    return apiSuccess(result);
  } catch (err) {
    return handleApiError(err);
  }
}