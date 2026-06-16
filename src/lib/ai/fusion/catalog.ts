/**
 * Static catalog for Fusion: provider kinds (used to derive the read-only model
 * registry from Integrations) + the Fusion strategy / judge option sets. Pure
 * data, safe to import from server and client.
 */

import { AI_PROVIDER_REGISTRY } from "@/lib/ai/provider-registry";

export type ProviderKind = string;

export type ProviderCatalogEntry = {
  kind: string;
  label: string;
  baseUrl: string;
  requiresKey: boolean;
  local: boolean;
};

// Derived from the single provider registry so Integrations + Fusion never diverge.
export const PROVIDER_CATALOG: ProviderCatalogEntry[] = AI_PROVIDER_REGISTRY.map((p) => ({
  kind: p.id,
  label: p.name,
  baseUrl: p.transport.baseUrl,
  requiresKey: p.requiresKey,
  local: p.local,
}));

export function getProviderCatalog(kind: string): ProviderCatalogEntry | undefined {
  return PROVIDER_CATALOG.find((p) => p.kind === kind);
}

export const FUSION_STRATEGIES = ["single", "parallel", "consensus"] as const;
export type FusionStrategy = (typeof FUSION_STRATEGIES)[number];

export const JUDGE_OPTIONS = ["auto", "anthropic", "openai", "google"] as const;
export type JudgeOption = (typeof JUDGE_OPTIONS)[number];

export type FusionLimits = { maxCostUsd: number; maxTokens: number; timeoutMs: number };
export const DEFAULT_LIMITS: FusionLimits = { maxCostUsd: 5, maxTokens: 50000, timeoutMs: 60000 };
