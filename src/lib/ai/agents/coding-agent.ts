/**
 * Teskel Coding Agent — a pre-configured agent for code assistance tasks.
 *
 * Bridges the new core agent system (AgentBuilder, createTool, createHook)
 * with Teskel's existing infrastructure:
 *  - Uses createProjectTools() for database-backed file operations
 *  - Uses createModel() for provider-agnostic LLM access
 *  - Integrates with the existing runner.ts safety model (read-only by default)
 *  - Logs tool calls via a safety hook for observability
 *
 * This replaces the hardcoded tool functions in runner.ts with composable,
 * typed Tool instances while preserving the same safety guarantees: the agent
 * can READ files and SEARCH code, but does NOT write files or execute commands
 * directly. File modifications are proposed as ChangeSets for user approval.
 *
 * @example
 * ```ts
 * const agent = createCodingAgent({
 *   projectId: "proj_abc123",
 *   provider: "openai",
 *   model: "gpt-4o",
 * });
 *
 * // Blocking execution
 * const response = await agent.prompt("Explain the auth flow").send();
 *
 * // Streaming execution
 * for await (const event of agent.prompt("Find all TODO comments").stream()) {
 *   // handle events...
 * }
 * ```
 */
import { AgentBuilder, createModel, createHook } from "../core";
import type { Agent } from "../core";
import { createProjectTools } from "../tools/project-tools";
import { thinkTool } from "../tools";

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export type CodingAgentOptions = {
  /** The project ID to scope file operations to. */
  projectId: string;
  /** AI provider identifier (default: AI_PROVIDER env var or 'openai'). */
  provider?: string;
  /** Model ID override (e.g. 'gpt-4o', 'claude-sonnet-4-20250514'). */
  model?: string;
  /** Explicit API key (bypasses env/DB resolution). */
  apiKey?: string;
  /** Workspace ID for DB-based key resolution. */
  workspaceId?: string;
  /** Maximum number of agent turns (default: 15). */
  maxTurns?: number;
  /** Sampling temperature (default: 0.1 for deterministic coding). */
  temperature?: number;
  /** Custom system instructions to append to the default prompt. */
  additionalInstructions?: string;
};

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

const CODING_AGENT_INSTRUCTIONS = `You are Teskel, an expert AI coding assistant. You help developers write, debug, and improve code.

When working on a task:
1. First understand the codebase by reading relevant files using the read_file and list_files tools
2. Think through your approach using the think tool — plan before acting
3. Search for related code patterns using search_code to understand conventions
4. Provide clear, actionable explanations of what you find and recommend

Guidelines:
- Read files before making assumptions about their content
- Use the think tool to reason through complex problems step by step
- When suggesting changes, explain what you're changing and why
- Preserve existing code style and conventions
- Consider edge cases and error handling
- Reference specific file paths and line numbers when discussing code`;

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create a pre-configured coding agent with project-scoped tools.
 *
 * The agent is configured with:
 *  - A think tool for chain-of-thought reasoning
 *  - Project-scoped list_files, read_file, and search_code tools
 *  - A safety hook that logs all tool calls
 *  - Low temperature (0.1) for deterministic coding output
 *  - 15-turn default limit to prevent runaway loops
 *
 * @param options - Configuration for the coding agent.
 * @returns A fully configured Agent instance ready for prompt execution.
 */
export function createCodingAgent(options: CodingAgentOptions): Agent {
  const {
    projectId,
    provider,
    model,
    apiKey,
    workspaceId,
    maxTurns = 15,
    temperature = 0.1,
    additionalInstructions,
  } = options;

  // --- Model ---
  const completionModel = createModel({
    provider: provider ?? process.env.AI_PROVIDER ?? "openai",
    model,
    apiKey,
    workspaceId,
  });

  // --- Project-scoped tools ---
  const projectTools = createProjectTools(projectId);

  // --- Safety hook: log all tool calls for observability ---
  const safetyHook = createHook({
    onToolCall({ toolName, args, tool }) {
      // Log tool invocations with truncated args for debugging.
      // In production this would feed into a structured logging/tracing system.
      const truncatedArgs =
        args.length > 200 ? args.substring(0, 200) + "…" : args;
      console.log(
        `[CodingAgent] Tool call: ${toolName}`,
        truncatedArgs,
      );
      return tool.run();
    },
    onToolResult({ toolName, result, run }) {
      // Log result size for monitoring token budget consumption.
      const resultSize = result.length;
      if (resultSize > 10_000) {
        console.warn(
          `[CodingAgent] Large tool result from ${toolName}: ${resultSize} chars`,
        );
      }
      return run.continue();
    },
  });

  // --- Build instructions ---
  const instructions = additionalInstructions
    ? `${CODING_AGENT_INSTRUCTIONS}\n\n${additionalInstructions}`
    : CODING_AGENT_INSTRUCTIONS;

  // --- Assemble the agent ---
  return new AgentBuilder("coding-agent", completionModel)
    .name("Teskel Coding Agent")
    .description(
      "An AI coding assistant that can read, search, and analyze project files.",
    )
    .instructions(instructions)
    .tool(thinkTool)
    .tool(projectTools.listFiles)
    .tool(projectTools.readFile)
    .tool(projectTools.searchCode)
    .temperature(temperature)
    .defaultMaxTurns(maxTurns)
    .hook(safetyHook)
    .build();
}
