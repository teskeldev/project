/**
 * Read-only model registry for Fusion. Models are NOT managed here — they are
 * derived from the workspace's enabled Integrations crossed with the provider
 * catalog's known model lists. Fusion only reads; key/provider management lives
 * in the Integrations menu.
 *
 * SERVER-ONLY.
 */
import { prisma } from "@/lib/db";
import { AI_PROVIDERS, getProviderConfig } from "@/lib/ai/providers";
import { getProviderCatalog } from "./catalog";

export type AvailableModel = {
  ref: string; // "provider:modelId"
  provider: string;
  providerLabel: string;
  modelId: string;
  name: string;
  contextWindow: number;
};

/**
 * List models available to a workspace: for each enabled Integration provider
 * (plus key-less local providers), expose that provider's catalog models.
 */
export async function listAvailableModels(workspaceId: string): Promise<AvailableModel[]> {
  const integrations = await prisma.integration.findMany({
    where: { workspaceId, enabled: true },
    select: { provider: true },
  });
  const connected = new Set(integrations.map((i) => i.provider));

  const out: AvailableModel[] = [];
  for (const provider of AI_PROVIDERS) {
    const catalog = getProviderCatalog(provider.id);
    const isLocal = catalog?.local ?? !provider.requiresApiKey;
    // Surface a provider's models when it's connected via Integrations, or when
    // it's a local runtime that needs no key.
    if (!connected.has(provider.id) && !isLocal) continue;

    const cfg = getProviderConfig(provider.id);
    for (const m of cfg?.models ?? []) {
      out.push({
        ref: `${provider.id}:${m.id}`,
        provider: provider.id,
        providerLabel: provider.name,
        modelId: m.id,
        name: m.name,
        contextWindow: m.contextWindow,
      });
    }
  }
  return out;
}
