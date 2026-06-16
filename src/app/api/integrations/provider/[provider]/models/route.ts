/**
 * GET /api/integrations/provider/[provider]/models?workspaceId=...
 *
 * Fetches available model IDs from a provider using the first active integration
 * key stored for that provider. Proxies the provider's /models endpoint so the
 * API key stays server-side and never hits the browser.
 */
import { apiSuccess, handleApiError, requireUser, ApiError, NO_STORE_HEADERS } from "@/lib/api";
import { prisma } from "@/lib/db";
import { decryptJson } from "@/lib/crypto";
import { getAiProvider } from "@/lib/ai/provider-registry";

type RouteContext = { params: Promise<{ provider: string }> };

const FETCH_TIMEOUT_MS = 12_000;

function stripTrailingSlash(url: string) {
  return url.replace(/\/+$/, "");
}

export async function GET(req: Request, ctx: RouteContext) {
  try {
    const user = await requireUser();
    const { provider } = await ctx.params;
    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get("workspaceId")?.trim();

    if (!workspaceId) throw new ApiError("workspaceId is required", 400, "BAD_REQUEST");

    // Verify workspace membership
    const member = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: user.id } },
    });
    if (!member) throw new ApiError("Forbidden", 403, "FORBIDDEN");

    // Find the first enabled integration for this provider
    const integration = await prisma.integration.findFirst({
      where: { workspaceId, provider, enabled: true },
      orderBy: { priority: "asc" },
    });
    if (!integration) {
      throw new ApiError("No active connection found for this provider", 404, "NOT_FOUND");
    }

    const entry = getAiProvider(provider);
    if (!entry) {
      throw new ApiError("Provider not in registry — cannot fetch models", 404, "NOT_FOUND");
    }

    let config: Record<string, unknown> = {};
    try {
      config = decryptJson<Record<string, unknown>>(integration.encryptedConfig);
    } catch {
      throw new ApiError("Failed to read integration credentials", 500, "DECRYPT_FAILED");
    }

    const apiKey = typeof config.apiKey === "string" ? config.apiKey.trim() : "";
    const baseUrl = stripTrailingSlash(
      typeof config.baseUrl === "string" && config.baseUrl.trim().length > 0
        ? config.baseUrl.trim()
        : entry.transport.baseUrl
    );

    if (!baseUrl) {
      throw new ApiError("Provider has no base URL configured", 400, "BAD_REQUEST");
    }

    const headers: Record<string, string> = { Accept: "application/json" };
    if (entry.transport.format === "anthropic") {
      headers["x-api-key"] = apiKey;
      headers["anthropic-version"] = "2023-06-01";
    } else {
      headers["Authorization"] = `Bearer ${apiKey}`;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    let res: Response;
    try {
      res = await fetch(`${baseUrl}/models`, {
        method: "GET",
        headers,
        signal: controller.signal,
      });
    } catch (err) {
      clearTimeout(timer);
      const isTimeout = err instanceof Error && err.name === "AbortError";
      throw new ApiError(
        isTimeout ? "Request timed out fetching models" : "Could not reach provider",
        502,
        "UPSTREAM_ERROR"
      );
    }
    clearTimeout(timer);

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        throw new ApiError("Authentication failed — check your API key", 401, "AUTH_FAILED");
      }
      throw new ApiError(`Provider returned HTTP ${res.status}`, 502, "UPSTREAM_ERROR");
    }

    const data = await res.json() as {
      data?: Array<{ id?: string; name?: string }>;
      models?: Array<{ id?: string; name?: string } | string>;
      [key: string]: unknown;
    };

    // Normalize to string IDs — providers differ in response shape
    let rawModels: string[] = [];
    const list = data.data ?? data.models ?? [];
    if (Array.isArray(list)) {
      rawModels = list
        .map((m) => (typeof m === "string" ? m : (m.id ?? m.name ?? "")))
        .filter(Boolean);
    }

    // Deduplicate and sort
    const models = [...new Set(rawModels)].sort((a, b) => a.localeCompare(b));

    return apiSuccess({ models, provider, count: models.length }, { headers: NO_STORE_HEADERS });
  } catch (err) {
    return handleApiError(err);
  }
}
