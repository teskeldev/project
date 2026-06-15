import { describe, it, expect } from "vitest";
import { AI_PROVIDER_REGISTRY, getAiProvider } from "@/lib/ai/provider-registry";
import {
  SUPPORTED_PROVIDERS,
  PROVIDER_CATALOG,
  parseProviderConfig,
  isSupportedProvider,
} from "@/lib/integrations/providers";
import { PROVIDER_CATALOG as FUSION_CATALOG } from "@/lib/ai/fusion/catalog";

describe("integrations provider catalog (derived from registry)", () => {
  it("exposes every AI registry provider as connectable + in the catalog", () => {
    const catalogIds = new Set(PROVIDER_CATALOG.map((p) => p.id));
    for (const e of AI_PROVIDER_REGISTRY) {
      expect(isSupportedProvider(e.id)).toBe(true);
      expect(catalogIds.has(e.id)).toBe(true);
    }
    // The many-provider goal: well beyond the old 4.
    expect(SUPPORTED_PROVIDERS.length).toBeGreaterThan(12);
    expect([...SUPPORTED_PROVIDERS]).toContain("deepseek");
    expect([...SUPPORTED_PROVIDERS]).toContain("openrouter");
  });

  it("Fusion catalog is derived from the same registry (no divergence)", () => {
    const fusionKinds = new Set(FUSION_CATALOG.map((p) => p.kind));
    for (const e of AI_PROVIDER_REGISTRY) expect(fusionKinds.has(e.id)).toBe(true);
  });

  it("validates per-provider config: key required, local key-less, custom needs baseUrl", () => {
    expect(() => parseProviderConfig("openai", { apiKey: "sk-x" })).not.toThrow();
    expect(() => parseProviderConfig("openai", {})).toThrow();
    expect(() => parseProviderConfig("ollama", {})).not.toThrow(); // local, no key
    expect(() => parseProviderConfig("custom", { apiKey: "k" })).toThrow(); // baseUrl required
    expect(() => parseProviderConfig("custom", { apiKey: "k", baseUrl: "https://x/v1" })).not.toThrow();
  });

  it("registry entries carry connect metadata (apiKeyUrl + format)", () => {
    expect(getAiProvider("anthropic")?.transport.format).toBe("anthropic");
    expect(getAiProvider("openrouter")?.display.apiKeyUrl).toContain("openrouter.ai");
    expect(getAiProvider("ollama")?.local).toBe(true);
  });
});
