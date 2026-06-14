/**
 * Skeleton → Flesh Pattern — generate structure first, then fill in details.
 * Particularly effective for weak models that struggle with large generations.
 *
 * Strategy:
 * 1. Ask model to generate ONLY the skeleton (signatures, types, class structure)
 * 2. For each function/method in the skeleton, ask model to implement JUST that piece
 * 3. Assemble all pieces into the final code
 *
 * This works because weak models handle small, focused tasks much better than
 * generating large, coherent code blocks in a single pass.
 */

import { chat, type AIMessage } from "@/lib/ai/provider";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SkeletonFleshOptions = {
  task: string;
  context: string;
  language: string;
  modelId?: string;
  provider?: string;
  workspaceId?: string;
  signal?: AbortSignal;
};

export type SkeletonFleshResult = {
  skeleton: string;
  flesh: string;
  steps: { phase: string; output: string }[];
};

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

type SkeletonSlot = {
  name: string;
  signature: string;
  startLine: number;
  endLine: number;
  placeholder: string;
};

// ---------------------------------------------------------------------------
// Prompts
// ---------------------------------------------------------------------------

function buildSkeletonPrompt(
  task: string,
  context: string,
  language: string
): AIMessage[] {
  return [
    {
      role: "system",
      content: `You are a code architect. Generate ONLY the structural skeleton of the code — no implementations.

Rules:
- Include all imports, type definitions, class declarations, and function signatures.
- For each function/method body, write ONLY a single-line placeholder comment: // TODO: implement
- Do NOT write any actual logic or implementation.
- The skeleton must be syntactically valid ${language} (except for the TODO placeholders).
- Include proper type annotations and return types.

Output ONLY the code. No explanations, no markdown fences.`,
    },
    {
      role: "user",
      content: `Task: ${task}

Context:
${context}

Generate the ${language} skeleton (structure only, no implementations):`,
    },
  ];
}

function buildFleshPrompt(
  functionName: string,
  signature: string,
  skeleton: string,
  task: string,
  context: string,
  language: string
): AIMessage[] {
  return [
    {
      role: "system",
      content: `You are a code implementer. You will be given a function signature and the full skeleton of a module. Implement ONLY the specified function.

Rules:
- Write ONLY the function body (the code that goes inside the function).
- Do NOT repeat the function signature or closing brace.
- Do NOT include imports or other functions.
- The implementation must be correct, complete, and production-quality.
- Use proper error handling and edge case coverage.
- Output ONLY the implementation code. No explanations, no markdown fences.`,
    },
    {
      role: "user",
      content: `Full module skeleton for context:
\`\`\`${language}
${skeleton}
\`\`\`

Original task: ${task}

Additional context:
${context}

Implement the body of this function:
\`\`\`${language}
${signature}
\`\`\`

Write ONLY the implementation (the lines that go inside the function body):`,
    },
  ];
}

// ---------------------------------------------------------------------------
// Skeleton parsing
// ---------------------------------------------------------------------------

/**
 * Extract function/method slots from the skeleton that need implementation.
 * Looks for patterns like:
 *   function name(...) { // TODO: implement }
 *   method(...) { // TODO: implement }
 */
function extractSlots(skeleton: string, language: string): SkeletonSlot[] {
  const lines = skeleton.split("\n");
  const slots: SkeletonSlot[] = [];

  // Pattern: function/method declaration followed by TODO placeholder
  const todoPattern = /\/\/\s*TODO:\s*implement/i;
  const pyTodoPattern = /pass\s*#\s*TODO/i;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check if this line or the next contains a TODO placeholder
    const hasTodo =
      todoPattern.test(line) ||
      pyTodoPattern.test(line) ||
      (i + 1 < lines.length && todoPattern.test(lines[i + 1]));

    if (!hasTodo) continue;

    // Try to extract the function signature
    const sig = extractSignature(lines, i, language);
    if (sig) {
      slots.push({
        name: sig.name,
        signature: sig.fullSignature,
        startLine: i,
        endLine: sig.endLine,
        placeholder: sig.placeholder,
      });
    }
  }

  return slots;
}

/**
 * Extract a function signature starting from the given line.
 */
function extractSignature(
  lines: string[],
  lineIdx: number,
  language: string
): { name: string; fullSignature: string; endLine: number; placeholder: string } | null {
  const line = lines[lineIdx];

  // TypeScript/JavaScript patterns
  const tsPatterns = [
    // function name(...)
    /(?:export\s+)?(?:async\s+)?function\s+(\w+)/,
    // name(...) { — method in class
    /(?:public|private|protected|static|async|\s)*(\w+)\s*\(/,
    // const name = (...) =>
    /(?:export\s+)?(?:const|let)\s+(\w+)\s*=/,
  ];

  // Python patterns
  const pyPatterns = [/(?:async\s+)?def\s+(\w+)/];

  const patterns = language.toLowerCase().includes("python") ? pyPatterns : tsPatterns;

  for (const pattern of patterns) {
    const match = line.match(pattern);
    if (match && match[1]) {
      // Find the end of this function block (the TODO line)
      let endLine = lineIdx;
      const todoPattern = /\/\/\s*TODO:\s*implement/i;
      const pyTodoPattern = /pass\s*#\s*TODO/i;

      for (let j = lineIdx; j < Math.min(lineIdx + 5, lines.length); j++) {
        if (todoPattern.test(lines[j]) || pyTodoPattern.test(lines[j])) {
          endLine = j;
          break;
        }
      }

      // Build the full signature (from function keyword to opening brace)
      let fullSig = "";
      for (let j = lineIdx; j <= endLine; j++) {
        const sigLine = lines[j].replace(todoPattern, "").replace(pyTodoPattern, "").trim();
        if (sigLine) fullSig += (fullSig ? "\n" : "") + lines[j];
      }

      // The placeholder is the TODO line itself
      const placeholder = lines[endLine];

      return {
        name: match[1],
        fullSignature: fullSig,
        endLine,
        placeholder,
      };
    }
  }

  return null;
}

/**
 * Replace a TODO placeholder in the skeleton with the actual implementation.
 */
function insertImplementation(
  skeleton: string,
  slot: SkeletonSlot,
  implementation: string
): string {
  const lines = skeleton.split("\n");
  const todoLine = lines[slot.endLine];

  // Detect indentation of the TODO line
  const indentMatch = todoLine.match(/^(\s*)/);
  const indent = indentMatch ? indentMatch[1] : "  ";

  // Indent the implementation
  const implLines = implementation.split("\n").map((line) => {
    if (line.trim() === "") return "";
    return indent + line;
  });

  // Replace the TODO line with the implementation
  lines.splice(slot.endLine, 1, ...implLines);

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Generate code using skeleton-first approach */
export async function skeletonFlesh(
  options: SkeletonFleshOptions
): Promise<SkeletonFleshResult> {
  const { task, context, language, modelId, provider, workspaceId, signal } = options;
  const steps: { phase: string; output: string }[] = [];

  const chatOpts = {
    model: modelId,
    provider,
    workspaceId,
    signal,
    temperature: 0.2,
  };

  // -------------------------------------------------------------------------
  // Phase 1: Generate skeleton
  // -------------------------------------------------------------------------
  const skeletonMessages = buildSkeletonPrompt(task, context, language);
  const skeletonRaw = await chat(skeletonMessages, chatOpts);

  // Clean up: remove markdown fences if the model added them
  const skeleton = stripCodeFences(skeletonRaw, language);
  steps.push({ phase: "skeleton", output: skeleton });

  // -------------------------------------------------------------------------
  // Phase 2: Extract slots and implement each one
  // -------------------------------------------------------------------------
  const slots = extractSlots(skeleton, language);

  if (slots.length === 0) {
    // Model may have already provided full implementation — return as-is
    steps.push({ phase: "flesh", output: skeleton });
    return { skeleton, flesh: skeleton, steps };
  }

  let currentCode = skeleton;

  for (const slot of slots) {
    const fleshMessages = buildFleshPrompt(
      slot.name,
      slot.signature,
      skeleton,
      task,
      context,
      language
    );

    const implRaw = await chat(fleshMessages, chatOpts);
    const impl = stripCodeFences(implRaw, language);

    steps.push({ phase: `implement:${slot.name}`, output: impl });

    // Insert implementation into the current code
    // Re-find the slot position since line numbers shift after each insertion
    const todoPattern = new RegExp(
      `(${escapeRegex(slot.placeholder.trim())})`,
      "m"
    );

    if (todoPattern.test(currentCode)) {
      const todoLine = currentCode.split("\n").findIndex((l) =>
        l.trim() === slot.placeholder.trim()
      );
      if (todoLine >= 0) {
        const updatedSlot = { ...slot, endLine: todoLine };
        currentCode = insertImplementation(currentCode, updatedSlot, impl);
      }
    }
  }

  steps.push({ phase: "assembly", output: currentCode });

  return {
    skeleton,
    flesh: currentCode,
    steps,
  };
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

/** Strip markdown code fences from LLM output */
function stripCodeFences(text: string, language: string): string {
  let cleaned = text.trim();

  // Remove opening fence
  const openPattern = new RegExp(`^\`\`\`(?:${language}|typescript|javascript|python|ts|js|py)?\\s*\\n?`, "i");
  cleaned = cleaned.replace(openPattern, "");

  // Remove closing fence
  cleaned = cleaned.replace(/\n?\s*```\s*$/, "");

  return cleaned.trim();
}

/** Escape special regex characters */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
