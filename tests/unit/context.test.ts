import { describe, it, expect, vi, beforeEach } from "vitest";

// context.ts depends on prisma (DB) and storage.readFile (FS). Mock both so the
// builder runs with NO database and NO filesystem access. We assert the persona,
// that enabled Rules + Knowledge are injected, and that the char budget clips
// lower-priority sections.
const findUnique = vi.fn();
const ruleFindMany = vi.fn();
const knowledgeFindMany = vi.fn();
const fileNodeFindMany = vi.fn();
const readFileMock = vi.fn();

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db", () => ({
  prisma: {
    project: { findUnique: (...a: unknown[]) => findUnique(...a) },
    rule: { findMany: (...a: unknown[]) => ruleFindMany(...a) },
    knowledgeItem: { findMany: (...a: unknown[]) => knowledgeFindMany(...a) },
    fileNode: { findMany: (...a: unknown[]) => fileNodeFindMany(...a) },
  },
}));
vi.mock("@/lib/storage", () => ({
  readFile: (...a: unknown[]) => readFileMock(...a),
}));
const loadActiveSkillsMock = vi.fn();
vi.mock("@/lib/skills", () => ({
  loadActiveSkills: (...a: unknown[]) => loadActiveSkillsMock(...a),
}));

import { buildProjectContext, TESKEL_PERSONA } from "@/lib/ai/context";

beforeEach(() => {
  findUnique.mockReset();
  ruleFindMany.mockReset();
  knowledgeFindMany.mockReset();
  fileNodeFindMany.mockReset();
  readFileMock.mockReset();
  loadActiveSkillsMock.mockReset();
  loadActiveSkillsMock.mockResolvedValue("");
});

describe("buildProjectContext", () => {
  it("returns persona-only when the project is missing", async () => {
    findUnique.mockResolvedValue(null);
    const ctx = await buildProjectContext("missing");
    expect(ctx.system).toBe(TESKEL_PERSONA);
    expect(ctx.contextBlocks).toEqual([]);
  });

  it("always starts with the Teskel persona", async () => {
    findUnique.mockResolvedValue({
      name: "Demo",
      description: null,
      storageKey: "demo",
      workspaceId: "ws1",
    });
    ruleFindMany.mockResolvedValue([]);
    knowledgeFindMany.mockResolvedValue([]);
    fileNodeFindMany.mockResolvedValue([]);

    const ctx = await buildProjectContext("p1");
    expect(ctx.system.startsWith(TESKEL_PERSONA)).toBe(true);
  });

  it("injects enabled Rules and Knowledge into the context", async () => {
    findUnique.mockResolvedValue({
      name: "Demo",
      description: "A demo project",
      storageKey: "demo",
      workspaceId: "ws1",
    });
    ruleFindMany.mockResolvedValue([
      {
        scope: "PROJECT",
        title: "Use tabs",
        content: "Always indent with tabs.",
        filePattern: null,
      },
    ]);
    knowledgeFindMany.mockResolvedValue([
      { title: "API Spec", type: "DOC", content: "The API is REST/JSON." },
    ]);
    fileNodeFindMany.mockResolvedValue([
      { path: "src/index.ts", type: "FILE" },
      { path: "src", type: "FOLDER" },
    ]);

    const ctx = await buildProjectContext("p1");
    const labels = ctx.contextBlocks.map((b) => b.label);

    expect(labels).toContain("RULES");
    expect(labels).toContain("KNOWLEDGE");
    expect(labels).toContain("PROJECT");
    expect(labels).toContain("FILE TREE");
    expect(ctx.system).toContain("Use tabs");
    expect(ctx.system).toContain("Always indent with tabs.");
    expect(ctx.system).toContain("API Spec");
    expect(ctx.system).toContain("src/index.ts");
    // folder paths render with a trailing slash
    expect(ctx.system).toContain("src/");
  });

  it("includes selected file contents via the (mocked) storage layer", async () => {
    findUnique.mockResolvedValue({
      name: "Demo",
      description: null,
      storageKey: "demo",
      workspaceId: "ws1",
    });
    ruleFindMany.mockResolvedValue([]);
    knowledgeFindMany.mockResolvedValue([]);
    fileNodeFindMany.mockResolvedValue([]);
    readFileMock.mockResolvedValue("export const x = 1;");

    const ctx = await buildProjectContext("p1", {
      selectedPaths: ["src/x.ts"],
    });
    expect(readFileMock).toHaveBeenCalledWith("demo", "src/x.ts");
    expect(ctx.system).toContain("FILE: src/x.ts");
    expect(ctx.system).toContain("export const x = 1;");
  });

  it("enforces the character budget, clipping low-priority sections", async () => {
    findUnique.mockResolvedValue({
      name: "Demo",
      description: null,
      storageKey: "demo",
      workspaceId: "ws1",
    });
    // A large rules block should consume the whole budget...
    ruleFindMany.mockResolvedValue([
      {
        scope: "GLOBAL",
        title: "Big rule",
        content: "X".repeat(5000),
        filePattern: null,
      },
    ]);
    // ...so this knowledge item must be dropped/clipped.
    knowledgeFindMany.mockResolvedValue([
      { title: "Unique-Knowledge-Marker", type: "DOC", content: "Y".repeat(5000) },
    ]);
    fileNodeFindMany.mockResolvedValue([]);

    const maxChars = 200;
    const ctx = await buildProjectContext("p1", { maxChars });
    // The budget is "soft": each section is clipped to the REMAINING budget,
    // but clip() appends a short "[truncated]" marker (~16 chars) that may
    // overshoot by the marker length per clipped block. Allow a small margin
    // for these markers while still proving the budget bounds the output
    // (the un-clipped rules+knowledge alone would be ~10k chars).
    const MARKER_OVERHEAD = 16 * 4; // generous: at most a few clipped blocks
    const blockChars = ctx.contextBlocks.reduce(
      (n, b) => n + b.content.length,
      0
    );
    expect(blockChars).toBeLessThanOrEqual(maxChars + MARKER_OVERHEAD);
    expect(blockChars).toBeLessThan(1000); // far below the ~10k unbounded size
    // The low-priority knowledge CONTENT must have been clipped out.
    expect(ctx.system).not.toContain("Unique-Knowledge-Marker");
    expect(ctx.system).not.toContain("Y".repeat(100));
    // A truncated section is marked.
    expect(ctx.system).toContain("[truncated]");
  });
});

