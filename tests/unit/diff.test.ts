import { describe, it, expect } from "vitest";
import { diffStat, parseUnifiedDiff, buildSideBySide } from "@/lib/diff";

// A small unified diff as produced by changeset.ts#unifiedDiff.
const SAMPLE = [
  "--- a/src/index.ts",
  "+++ b/src/index.ts",
  " const a = 1;",
  "-const b = 2;",
  "+const b = 3;",
  "+const c = 4;",
  " export { a };",
].join("\n");

describe("diffStat", () => {
  it("counts additions and deletions, ignoring file headers", () => {
    const stat = diffStat(SAMPLE);
    expect(stat.additions).toBe(2);
    expect(stat.deletions).toBe(1);
  });

  it("returns zeros for null / empty input", () => {
    expect(diffStat(null)).toEqual({ additions: 0, deletions: 0 });
    expect(diffStat(undefined)).toEqual({ additions: 0, deletions: 0 });
    expect(diffStat("")).toEqual({ additions: 0, deletions: 0 });
  });
});

describe("parseUnifiedDiff", () => {
  it("classifies meta / context / added / removed lines", () => {
    const lines = parseUnifiedDiff(SAMPLE);
    const meta = lines.filter((l) => l.type === "meta");
    const added = lines.filter((l) => l.type === "added");
    const removed = lines.filter((l) => l.type === "removed");
    const context = lines.filter((l) => l.type === "context");

    expect(meta).toHaveLength(2);
    expect(added).toHaveLength(2);
    expect(removed).toHaveLength(1);
    expect(context).toHaveLength(2);
  });

  it("tracks old/new line numbers correctly", () => {
    const lines = parseUnifiedDiff(SAMPLE).filter((l) => l.type !== "meta");
    // first context line is old #1 / new #1
    expect(lines[0]).toMatchObject({ type: "context", oldLine: 1, newLine: 1 });
    // removed line advances only the old counter
    const removed = lines.find((l) => l.type === "removed");
    expect(removed?.oldLine).toBe(2);
    expect(removed?.newLine).toBeNull();
    // added lines advance only the new counter
    const added = lines.filter((l) => l.type === "added");
    expect(added[0].oldLine).toBeNull();
    expect(added[0].newLine).toBe(2);
  });

  it("returns an empty array for falsy input", () => {
    expect(parseUnifiedDiff(null)).toEqual([]);
    expect(parseUnifiedDiff("")).toEqual([]);
  });
});

describe("buildSideBySide", () => {
  it("aligns unchanged lines as context rows", () => {
    const rows = buildSideBySide("a\nb\nc", "a\nb\nc");
    expect(rows).toHaveLength(3);
    expect(rows.every((r) => r.type === "context")).toBe(true);
  });

  it("emits added rows for inserted lines", () => {
    const rows = buildSideBySide("a\nc", "a\nb\nc");
    const added = rows.filter((r) => r.type === "added");
    expect(added).toHaveLength(1);
    expect(added[0].right.content).toBe("b");
    expect(added[0].left.content).toBeNull();
  });

  it("emits removed rows for deleted lines", () => {
    const rows = buildSideBySide("a\nb\nc", "a\nc");
    const removed = rows.filter((r) => r.type === "removed");
    expect(removed).toHaveLength(1);
    expect(removed[0].left.content).toBe("b");
    expect(removed[0].right.content).toBeNull();
  });

  it("handles null/undefined inputs as empty files", () => {
    expect(buildSideBySide(null, null)).toEqual([
      { left: { lineNumber: 1, content: "" }, right: { lineNumber: 1, content: "" }, type: "context" },
    ]);
  });
});
