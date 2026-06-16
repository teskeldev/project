import { describe, it, expect, vi, beforeEach } from "vitest";

const db = vi.hoisted(() => ({ integration: { findMany: vi.fn() } }));
vi.mock("@/lib/db", () => ({ prisma: db }));
vi.mock("@/lib/crypto", () => ({
  // Our test stores the apiKey as plain JSON in encryptedConfig.
  decryptJson: (s: string) => JSON.parse(s),
}));

import { resolveApiKey } from "@/lib/ai/resolve-key";

beforeEach(() => {
  db.integration.findMany.mockReset();
  delete process.env.DEEPSEEK_API_KEY;
});

describe("resolveApiKey priority pool", () => {
  it("queries DB connections ordered by priority then createdAt, returns the first usable key", async () => {
    db.integration.findMany.mockResolvedValue([
      { encryptedConfig: JSON.stringify({ apiKey: "top-key" }) },
      { encryptedConfig: JSON.stringify({ apiKey: "backup-key" }) },
    ]);

    const res = await resolveApiKey("deepseek", "ws1");
    expect(res?.apiKey).toBe("top-key");
    expect(res?.source).toBe("db");

    const args = db.integration.findMany.mock.calls[0][0];
    expect(args.where).toMatchObject({ workspaceId: "ws1", provider: "deepseek", enabled: true });
    expect(args.orderBy).toEqual([{ priority: "asc" }, { createdAt: "asc" }]);
  });

  it("skips a corrupt connection and falls through to the next", async () => {
    db.integration.findMany.mockResolvedValue([
      { encryptedConfig: "not-json" },
      { encryptedConfig: JSON.stringify({ apiKey: "good" }) },
    ]);
    const res = await resolveApiKey("deepseek", "ws1");
    expect(res?.apiKey).toBe("good");
  });

  it("returns null when no connection yields a key", async () => {
    db.integration.findMany.mockResolvedValue([]);
    expect(await resolveApiKey("deepseek", "ws1")).toBeNull();
  });
});
