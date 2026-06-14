/**
 * Teskel built-in tools for the agent system.
 *
 * Provides a standard set of tools using the createTool() factory from the
 * core module. These are placeholder implementations that return stub data —
 * for real project-scoped implementations that interact with the database and
 * file system, see ./project-tools.ts.
 *
 * Tools:
 *  - think:        Chain-of-thought reasoning (no-op, records reasoning)
 *  - list_files:   List files and directories in a project path
 *  - read_file:    Read file contents with optional line range
 *  - search_code:  Regex search across project files
 *  - write_file:   Write or create a file
 *  - git_status:   Get current git status
 *  - run_command:  Execute a shell command (placeholder — gated in production)
 *  - web_search:   Search the web for information
 */
import { z } from "zod";
import { createTool, createThinkTool } from "../core";

// ---------------------------------------------------------------------------
// Think tool — chain-of-thought reasoning
// ---------------------------------------------------------------------------

/**
 * Think tool for structured chain-of-thought reasoning.
 *
 * Allows the LLM to record its reasoning process before acting, improving
 * accuracy on complex multi-step tasks. The thought is returned as-is.
 */
export const thinkTool = createThinkTool();

// ---------------------------------------------------------------------------
// File system tools
// ---------------------------------------------------------------------------

/**
 * List files and directories in a project path.
 *
 * Returns file names with their types (FILE or DIRECTORY). Supports both
 * flat and recursive listing. Placeholder — will be connected to the
 * project file system via project-tools.ts.
 */
export const listFilesTool = createTool({
  name: "list_files",
  description:
    "List files and directories in a project path. Returns file names with types.",
  input: z.object({
    path: z
      .string()
      .describe("Relative path within the project. Use '.' for root."),
    recursive: z
      .boolean()
      .optional()
      .describe("Whether to list recursively"),
  }),
  execute: async ({ path, recursive }) => {
    // Placeholder — will be connected to project file system
    return { files: [] as string[], path, recursive: recursive ?? false };
  },
});

/**
 * Read the contents of a file in the project.
 *
 * Supports optional line-range selection for reading specific sections
 * of large files. Placeholder — will be connected to the project file
 * system via project-tools.ts.
 */
export const readFileTool = createTool({
  name: "read_file",
  description: "Read the contents of a file in the project.",
  input: z.object({
    path: z.string().describe("Relative file path within the project"),
    startLine: z
      .number()
      .optional()
      .describe("Start line number (1-indexed)"),
    endLine: z
      .number()
      .optional()
      .describe("End line number (1-indexed)"),
  }),
  execute: async ({ path, startLine, endLine }) => {
    // Placeholder — will be connected to project file system
    return { content: "", path, startLine, endLine };
  },
});

/**
 * Search for text patterns across project files using regex.
 *
 * Returns matching lines with file paths and line numbers. Supports
 * glob-based file filtering and result count limits. Placeholder —
 * will be connected to the search engine via project-tools.ts.
 */
export const searchCodeTool = createTool({
  name: "search_code",
  description:
    "Search for text patterns across project files using regex.",
  input: z.object({
    query: z.string().describe("Search query (regex supported)"),
    filePattern: z
      .string()
      .optional()
      .describe("Glob pattern to filter files (e.g., '*.ts')"),
    maxResults: z
      .number()
      .optional()
      .describe("Maximum number of results to return"),
  }),
  execute: async ({ query, filePattern, maxResults }) => {
    // Placeholder — will be connected to search engine
    return {
      results: [] as Array<{ path: string; line: number; text: string }>,
      query,
      filePattern,
      maxResults,
    };
  },
});

/**
 * Write or update a file in the project.
 *
 * Creates the file if it doesn't exist, overwrites if it does. The agent
 * runner's safety model determines whether writes are applied directly or
 * staged as a ChangeSet for user approval. Placeholder — will be connected
 * to the storage layer via project-tools.ts.
 */
export const writeFileTool = createTool({
  name: "write_file",
  description:
    "Write or update a file in the project. Creates the file if it doesn't exist.",
  input: z.object({
    path: z.string().describe("Relative file path"),
    content: z.string().describe("Full file content to write"),
  }),
  execute: async ({ path, content }) => {
    // Placeholder — will be connected to storage layer
    return { success: true, path, bytesWritten: content.length };
  },
});

// ---------------------------------------------------------------------------
// Git tools
// ---------------------------------------------------------------------------

/**
 * Get the current git status of the project.
 *
 * Returns branch name, staged/unstaged/untracked file lists, and whether
 * the working tree is clean. Placeholder — will be connected to the git
 * service via project-tools.ts.
 */
export const gitStatusTool = createTool({
  name: "git_status",
  description: "Get the current git status of the project.",
  input: z.object({}),
  execute: async () => {
    // Placeholder — will be connected to git service
    return {
      status: "clean" as const,
      branch: "main",
      changes: [] as Array<{ path: string; status: string }>,
    };
  },
});

// ---------------------------------------------------------------------------
// Terminal tool
// ---------------------------------------------------------------------------

/**
 * Execute a shell command in the project directory.
 *
 * SAFETY: In production, command execution is gated behind user approval
 * and command validation. The agent runner (runner.ts) intentionally does
 * NOT execute commands — it only proposes them. This tool exists for the
 * new agent system where execution policy is controlled by hooks.
 */
export const runCommandTool = createTool({
  name: "run_command",
  description: "Execute a shell command in the project directory.",
  input: z.object({
    command: z.string().describe("The shell command to execute"),
    timeout: z
      .number()
      .optional()
      .describe("Timeout in seconds (default: 30)"),
  }),
  execute: async ({ command, timeout }) => {
    // Placeholder — gated by hooks in production
    return {
      stdout: "",
      stderr: "",
      exitCode: 0,
      command,
      timeout: timeout ?? 30,
    };
  },
});

// ---------------------------------------------------------------------------
// Web search tool
// ---------------------------------------------------------------------------

/**
 * Search the web for information.
 *
 * Returns a list of search results with titles, URLs, and snippets.
 * Placeholder — will be connected to a search provider.
 */
export const webSearchTool = createTool({
  name: "web_search",
  description: "Search the web for information.",
  input: z.object({
    query: z.string().describe("Search query"),
  }),
  execute: async ({ query }) => {
    // Placeholder — will be connected to search provider
    return {
      results: [] as Array<{ title: string; url: string; snippet: string }>,
      query,
    };
  },
});

// ---------------------------------------------------------------------------
// Export all built-in tools as a collection
// ---------------------------------------------------------------------------

/**
 * All built-in tools as an array, suitable for passing to
 * `AgentBuilder.tools()` or `ToolSet.fromTools()`.
 */
export const builtinTools = [
  thinkTool,
  listFilesTool,
  readFileTool,
  searchCodeTool,
  writeFileTool,
  gitStatusTool,
  runCommandTool,
  webSearchTool,
];
