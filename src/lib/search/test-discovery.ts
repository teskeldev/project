/**
 * Phase 1.8 – Test File Discovery
 *
 * Given a source file, finds associated test file(s) and vice versa.
 * Supports multiple language conventions (TS/JS, Python, Go, Rust) and
 * various directory layouts (co-located, mirror, __tests__, etc.).
 *
 * Pure TypeScript – no external dependencies, regex-based path matching.
 */

import * as path from "path";

/* =============================== Types =================================== */

export type TestAssociation = {
  sourceFile: string;
  testFiles: string[];
  confidence: number; // 0-1, how confident we are in the association
};

/* ========================== Constants / Patterns ========================= */

/**
 * Regex that matches common test file naming conventions across languages.
 *
 * Matches:
 *  - foo.test.ts / foo.test.tsx / foo.test.js / foo.test.jsx / foo.test.mjs
 *  - foo.spec.ts / foo.spec.tsx / foo.spec.js / foo.spec.jsx / foo.spec.mjs
 *  - foo_test.go / foo_test.rs
 *  - foo_test.py / test_foo.py
 *  - Files inside __tests__ directories
 */
const TEST_FILE_PATTERNS: RegExp[] = [
  // JS/TS: .test. or .spec. variants
  /\.(?:test|spec)\.[tj]sx?$/,
  /\.(?:test|spec)\.mjs$/,
  // Go / Rust: _test suffix before extension
  /_test\.(?:go|rs)$/,
  // Python: test_ prefix or _test suffix
  /(?:^|[\\/])test_[^/\\]+\.py$/,
  /(?:^|[\\/])[^/\\]+_test\.py$/,
  // Files inside __tests__ directory (any extension)
  /(?:^|[\\/])__tests__[\\/]/,
  // Files inside top-level tests/ or test/ directories with test/spec suffix
  /(?:^|[\\/])tests?[\\/].*\.(?:test|spec)\.[tj]sx?$/,
  /(?:^|[\\/])tests?[\\/].*(?:_test|test_)\.\w+$/,
];

/**
 * Directories commonly used to house test files.
 */

/**
 * Extensions grouped by language family for matching source ↔ test.
 */
const EXTENSION_FAMILIES: Record<string, string[]> = {
  typescript: [".ts", ".tsx"],
  javascript: [".js", ".jsx", ".mjs"],
  python: [".py"],
  go: [".go"],
  rust: [".rs"],
};

/* ========================== Public API ==================================== */

/**
 * Check if a file path looks like a test file.
 *
 * Uses pattern matching against known test file conventions across
 * TypeScript, JavaScript, Python, Go, and Rust ecosystems.
 */
export function isTestFile(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, "/");
  return TEST_FILE_PATTERNS.some((pattern) => pattern.test(normalized));
}

/**
 * Find all test files in a list of project files.
 *
 * @param allFiles - Array of relative file paths in the project
 * @returns Array of paths that are identified as test files
 */
export function findAllTestFiles(allFiles: string[]): string[] {
  return allFiles.filter(isTestFile);
}

/**
 * Find test files associated with a given source file.
 *
 * Searches through `allFiles` for test files that correspond to `sourcePath`
 * using naming conventions, directory structure mirroring, and fuzzy matching.
 *
 * @param sourcePath - The source file to find tests for
 * @param allFiles - All files in the project (relative paths)
 * @returns A TestAssociation with matched test files and confidence score
 */
export function findTestFiles(
  sourcePath: string,
  allFiles: string[]
): TestAssociation {
  const normalized = normalizePath(sourcePath);

  // If the source file is itself a test file, return empty
  if (isTestFile(normalized)) {
    return { sourceFile: sourcePath, testFiles: [], confidence: 0 };
  }

  const parsed = path.parse(normalized);
  const baseName = parsed.name; // e.g. "foo" from "foo.ts"
  const ext = parsed.ext; // e.g. ".ts"
  const dir = parsed.dir; // e.g. "src/lib"

  const candidates: { file: string; confidence: number }[] = [];

  for (const file of allFiles) {
    if (!isTestFile(file)) continue;

    const normalizedFile = normalizePath(file);
    const confidence = scoreTestCandidate(
      normalized,
      baseName,
      ext,
      dir,
      normalizedFile
    );

    if (confidence > 0) {
      candidates.push({ file, confidence });
    }
  }

  // Sort by confidence descending
  candidates.sort((a, b) => b.confidence - a.confidence);

  // Take the best confidence as the overall confidence
  const bestConfidence = candidates.length > 0 ? candidates[0].confidence : 0;

  return {
    sourceFile: sourcePath,
    testFiles: candidates.map((c) => c.file),
    confidence: bestConfidence,
  };
}

/**
 * Find the source file associated with a given test file.
 *
 * Reverses the test file naming conventions to locate the original source.
 *
 * @param testPath - The test file path
 * @param allFiles - All files in the project (relative paths)
 * @returns The most likely source file with confidence, or null if none found
 */
export function findSourceFile(
  testPath: string,
  allFiles: string[]
): { sourcePath: string; confidence: number } | null {
  const normalized = normalizePath(testPath);

  if (!isTestFile(normalized)) {
    return null;
  }

  const possibleSourceNames = deriveSourceNames(normalized);
  const testDir = path.dirname(normalized);

  const candidates: { file: string; confidence: number }[] = [];

  for (const file of allFiles) {
    const normalizedFile = normalizePath(file);

    // Skip test files
    if (isTestFile(normalizedFile)) continue;

    const fileBase = path.basename(normalizedFile);
    const fileDir = path.dirname(normalizedFile);

    for (const sourceName of possibleSourceNames) {
      if (fileBase === sourceName) {
        // Exact name match in same directory
        if (fileDir === testDir) {
          candidates.push({ file, confidence: 1.0 });
        }
        // Same directory but test is in __tests__ subdirectory
        else if (testDir === path.join(fileDir, "__tests__")) {
          candidates.push({ file, confidence: 0.95 });
        }
        // Mirror directory structure (tests/lib/foo.test.ts → src/lib/foo.ts)
        else if (isMirrorStructure(normalizedFile, normalized)) {
          candidates.push({ file, confidence: 0.8 });
        }
        // Name matches but different directory
        else {
          candidates.push({ file, confidence: 0.6 });
        }
      }
    }
  }

  if (candidates.length === 0) {
    return null;
  }

  // Sort by confidence descending
  candidates.sort((a, b) => b.confidence - a.confidence);

  return {
    sourcePath: candidates[0].file,
    confidence: candidates[0].confidence,
  };
}

/**
 * Detect the test command for a project based on configuration files.
 *
 * Inspects the list of project files for known test framework config files
 * and returns the appropriate test command.
 *
 * @param projectFiles - List of all file paths in the project
 * @returns The detected test command string, or null if none detected
 */
export function detectTestCommand(projectFiles: string[]): string | null {
  const baseNames = new Set(projectFiles.map((f) => path.basename(f)));

  // Vitest (check first since it's often used alongside package.json)
  if (
    baseNames.has("vitest.config.ts") ||
    baseNames.has("vitest.config.js") ||
    baseNames.has("vitest.config.mts") ||
    baseNames.has("vitest.config.mjs")
  ) {
    return "vitest run";
  }

  // Jest
  if (
    baseNames.has("jest.config.ts") ||
    baseNames.has("jest.config.js") ||
    baseNames.has("jest.config.mjs") ||
    baseNames.has("jest.config.cjs")
  ) {
    return "jest";
  }

  // Python: pytest
  if (
    baseNames.has("pytest.ini") ||
    baseNames.has("pyproject.toml") ||
    baseNames.has("setup.cfg")
  ) {
    return "pytest";
  }

  // Rust: Cargo
  if (baseNames.has("Cargo.toml")) {
    return "cargo test";
  }

  // Go
  if (baseNames.has("go.mod")) {
    return "go test ./...";
  }

  // Fallback: check package.json existence (implies npm/node project)
  if (baseNames.has("package.json")) {
    return "npm test";
  }

  return null;
}

/* ========================== Internal Helpers ============================== */

/**
 * Normalize a file path to use forward slashes for consistent matching.
 */
function normalizePath(filePath: string): string {
  return filePath.replace(/\\/g, "/");
}

/**
 * Score how likely a candidate test file corresponds to a given source file.
 *
 * @returns Confidence score between 0 and 1, or 0 if no match
 */
function scoreTestCandidate(
  sourcePath: string,
  sourceBase: string,
  sourceExt: string,
  sourceDir: string,
  testPath: string
): number {
  const testParsed = path.parse(testPath);
  const testDir = testParsed.dir;

  // Extract the "real" base name from the test file
  // e.g. "foo.test" → "foo", "test_foo" → "foo", "foo_test" → "foo"
  const testBaseName = extractTestBaseName(testPath);

  if (!testBaseName) return 0;

  // Check if base names match
  if (testBaseName !== sourceBase) {
    // Fuzzy: check if one contains the other (for partial matches)
    if (
      sourceBase.length > 3 &&
      (testBaseName.includes(sourceBase) || sourceBase.includes(testBaseName))
    ) {
      return 0.4; // Weak fuzzy match
    }
    return 0;
  }

  // Base names match — now score based on directory relationship
  // Check extension compatibility
  if (!areExtensionsCompatible(sourceExt, testPath)) {
    return 0.3; // Name matches but different language family
  }

  // Same directory: foo.ts and foo.test.ts in same dir
  if (testDir === sourceDir) {
    return 1.0;
  }

  // Test is in __tests__ subdirectory of source dir
  if (testDir === `${sourceDir}/__tests__`) {
    return 0.95;
  }

  // Test is in __tests__ at same level
  if (testDir.endsWith("__tests__") && path.dirname(testDir) === sourceDir) {
    return 0.95;
  }

  // Mirror directory structure
  if (isMirrorStructure(sourcePath, testPath)) {
    return 0.8;
  }

  // Same base name, compatible extension, but different directory
  // Check if they share some path segments
  const sharedSegments = countSharedPathSegments(sourceDir, testDir);
  if (sharedSegments > 0) {
    return Math.min(0.7, 0.5 + sharedSegments * 0.1);
  }

  // Name match only, completely different location
  return 0.6;
}

/**
 * Extract the "base" name from a test file path, stripping test-related
 * prefixes, suffixes, and directory markers.
 *
 * Examples:
 *  - "src/foo.test.ts" → "foo"
 *  - "tests/test_foo.py" → "foo"
 *  - "pkg/foo_test.go" → "foo"
 *  - "__tests__/foo.ts" → "foo"
 */
function extractTestBaseName(testPath: string): string | null {
  const basename = path.basename(testPath);

  // JS/TS: foo.test.ts, foo.spec.tsx → "foo"
  const jsMatch = basename.match(/^(.+?)\.(?:test|spec)\.[tj]sx?$/);
  if (jsMatch) return jsMatch[1];

  // JS/TS: foo.test.mjs, foo.spec.mjs → "foo"
  const mjsMatch = basename.match(/^(.+?)\.(?:test|spec)\.mjs$/);
  if (mjsMatch) return mjsMatch[1];

  // Go/Rust: foo_test.go, foo_test.rs → "foo"
  const goRustMatch = basename.match(/^(.+?)_test\.(go|rs)$/);
  if (goRustMatch) return goRustMatch[1];

  // Python: test_foo.py → "foo"
  const pyPrefixMatch = basename.match(/^test_(.+?)\.py$/);
  if (pyPrefixMatch) return pyPrefixMatch[1];

  // Python: foo_test.py → "foo"
  const pySuffixMatch = basename.match(/^(.+?)_test\.py$/);
  if (pySuffixMatch) return pySuffixMatch[1];

  // File inside __tests__ directory without test/spec suffix
  // e.g. __tests__/foo.ts → "foo"
  if (testPath.includes("__tests__/") || testPath.includes("__tests__\\")) {
    const ext = path.extname(basename);
    const name = basename.slice(0, -ext.length);
    // Strip .test/.spec if present (already handled above, but just in case)
    const cleaned = name.replace(/\.(?:test|spec)$/, "");
    return cleaned || null;
  }

  return null;
}

/**
 * Derive possible source file names from a test file path.
 *
 * Returns an array of candidate source file basenames (with extension).
 */
function deriveSourceNames(testPath: string): string[] {
  const basename = path.basename(testPath);
  const results: string[] = [];

  // JS/TS: foo.test.ts → foo.ts, foo.tsx
  const jsMatch = basename.match(/^(.+?)\.(?:test|spec)\.([tj]sx?)$/);
  if (jsMatch) {
    const [, name, ext] = jsMatch;
    results.push(`${name}.${ext}`);
    // Also try alternate extensions in the same family
    if (ext === "ts") results.push(`${name}.tsx`);
    if (ext === "tsx") results.push(`${name}.ts`);
    if (ext === "js") results.push(`${name}.jsx`);
    if (ext === "jsx") results.push(`${name}.js`);
    return results;
  }

  // JS: foo.test.mjs → foo.mjs, foo.js
  const mjsMatch = basename.match(/^(.+?)\.(?:test|spec)\.mjs$/);
  if (mjsMatch) {
    const [, name] = mjsMatch;
    results.push(`${name}.mjs`, `${name}.js`);
    return results;
  }

  // Go: foo_test.go → foo.go
  const goMatch = basename.match(/^(.+?)_test\.go$/);
  if (goMatch) {
    results.push(`${goMatch[1]}.go`);
    return results;
  }

  // Rust: foo_test.rs → foo.rs
  const rustMatch = basename.match(/^(.+?)_test\.rs$/);
  if (rustMatch) {
    results.push(`${rustMatch[1]}.rs`);
    return results;
  }

  // Python: test_foo.py → foo.py
  const pyPrefixMatch = basename.match(/^test_(.+?)\.py$/);
  if (pyPrefixMatch) {
    results.push(`${pyPrefixMatch[1]}.py`);
    return results;
  }

  // Python: foo_test.py → foo.py
  const pySuffixMatch = basename.match(/^(.+?)_test\.py$/);
  if (pySuffixMatch) {
    results.push(`${pySuffixMatch[1]}.py`);
    return results;
  }

  // __tests__/foo.ts → foo.ts
  if (testPath.includes("__tests__/")) {
    results.push(basename);
    return results;
  }

  return results;
}

/**
 * Check if two paths represent a mirror directory structure.
 *
 * A mirror structure is when the test file mirrors the source directory
 * layout under a different root, e.g.:
 *   src/lib/foo.ts → tests/lib/foo.test.ts
 *   src/utils/bar.ts → test/utils/bar.spec.ts
 */
function isMirrorStructure(sourcePath: string, testPath: string): boolean {
  const sourceParts = sourcePath.split("/");
  const testParts = testPath.split("/");

  if (sourceParts.length < 2 || testParts.length < 2) return false;

  // Common source roots
  const sourceRoots = ["src", "lib", "app", "pkg", "internal", "cmd"];
  // Common test roots
  const testRoots = ["tests", "test", "spec", "__tests__", "test_"];

  const sourceRoot = sourceParts[0];
  const testRoot = testParts[0];

  // Check if first segments are source/test roots
  const isSourceRoot = sourceRoots.includes(sourceRoot);
  const isTestRoot = testRoots.includes(testRoot);

  if (!isSourceRoot && !isTestRoot) return false;

  // Compare the remaining path segments (excluding filename)
  const sourceMiddle = sourceParts.slice(1, -1);
  const testMiddle = testParts.slice(1, -1);

  // If test has an extra segment that's a test root, skip it
  // e.g. tests/unit/lib/foo.test.ts vs src/lib/foo.ts
  let adjustedTestMiddle = testMiddle;
  if (
    testMiddle.length > 0 &&
    ["unit", "integration", "e2e", "functional"].includes(testMiddle[0])
  ) {
    adjustedTestMiddle = testMiddle.slice(1);
  }

  // Check if the middle path segments match
  if (sourceMiddle.length !== adjustedTestMiddle.length) return false;

  return sourceMiddle.every((seg, i) => seg === adjustedTestMiddle[i]);
}

/**
 * Check if a source file extension is compatible with a test file's extension.
 */
function areExtensionsCompatible(sourceExt: string, testPath: string): boolean {
  const testExt = getEffectiveExtension(testPath);
  if (!testExt) return true; // Can't determine, assume compatible

  // Find which family the source extension belongs to
  for (const family of Object.values(EXTENSION_FAMILIES)) {
    if (family.includes(sourceExt) && family.includes(testExt)) {
      return true;
    }
  }

  // If source ext matches test ext exactly
  return sourceExt === testExt;
}

/**
 * Get the "effective" extension of a test file (the language extension,
 * not the .test/.spec part).
 *
 * e.g. "foo.test.ts" → ".ts", "foo_test.go" → ".go"
 */
function getEffectiveExtension(testPath: string): string | null {
  const basename = path.basename(testPath);

  // JS/TS: foo.test.tsx → .tsx
  const jsMatch = basename.match(/\.(?:test|spec)\.([tj]sx?|mjs)$/);
  if (jsMatch) return `.${jsMatch[1]}`;

  // Go/Rust/Python: just use the actual extension
  const ext = path.extname(basename);
  return ext || null;
}

/**
 * Count how many path segments two directory paths share (from the start).
 */
function countSharedPathSegments(dir1: string, dir2: string): number {
  const parts1 = dir1.split("/").filter(Boolean);
  const parts2 = dir2.split("/").filter(Boolean);

  let count = 0;
  for (let i = 0; i < Math.min(parts1.length, parts2.length); i++) {
    if (parts1[i] === parts2[i]) {
      count++;
    } else {
      break;
    }
  }

  return count;
}
