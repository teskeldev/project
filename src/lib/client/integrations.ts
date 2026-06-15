/**
 * Client-side typed helpers for the integrations API (Phase 7c).
 *
 * This is an OWN client module for the integrations feature (kept separate from
 * the shared `src/lib/client/api.ts`). It reuses `apiFetch` for the standard
 * success/error envelope handling.
 *
 * Secrets are NEVER present here: the API only returns masked hints + which
 * fields are configured. Plaintext config flows one-way (client -> server) on
 * create/update.
 */
import { apiFetch } from "@/lib/client/api";
import type { ProviderId } from "@/lib/integrations/providers";

export type SafeIntegration = {
  id: string;
  workspaceId: string;
  provider: string;
  name: string;
  enabled: boolean;
  priority: number;
  createdAt: string;
  updatedAt: string;
  configHints: Record<string, string>;
  configuredFields: string[];
  maskedSecrets: Record<string, string>;
};

export type IntegrationTestResult = { ok: boolean; message: string };

export function listIntegrations(
  workspaceId?: string
): Promise<{ integrations: SafeIntegration[] }> {
  const qs = workspaceId
    ? `?workspaceId=${encodeURIComponent(workspaceId)}`
    : "";
  return apiFetch(`/api/integrations${qs}`);
}

export function createIntegration(input: {
  workspaceId: string;
  provider: ProviderId;
  name: string;
  config: Record<string, unknown>;
  priority?: number;
}): Promise<{ integration: SafeIntegration }> {
  return apiFetch("/api/integrations", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateIntegration(
  id: string,
  input: {
    name?: string;
    enabled?: boolean;
    config?: Record<string, unknown>;
  }
): Promise<{ integration: SafeIntegration }> {
  return apiFetch(`/api/integrations/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteIntegration(
  id: string
): Promise<{ deleted: boolean; id: string }> {
  return apiFetch(`/api/integrations/${id}`, { method: "DELETE" });
}

export function testIntegration(id: string): Promise<IntegrationTestResult> {
  return apiFetch(`/api/integrations/${id}/test`, { method: "POST" });
}