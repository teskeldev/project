import { describe, it, expect, vi, beforeEach } from "vitest";

const getSkillBySlugMock = vi.fn();
const loadSkillContentMock = vi.fn();

vi.mock("@/lib/db", () => ({ prisma: {} }));
vi.mock("@/lib/skills", () => ({
  getSkillBySlug: (...a: unknown[]) => getSkillBySlugMock(...a),
}));
vi.mock("@/lib/skills-loader", () => ({
  loadSkillContent: (...a: unknown[]) => loadSkillContentMock(...a),
}));

import { resolveSkillsContent } from "@/lib/ai/fusion-profile";

beforeEach(() => {
  getSkillBySlugMock.mockReset();
  loadSkillContentMock.mockReset();
});

describe("resolveSkillsContent", () => {
  it("returns empty string when no slugs are given", async () => {
    expect(await resolveSkillsContent([], "ws1")).toBe("");
  });

  it("prefers a workspace DB skill and wraps it in a FUSED SKILLS block", async () => {
    getSkillBySlugMock.mockResolvedValue({ name: "Security Audit", content: "audit rules here" });

    const block = await resolveSkillsContent(["security-audit"], "ws1");

    expect(getSkillBySlugMock).toHaveBeenCalledWith("ws1", "security-audit");
    expect(loadSkillContentMock).not.toHaveBeenCalled();
    expect(block).toContain("--- FUSED SKILLS ---");
    expect(block).toContain("### Skill: Security Audit");
    expect(block).toContain("audit rules here");
    expect(block).toContain("--- END SKILLS ---");
  });

  it("caps the block at the budget when content is huge", async () => {
    getSkillBySlugMock.mockResolvedValue({ name: "Big", content: "x".repeat(20000) });

    const block = await resolveSkillsContent(["big"], "ws1");

    // 8000 char cap + the END marker suffix.
    expect(block.length).toBeLessThanOrEqual(8100);
    expect(block.startsWith("--- FUSED SKILLS ---")).toBe(true);
  });

  it("deduplicates slugs", async () => {
    getSkillBySlugMock.mockResolvedValue({ name: "Dup", content: "c" });
    await resolveSkillsContent(["dup", "dup"], "ws1");
    expect(getSkillBySlugMock).toHaveBeenCalledTimes(1);
  });
});
