/**
 * POST /api/integrations/test-all?workspaceId=...
 * Runs a connection test on every enabled integration in the workspace in parallel.
 * Returns a summary of pass/fail counts plus per-integration results.
 */
import { prisma } from "@/lib/db";
import { apiSuccess, handleApiError, requireUser, ApiError } from "@/lib/api";
import { decryptJson } from "@/lib/crypto";
import { isSupportedProvider, type ProviderId } from "@/lib/integrations/providers";
import { testConnection } from "@/lib/integrations/test-connection";
import { classifyError, cooldownUntilFor } from "@/lib/integrations/cooldown";

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get("workspaceId")?.trim();
    if (!workspaceId) throw new ApiError("workspaceId is required", 400, "BAD_REQUEST");

    const member = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: user.id } },
    });
    if (!member || !["OWNER", "ADMIN"].includes(member.role)) {
      throw new ApiError("Forbidden — ADMIN or OWNER required", 403, "FORBIDDEN");
    }

    const integrations = await prisma.integration.findMany({
      where: { workspaceId, enabled: true },
      orderBy: [{ provider: "asc" }, { priority: "asc" }],
    });

    const results = await Promise.all(
      integrations.map(async (integration) => {
        if (!isSupportedProvider(integration.provider)) {
          return {
            id: integration.id,
            name: integration.name,
            provider: integration.provider,
            ok: null,
            message: "Testing not supported for this provider",
          };
        }

        let config: Record<string, unknown>;
        try {
          config = decryptJson<Record<string, unknown>>(integration.encryptedConfig);
        } catch {
          return {
            id: integration.id,
            name: integration.name,
            provider: integration.provider,
            ok: false,
            message: "Could not decrypt stored credentials",
          };
        }

        const result = await testConnection(integration.provider as ProviderId, config);

        // Update error tracking in DB
        if (result.ok) {
          await prisma.integration.update({
            where: { id: integration.id },
            data: { errorType: null, lastError: null, lastErrorAt: null, cooldownUntil: null },
          });
        } else {
          const errorType = classifyError(null, result.message ?? "");
          const cooldownUntil = cooldownUntilFor(errorType);
          await prisma.integration.update({
            where: { id: integration.id },
            data: {
              errorType,
              lastError: result.message ?? "Unknown error",
              lastErrorAt: new Date(),
              cooldownUntil,
            },
          });
        }

        return {
          id: integration.id,
          name: integration.name,
          provider: integration.provider,
          ok: result.ok,
          message: result.message,
        };
      })
    );

    const passed = results.filter((r) => r.ok === true).length;
    const failed = results.filter((r) => r.ok === false).length;
    const skipped = results.filter((r) => r.ok === null).length;

    return apiSuccess({ passed, failed, skipped, total: results.length, results });
  } catch (err) {
    return handleApiError(err);
  }
}
