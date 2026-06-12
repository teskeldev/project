import { describe, it, expect, vi } from "vitest";
import path from "node:path";

// storage.ts imports ApiError from "@/lib/api", which transitively loads
// "@/auth" (NextAuth) and "@/lib/db" (Prisma). Mock both so the unit test
// stays free of any database / network / next-server dependency.
vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: {} }));

import {
  resolveSafe,
  normalizeRelPath,
  getProjectRoot,
  assertValidName,
  detectLanguage,
  joinRelPath,
} from "@/lib/storage";
import { ApiError } from "@/lib/api";

const KEY = "proj";

/** Resolve a path and return it as a project-relative POSIX path. */
function relOf(storageKey: string, input: string): string {
  const root = getProjectRoot(storageKey);
  const abs = resolveSafe(storageKey, input);
  return path.relative(root, abs).split(path.sep).join("/");
}

describe("storage path security", () => {
  describe("normalizeRelPath / resolveSafe BLOCK traversal", () => {
    const traversal = [
      "../etc/passwd",
      "../../etc/passwd",
      "..",
      "foo/../../bar",
      "src/../../escape",
      "..\\..\\windows\\system32",
      "a/b/../../../c",
    ];
    for (const p of traversal) {
      it(`blocks "${p}"`, () => {
        expect(() => normalizeRelPath(p)).toThrowError(ApiError);
        expect(() => resolveSafe(KEY, p)).toThrowError(ApiError);
      });
    }

    it("blocks null bytes", () => {
      expect(() => normalizeRelPath("foo\u0000bar")).toThrowError(ApiError);
      expect(() => resolveSafe(KEY, "foo\u0000bar")).toThrowError(ApiError);
    });
  });

  describe("absolute paths / drive prefixes / leading slashes are RE-ROOTED, never escape", () => {
    // The normalizer strips leading slashes and drive letters, re-rooting the
    // path INSIDE the project. The security guarantee is containment, not a
    // throw. Verify the resolved path never escapes the project root.
    const reRooted: Array<[string, string]> = [
      ["/etc/passwd", "etc/passwd"],
      ["///leading/slashes", "leading/slashes"],
      ["C:\\Windows\\System32", "Windows/System32"],
      ["c:/users/secret", "users/secret"],
    ];
    for (const [input, expected] of reRooted) {
      it(`re-roots "${input}" -> "${expected}" inside the project`, () => {
        expect(normalizeRelPath(input)).toBe(expected);
        const root = getProjectRoot(KEY);
        const abs = resolveSafe(KEY, input);
        const rootWithSep = root.endsWith(path.sep) ? root : root + path.sep;
        expect(abs === root || abs.startsWith(rootWithSep)).toBe(true);
        expect(relOf(KEY, input)).toBe(expected);
      });
    }
  });

  describe("valid relative paths are ALLOWED", () => {
    const valid: Array<[string, string]> = [
      ["src/index.ts", "src/index.ts"],
      ["a/b/c/deep/file.tsx", "a/b/c/deep/file.tsx"],
      ["foo/../bar", "bar"],
      ["./readme.md", "readme.md"],
      ["nested//double//slash", "nested/double/slash"],
      ["trailing/slash/", "trailing/slash"],
    ];
    for (const [input, expected] of valid) {
      it(`allows "${input}"`, () => {
        expect(normalizeRelPath(input)).toBe(expected);
        expect(relOf(KEY, input)).toBe(expected);
      });
    }

    it("treats empty / dot as the project root", () => {
      expect(normalizeRelPath("")).toBe("");
      expect(normalizeRelPath(".")).toBe("");
      expect(resolveSafe(KEY, "")).toBe(getProjectRoot(KEY));
    });
  });

  describe("sibling-prefix escape is impossible", () => {
    // The containment check compares against `root + sep` so a sibling dir
    // whose name merely starts with the root name (app vs app-evil) cannot be
    // mistaken for being inside the root. Traversal is also blocked outright,
    // so no crafted relative path can land in a sibling directory.
    it("never resolves into a sibling directory that shares a name prefix", () => {
      const root = getProjectRoot("app");
      // Any traversal attempt throws before a sibling could be reached.
      expect(() => resolveSafe("app", "../app-evil/secret")).toThrowError(
        ApiError
      );
      // A normal resolve stays strictly under root + separator.
      const abs = resolveSafe("app", "src/file.ts");
      expect(abs.startsWith(root + path.sep)).toBe(true);
      expect(abs.startsWith(root + "-evil")).toBe(false);
    });
  });

  describe("getProjectRoot rejects unsafe storage keys", () => {
    const bad = ["../evil", "a/b", "a\\b", "..", "with\u0000null"];
    for (const k of bad) {
      it(`rejects storage key "${k}"`, () => {
        expect(() => getProjectRoot(k)).toThrowError(ApiError);
      });
    }
    it("accepts a simple storage key", () => {
      expect(() => getProjectRoot("abc123")).not.toThrow();
    });
  });
});

describe("assertValidName", () => {
  it("rejects separators, control/reserved chars, dot names, and empties", () => {
    for (const n of ["", "  ", ".", "..", "a/b", "a\\b", "a:b", "a<b", "x\u0000"]) {
      expect(() => assertValidName(n)).toThrowError(ApiError);
    }
  });
  it("accepts ordinary names and trims them", () => {
    expect(assertValidName("  index.ts  ")).toBe("index.ts");
    expect(assertValidName("my-file_01.test.tsx")).toBe("my-file_01.test.tsx");
  });
});

describe("detectLanguage", () => {
  it("maps common extensions and special filenames", () => {
    expect(detectLanguage("index.ts")).toBe("typescript");
    expect(detectLanguage("app.tsx")).toBe("typescript");
    expect(detectLanguage("style.css")).toBe("css");
    expect(detectLanguage("Dockerfile")).toBe("dockerfile");
    expect(detectLanguage(".gitignore")).toBe("ignore");
    expect(detectLanguage("schema.prisma")).toBe("prisma");
  });
  it("returns null for unknown extensions", () => {
    expect(detectLanguage("mystery.zzz")).toBeNull();
  });
});

describe("joinRelPath", () => {
  it("joins a parent dir with a child name", () => {
    expect(joinRelPath("src", "index.ts")).toBe("src/index.ts");
    expect(joinRelPath("", "index.ts")).toBe("index.ts");
    expect(joinRelPath("a/b/", "c.ts")).toBe("a/b/c.ts");
  });
});
