/**
 * Cooldown and error-tagging utilities for integrations.
 * Used by test routes and the model router to flag rate-limits,
 * auth failures, etc. and temporarily suppress a provider.
 */

export type IntegrationErrorType =
  | "AUTH"
  | "RATE_LIMIT"
  | "QUOTA"
  | "NETWORK"
  | "SERVER"
  | "TIMEOUT"
  | "UNKNOWN";

const COOLDOWN_MS: Record<IntegrationErrorType, number> = {
  AUTH: 0,
  RATE_LIMIT: 60_000,
  QUOTA: 3_600_000,
  NETWORK: 30_000,
  SERVER: 120_000,
  TIMEOUT: 30_000,
  UNKNOWN: 60_000,
};

export function classifyError(
  statusCode: number | null,
  message: string,
): IntegrationErrorType {
  if (statusCode === 401 || statusCode === 403) return "AUTH";
  if (statusCode === 429) return "RATE_LIMIT";
  if (statusCode === 402) return "QUOTA";
  if (statusCode === 408 || /timeout/i.test(message)) return "TIMEOUT";
  if (statusCode != null && statusCode >= 500) return "SERVER";
  if (/network|ECONNREFUSED|ENOTFOUND|fetch/i.test(message)) return "NETWORK";
  return "UNKNOWN";
}

export function cooldownUntilFor(errorType: IntegrationErrorType): Date | null {
  const ms = COOLDOWN_MS[errorType];
  if (!ms) return null;
  return new Date(Date.now() + ms);
}

export function isOnCooldown(cooldownUntil: Date | null | undefined): boolean {
  if (!cooldownUntil) return false;
  return cooldownUntil > new Date();
}
