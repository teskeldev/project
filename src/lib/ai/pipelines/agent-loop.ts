/**
 * Agent Loop Pipeline — flexible autonomous agent for strong models.
 *
 * Based on OpenHands/SWE-agent patterns: Observe → Think → Act → Observe loop.
 * Optimal for models with strong multi-turn reasoning (Claude, GPT-4o, etc.)
 *
 * The agent has access to tools and can navigate the codebase autonomously.
 *
 * Phase 3.9 of the quality amplification system.
 */

import { chat, type AIMessage, type ChatOptions } from "@/lib/ai/provider";
import { buildSmartContext } from "@/lib/ai/smart-context";
import { buildRepoMap } from "@/lib/search/repo-map";
import {
  validateSearchBlocks,
  type SearchReplaceBlock,
} from "@/lib/ai/output-schema";
import { hybridSearch } from "@/lib/search/hybrid";
import { readFile } from "@/lib/storage";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type AgentLoopOptions = {
  task: string;
  projectId: string;
  storageKey: string;

  // Model config
  modelId?: string;
  provider?: string;
  workspaceId?: string;

  // Loop config
  maxIterations?: number;
  maxTokensPerTurn?: number;
  enableSelfVerification?: boolean;

  // Tools available
  tools?: AgentTool[];

  // Callbacks
  onIteration?: (iteration: number, action: AgentAction) => void;
  onComplete?: (result: AgentLoopResult) => void;
  signal?: AbortSignal;
};

export type AgentTool = {
  name: string;
  description: string;
  execute: (params: Record<string, unknown>) => Promise<string>;
};

export type AgentAction = {
  tool: string;
  params: Record<string, unknown>;
  reasoning: string;
  result?: string;
};

export type AgentLoopResult = {
  success: boolean;
  patches: SearchReplaceBlock[];
  actions: AgentAction[];
  iterations: number;
  reasoning: string[];
  verificationResult?: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_MAX_ITERATIONS = 10;
const DEFAULT_MAX_TOKENS_PER_TURN = 4096;
const TOOL_CALL_REGEX = /<tool_call>\s*<name>([\s\S]*?)<\/name>\s*<params>([\s\S]*?)<\/params>\s*<\/tool_call>/g;
const MAX_OBSERVATION_LENGTH = 8000;
const MAX_HISTORY_MESSAGES = 30;

// ─────────────────────────────────────────────────────────────────────────────
// Main Agent Loop
// ─────────────────────────────────────────────────────────────────────────────

/** Run the agent loop */
export async function runAgentLoop(options: AgentLoopOptions): Promise<AgentLoopResult> {
  const {
    task,
    projectId,
    storageKey,
    modelId,
    provider,
    workspaceId,
    maxIterations = DEFAULT_MAX_ITERATIONS,
    maxTokensPerTurn = DEFAULT_MAX_TOKENS_PER_TURN,
    enableSelfVerification = true,
    tools: customTools,
    onIteration,
    onComplete,
    signal,
  } = options;

  const chatOpts: ChatOptions = {
    model: modelId,
    provider,
    workspaceId,
    maxTokens: maxTokensPerTurn,
    signal,
  };

  // Initialize tools
  const tools = customTools ?? getDefaultTools(projectId, storageKey);
  const toolMap = new Map(tools.map((t) => [t.name, t]));

  // Track state
  const actions: AgentAction[] = [];
  const reasoning: string[] = [];
  const patches: SearchReplaceBlock[] = [];
  let iterations = 0;

  // Build initial context
  const initialContext = await buildInitialContext(task, projectId, storageKey);

  // Conversation history for the agent
  const messages: AIMessage[] = [
    { role: "system", content: buildAgentSystemPrompt(tools) },
    { role: "user", content: buildInitialUserMessage(task, initialContext) },
  ];

  // ─── Main Loop ────────────────────────────────────────────────────────
  while (iterations < maxIterations) {
    // Check abort signal
    if (signal?.aborted) {
      break;
    }

    iterations++;

    // ─── THINK + ACT: Get agent's next action ─────────────────────────
    const response = await chat(messages, {
      ...chatOpts,
      temperature: 0.2,
    });

    // Parse the response for reasoning and tool calls
    const { thought, toolCalls } = parseAgentResponse(response);

    if (thought) {
      reasoning.push(thought);
    }

    // Add assistant message to history
    messages.push({ role: "assistant", content: response });

    // ─── Handle "done" action ─────────────────────────────────────────
    const doneCall = toolCalls.find((tc) => tc.name === "done");
    if (doneCall || toolCalls.length === 0) {
      // Agent signals completion or has no more actions
      if (doneCall) {
        const summary = doneCall.params.summary as string | undefined;
        reasoning.push(`Completed: ${summary ?? "Task finished"}`);
      }
      break;
    }

    // ─── Execute tool calls ───────────────────────────────────────────
    const observations: string[] = [];

    for (const toolCall of toolCalls) {
      const tool = toolMap.get(toolCall.name);

      const action: AgentAction = {
        tool: toolCall.name,
        params: toolCall.params,
        reasoning: thought ?? "",
      };

      if (!tool) {
        action.result = `Error: Unknown tool "${toolCall.name}". Available tools: ${tools.map((t) => t.name).join(", ")}`;
        observations.push(`[${toolCall.name}] ${action.result}`);
      } else {
        try {
          const result = await tool.execute(toolCall.params);
          action.result = result;
          observations.push(`[${toolCall.name}] ${truncateObservation(result)}`);

          // Track patches from write_patch tool
          if (
            toolCall.name === "write_patch" &&
            typeof toolCall.params.file === "string" &&
            typeof toolCall.params.search === "string" &&
            typeof toolCall.params.replace === "string"
          ) {
            patches.push({
              filePath: toolCall.params.file,
              search: toolCall.params.search,
              replace: toolCall.params.replace,
            });
          }
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          action.result = `Error: ${errorMsg}`;
          observations.push(`[${toolCall.name}] Error: ${errorMsg}`);
        }
      }

      actions.push(action);
      onIteration?.(iterations, action);
    }

    // ─── OBSERVE: Feed results back ──────────────────────────────────
    const observationMessage = observations.join("\n\n");
    messages.push({
      role: "user",
      content: `## Observation\n\n${observationMessage}\n\nContinue with the task. Use <tool_call> to take another action, or call the "done" tool if the task is complete.`,
    });

    // Trim history if too long to prevent context overflow
    trimHistory(messages);
  }

  // ─── Self-verification ──────────────────────────────────────────────────
  let verificationResult: string | undefined;

  if (enableSelfVerification && patches.length > 0) {
    verificationResult = await selfVerify(patches, storageKey, chatOpts);
  }

  const result: AgentLoopResult = {
    success: patches.length > 0 && (verificationResult === undefined || !verificationResult.includes("FAILED")),
    patches,
    actions,
    iterations,
    reasoning,
    verificationResult,
  };

  onComplete?.(result);
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Default Tools
// ─────────────────────────────────────────────────────────────────────────────

/** Get the default tool set for the agent */
export function getDefaultTools(projectId: string, storageKey: string): AgentTool[] {
  return [
    {
      name: "read_file",
      description:
        "Read the contents of a file. Params: { path: string, startLine?: number, endLine?: number }",
      execute: async (params) => {
        const filePath = params.path as string;
        if (!filePath) return "Error: 'path' parameter is required";

        try {
          const content = await readFile(storageKey, filePath);
          if (content === null) return `Error: File not found: ${filePath}`;

          const lines = content.split("\n");
          const startLine = (params.startLine as number) ?? 1;
          const endLine = (params.endLine as number) ?? lines.length;

          const slice = lines.slice(
            Math.max(0, startLine - 1),
            Math.min(lines.length, endLine)
          );

          const numbered = slice.map(
            (line, idx) => `${startLine + idx} | ${line}`
          );

          return `File: ${filePath} (${lines.length} lines total)\n\n${numbered.join("\n")}`;
        } catch (err) {
          return `Error reading file: ${err instanceof Error ? err.message : String(err)}`;
        }
      },
    },
    {
      name: "search_code",
      description:
        "Search the codebase for relevant code using hybrid search (keyword + semantic). Params: { query: string, maxResults?: number }",
      execute: async (params) => {
        const query = params.query as string;
        if (!query) return "Error: 'query' parameter is required";

        const maxResults = (params.maxResults as number) ?? 10;

        try {
          const results = await hybridSearch(projectId, storageKey, query, {
            topK: maxResults,
            includeContent: true,
          });

          if (results.length === 0) return "No results found.";

          return results
            .map((r, i) => {
              const content = r.content.length > 500
                ? r.content.slice(0, 500) + "\n... (truncated)"
                : r.content;
              return `### Result ${i + 1}: ${r.filePath} (lines ${r.startLine}-${r.endLine}, score: ${r.score.toFixed(3)})\n\`\`\`\n${content}\n\`\`\``;
            })
            .join("\n\n");
        } catch (err) {
          return `Error searching: ${err instanceof Error ? err.message : String(err)}`;
        }
      },
    },
    {
      name: "list_files",
      description:
        "List files in a directory. Params: { directory?: string }",
      execute: async (params) => {
        const directory = (params.directory as string) ?? "";

        try {
          // Use repo map for listing since we don't have direct fs access
          const repoMap = await buildRepoMap(projectId, storageKey, {
            maxChars: 6000,
            maxFiles: 100,
          });

          if (directory) {
            // Filter to only show files in the specified directory
            const lines = repoMap.split("\n").filter((line) => {
              const trimmed = line.trim();
              return trimmed.startsWith(directory) || trimmed.includes(`/${directory}`);
            });
            return lines.length > 0
              ? lines.join("\n")
              : `No files found in directory: ${directory}`;
          }

          return repoMap;
        } catch (err) {
          return `Error listing files: ${err instanceof Error ? err.message : String(err)}`;
        }
      },
    },
    {
      name: "write_patch",
      description:
        "Propose a code change using SEARCH/REPLACE. Params: { file: string, search: string, replace: string }",
      execute: async (params) => {
        const file = params.file as string;
        const search = params.search as string;
        const replace = params.replace as string;

        if (!file) return "Error: 'file' parameter is required";
        if (search === undefined || search === null) return "Error: 'search' parameter is required";
        if (replace === undefined || replace === null) return "Error: 'replace' parameter is required";

        // Validate that the search text exists in the file
        try {
          const content = await readFile(storageKey, file);
          if (content === null) return `Error: File not found: ${file}`;

          if (content.includes(search)) {
            return `Patch recorded for ${file}. SEARCH text found (exact match). Change will replace ${search.split("\n").length} lines.`;
          }

          // Try normalized match
          const normalizedContent = content.replace(/\s+/g, " ");
          const normalizedSearch = search.replace(/\s+/g, " ");

          if (normalizedContent.includes(normalizedSearch)) {
            return `Patch recorded for ${file}. SEARCH text found (whitespace-normalized match). Change will replace approximately ${search.split("\n").length} lines.`;
          }

          return `Warning: SEARCH text not found in ${file}. The patch has been recorded but may fail during application. Please verify the exact text.`;
        } catch (err) {
          return `Error validating patch: ${err instanceof Error ? err.message : String(err)}`;
        }
      },
    },
    {
      name: "verify_patch",
      description:
        "Verify all proposed patches by checking syntax and search text validity. Params: {} (no params needed)",
      execute: async () => {
        // This is handled at the loop level — the tool just triggers verification
        return "Verification will be performed at the end of the agent loop. All patches recorded so far will be validated.";
      },
    },
    {
      name: "done",
      description:
        "Signal that the task is complete. Params: { summary: string }",
      execute: async (params) => {
        const summary = params.summary as string | undefined;
        return `Task completed: ${summary ?? "No summary provided"}`;
      },
    },
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// Agent Response Parsing
// ─────────────────────────────────────────────────────────────────────────────

type ParsedToolCall = {
  name: string;
  params: Record<string, unknown>;
};

type ParsedAgentResponse = {
  thought: string | null;
  toolCalls: ParsedToolCall[];
};

function parseAgentResponse(response: string): ParsedAgentResponse {
  // Extract thought/reasoning (text before tool calls)
  const firstToolCallIdx = response.indexOf("<tool_call>");
  const thought = firstToolCallIdx > 0
    ? response.slice(0, firstToolCallIdx).trim()
    : firstToolCallIdx === -1
      ? response.trim()
      : null;

  // Extract tool calls
  const toolCalls: ParsedToolCall[] = [];

  // Reset regex state
  const regex = new RegExp(TOOL_CALL_REGEX.source, TOOL_CALL_REGEX.flags);
  let match: RegExpExecArray | null;

  while ((match = regex.exec(response)) !== null) {
    const name = match[1].trim();
    const paramsStr = match[2].trim();

    let params: Record<string, unknown> = {};
    try {
      params = JSON.parse(paramsStr);
    } catch {
      // Try to extract key-value pairs from malformed JSON
      params = parseMalformedParams(paramsStr);
    }

    toolCalls.push({ name, params });
  }

  return { thought: thought || null, toolCalls };
}

function parseMalformedParams(paramsStr: string): Record<string, unknown> {
  const params: Record<string, unknown> = {};

  // Try to extract "key": "value" patterns.
  // NOTE: the value class excludes the backslash (`[^"\\]`) so the unrolled
  // `(?:\\.[^"\\]*)*` loop is unambiguous. Using `[^"]` here (which includes
  // the backslash) made a run of backslashes partition ambiguously and caused
  // catastrophic backtracking (exponential ReDoS) on malformed model output.
  const kvRegex = /"(\w+)"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/g;
  let kvMatch: RegExpExecArray | null;

  while ((kvMatch = kvRegex.exec(paramsStr)) !== null) {
    params[kvMatch[1]] = kvMatch[2].replace(/\\"/g, '"').replace(/\\n/g, "\n");
  }

  // Try to extract "key": number patterns
  const numRegex = /"(\w+)"\s*:\s*(\d+)/g;
  let numMatch: RegExpExecArray | null;

  while ((numMatch = numRegex.exec(paramsStr)) !== null) {
    if (!(numMatch[1] in params)) {
      params[numMatch[1]] = parseInt(numMatch[2], 10);
    }
  }

  // Try to extract "key": true/false patterns
  const boolRegex = /"(\w+)"\s*:\s*(true|false)/g;
  let boolMatch: RegExpExecArray | null;

  while ((boolMatch = boolRegex.exec(paramsStr)) !== null) {
    if (!(boolMatch[1] in params)) {
      params[boolMatch[1]] = boolMatch[2] === "true";
    }
  }

  return params;
}

// ─────────────────────────────────────────────────────────────────────────────
// Context Building
// ─────────────────────────────────────────────────────────────────────────────

async function buildInitialContext(
  task: string,
  projectId: string,
  storageKey: string
): Promise<string> {
  try {
    const [smartContext, repoMap] = await Promise.all([
      buildSmartContext(projectId, {
        query: task,
        taskType: "agent",
        includeRepoMap: false,
        maxRelevantFiles: 5,
      }),
      buildRepoMap(projectId, storageKey, { maxChars: 4000 }),
    ]);

    const sections: string[] = [];

    sections.push(`## Repository Structure\n${repoMap}`);

    if (smartContext.system) {
      // Extract relevant context from the system prompt
      const contextStart = smartContext.system.indexOf("## Relevant");
      if (contextStart !== -1) {
        sections.push(smartContext.system.slice(contextStart));
      }
    }

    return sections.join("\n\n");
  } catch {
    // Fallback: just use repo map
    try {
      const repoMap = await buildRepoMap(projectId, storageKey, { maxChars: 6000 });
      return `## Repository Structure\n${repoMap}`;
    } catch {
      return "## Context\nUnable to load repository context. Use the search_code and list_files tools to explore the codebase.";
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Self-Verification
// ─────────────────────────────────────────────────────────────────────────────

async function selfVerify(
  patches: SearchReplaceBlock[],
  storageKey: string,
  chatOpts: ChatOptions
): Promise<string> {
  // Load file contents for validation
  const filePathSet = new Set<string>();
  for (const p of patches) {
    if (p.filePath) filePathSet.add(p.filePath);
  }
  const filePaths = Array.from(filePathSet);
  const fileContents = new Map<string, string>();

  for (const fp of filePaths) {
    try {
      const content = await readFile(storageKey, fp);
      if (content !== null) {
        fileContents.set(fp, content);
      }
    } catch {
      // Skip files that can't be read
    }
  }

  // Validate search blocks exist
  const { valid, invalid } = validateSearchBlocks(patches, fileContents);

  const validationDetails: string[] = [];

  if (invalid.length > 0) {
    validationDetails.push(
      `FAILED: ${invalid.length}/${patches.length} patches have invalid SEARCH text:`
    );
    for (const inv of invalid) {
      validationDetails.push(`  - ${inv.block.filePath ?? "(no file)"}: ${inv.reason}`);
    }
  }

  if (valid.length > 0) {
    validationDetails.push(`PASSED: ${valid.length}/${patches.length} patches have valid SEARCH text`);
  }

  // Ask the model to review its own work
  const patchSummary = patches
    .map(
      (p) =>
        `File: ${p.filePath ?? "(unknown)"}\nSearch (${p.search.split("\n").length} lines) → Replace (${p.replace.split("\n").length} lines)`
    )
    .join("\n");

  const verifyMessages: AIMessage[] = [
    {
      role: "system",
      content: VERIFICATION_SYSTEM_PROMPT,
    },
    {
      role: "user",
      content: `## Patches to verify\n\n${patchSummary}\n\n## Validation results\n${validationDetails.join("\n")}\n\nDoes this look correct? Are there any issues?`,
    },
  ];

  try {
    const verifyResponse = await chat(verifyMessages, {
      ...chatOpts,
      temperature: 0.1,
      maxTokens: 1000,
    });

    return `${validationDetails.join("\n")}\n\nAgent self-review: ${verifyResponse}`;
  } catch {
    return validationDetails.join("\n");
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// History Management
// ─────────────────────────────────────────────────────────────────────────────

function trimHistory(messages: AIMessage[]): void {
  // Keep system message + initial user message + last N messages
  if (messages.length <= MAX_HISTORY_MESSAGES) return;

  const systemMsg = messages[0]; // system prompt
  const initialMsg = messages[1]; // initial task + context

  // Keep the most recent messages
  const recentCount = MAX_HISTORY_MESSAGES - 3; // -3 for system + initial + summary
  const recentMessages = messages.slice(-recentCount);

  // Rebuild messages array in place
  messages.length = 0;
  messages.push(systemMsg, initialMsg);

  // Add a summary of trimmed messages
  messages.push({
    role: "user",
    content:
      "[Earlier conversation history was trimmed to save context. The agent has been working on the task and has taken several actions. Continue from the most recent observation.]",
  });

  for (const msg of recentMessages) {
    messages.push(msg);
  }
}

function truncateObservation(text: string): string {
  if (text.length <= MAX_OBSERVATION_LENGTH) return text;

  const half = Math.floor(MAX_OBSERVATION_LENGTH / 2);
  return (
    text.slice(0, half) +
    `\n\n... [${text.length - MAX_OBSERVATION_LENGTH} characters truncated] ...\n\n` +
    text.slice(-half)
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Prompt Templates
// ─────────────────────────────────────────────────────────────────────────────

function buildAgentSystemPrompt(tools: AgentTool[]): string {
  const toolDescriptions = tools
    .map((t) => `- **${t.name}**: ${t.description}`)
    .join("\n");

  return `You are an autonomous coding agent. Your job is to complete software engineering tasks by reading code, understanding the problem, and making precise changes.

## Available Tools

${toolDescriptions}

## How to use tools

To use a tool, output a tool_call block:

<tool_call>
<name>tool_name</name>
<params>{"key": "value"}</params>
</tool_call>

You can call multiple tools in one response. Each tool call will be executed and the results will be provided as observations.

## Workflow

1. **Understand**: Read the task carefully. Think about what needs to change.
2. **Explore**: Use search_code and read_file to understand the relevant code.
3. **Plan**: Before making changes, think through your approach.
4. **Implement**: Use write_patch to propose changes. Make minimal, precise edits.
5. **Verify**: After making changes, verify they are correct.
6. **Complete**: Call the "done" tool when finished.

## Rules

- Always read a file before modifying it
- Make minimal changes — don't rewrite entire files
- The SEARCH text in write_patch must match the file EXACTLY (including whitespace and indentation)
- Think step by step before acting
- If you're unsure about something, search for more context
- Call "done" when the task is complete

## Output Format

Start each response with your reasoning/thought process, then include tool calls:

I need to understand how the authentication system works before making changes.

<tool_call>
<name>read_file</name>
<params>{"path": "src/lib/auth.ts"}</params>
</tool_call>`;
}

function buildInitialUserMessage(task: string, context: string): string {
  return `## Task

${task}

${context}

## Instructions

Complete the task described above. Start by exploring the relevant code, then make the necessary changes using write_patch. Call "done" when finished.`;
}

const VERIFICATION_SYSTEM_PROMPT = `You are a code review expert. Review the proposed patches and validation results.

Check for:
1. Do the patches make logical sense for the task?
2. Are there any obvious bugs introduced?
3. Is anything missing that should have been changed?
4. Are the SEARCH texts valid (matching the original code)?

Be concise. If everything looks good, say "PASSED: Changes look correct."
If there are issues, say "FAILED: [reason]" and explain what's wrong.`;
