/**
 * GET /api/integrations/:id/quota
 * Fetches quota/usage information from the provider.
 * Provider-specific — only providers with quota endpoints are supported.
 * Returns { supported, used, limit, remaining, resetAt, unit }.
 */
import { prisma } from "@/lib/db";
import { apiSuccess, handleApiError, requireUser, ApiError, NO_STORE_HEADERS } from "@/lib/api";
import { decryptJson } from "@/lib/crypto";

type RouteContext = { params: Promise<{ id: string }> };

const FETCH_TIMEOUT_MS = 10_000;

async function safeFetch(url: string, headers: Record<string, string>) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { headers, signal: ctrl.signal });
    clearTimeout(timer);
    return res;
  } catch {
    clearTimeout(timer);
    return null;
  }
}

export async function GET(_req: Request, ctx: RouteContext) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;

    const integration = await prisma.integration.findUnique({ where: { id } });
    if (!integration) throw new ApiError("Integration not found", 404, "NOT_FOUND");

    const member = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: { workspaceId: integration.workspaceId, userId: user.id },
      },
    });
    if (!member) throw new ApiError("Forbidden", 403, "FORBIDDEN");

    let config: Record<string, unknown> = {};
    try {
      config = decryptJson<Record<string, unknown>>(integration.encryptedConfig);
    } catch {
      throw new ApiError("Could not read integration credentials", 500, "DECRYPT_FAILED");
    }

    const apiKey = typeof config.apiKey === "string" ? config.apiKey.trim() : "";

    // Provider-specific quota endpoints
    switch (integration.provider) {
      case "openai": {
        const res = await safeFetch("https://api.openai.com/v1/organization/usage", {
          Authorization: `Bearer ${apiKey}`,
        });
        if (!res?.ok) {
          return apiSuccess({ supported: true, error: "Could not fetch quota from OpenAI" }, { headers: NO_STORE_HEADERS });
        }
        const data = await res.json() as { total_usage?: number };
        return apiSuccess({
          supported: true,
          used: data.total_usage ? data.total_usage / 100 : null,
          unit: "USD",
          note: "Monthly usage in USD (cumulative)",
        }, { headers: NO_STORE_HEADERS });
      }

      case "anthropic": {
        // Anthropic doesn't expose a quota API — report from our local logs
        const thirtyDays = new Date(Date.now() - 30 * 86_400_000);
        const agg = await prisma.aiRequestLog.aggregate({
          where: {
            workspaceId: integration.workspaceId,
            provider: "anthropic",
            createdAt: { gte: thirtyDays },
          },
          _sum: { inputTokens: true, outputTokens: true, costUsd: true },
        });
        return apiSuccess({
          supported: true,
          used: (agg._sum.inputTokens ?? 0) + (agg._sum.outputTokens ?? 0),
          costUsd: agg._sum.costUsd ?? 0,
          unit: "tokens",
          note: "Last 30 days — tracked by Teskel (no direct quota API)",
        }, { headers: NO_STORE_HEADERS });
      }

      default:
        return apiSuccess(
          { supported: false, note: "Quota tracking is not available for this provider." },
          { headers: NO_STORE_HEADERS }
        );
    }
  } catch (err) {
    return handleApiError(err);
  }
}
