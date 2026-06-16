/**
 * Teskel AgentBuilder — fluent builder for constructing Agent instances.
 *
 * Provides a chainable API for configuring an agent with a model, tools,
 * instructions, hooks, and other options before building the final Agent.
 *
 * @example
 * ```ts
 * const agent = new AgentBuilder("assistant", model)
 *   .name("Research Assistant")
 *   .description("Helps with research tasks")
 *   .instructions("You are a helpful research assistant.")
 *   .tool(searchTool)
 *   .tool(calculatorTool)
 *   .temperature(0.7)
 *   .maxTokens(4096)
 *   .defaultMaxTurns(15)
 *   .hook(loggingHook)
 *   .build();
 * ```
 */
import type { CompletionModel, ToolChoice } from "./types";
import type { AnyTool } from "./tool";
import { ToolSet } from "./tool-set";
import type { PromptHook } from "./hooks";
import { composeHooks } from "./hooks";
import { Agent, type AgentOptions } from "./agent";

export class AgentBuilder {
  private opts: { id: string; model: CompletionModel } & Partial<
    Omit<AgentOptions, "id" | "model" | "tools">
  >;
  private toolList: AnyTool[] = [];
  private hooks: PromptHook[] = [];

  constructor(id: string, model: CompletionModel) {
    this.opts = { id, model };
  }

  /** Set the agent's display name. */
  name(name: string): this {
    this.opts.name = name;
    return this;
  }

  /** Set the agent's description. */
  description(desc: string): this {
    this.opts.description = desc;
    return this;
  }

  /** Set the system instructions for the agent. */
  instructions(instructions: string): this {
    this.opts.instructions = instructions;
    return this;
  }

  /** Add a single tool to the agent. */
  tool(tool: AnyTool): this {
    this.toolList.push(tool);
    return this;
  }

  /** Add multiple tools to the agent. */
  tools(tools: AnyTool[]): this {
    this.toolList.push(...tools);
    return this;
  }

  /** Set the sampling temperature. */
  temperature(temp: number): this {
    this.opts.temperature = temp;
    return this;
  }

  /** Set the maximum output tokens per completion call. */
  maxTokens(tokens: number): this {
    this.opts.maxTokens = tokens;
    return this;
  }

  /** Set the tool choice strategy. */
  toolChoice(choice: ToolChoice): this {
    this.opts.toolChoice = choice;
    return this;
  }

  /** Set the default maximum number of turns for prompt requests. */
  defaultMaxTurns(turns: number): this {
    this.opts.defaultMaxTurns = turns;
    return this;
  }

  /**
   * Add a hook to the agent. Multiple hooks are composed in order,
   * with earlier hooks taking priority for short-circuit actions.
   */
  hook(hook: PromptHook): this {
    this.hooks.push(hook);
    return this;
  }

  /**
   * Build the Agent instance from the accumulated configuration.
   *
   * @throws {Error} If required options are missing.
   */
  build(): Agent {
    const agentOpts: AgentOptions = {
      id: this.opts.id,
      model: this.opts.model,
    };

    if (this.opts.name !== undefined) agentOpts.name = this.opts.name;
    if (this.opts.description !== undefined)
      agentOpts.description = this.opts.description;
    if (this.opts.instructions !== undefined)
      agentOpts.instructions = this.opts.instructions;
    if (this.opts.temperature !== undefined)
      agentOpts.temperature = this.opts.temperature;
    if (this.opts.maxTokens !== undefined)
      agentOpts.maxTokens = this.opts.maxTokens;
    if (this.opts.toolChoice !== undefined)
      agentOpts.toolChoice = this.opts.toolChoice;
    if (this.opts.defaultMaxTurns !== undefined)
      agentOpts.defaultMaxTurns = this.opts.defaultMaxTurns;

    // Build ToolSet from accumulated tools
    if (this.toolList.length > 0) {
      agentOpts.tools = ToolSet.fromTools(this.toolList);
    }

    // Compose hooks
    if (this.hooks.length === 1) {
      agentOpts.hook = this.hooks[0];
    } else if (this.hooks.length > 1) {
      agentOpts.hook = this.hooks.reduce((acc, hook) =>
        composeHooks(acc, hook),
      );
    }

    return new Agent(agentOpts);
  }
}
