/**
 * Test Execution & Auto-Fix Loop — Phase 3.4
 *
 * Runs tests against generated code and iteratively fixes failures.
 * Supports common test frameworks: vitest, jest, pytest, go test.
 */
import { exec } from "child_process";
import { promisify } from "util";
import { chat } from "@/lib/ai/provider";

const execAsync = promisify(exec);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TestResult = {
  passed: boolean;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  failures: TestFailure[];
  duration: number; // ms
  raw: string; // Raw output
  command: string; // Command that was run
};

export type TestFailure = {
  testName: string;
  file?: string;
  message: string;
  expected?: string;
  actual?: string;
  stackTrace?: string;
};

export type AutoFixOptions = {
  code: string; // The code that was generated
  testCommand: string; // Command to run tests
  cwd: string; // Working directory
  maxAttempts?: number; // Max fix attempts (default 3)
  modelId?: string;
  provider?: string;
  workspaceId?: string;
  signal?: AbortSignal;
  onAttempt?: (attempt: number, result: TestResult) => void;
};

export type AutoFixResult = {
  success: boolean;
  finalCode: string;
  attempts: number;
  testResults: TestResult[];
  fixesApplied: string[]; // Description of each fix
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_TIMEOUT = 30_000; // 30 seconds
const DEFAULT_MAX_ATTEMPTS = 3;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Run tests and return structured results */
export async function runTests(
  command: string,
  cwd: string,
  options?: { timeout?: number }
): Promise<TestResult> {
  const timeout = options?.timeout ?? DEFAULT_TIMEOUT;
  const start = Date.now();

  let stdout = "";
  let stderr = "";
  let exitCode = 0;

  try {
    const result = await execAsync(command, {
      cwd,
      timeout,
      env: { ...process.env, FORCE_COLOR: "0", CI: "true" },
      maxBuffer: 10 * 1024 * 1024, // 10MB
    });
    stdout = result.stdout;
    stderr = result.stderr;
  } catch (err: unknown) {
    const execErr = err as {
      stdout?: string;
      stderr?: string;
      code?: number;
      killed?: boolean;
    };
    stdout = execErr.stdout ?? "";
    stderr = execErr.stderr ?? "";
    exitCode = execErr.code ?? 1;

    if (execErr.killed) {
      return {
        passed: false,
        totalTests: 0,
        passedTests: 0,
        failedTests: 0,
        failures: [
          {
            testName: "(timeout)",
            message: `Test command timed out after ${timeout}ms`,
          },
        ],
        duration: Date.now() - start,
        raw: `TIMEOUT: ${command}`,
        command,
      };
    }
  }

  const raw = `${stdout}\n${stderr}`.trim();
  const duration = Date.now() - start;
  const framework = detectFramework(raw);
  const failures = parseTestOutput(raw, framework);

  // Try to extract counts from output
  const counts = extractTestCounts(raw, framework);

  return {
    passed: exitCode === 0 && failures.length === 0,
    totalTests: counts.total,
    passedTests: counts.passed,
    failedTests: counts.failed || failures.length,
    failures,
    duration,
    raw,
    command,
  };
}

/** Run tests and iteratively fix failures */
export async function autoFixWithTests(
  options: AutoFixOptions
): Promise<AutoFixResult> {
  const {
    testCommand,
    cwd,
    maxAttempts = DEFAULT_MAX_ATTEMPTS,
    modelId,
    provider,
    workspaceId,
    signal,
    onAttempt,
  } = options;

  let currentCode = options.code;
  const testResults: TestResult[] = [];
  const fixesApplied: string[] = [];

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (signal?.aborted) {
      break;
    }

    const result = await runTests(testCommand, cwd);
    testResults.push(result);
    onAttempt?.(attempt, result);

    if (result.passed) {
      return {
        success: true,
        finalCode: currentCode,
        attempts: attempt,
        testResults,
        fixesApplied,
      };
    }

    // Don't try to fix on the last attempt
    if (attempt === maxAttempts) {
      break;
    }

    // Ask AI to fix the failures
    const failureContext = formatTestFailuresForAI(result.failures);
    const fixPrompt = buildFixPrompt(currentCode, failureContext, attempt);

    const fixResponse = await chat(
      [
        {
          role: "system",
          content:
            "You are a code repair assistant. Fix the code to make the failing tests pass. " +
            "Return ONLY the fixed code, no explanations or markdown fences.",
        },
        { role: "user", content: fixPrompt },
      ],
      {
        model: modelId,
        provider,
        workspaceId,
        temperature: 0.1, // Low temperature for fixes
        signal,
      }
    );

    const fixedCode = extractCodeFromResponse(fixResponse);
    if (fixedCode && fixedCode !== currentCode) {
      fixesApplied.push(
        `Attempt ${attempt}: Fixed ${result.failures.length} test failure(s)`
      );
      currentCode = fixedCode;
    } else {
      fixesApplied.push(
        `Attempt ${attempt}: AI could not produce a different fix`
      );
      break; // No point retrying if AI gives same code
    }
  }

  return {
    success: false,
    finalCode: currentCode,
    attempts: testResults.length,
    testResults,
    fixesApplied,
  };
}

/** Parse test output from common frameworks (vitest, jest, pytest, go test) */
export function parseTestOutput(raw: string, framework?: string): TestFailure[] {
  const detected = framework ?? detectFramework(raw);

  switch (detected) {
    case "vitest":
    case "jest":
      return parseVitestJestOutput(raw);
    case "pytest":
      return parsePytestOutput(raw);
    case "go":
      return parseGoTestOutput(raw);
    default:
      return parseGenericOutput(raw);
  }
}

/** Format test failures for AI feedback */
export function formatTestFailuresForAI(failures: TestFailure[]): string {
  if (failures.length === 0) return "All tests passed.";

  const lines: string[] = [`${failures.length} test(s) failed:\n`];

  for (const f of failures) {
    lines.push(`--- FAILURE: ${f.testName} ---`);
    if (f.file) lines.push(`  File: ${f.file}`);
    lines.push(`  Message: ${f.message}`);
    if (f.expected) lines.push(`  Expected: ${f.expected}`);
    if (f.actual) lines.push(`  Actual:   ${f.actual}`);
    if (f.stackTrace) {
      // Only include first 5 lines of stack trace
      const stackLines = f.stackTrace.split("\n").slice(0, 5);
      lines.push(`  Stack:\n    ${stackLines.join("\n    ")}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function detectFramework(raw: string): string {
  if (/vitest|VITEST/.test(raw)) return "vitest";
  if (/jest|JEST|Jest/.test(raw)) return "jest";
  if (/pytest|PASSED|FAILED.*\.py/.test(raw)) return "pytest";
  if (/--- FAIL:|--- PASS:|=== RUN/.test(raw)) return "go";
  return "unknown";
}

function parseVitestJestOutput(raw: string): TestFailure[] {
  const failures: TestFailure[] = [];
  const lines = raw.split("\n");

  let currentTest: Partial<TestFailure> | null = null;
  let collectingStack = false;
  let stackLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Match test failure lines: "✗ test name" or "× test name" or "FAIL test name"
    const failMatch = line.match(
      /(?:✗|×|✕|FAIL)\s+(.+?)(?:\s+\(\d+\s*ms\))?$/
    );
    if (failMatch) {
      if (currentTest) {
        if (stackLines.length > 0) currentTest.stackTrace = stackLines.join("\n");
        failures.push(finalizeFailure(currentTest));
      }
      currentTest = { testName: failMatch[1].trim(), message: "" };
      collectingStack = false;
      stackLines = [];
      continue;
    }

    // Match "Expected:" / "Received:" pairs
    if (currentTest) {
      const expectedMatch = line.match(/Expected:?\s*(.+)/);
      if (expectedMatch) {
        currentTest.expected = expectedMatch[1].trim();
        continue;
      }

      const receivedMatch = line.match(/Received:?\s*(.+)/);
      if (receivedMatch) {
        currentTest.actual = receivedMatch[1].trim();
        continue;
      }

      // Match "expect(received).toEqual(expected)" style
      const assertMatch = line.match(
        /expect\((.+?)\)\.(\w+)\((.+?)\)/
      );
      if (assertMatch) {
        currentTest.message =
          currentTest.message || `${assertMatch[2]} assertion failed`;
        continue;
      }

      // Match error messages
      const errorMatch = line.match(/(?:Error|AssertionError):\s*(.+)/);
      if (errorMatch) {
        currentTest.message = errorMatch[1].trim();
        collectingStack = true;
        continue;
      }

      // Collect stack trace
      if (collectingStack && line.match(/^\s+at\s/)) {
        stackLines.push(line.trim());
        continue;
      } else if (collectingStack && !line.match(/^\s+at\s/) && line.trim()) {
        collectingStack = false;
      }

      // Match file paths
      const fileMatch = line.match(/(?:at\s+)?(\S+\.(?:ts|js|tsx|jsx)):(\d+)/);
      if (fileMatch && !currentTest.file) {
        currentTest.file = fileMatch[1];
      }
    }
  }

  // Push last failure
  if (currentTest) {
    if (stackLines.length > 0) currentTest.stackTrace = stackLines.join("\n");
    failures.push(finalizeFailure(currentTest));
  }

  // Fallback: look for "FAIL" lines with file paths
  if (failures.length === 0) {
    const failFileRegex = /FAIL\s+(\S+)/g;
    let match: RegExpExecArray | null;
    while ((match = failFileRegex.exec(raw)) !== null) {
      failures.push({
        testName: match[1],
        file: match[1],
        message: "Test suite failed",
      });
    }
  }

  return failures;
}

function parsePytestOutput(raw: string): TestFailure[] {
  const failures: TestFailure[] = [];
  const lines = raw.split("\n");

  let currentTest: Partial<TestFailure> | null = null;
  let collectingMessage = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Match "FAILED test_file.py::test_name" or "_ test_name _"
    const failedMatch = line.match(/FAILED\s+(\S+?)::(\S+)/);
    if (failedMatch) {
      if (currentTest) failures.push(finalizeFailure(currentTest));
      currentTest = {
        testName: failedMatch[2],
        file: failedMatch[1],
        message: "",
      };
      collectingMessage = false;
      continue;
    }

    // Match "_ _ _ test_name _ _ _" section headers
    const sectionMatch = line.match(/_{3,}\s+(.+?)\s+_{3,}/);
    if (sectionMatch) {
      if (currentTest) failures.push(finalizeFailure(currentTest));
      currentTest = { testName: sectionMatch[1].trim(), message: "" };
      collectingMessage = true;
      continue;
    }

    if (currentTest && collectingMessage) {
      // Match AssertionError
      const assertMatch = line.match(/AssertionError:\s*(.+)/);
      if (assertMatch) {
        currentTest.message = assertMatch[1].trim();
        collectingMessage = false;
        continue;
      }

      // Match "assert x == y" style
      const assertEqMatch = line.match(/assert\s+(.+?)\s*==\s*(.+)/);
      if (assertEqMatch) {
        currentTest.expected = assertEqMatch[2].trim();
        currentTest.actual = assertEqMatch[1].trim();
        currentTest.message = currentTest.message || "Assertion failed";
        continue;
      }

      // Match "E       ..." lines (pytest error detail)
      const eLineMatch = line.match(/^E\s+(.+)/);
      if (eLineMatch) {
        currentTest.message =
          (currentTest.message ? currentTest.message + "; " : "") +
          eLineMatch[1].trim();
      }
    }
  }

  if (currentTest) failures.push(finalizeFailure(currentTest));
  return failures;
}

function parseGoTestOutput(raw: string): TestFailure[] {
  const failures: TestFailure[] = [];
  const lines = raw.split("\n");

  let currentTest: Partial<TestFailure> | null = null;
  let messageLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Match "--- FAIL: TestName (0.00s)"
    const failMatch = line.match(/--- FAIL:\s+(\S+)\s+\((.+?)\)/);
    if (failMatch) {
      if (currentTest) {
        currentTest.message = messageLines.join("\n").trim() || "Test failed";
        failures.push(finalizeFailure(currentTest));
      }
      currentTest = { testName: failMatch[1] };
      messageLines = [];
      continue;
    }

    // Match "=== RUN   TestName" to track current test
    const runMatch = line.match(/=== RUN\s+(\S+)/);
    if (runMatch) {
      if (currentTest) {
        currentTest.message = messageLines.join("\n").trim() || "Test failed";
        failures.push(finalizeFailure(currentTest));
        currentTest = null;
        messageLines = [];
      }
      continue;
    }

    // Collect failure messages (indented lines after FAIL)
    if (currentTest) {
      const trimmed = line.replace(/^\s+/, "");
      if (trimmed) {
        messageLines.push(trimmed);

        // Look for file:line references
        const fileMatch = trimmed.match(/(\S+\.go):(\d+)/);
        if (fileMatch && !currentTest.file) {
          currentTest.file = fileMatch[1];
        }
      }
    }
  }

  if (currentTest) {
    currentTest.message = messageLines.join("\n").trim() || "Test failed";
    failures.push(finalizeFailure(currentTest));
  }

  return failures;
}

function parseGenericOutput(raw: string): TestFailure[] {
  const failures: TestFailure[] = [];

  // Look for common failure patterns
  const errorLines = raw.split("\n").filter(
    (line) =>
      /(?:FAIL|ERROR|FAILED|✗|×|✕)/i.test(line) &&
      !/(?:PASS|OK|✓|✔)/i.test(line)
  );

  for (const line of errorLines) {
    failures.push({
      testName: line.trim().slice(0, 100),
      message: line.trim(),
    });
  }

  return failures;
}

function finalizeFailure(partial: Partial<TestFailure>): TestFailure {
  return {
    testName: partial.testName ?? "unknown",
    file: partial.file,
    message: partial.message || "Test failed",
    expected: partial.expected,
    actual: partial.actual,
    stackTrace: partial.stackTrace,
  };
}

function extractTestCounts(
  raw: string,
  framework: string
): { total: number; passed: number; failed: number } {
  // Vitest/Jest: "Tests:  2 failed, 5 passed, 7 total"
  const jestMatch = raw.match(
    /Tests?:\s*(?:(\d+)\s+failed,?\s*)?(?:(\d+)\s+passed,?\s*)?(\d+)\s+total/i
  );
  if (jestMatch) {
    return {
      failed: parseInt(jestMatch[1] ?? "0", 10),
      passed: parseInt(jestMatch[2] ?? "0", 10),
      total: parseInt(jestMatch[3], 10),
    };
  }

  // Pytest: "5 passed, 2 failed"
  const pytestMatch = raw.match(
    /(\d+)\s+passed(?:.*?(\d+)\s+failed)?/
  );
  if (pytestMatch) {
    const passed = parseInt(pytestMatch[1], 10);
    const failed = parseInt(pytestMatch[2] ?? "0", 10);
    return { total: passed + failed, passed, failed };
  }

  // Go: "ok" or "FAIL" with counts
  const goMatch = raw.match(/(?:ok|FAIL)\s+\S+\s+[\d.]+s/g);
  if (goMatch && framework === "go") {
    const total = goMatch.length;
    const failed = goMatch.filter((m) => m.startsWith("FAIL")).length;
    return { total, passed: total - failed, failed };
  }

  // Fallback: count pass/fail lines
  const passCount = (raw.match(/(?:✓|✔|PASS)/g) ?? []).length;
  const failCount = (raw.match(/(?:✗|×|✕|FAIL)/g) ?? []).length;
  return {
    total: passCount + failCount || 0,
    passed: passCount,
    failed: failCount,
  };
}

function buildFixPrompt(
  code: string,
  failureContext: string,
  attempt: number
): string {
  const urgency =
    attempt > 1
      ? `\n\nThis is attempt ${attempt}. Previous fixes did not resolve all failures. Be more careful and thorough.`
      : "";

  return (
    `The following code has test failures that need to be fixed:\n\n` +
    `## Current Code\n\`\`\`\n${code}\n\`\`\`\n\n` +
    `## Test Failures\n${failureContext}\n\n` +
    `Fix the code to make all tests pass. Return the complete fixed code.${urgency}`
  );
}

function extractCodeFromResponse(response: string): string | null {
  // Try to extract from code fences
  const fenceMatch = response.match(
    /```(?:typescript|javascript|ts|js|python|go)?\s*\n([\s\S]*?)\n```/
  );
  if (fenceMatch) return fenceMatch[1].trim();

  // If no fences, assume the whole response is code (if it looks like code)
  const trimmed = response.trim();
  if (
    trimmed.includes("function ") ||
    trimmed.includes("import ") ||
    trimmed.includes("export ") ||
    trimmed.includes("const ") ||
    trimmed.includes("def ") ||
    trimmed.includes("class ")
  ) {
    return trimmed;
  }

  return null;
}
