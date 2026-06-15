import { describe, it, expect } from "vitest";
import { resolveRouting, type RoutableModel } from "@/lib/ai/fusion/routing";
import { PROVIDER_CATALOG, getProviderCatalog } from "@/lib/ai/fusion/catalog";

const models: RoutableModel[] = [
  { id: "a", modelId: "cheap", pricing: { input: 1, output: 2 }, capabilities: { reasoning: false, vision: false, tools: true, structuredOutput: true, jsonMode: true } },
  { id: "b", modelId: "smart", pricing: { input: 15, output: 60 }, capabilities: { reasoning: true, vision: false, tools: true, structuredOutput: true, jsonMode: true } },
  { id: "c", modelId: "vision", pricing: { input: 5, output: 10 }, capabilities: { reasoning: false, vision: true, tools: true, structuredOutput: true, jsonMode: true } },
];

describe("resolveRouting", () => {
  it("cheapest puts the lowest blended price first", () => {
    expect(resolveRouting("cheapest", models)[0].id).toBe("a");
  });

  it("quality puts the reasoning/most expensive model first", () => {
    expect(resolveRouting("quality", models)[0].id).toBe("b");
  });

  it("vision surfaces vision-capable models first", () => {
    expect(resolveRouting("vision", models)[0].id).toBe("c");
  });

  it("fallback honors the configured chain order", () => {
    const ordered = resolveRouting("fallback", models, { fallbackChain: ["b", "a"] });
    expect(ordered.map((m) => m.id)).toEqual(["b", "a", "c"]);
  });
});

describe("provider catalog", () => {
  it("includes the OpenRouter-class providers", () => {
    const kinds = PROVIDER_CATALOG.map((p) => p.kind);
    for (const k of ["openai", "anthropic", "google", "openrouter", "deepseek", "groq", "cerebras", "together", "fireworks", "xai", "ollama", "lmstudio", "azure-openai", "custom"]) {
      expect(kinds).toContain(k);
    }
  });

  it("marks local runtimes as not requiring a key", () => {
    expect(getProviderCatalog("ollama")?.requiresKey).toBe(false);
    expect(getProviderCatalog("lmstudio")?.requiresKey).toBe(false);
    expect(getProviderCatalog("openai")?.requiresKey).toBe(true);
  });
});
