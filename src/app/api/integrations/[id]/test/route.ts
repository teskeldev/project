import { prisma } from "@/lib/db";
import {
  apiSuccess,
  handleApiError,
  requireUser,
  ApiError,
} from "@/lib/api";
import { enforceRateLimit } from "@/lib/rate-limit";
import { decryptJson } from "@/lib/crypto";
import {
  isSupportedProvider,
  type ProviderId,
} from "@/lib/integrations/providers";
import { testConnection } from "@/lib/integrations/test-connection";
import { classifyError, cooldownUntilFor } from "@/lib/integrations/cooldown";

type RouteContext = { params: Promise<{ id: string }> };

// POST /api/integrations/:id/test
// Decrypts the stored config and runs a provider-specific connection test.
// Returns only { ok, message } — the secret is NEVER returned or logged.
// On failure, tags the integration with errorType + cooldownUntil.
export async function POST(_req: Request, ctx: RouteContext) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;

    // Rate limit: 5 per minute
    await enforceRateLimit(`integrations:test:${user.id}`, 5, 60_000);

    const integration = await prisma.integration.findUnique({ where: { id } });
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

    if (result.ok) {
      // Clear any previous error state on success
      await prisma.integration.update({
        where: { id },
        data: {
          errorType: null,
          lastError: null,
          lastErrorAt: null,
          cooldownUntil: null,
        },
      });
    } else {
      const errorType = classifyError(null, result.message ?? "");
      const cooldownUntil = cooldownUntilFor(errorType);
      await prisma.integration.update({
        where: { id },
        data: {
          errorType,
          lastError: result.message ?? "Unknown error",
          lastErrorAt: new Date(),
          cooldownUntil,
        },
      });
    }

    return apiSuccess(result);
  } catch (err) {
    return handleApiError(err);
  }
}
