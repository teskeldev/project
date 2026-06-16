import { describe, it, expect, vi, beforeEach } from "vitest";

// Mocking dependencies
const chatMock = vi.fn();
const isAIConfiguredAsyncMock = vi.fn();

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: {} }));
vi.mock("@/lib/ai/provider", () => ({
  chat: (...args: unknown[]) => chatMock(...args),
  isAIConfiguredAsync: (...args: unknown[]) => isAIConfiguredAsyncMock(...args),
}));

import { executeFusion, detectPanel } from "@/lib/ai/fusion-panel";

beforeEach(() => {
  chatMock.mockReset();
  isAIConfiguredAsyncMock.mockReset();
});

describe("Fusion Panel Integration Tests", () => {
  describe("detectPanel", () => {
    it("returns a multi-provider panel when both anthropic and openai are configured", async () => {
      isAIConfiguredAsyncMock.mockImplementation((provider: string) => {
        return provider === "anthropic" || provider === "openai";
      });

      const panel = await detectPanel();
      expect(panel.slug).toBe("opus4.8-gpt5.5");
      expect(panel.panelists).toEqual([
        { model: "claude-opus-4-8", provider: "anthropic" },
        { model: "gpt-4o", provider: "openai" },
      ]);
      expect(panel.judge).toEqual({ model: "claude-opus-4-8", provider: "anthropic" });
    });

    it("uses two cold Opus 4.8 runs (opus4.8-4.8) when only Anthropic is configured", async () => {
      isAIConfiguredAsyncMock.mockImplementation((provider: string) => provider === "anthropic");

      const panel = await detectPanel();
      expect(panel.slug).toBe("opus4.8-4.8");
      expect(panel.panelists).toHaveLength(2);
      expect(panel.panelists.every((p) => p.model === "claude-opus-4-8")).toBe(true);
      expect(panel.judge).toEqual({ model: "claude-opus-4-8", provider: "anthropic" });
      expect(panel.downgraded).toBe(false);
    });

    it("downgrades and never lets Opus drive when Anthropic is absent", async () => {
      isAIConfiguredAsyncMock.mockImplementation((provider: string) => provider === "openai");

      const panel = await detectPanel();
      expect(panel.downgraded).toBe(true);
      expect(panel.dropped.join(" ")).toContain("opus4.8");
      expect(panel.judge.provider).toBe("openai");
    });
  });

  describe("executeFusion Track B (Research/Analysis)", () => {
    it("runs fanned-out panelist calls and synthesizes them using the judge model", async () => {
      isAIConfiguredAsyncMock.mockResolvedValue(true);

      // Setup chat mock returns
      // 1. Panelist 1 (Claude 3.5 Sonnet)
      // 2. Panelist 2 (GPT-4o)
      // 3. Panelist 3 (Llama-3.1-70b)
      // 4. Judge model synthesis
      chatMock
        .mockResolvedValueOnce("Panelist 1 Response: Use PostgreSQL because of JSONB support.")
        .mockResolvedValueOnce("Panelist 2 Response: Use PostgreSQL for robust transactions.")
        .mockResolvedValueOnce("Panelist 3 Response: Use PostgreSQL because it scales well.")
        .mockResolvedValueOnce(`# Final Answer
PostgreSQL is the recommended database.

# Consensus
- Panelists agreed that PostgreSQL is the best choice (Attributed to: Panelist 1, Panelist 2, Panelist 3)

# Contradictions
- No major contradictions found.

# Partial Coverage
- Panelist 1 highlighted JSONB (Attributed to: Panelist 1)

# Unique Insights
- None.

# Blind Spots
- None.`);

      const result = await executeFusion({
        task: "Which database should I use for my app?",
        panelSlug: "opus4.8-gpt5.5-gemini3.1pro",
      });

      expect(result.success).toBe(true);
      expect(result.track).toBe("B");
      expect(result.panelSlug).toBe("opus4.8-gpt5.5-gemini3.1pro");
      expect(result.deliverable).toContain("PostgreSQL is the recommended database.");
      expect(result.analysis?.consensus).toContain("Panelists agreed that PostgreSQL");
      expect(chatMock).toHaveBeenCalledTimes(4);
    });
  });

  describe("executeFusion Track A (Code/Artifact)", () => {
    it("runs code fanned-out panelist calls, runs validation, and merges them using the judge", async () => {
      isAIConfiguredAsyncMock.mockResolvedValue(true);

      // Panelist 1 code
      const codeA = "const greet = () => 'Hello';";
      // Panelist 2 code
      const codeB = "function greet() { return 'Hello'; }";
      // Judge merged code
      const mergedCode = '{\n  "code": "const greet = () => \\"Hello\\";",\n  "mergeRationale": "Kept the cleaner arrow function syntax from Candidate A."\n}';

      chatMock
        .mockResolvedValueOnce(`\`\`\`javascript\n${codeA}\n\`\`\``)
        .mockResolvedValueOnce(`\`\`\`javascript\n${codeB}\n\`\`\``)
        .mockResolvedValueOnce(mergedCode);

      const result = await executeFusion({
        task: "write a javascript greet function",
        validateSyntax: true,
        panelSlug: "opus4.8-4.8",
      });

      expect(result.success).toBe(true);
      expect(result.track).toBe("A");
      expect(result.deliverable).toBe('const greet = () => "Hello";');
      expect(result.mergeRationale).toBe("Kept the cleaner arrow function syntax from Candidate A.");
      expect(chatMock).toHaveBeenCalledTimes(3);
    });
  });
});
