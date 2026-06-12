/**
 * Server-only helpers for the integrations feature: building SAFE (masked)
 * representations of stored integrations and validating request bodies.
 *
 * SERVER-ONLY: imports `@/lib/crypto` (Node crypto). Never import from a client
 * component.
 */
import { z } from "zod";
import type { Integration } from "@prisma/client";
import { decryptJson } from "@/lib/crypto";
import {
  SUPPORTED_PROVIDERS,
  PROVIDER_SECRET_FIELDS,
  isSupportedProvider,
  type ProviderId,
} from "@/lib/integrations/providers";

/* -------------------------------------------------------------------------- */
/* Request schemas                                                            */
/* -------------------------------------------------------------------------- */

export const createIntegrationSchema = z.object({
  workspaceId: z.string().min(1, "workspaceId is required"),
  provider: z.enum(SUPPORTED_PROVIDERS),
  name: z.string().trim().min(1, "Name is required").max(120),
  // Per-provider shape is validated separately once provider is known.
  config: z.record(z.string(), z.unknown()),
});
export type CreateIntegrationInput = z.infer<typeof createIntegrationSchema>;

export const updateIntegrationSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    enabled: z.boolean().optional(),
    config: z.record(z.string(), z.unknown()).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: "No fields to update",
  });
export type UpdateIntegrationInput = z.infer<typeof updateIntegrationSchema>;

/* -------------------------------------------------------------------------- */
/* Masking                                                                    */
/* -------------------------------------------------------------------------- */

/** Show only the last 4 chars of a secret, e.g. "••••3a9f". */
function maskSecret(value: unknown): string {
  const str = typeof value === "string" ? value : String(value ?? "");
  const last4 = str.slice(-4);
  return last4 ? `••••${last4}` : "••••";
}

export type SafeIntegration = {
  id: string;
  workspaceId: string;
  provider: string;
  name: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  /** Non-secret config values, echoed as-is (e.g. baseUrl, model, url). */
  configHints: Record<string, string>;
  /** Which config fields are present (both secret and non-secret keys). */
  configuredFields: string[];
  /** Masked previews of secret fields (last 4 chars only). */
  maskedSecrets: Record<string, string>;
};

/**
 * Build a SAFE representation of an integration for API responses.
 * NEVER includes decrypted secret values; secret fields are masked to last4.
 * Decryption failures degrade gracefully (no crash, no leak).
 */
export function toSafeIntegration(row: Integration): SafeIntegration {
  const provider = row.provider;
  const secretFields: readonly string[] = isSupportedProvider(provider)
    ? PROVIDER_SECRET_FIELDS[provider as ProviderId]
    : [];

  const configHints: Record<string, string> = {};
  const maskedSecrets: Record<string, string> = {};
  const configuredFields: string[] = [];

  try {
    const config = decryptJson<Record<string, unknown>>(row.encryptedConfig);
    for (const [key, value] of Object.entries(config)) {
      const hasValue =
        value !== undefined &&
        value !== null &&
        !(typeof value === "string" && value.length === 0);
      if (!hasValue) continue;

      configuredFields.push(key);
      if (secretFields.includes(key)) {
        maskedSecrets[key] = maskSecret(value);
      } else if (typeof value === "string") {
        configHints[key] = value;
      }
    }
  } catch {
    // Corrupt/unreadable config: return the row metadata without config detail.
  }

  return {
    id: row.id,
    workspaceId: row.workspaceId,
    provider: row.provider,
    name: row.name,
    enabled: row.enabled,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    configHints,
    configuredFields,
    maskedSecrets,
  };
}