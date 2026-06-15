import { describe, it, expect, vi, beforeEach } from "vitest";

const chatMock = vi.hoisted(() => vi.fn());
const isConfiguredMock = vi.hoisted(() => vi.fn());
const resolveFusionMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/ai/provider", () => ({
  chat: (...a: unknown[]) => chatMock(...a),
  isAIConfiguredAsync: (...a: unknown[]) => isConfiguredMock(...a),
}));
vi.mock("@/lib/quota", () => ({ recordUsage: vi.fn() }));
vi.mock("@/lib/ai/fusion/logging", () => ({ recordFusionRequest: vi.fn() }));
vi.mock("@/lib/ai/fusion/resolver", () => ({
  resolveFusion: (...a: unknown[]) => resolveFusionMock(...a),
  buildFusionSystem: () => "",
}));

import { runFusion, type FusionProgress } from "@/lib/ai/fusion/runner";

const LIMITS = { maxCostUsd: 5, maxTokens: 1000, timeoutMs: 5000 };

function resolved(strategy: string, modelCount: number) {
  const models = Array.from({ length: modelCount }, (_, i) => ({
    ref: `openai:m${i}`, provider: "openai", modelId: `m${i}`, name: `M${i}`,
  }));
  return {
    fusion: { strategy, judge: "auto", judgeModelId: null, limits: LIMITS },
    models, skills: [], rules: [], knowledge: [], warnings: [],
  };
}

beforeEach(() => {
  chatMock.mockReset();
  isConfiguredMock.mockReset().mockResolvedValue(true);
  resolveFusionMock.mockReset();
});

describe("runFusion", () => {
  it("parallel: fans out to models, judges, and parses the merge rationale", async () => {
    resolveFusionMock.mockResolvedValue(resolved("parallel", 2));
    chatMock
      .mockResolvedValueOnce("answer A")
      .mockResolvedValueOnce("answer B")
      .mockResolvedValueOnce("<<<ANSWER>>>final fused<<<RATIONALE>>>kept A's structure");

    const events: FusionProgress[] = [];
    const r = await runFusion({ fusionId: "f", prompt: "hi", workspaceId: "ws", onProgress: (e) => events.push(e) });

    expect(r.runs).toHaveLength(2);
    expect(r.fused).toBe("final fused");
    expect(r.mergeRationale).toBe("kept A's structure");
    expect(chatMock).toHaveBeenCalledTimes(3); // 2 models + judge
    expect(events.filter((e) => e.type === "model_start")).toHaveLength(2);
    expect(events.filter((e) => e.type === "model_done")).toHaveLength(2);
    expect(events.some((e) => e.type === "judging")).toBe(true);
  });

  it("single: one model, no judge, no rationale", async () => {
    resolveFusionMock.mockResolvedValue(resolved("single", 3));
    chatMock.mockResolvedValueOnce("solo answer");

    const r = await runFusion({ fusionId: "f", prompt: "hi", workspaceId: "ws" });

    expect(r.runs).toHaveLength(1);
    expect(r.fused).toBe("solo answer");
    expect(r.mergeRationale).toBeUndefined();
    expect(r.judgeUsed).toBe("none");
    expect(chatMock).toHaveBeenCalledTimes(1);
  });

  it("returns a clear message when there are no available models", async () => {
    resolveFusionMock.mockResolvedValue(resolved("parallel", 0));
    const r = await runFusion({ fusionId: "f", prompt: "hi", workspaceId: "ws" });
    expect(r.runs).toHaveLength(0);
    expect(r.fused).toMatch(/no available models/i);
  });
});
