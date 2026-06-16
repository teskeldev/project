/**
 * Specification-First (TDD) Pattern — write spec/tests first, then implement.
 * Forces the model to think about behavior before writing code.
 *
 * Strategy:
 * 1. Ask model to write a SPECIFICATION (what the code should do, inputs, outputs, edge cases)
 * 2. Ask model to write TESTS based on the specification
 * 3. Ask model to write IMPLEMENTATION that passes the tests
 *
 * This pattern dramatically improves code quality because:
 * - The spec forces explicit thinking about requirements
 * - Tests create a concrete contract the implementation must satisfy
 * - The model can verify its own implementation against the tests
 */

import { chat, type AIMessage } from "@/lib/ai/provider";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SpecFirstOptions = {
  task: string;
  context: string;
  language: string;
  testFramework?: string;
  modelId?: string;
  provider?: string;
  workspaceId?: string;
  signal?: AbortSignal;
};

export type SpecFirstResult = {
  specification: string;
  tests: string;
  implementation: string;
  steps: { phase: string; output: string }[];
};

// ---------------------------------------------------------------------------
// Prompts
// ---------------------------------------------------------------------------

function buildSpecPrompt(task: string, context: string, language: string): AIMessage[] {
  return [
    {
      role: "system",
      content: `You are a software architect writing a technical specification. Your job is to define WHAT the code should do, NOT how to implement it.

Write a clear, structured specification that covers:
1. **Purpose**: What problem does this code solve?
2. **Inputs**: What data does it accept? Include types and constraints.
3. **Outputs**: What does it return? Include types and possible values.
4. **Behavior**: Step-by-step description of what happens.
5. **Edge Cases**: What happens with invalid input, empty data, boundary values?
6. **Error Handling**: What errors can occur and how should they be reported?

Be specific and precise. Use concrete examples where helpful.
Output ONLY the specification text. No code, no markdown fences.`,
    },
    {
      role: "user",
      content: `Language: ${language}

Task: ${task}

Context:
${context}

Write the specification:`,
    },
  ];
}

function buildTestPrompt(
  task: string,
  specification: string,
  language: string,
  testFramework: string
): AIMessage[] {
  return [
    {
      role: "system",
      content: `You are a test engineer. Write comprehensive tests based on the given specification.

Rules:
- Use the ${testFramework} testing framework.
- Write tests for ALL behaviors described in the specification.
- Include tests for edge cases and error conditions.
- Each test should be focused and test ONE thing.
- Use descriptive test names that explain what is being tested.
- Include setup/teardown if needed.
- Mock external dependencies appropriately.
- Output ONLY the test code. No explanations outside of code comments.
- Do NOT wrap the output in markdown code fences.`,
    },
    {
      role: "user",
      content: `Language: ${language}
Test Framework: ${testFramework}

Task: ${task}

Specification:
${specification}

Write the tests:`,
    },
  ];
}

function buildImplementationPrompt(
  task: string,
  specification: string,
  tests: string,
  language: string
): AIMessage[] {
  return [
    {
      role: "system",
      content: `You are a software engineer implementing code that must pass the given tests.

Rules:
- Implement the code according to the specification.
- Your implementation MUST pass all the provided tests.
- Follow best practices for ${language}.
- Include proper error handling as described in the specification.
- Include necessary imports.
- Write clean, readable, production-quality code.
- Output ONLY the implementation code. No explanations outside of code comments.
- Do NOT wrap the output in markdown code fences.
- Do NOT include the tests in your output.`,
    },
    {
      role: "user",
      content: `Language: ${language}

Task: ${task}

Specification:
${specification}

Tests that must pass:
\`\`\`${language}
${tests}
\`\`\`

Write the implementation:`,
    },
  ];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Detect the appropriate test framework based on language and hints */
function resolveTestFramework(language: string, explicit?: string): string {
  if (explicit) return explicit;

  const lang = language.toLowerCase();

  if (lang.includes("typescript") || lang.includes("ts")) return "vitest";
  if (lang.includes("javascript") || lang.includes("js")) return "jest";
  if (lang.includes("python") || lang.includes("py")) return "pytest";
  if (lang.includes("rust") || lang.includes("rs")) return "cargo test";
  if (lang.includes("go")) return "testing";
  if (lang.includes("java")) return "JUnit 5";
  if (lang.includes("c#") || lang.includes("csharp")) return "xUnit";
  if (lang.includes("ruby") || lang.includes("rb")) return "RSpec";

  return "vitest"; // Default
}

/** Strip markdown code fences from LLM output */
function stripCodeFences(text: string): string {
  let cleaned = text.trim();

  // Remove opening fence with optional language tag
  cleaned = cleaned.replace(/^```[\w]*\s*\n?/, "");

  // Remove closing fence
  cleaned = cleaned.replace(/\n?\s*```\s*$/, "");

  return cleaned.trim();
}

/**
 * Validate that the specification contains the expected sections.
 * Returns the spec as-is but logs warnings for missing sections.
 */
function validateSpecification(spec: string): {
  isValid: boolean;
  missingSections: string[];
} {
  const expectedSections = ["purpose", "input", "output", "behavior", "edge case", "error"];
  const lowerSpec = spec.toLowerCase();

  const missingSections = expectedSections.filter(
    (section) => !lowerSpec.includes(section)
  );

  return {
    isValid: missingSections.length <= 2, // Allow some flexibility
    missingSections,
  };
}

/**
 * Validate that tests reference the expected patterns for the framework.
 */
function validateTests(tests: string, framework: string): boolean {
  const frameworkPatterns: Record<string, RegExp[]> = {
    vitest: [/describe|it|test|expect/],
    jest: [/describe|it|test|expect/],
    pytest: [/def test_|assert/],
    "cargo test": [/#\[test\]|assert/],
    testing: [/func Test|t\.Error|t\.Fatal/],
    "JUnit 5": [/@Test|assert/i],
    xUnit: [/\[Fact\]|\[Theory\]|Assert/],
    RSpec: [/describe|it|expect/],
  };

  const patterns = frameworkPatterns[framework] ?? [/test|assert|expect/i];
  return patterns.some((p) => p.test(tests));
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Generate code using specification-first approach */
export async function specFirst(options: SpecFirstOptions): Promise<SpecFirstResult> {
  const { task, context, language, modelId, provider, workspaceId, signal } = options;
  const steps: { phase: string; output: string }[] = [];

  const testFramework = resolveTestFramework(language, options.testFramework);

  const chatOpts = {
    model: modelId,
    provider,
    workspaceId,
    signal,
    temperature: 0.3,
  };

  // -------------------------------------------------------------------------
  // Phase 1: Generate specification
  // -------------------------------------------------------------------------
  const specMessages = buildSpecPrompt(task, context, language);
  const specRaw = await chat(specMessages, chatOpts);
  const specification = specRaw.trim();

  steps.push({ phase: "specification", output: specification });

  // Validate spec quality
  const specValidation = validateSpecification(specification);
  if (!specValidation.isValid) {
    // Retry with more explicit instructions if spec is too thin
    const retryMessages: AIMessage[] = [
      ...specMessages,
      { role: "assistant", content: specification },
      {
        role: "user",
        content: `The specification is missing important sections: ${specValidation.missingSections.join(", ")}. Please expand the specification to cover these areas. Output the COMPLETE revised specification:`,
      },
    ];

    const retrySpec = await chat(retryMessages, chatOpts);
    const revisedSpec = retrySpec.trim();
    steps.push({ phase: "specification-retry", output: revisedSpec });

    // Use the revised spec going forward
    return continueWithSpec(revisedSpec, task, language, testFramework, chatOpts, steps);
  }

  return continueWithSpec(specification, task, language, testFramework, chatOpts, steps);
}

// ---------------------------------------------------------------------------
// Internal continuation
// ---------------------------------------------------------------------------

async function continueWithSpec(
  specification: string,
  task: string,
  language: string,
  testFramework: string,
  chatOpts: { model?: string; provider?: string; workspaceId?: string; signal?: AbortSignal; temperature: number },
  steps: { phase: string; output: string }[]
): Promise<SpecFirstResult> {
  // -------------------------------------------------------------------------
  // Phase 2: Generate tests
  // -------------------------------------------------------------------------
  const testMessages = buildTestPrompt(task, specification, language, testFramework);
  const testsRaw = await chat(testMessages, chatOpts);
  const tests = stripCodeFences(testsRaw);

  steps.push({ phase: "tests", output: tests });

  // Validate tests look reasonable
  if (!validateTests(tests, testFramework)) {
    // Retry test generation with explicit framework reminder
    const retryMessages: AIMessage[] = [
      ...testMessages,
      { role: "assistant", content: tests },
      {
        role: "user",
        content: `The tests don't appear to use the ${testFramework} framework correctly. Please rewrite them using proper ${testFramework} syntax and assertions. Output ONLY the corrected test code:`,
      },
    ];

    const retryTests = await chat(retryMessages, chatOpts);
    const revisedTests = stripCodeFences(retryTests);
    steps.push({ phase: "tests-retry", output: revisedTests });

    return continueWithTests(specification, revisedTests, task, language, chatOpts, steps);
  }

  return continueWithTests(specification, tests, task, language, chatOpts, steps);
}

async function continueWithTests(
  specification: string,
  tests: string,
  task: string,
  language: string,
  chatOpts: { model?: string; provider?: string; workspaceId?: string; signal?: AbortSignal; temperature: number },
  steps: { phase: string; output: string }[]
): Promise<SpecFirstResult> {
  // -------------------------------------------------------------------------
  // Phase 3: Generate implementation
  // -------------------------------------------------------------------------
  const implMessages = buildImplementationPrompt(task, specification, tests, language);
  const implRaw = await chat(implMessages, chatOpts);
  const implementation = stripCodeFences(implRaw);

  steps.push({ phase: "implementation", output: implementation });

  return {
    specification,
    tests,
    implementation,
    steps,
  };
}
