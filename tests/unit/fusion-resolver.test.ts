import { describe, it, expect, vi, beforeEach } from "vitest";

const db = vi.hoisted(() => ({
  fusion: { findFirst: vi.fn() },
  integration: { findMany: vi.fn() },
  skill: { findMany: vi.fn() },
  rule: { findMany: vi.fn() },
  knowledgeItem: { findMany: vi.fn() },
}));

vi.mock("@/lib/db", () => ({ prisma: db }));

import { resolveFusion, resolveFusionContext } from "@/lib/ai/fusion/resolver";

beforeEach(() => {
  Object.values(db).forEach((m) => Object.values(m).forEach((fn) => (fn as ReturnType<typeof vi.fn>).mockReset()));
});

function fusionRow(over: Record<string, unknown> = {}) {
  return {
    id: "f1", workspaceId: "ws1", name: "Team", description: null,
    modelIds: ["openai:gpt-4o", "anthropic:claude-opus-4-8"],
    skillIds: [], ruleIds: [], knowledgeIds: [],
    strategy: "parallel", judge: "auto", judgeModelId: null,
    limits: { maxCostUsd: 5, maxTokens: 1000, timeoutMs: 1000 },
    status: "active", isTemplate: false, createdById: "u1",
    createdAt: new Date(), updatedAt: new Date(), ...over,
  };
}

describe("resolveFusion graceful degradation", () => {
  it("drops models whose provider isn't connected and warns", async () => {
    db.fusion.findFirst.mockResolvedValue(fusionRow());
    db.integration.findMany.mockResolvedValue([{ provider: "openai" }]); // anthropic NOT connected
    db.skill.findMany.mockResolvedValue([]);
    db.rule.findMany.mockResolvedValue([]);
    db.knowledgeItem.findMany.mockResolvedValue([]);

    const resolved = await resolveFusion("f1", "ws1");

    const refs = resolved.models.map((m) => m.ref);
    expect(refs).toContain("openai:gpt-4o");
    expect(refs).not.toContain("anthropic:claude-opus-4-8");
    expect(resolved.warnings.some((w) => w.includes("anthropic:claude-opus-4-8"))).toBe(true);
  });

  it("warns for skill ids that resolve to nothing in scope", async () => {
    db.fusion.findFirst.mockResolvedValue(fusionRow({ modelIds: ["openai:gpt-4o"], skillIds: ["s-missing"] }));
    db.integration.findMany.mockResolvedValue([{ provider: "openai" }]);
    db.skill.findMany.mockResolvedValue([]); // none found
    db.rule.findMany.mockResolvedValue([]);
    db.knowledgeItem.findMany.mockResolvedValue([]);

    const resolved = await resolveFusion("f1", "ws1");
    expect(resolved.skills).toHaveLength(0);
    expect(resolved.warnings.some((w) => w.includes("s-missing"))).toBe(true);
  });

  it("throws when the Fusion does not exist", async () => {
    db.fusion.findFirst.mockResolvedValue(null);
    await expect(resolveFusion("nope", "ws1")).rejects.toThrow();
  });
});

describe("resolveFusionContext (lightweight injection)", () => {
  it("returns the primary available model + a system block from rules/skills", async () => {
    db.fusion.findFirst.mockResolvedValue(
      fusionRow({ modelIds: ["openai:gpt-4o"], ruleIds: ["r1"], skillIds: [], knowledgeIds: [] })
    );
    db.integration.findMany.mockResolvedValue([{ provider: "openai" }]);
    db.skill.findMany.mockResolvedValue([]);
    db.rule.findMany.mockResolvedValue([{ id: "r1", title: "No any", content: "Avoid any types.", workspaceId: "ws1", projectId: null }]);
    db.knowledgeItem.findMany.mockResolvedValue([]);

    const ctx = await resolveFusionContext("f1", "ws1");
    expect(ctx.primary).toEqual({ provider: "openai", modelId: "gpt-4o" });
    expect(ctx.system).toContain("RULES");
    expect(ctx.system).toContain("Avoid any types.");
  });

  it("keeps a free provider:modelId when the provider is connected (B-6)", async () => {
    db.fusion.findFirst.mockResolvedValue(fusionRow({ modelIds: ["openai:custom-router-model"] }));
    db.integration.findMany.mockResolvedValue([{ provider: "openai" }]); // openai connected
    db.skill.findMany.mockResolvedValue([]);
    db.rule.findMany.mockResolvedValue([]);
    db.knowledgeItem.findMany.mockResolvedValue([]);

    const ctx = await resolveFusionContext("f1", "ws1");
    expect(ctx.primary).toEqual({ provider: "openai", modelId: "custom-router-model" });
    expect(ctx.warnings).toHaveLength(0);
  });

  it("returns null primary when no model is available", async () => {
    db.fusion.findFirst.mockResolvedValue(fusionRow({ modelIds: ["anthropic:claude-opus-4-8"] }));
    db.integration.findMany.mockResolvedValue([{ provider: "openai" }]);
    db.skill.findMany.mockResolvedValue([]);
    db.rule.findMany.mockResolvedValue([]);
    db.knowledgeItem.findMany.mockResolvedValue([]);

    const ctx = await resolveFusionContext("f1", "ws1");
    expect(ctx.primary).toBeNull();
    expect(ctx.warnings.length).toBeGreaterThan(0);
  });
});
