/**
 * Teskel ToolSet — a registry for managing and invoking tools.
 *
 * Provides a centralized collection of tools that can be registered,
 * looked up, and invoked by name. Designed for use with LLM tool-calling
 * flows where the model selects a tool by name and provides JSON arguments.
 */
import type { AnyTool } from "./tool";
import type { ToolDefinition } from "./types";

// ---------------------------------------------------------------------------
// Error types
// ---------------------------------------------------------------------------

/** Thrown when attempting to call a tool that is not registered. */
export class ToolNotFoundError extends Error {
  constructor(readonly toolName: string) {
    super(`Tool not found: ${toolName}`);
    this.name = "ToolNotFoundError";
  }
}

/** Wraps errors that occur during tool execution. */
export class ToolCallError extends Error {
  readonly cause: unknown;

  constructor(readonly toolName: string, cause: unknown) {
    const message =
      cause instanceof Error
        ? `Tool call failed: ${toolName} — ${cause.message}`
        : `Tool call failed: ${toolName}`;
    super(message);
    this.name = "ToolCallError";
    this.cause = cause;
  }
}

// ---------------------------------------------------------------------------
// ToolSet
// ---------------------------------------------------------------------------

/**
 * A registry of tools that can be queried for definitions and invoked by name.
 *
 * @example
 * ```ts
 * const tools = ToolSet.fromTools([searchTool, calculatorTool]);
 *
 * // Get definitions for LLM registration
 * const defs = tools.getDefinitions();
 *
 * // Invoke a tool by name with raw JSON args
 * const result = await tools.call("search", '{"query": "hello"}');
 * ```
 */
export class ToolSet {
  private tools = new Map<string, AnyTool>();

  /**
   * Create a ToolSet from an array of tools.
   */
  static fromTools(tools: AnyTool[]): ToolSet {
    const set = new ToolSet();
    for (const tool of tools) {
      set.addTool(tool);
    }
    return set;
  }

  /**
   * Register a tool. Throws if a tool with the same name is already registered.
   */
  addTool(tool: AnyTool): this {
    if (this.tools.has(tool.name)) {
      throw new Error(
        `Duplicate tool name: "${tool.name}" is already registered`,
      );
    }
    this.tools.set(tool.name, tool);
    return this;
  }

  /**
   * Register multiple tools from an array or another ToolSet.
   */
  addTools(tools: AnyTool[] | ToolSet): this {
    if (tools instanceof ToolSet) {
      for (const entry of tools.entries()) {
        this.addTool(entry[1]);
      }
    } else {
      for (const tool of tools) {
        this.addTool(tool);
      }
    }
    return this;
  }

  /**
   * Check whether a tool with the given name is registered.
   */
  has(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * Look up a tool by name. Returns undefined if not found.
   */
  get(name: string): AnyTool | undefined {
    return this.tools.get(name);
  }

  /**
   * Get all tool definitions in the format expected by LLM providers.
   */
  getDefinitions(): ToolDefinition[] {
    const definitions: ToolDefinition[] = [];
    this.tools.forEach((tool) => {
      definitions.push(tool.definition());
    });
    return definitions;
  }

  /**
   * Invoke a tool by name with raw JSON arguments.
   *
   * The arguments are parsed and validated against the tool's input schema,
   * the tool is executed, and the result is serialized to a string.
   *
   * @param name - The tool name to invoke.
   * @param argsJson - Raw JSON string of arguments.
   * @returns The serialized result string.
   * @throws {ToolNotFoundError} If no tool with the given name is registered.
   * @throws {ToolCallError} If the tool execution fails.
   */
  async call(name: string, argsJson: string): Promise<string> {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new ToolNotFoundError(name);
    }

    let args: unknown;
    try {
      args = tool.parseArgs(argsJson);
    } catch (err) {
      throw new ToolCallError(name, err);
    }

    let result: unknown;
    try {
      result = await tool.call(args);
    } catch (err) {
      throw new ToolCallError(name, err);
    }

    // Serialize the result to a string for the LLM
    if (typeof result === "string") {
      return result;
    }
    if (result === undefined || result === null) {
      return "";
    }
    return JSON.stringify(result);
  }

  /**
   * The number of registered tools.
   */
  get size(): number {
    return this.tools.size;
  }

  /**
   * Get all entries as an array of [name, tool] pairs.
   */
  entries(): Array<[string, AnyTool]> {
    return Array.from(this.tools.entries());
  }

  /**
   * Iterate over all registered tools as [name, tool] pairs.
   */
  [Symbol.iterator](): Iterator<[string, AnyTool]> {
    return this.tools.entries();
  }
}
