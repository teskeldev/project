import { describe, it, expect } from "vitest";
import { PROVIDER_CATALOG, getProviderCatalog, FUSION_STRATEGIES, JUDGE_OPTIONS, DEFAULT_LIMITS } from "@/lib/ai/fusion/catalog";
import { FUSION_TEMPLATES, getFusionTemplate } from "@/lib/ai/fusion/templates";

describe("fusion catalog", () => {
  it("keeps provider kinds (managed in Integrations, consumed read-only)", () => {
    const kinds = PROVIDER_CATALOG.map((p) => p.kind);
    for (const k of ["openai", "anthropic", "google", "openrouter", "deepseek", "groq", "xai", "ollama", "custom"]) {
      expect(kinds).toContain(k);
    }
    expect(getProviderCatalog("ollama")?.requiresKey).toBe(false);
    expect(getProviderCatalog("openai")?.requiresKey).toBe(true);
  });

  it("exposes the simple strategy + judge sets", () => {
    expect([...FUSION_STRATEGIES]).toEqual(["single", "parallel", "consensus"]);
    expect([...JUDGE_OPTIONS]).toEqual(["auto", "anthropic", "openai", "google"]);
  });

  it("provides sane default limits", () => {
    expect(DEFAULT_LIMITS.maxTokens).toBeGreaterThan(0);
    expect(DEFAULT_LIMITS.timeoutMs).toBeGreaterThan(0);
  });
});

describe("fusion templates", () => {
  it("ships the built-in templates and resolves by id", () => {
    const ids = FUSION_TEMPLATES.map((t) => t.id);
    expect(ids).toContain("senior-fullstack");
    expect(ids).toContain("web3-auditor");
    expect(getFusionTemplate("research-analyst")?.strategy).toBe("consensus");
    expect(getFusionTemplate("nope")).toBeUndefined();
  });
});
