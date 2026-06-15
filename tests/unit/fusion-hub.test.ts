import { describe, it, expect } from "vitest";
import { resolveRoutingSteps, isParallel, stopsAtFirstSuccess } from "@/lib/ai/fusion/routing";
import { PROVIDER_CATALOG, getProviderCatalog, ROUTING_STRATEGIES, JUDGE_MODES } from "@/lib/ai/fusion/catalog";

describe("routing helpers", () => {
  it("returns the configured steps in order", () => {
    expect(resolveRoutingSteps({ steps: ["openai:gpt-4o", "anthropic:claude-opus-4-8"] })).toEqual([
      "openai:gpt-4o",
      "anthropic:claude-opus-4-8",
    ]);
  });

  it("caps steps by maxFanout", () => {
    expect(resolveRoutingSteps({ steps: ["a", "b", "c"], maxFanout: 2 })).toEqual(["a", "b"]);
  });

  it("classifies strategy execution semantics", () => {
    expect(isParallel("parallel")).toBe(true);
    expect(isParallel("fallback")).toBe(false);
    expect(stopsAtFirstSuccess("sequential")).toBe(true);
    expect(stopsAtFirstSuccess("fallback")).toBe(true);
    expect(stopsAtFirstSuccess("parallel")).toBe(false);
  });
});

describe("catalog", () => {
  it("keeps the OpenRouter-class providers (managed in Integrations)", () => {
    const kinds = PROVIDER_CATALOG.map((p) => p.kind);
    for (const k of ["openai", "anthropic", "google", "openrouter", "deepseek", "groq", "xai", "ollama", "custom"]) {
      expect(kinds).toContain(k);
    }
  });

  it("marks local runtimes as not requiring a key", () => {
    expect(getProviderCatalog("ollama")?.requiresKey).toBe(false);
    expect(getProviderCatalog("openai")?.requiresKey).toBe(true);
  });

  it("exposes the simplified routing strategies and judge modes", () => {
    expect([...ROUTING_STRATEGIES]).toEqual(["sequential", "parallel", "fallback", "cost", "latency"]);
    expect([...JUDGE_MODES]).toEqual(["consensus", "majority", "merge", "debate"]);
  });
});
