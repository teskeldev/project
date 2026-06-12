import { prisma } from "@/lib/db";
import {
  apiSuccess,
  handleApiError,
  requireUser,
  validateBody,
  ApiError,
  type SessionUser,
} from "@/lib/api";
import { encryptJson, decryptJson } from "@/lib/crypto";
import {
  parseProviderConfig,
  type ProviderId,
} from "@/lib/integrations/providers";
import {
  updateIntegrationSchema,
  toSafeIntegration,
} from "@/lib/integrations/server";

type RouteContext = { params: Promise<{ id: string }> };

/** Load an integration and verify the user belongs to its workspace. */
async function loadAuthorizedIntegration(user: SessionUser, id: string) {
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
  return integration;
}

// PATCH /api/integrations/:id
// Update name/enabled, and/or replace config (re-encrypted). When config is
// provided, it is merged with the existing config so callers can update a
// single field without resubmitting secrets — then re-validated + re-encrypted.
export async function PATCH(req: Request, ctx: RouteContext) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    const existing = await loadAuthorizedIntegration(user, id);

    const { name, enabled, config } = await validateBody(
      req,
      updateIntegrationSchema
    );

    const data: {
      name?: string;
      enabled?: boolean;
      encryptedConfig?: string;
    } = {};

    if (typeof name === "string") data.name = name;
    if (typeof enabled === "boolean") data.enabled = enabled;

    if (config) {
      // Merge new (non-empty) values over the existing decrypted config so a
      // partial update doesn't wipe secrets the user didn't resend.
      let current: Record<string, unknown> = {};
      try {
        current = decryptJson<Record<string, unknown>>(
          existing.encryptedConfig
        );
      } catch {
        current = {};
      }

      const merged: Record<string, unknown> = { ...current };
      for (const [key, value] of Object.entries(config)) {
        const isEmptyString = typeof value === "string" && value.length === 0;
        if (value === undefined || value === null || isEmptyString) continue;
        merged[key] = value;
      }

      let parsed: Record<string, unknown>;
      try {
        parsed = parseProviderConfig(existing.provider as ProviderId, merged);
      } catch {
        throw new ApiError(
          "Invalid configuration for this provider",
          422,
          "VALIDATION_ERROR"
        );
      }
      data.encryptedConfig = encryptJson(parsed);
    }

    const updated = await prisma.integration.update({
      where: { id },
      data,
    });

    return apiSuccess({ integration: toSafeIntegration(updated) });
  } catch (err) {
    return handleApiError(err);
  }
}

// DELETE /api/integrations/:id
export async function DELETE(_req: Request, ctx: RouteContext) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    await loadAuthorizedIntegration(user, id);

    await prisma.integration.delete({ where: { id } });

    return apiSuccess({ deleted: true, id });
  } catch (err) {
    return handleApiError(err);
  }
}