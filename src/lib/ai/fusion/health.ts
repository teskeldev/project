/**
 * Provider + MCP health checks for the Fusion hub. SERVER-ONLY.
 */
import { prisma } from "@/lib/db";
import { resolveApiKey } from "@/lib/ai/resolve-key";
import { getProviderCatalog } from "./catalog";

export type HealthResult = { status: "connected" | "error" | "disconnected"; latencyMs: number; detail?: string };

/**
 * Probe a provider by listing models. 2xx → connected; reachable-but-rejected
 * (401/403) → error (likely a bad key); network failure → disconnected.
 */
export async function checkProviderHealth(workspaceId: string, providerId: string): Promise<HealthResult> {
  const provider = await prisma.fusionProvider.findFirst({ where: { id: providerId, workspaceId } });
  if (!provider) throw new Error("Provider not found");

  const catalog = getProviderCatalog(provider.kind);
  const base = (provider.baseUrl || catalog?.baseUrl || "").replace(/\/+$/, "");
  const start = Date.now();

  let result: HealthResult;
  if (!base) {
    result = { status: "error", latencyMs: 0, detail: "No base URL configured" };
  } else {
    try {
      const headers: Record<string, string> = {};
      if (catalog?.requiresKey !== false) {
        const key = await resolveApiKey(provider.kind, workspaceId);
        if (key?.apiKey) {
          if (provider.kind === "anthropic") {
            headers["x-api-key"] = key.apiKey;
            headers["anthropic-version"] = "2023-06-01";
          } else {
            headers["Authorization"] = `Bearer ${key.apiKey}`;
          }
        }
      }
      const res = await fetch(`${base}/models`, {
        method: "GET",
        headers,
        signal: AbortSignal.timeout(8000),
      });
      const latencyMs = Date.now() - start;
      if (res.ok) result = { status: "connected", latencyMs };
      else if (res.status === 401 || res.status === 403)
        result = { status: "error", latencyMs, detail: `Auth failed (${res.status})` };
      else result = { status: "connected", latencyMs, detail: `Reachable (${res.status})` };
    } catch (err) {
      result = {
        status: "disconnected",
        latencyMs: Date.now() - start,
        detail: err instanceof Error ? err.message : "unreachable",
      };
    }
  }

  await prisma.fusionProvider.update({
    where: { id: providerId },
    data: { lastStatus: result.status, lastLatencyMs: result.latencyMs, lastCheckedAt: new Date() },
  });
  return result;
}

/** Best-effort MCP server reachability check (HTTP servers only in v1). */
export async function checkMcpHealth(workspaceId: string, id: string): Promise<HealthResult> {
  const server = await prisma.fusionMcpServer.findFirst({ where: { id, workspaceId } });
  if (!server) throw new Error("MCP server not found");

  const start = Date.now();
  let result: HealthResult;
  if (server.url) {
    try {
      const res = await fetch(server.url, { method: "GET", signal: AbortSignal.timeout(6000) });
      result = { status: res.ok || res.status < 500 ? "connected" : "error", latencyMs: Date.now() - start };
    } catch (err) {
      result = { status: "disconnected", latencyMs: Date.now() - start, detail: err instanceof Error ? err.message : "unreachable" };
    }
  } else {
    // Command-based (stdio) servers can't be health-checked over HTTP in v1.
    result = { status: "connected", latencyMs: 0, detail: "stdio server (not probed)" };
  }

  await prisma.fusionMcpServer.update({
    where: { id },
    data: { lastStatus: result.status, lastCheckedAt: new Date() },
  });
  return result;
}
