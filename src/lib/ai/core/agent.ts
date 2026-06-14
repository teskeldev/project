/**
 * Teskel Agent — the core execution engine for multi-turn LLM interactions.
 *
 * The Agent class wraps a CompletionModel with tools, instructions, and hooks
 * to provide a high-level interface for prompt execution. The PromptRequest
 * class implements the multi-turn tool loop with proper error handling,
 * usage accumulation, and hook integration.
 *
 * Inspired by Anvia's agent architecture.
 */
import type {
  AssistantContent,
  CompletionModel,
  CompletionRequest,
  CompletionResponse,
  Message,
  StreamingCompletionModel,
  ToolCallContent,
  ToolChoice,
  ToolResultContent,
  Usage,
} from "./types";
import { Message as MessageFactory, isStreamingModel } from "./types";
import type { AnyTool } from "./tool";
import { createTool } from "./tool";
import { ToolSet, ToolCallError, ToolNotFoundError } from "./tool-set";
import type {
  PromptHook,
  HookAction,
  ToolCallHookAction,
} from "./hooks";
import {
  createRunControl,
  createToolCallControl,
  composeHooks,
} from "./hooks";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Agent options
// ---------------------------------------------------------------------------

export type AgentOptions = {
  id: string;
  name?: string;
  description?: string;
  model: CompletionModel;
  instructions?: string;
  tools?: ToolSet;
  toolChoice?: ToolChoice;
  temperature?: number;
  maxTokens?: number;
  defaultMaxTurns?: number;
  hook?: PromptHook;
};

// ---------------------------------------------------------------------------
// Response types
// ---------------------------------------------------------------------------

export type PromptResponse = {
  /** The final text output from the agent. */
  output: string;
  /** Accumulated token usage across all turns. */
  usage: Usage;
  /** The full message history including all turns. */
  messages: Message[];
};

// ---------------------------------------------------------------------------
// Stream event types
// ---------------------------------------------------------------------------

export type AgentStreamEvent =
  | { type: "turn_start"; turn: number }
  | { type: "text_delta"; turn: number; delta: string }
  | { type: "reasoning_delta"; turn: number; delta: string }
  | {
      type: "tool_call";
      turn: number;
      toolName: string;
      toolCallId: string;
      args: string;
    }
  | {
      type: "tool_result";
      turn: number;
      toolName: string;
      toolCallId: string;
      result: string;
    }
  | { type: "turn_end"; turn: number }
  | { type: "final"; output: string; usage: Usage; messages: Message[] }
  | { type: "error"; error: unknown };

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class MaxTurnsError extends Error {
  constructor(readonly turns: number) {
    super(`Agent exceeded maximum turns: ${turns}`);
    this.name = "MaxTurnsError";
  }
}

export class PromptCancelledError extends Error {
  constructor(readonly reason: string) {
    super(`Prompt cancelled: ${reason}`);
    this.name = "PromptCancelledError";
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Accumulate usage from multiple turns. */
function addUsage(a: Usage, b: Usage): Usage {
  return {
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    totalTokens: a.totalTokens + b.totalTokens,
  };
}

/** Create a zero-value Usage. */
function emptyUsage(): Usage {
  return { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
}

/** Extract text from assistant content. */
function extractText(content: string | AssistantContent[]): string {
  if (typeof content === "string") return content;
  return content
    .filter((c): c is { type: "text"; text: string } => c.type === "text")
    .map((c) => c.text)
    .join("");
}

/** Extract tool calls from assistant content. */
function extractToolCalls(
  content: string | AssistantContent[],
): ToolCallContent[] {
  if (typeof content === "string") return [];
  return content.filter(
    (c): c is ToolCallContent => c.type === "tool_call",
  );
}

/** Normalize prompt input to a Message. */
function normalizePrompt(input: string | Message): Message {
  if (typeof input === "string") {
    return MessageFactory.user(input);
  }
  return input;
}

/**
 * Resolve a hook action result, handling void/undefined/Promise.
 * Returns the action or undefined (meaning "continue").
 */
async function resolveAction<T extends HookAction | ToolCallHookAction>(
  result: T | Promise<T | undefined> | void,
): Promise<T | undefined> {
  if (result === undefined || result === null) return undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (typeof (result as any).then === "function") {
    return ((await result) as T | undefined) ?? undefined;
  }
  return result as T;
}

// ---------------------------------------------------------------------------
// PromptRequest — the execution engine
// ---------------------------------------------------------------------------

/**
 * Represents a pending prompt request that can be configured and executed.
 *
 * Supports both blocking (`send()`) and streaming (`stream()`) execution,
 * with a multi-turn tool loop that handles tool calls, hook lifecycle,
 * and usage accumulation.
 *
 * @example
 * ```ts
 * const response = await agent
 *   .prompt("What's the weather?")
 *   .withHistory(previousMessages)
 *   .maxTurns(5)
 *   .send();
 * ```
 */
export class PromptRequest {
  private history: Message[] = [];
  private maxTurnsValue: number;
  private hookOverride?: PromptHook;
  private toolConcurrency = 1;

  constructor(
    private agentOpts: AgentOptions,
    private promptInput: string | Message,
  ) {
    this.maxTurnsValue = agentOpts.defaultMaxTurns ?? 10;
  }

  /** Set conversation history (messages before the current prompt). */
  withHistory(history: Message[]): this {
    this.history = [...history];
    return this;
  }

  /** Set the maximum number of turns (completion calls) for this request. */
  maxTurns(n: number): this {
    this.maxTurnsValue = n;
    return this;
  }

  /** Override the agent-level hook for this specific request. */
  requestHook(hook: PromptHook): this {
    this.hookOverride = hook;
    return this;
  }

  /** Set the concurrency level for parallel tool execution. */
  withToolConcurrency(n: number): this {
    this.toolConcurrency = Math.max(1, n);
    return this;
  }

  /** Get the effective hook (request-level composed with agent-level). */
  private getEffectiveHook(): PromptHook | undefined {
    const agentHook = this.agentOpts.hook;
    const reqHook = this.hookOverride;
    if (agentHook && reqHook) return composeHooks(reqHook, agentHook);
    return reqHook ?? agentHook;
  }

  /** Build the CompletionRequest for a given set of messages. */
  private buildCompletionRequest(messages: Message[]): CompletionRequest {
    const req: CompletionRequest = { messages };

    if (this.agentOpts.instructions) {
      req.instructions = this.agentOpts.instructions;
    }
    if (this.agentOpts.temperature !== undefined) {
      req.temperature = this.agentOpts.temperature;
    }
    if (this.agentOpts.maxTokens !== undefined) {
      req.maxTokens = this.agentOpts.maxTokens;
    }
    if (this.agentOpts.tools && this.agentOpts.tools.size > 0) {
      req.tools = this.agentOpts.tools.getDefinitions();
      req.toolChoice = this.agentOpts.toolChoice ?? "auto";
    }

    return req;
  }

  /**
   * Execute tool calls with the configured concurrency.
   * Returns an array of { toolCallId, toolName, args, result, isError } objects.
   */
  private async executeToolCalls(
    toolCalls: ToolCallContent[],
    hook: PromptHook | undefined,
    _promptMsg: Message,
    _turn: number,
  ): Promise<
    Array<{
      toolCallId: string;
      toolName: string;
      args: string;
      result: string;
      isError: boolean;
      action?: HookAction;
    }>
  > {
    const toolSet = this.agentOpts.tools;
    if (!toolSet) {
      return toolCalls.map((tc) => ({
        toolCallId: tc.id,
        toolName: tc.name,
        args: tc.arguments,
        result: `Error: No tools registered`,
        isError: true,
      }));
    }

    const runControl = createRunControl();
    const results: Array<{
      toolCallId: string;
      toolName: string;
      args: string;
      result: string;
      isError: boolean;
      action?: HookAction;
    }> = [];

    // Process tool calls with concurrency control
    const pending = [...toolCalls];
    while (pending.length > 0) {
      const batch = pending.splice(0, this.toolConcurrency);
      const batchResults = await Promise.all(
        batch.map(async (tc) => {
          // --- onToolCall hook ---
          if (hook?.onToolCall) {
            const toolControl = createToolCallControl();
            const action = await resolveAction(
              hook.onToolCall({
                toolName: tc.name,
                toolCallId: tc.id,
                args: tc.arguments,
                tool: toolControl,
              }),
            );
            if (action) {
              if (action.type === "terminate") {
                return {
                  toolCallId: tc.id,
                  toolName: tc.name,
                  args: tc.arguments,
                  result: `Tool call cancelled: ${action.reason}`,
                  isError: true,
                  action: action as HookAction,
                };
              }
              if (action.type === "skip") {
                return {
                  toolCallId: tc.id,
                  toolName: tc.name,
                  args: tc.arguments,
                  result: `Tool call skipped: ${action.reason}`,
                  isError: false,
                };
              }
            }
          }

          // --- Execute the tool ---
          let result: string;
          let isError = false;
          try {
            result = await toolSet.call(tc.name, tc.arguments);
          } catch (err) {
            isError = true;
            if (err instanceof ToolNotFoundError) {
              result = `Error: Tool "${tc.name}" not found`;
            } else if (err instanceof ToolCallError) {
              result = `Error: ${err.message}`;
            } else if (err instanceof Error) {
              result = `Error: ${err.message}`;
            } else {
              result = `Error: Tool execution failed`;
            }
          }

          // --- onToolResult hook ---
          if (hook?.onToolResult) {
            const action = await resolveAction(
              hook.onToolResult({
                toolName: tc.name,
                toolCallId: tc.id,
                args: tc.arguments,
                result,
                run: runControl,
              }),
            );
            if (action && action.type === "terminate") {
              return {
                toolCallId: tc.id,
                toolName: tc.name,
                args: tc.arguments,
                result,
                isError,
                action,
              };
            }
          }

          return {
            toolCallId: tc.id,
            toolName: tc.name,
            args: tc.arguments,
            result,
            isError,
          };
        }),
      );

      results.push(...batchResults);

      // Check if any result triggered a terminate action
      const terminated = batchResults.find(
        (r) => r.action?.type === "terminate",
      );
      if (terminated) break;
    }

    return results;
  }

  /**
   * Execute the prompt with a blocking multi-turn loop.
   *
   * The loop:
   * 1. Builds a CompletionRequest with instructions, history, and tools
   * 2. Calls hook.onCompletionCall
   * 3. Calls model.completion()
   * 4. Calls hook.onCompletionResponse
   * 5. Checks for tool calls in the response
   * 6. If tool calls: calls hook.onToolCall, executes via ToolSet, calls hook.onToolResult
   * 7. Appends assistant message + tool results to history
   * 8. Loops until no tool calls or maxTurns exceeded
   * 9. Returns final text output + accumulated usage + messages
   */
  async send(): Promise<PromptResponse> {
    const hook = this.getEffectiveHook();
    const model = this.agentOpts.model;
    const promptMsg = normalizePrompt(this.promptInput);
    const runControl = createRunControl();

    // Build the working message list
    const messages: Message[] = [...this.history, promptMsg];
    let totalUsage = emptyUsage();
    let turn = 0;

    while (turn < this.maxTurnsValue) {
      turn++;

      // --- onCompletionCall hook ---
      if (hook?.onCompletionCall) {
        const action = await resolveAction(
          hook.onCompletionCall({
            prompt: promptMsg,
            history: messages,
            run: runControl,
          }),
        );
        if (action?.type === "terminate") {
          throw new PromptCancelledError(action.reason);
        }
      }

      // --- Call the model ---
      const request = this.buildCompletionRequest(messages);
      let response: CompletionResponse;
      try {
        response = await model.completion(request);
      } catch (err) {
        throw err;
      }

      totalUsage = addUsage(totalUsage, response.usage);

      // --- onCompletionResponse hook ---
      if (hook?.onCompletionResponse) {
        const action = await resolveAction(
          hook.onCompletionResponse({
            prompt: promptMsg,
            response,
            run: runControl,
          }),
        );
        if (action?.type === "terminate") {
          throw new PromptCancelledError(action.reason);
        }
      }

      // --- Process the response ---
      const toolCalls = extractToolCalls(response.content);
      const assistantMsg = MessageFactory.assistant(response.content);
      messages.push(assistantMsg);

      // If no tool calls, we're done
      if (toolCalls.length === 0) {
        const output = extractText(response.content);
        return { output, usage: totalUsage, messages };
      }

      // --- Execute tool calls ---
      const toolResults = await this.executeToolCalls(
        toolCalls,
        hook,
        promptMsg,
        turn,
      );

      // Build tool result message
      const toolContent: ToolResultContent[] = toolResults.map((r) => ({
        toolCallId: r.toolCallId,
        content: r.result,
        isError: r.isError,
      }));
      messages.push(MessageFactory.tool(toolContent));

      // Check if any tool result triggered termination
      const terminated = toolResults.find(
        (r) => r.action?.type === "terminate",
      );
      if (terminated) {
        const output = extractText(response.content);
        return { output, usage: totalUsage, messages };
      }
    }

    // Exceeded max turns
    throw new MaxTurnsError(this.maxTurnsValue);
  }

  /**
   * Execute the prompt with streaming, yielding events as they occur.
   *
   * Uses model.streamCompletion() if available, otherwise falls back
   * to model.completion() and emits events from the complete response.
   */
  async *stream(): AsyncGenerator<AgentStreamEvent> {
    const hook = this.getEffectiveHook();
    const model = this.agentOpts.model;
    const promptMsg = normalizePrompt(this.promptInput);
    const runControl = createRunControl();
    const useStreaming = isStreamingModel(model);

    const messages: Message[] = [...this.history, promptMsg];
    let totalUsage = emptyUsage();
    let turn = 0;

    try {
      while (turn < this.maxTurnsValue) {
        turn++;
        yield { type: "turn_start", turn };

        // --- onCompletionCall hook ---
        if (hook?.onCompletionCall) {
          const action = await resolveAction(
            hook.onCompletionCall({
              prompt: promptMsg,
              history: messages,
              run: runControl,
            }),
          );
          if (action?.type === "terminate") {
            yield {
              type: "error",
              error: new PromptCancelledError(action.reason),
            };
            return;
          }
        }

        const request = this.buildCompletionRequest(messages);
        let response: CompletionResponse;

        if (useStreaming) {
          // --- Streaming path ---
          const streamingModel = model as StreamingCompletionModel;
          // Track partial tool calls being assembled from deltas
          const partialToolCalls = new Map<
            string,
            { id: string; name: string; arguments: string }
          >();
          let streamResponse: CompletionResponse | undefined;

          for await (const event of streamingModel.streamCompletion(request)) {
            switch (event.type) {
              case "text_delta":
                yield { type: "text_delta", turn, delta: event.delta };
                break;

              case "reasoning_delta":
                yield { type: "reasoning_delta", turn, delta: event.delta };
                break;

              case "tool_call_delta": {
                // Accumulate partial tool call data
                let partial = partialToolCalls.get(event.id);
                if (!partial) {
                  partial = {
                    id: event.id,
                    name: event.name ?? "",
                    arguments: "",
                  };
                  partialToolCalls.set(event.id, partial);
                }
                if (event.name) partial.name = event.name;
                if (event.argumentsDelta)
                  partial.arguments += event.argumentsDelta;
                break;
              }

              case "tool_call":
                // Complete tool call received
                yield {
                  type: "tool_call",
                  turn,
                  toolName: event.toolCall.name,
                  toolCallId: event.toolCall.id,
                  args: event.toolCall.arguments,
                };
                break;

              case "final":
                streamResponse = event.response;
                break;

              case "error":
                yield { type: "error", error: event.error };
                return;
            }
          }

          if (!streamResponse) {
            yield {
              type: "error",
              error: new Error("Stream ended without final response"),
            };
            return;
          }

          response = streamResponse;
        } else {
          // --- Non-streaming fallback ---
          response = await model.completion(request);

          // Emit text content as a single delta
          const text = extractText(response.content);
          if (text) {
            yield { type: "text_delta", turn, delta: text };
          }

          // Emit tool calls
          const tcs = extractToolCalls(response.content);
          for (const tc of tcs) {
            yield {
              type: "tool_call",
              turn,
              toolName: tc.name,
              toolCallId: tc.id,
              args: tc.arguments,
            };
          }
        }

        totalUsage = addUsage(totalUsage, response.usage);

        // --- onCompletionResponse hook ---
        if (hook?.onCompletionResponse) {
          const action = await resolveAction(
            hook.onCompletionResponse({
              prompt: promptMsg,
              response,
              run: runControl,
            }),
          );
          if (action?.type === "terminate") {
            yield {
              type: "error",
              error: new PromptCancelledError(action.reason),
            };
            return;
          }
        }

        // --- Process tool calls ---
        const toolCalls = extractToolCalls(response.content);
        const assistantMsg = MessageFactory.assistant(response.content);
        messages.push(assistantMsg);

        if (toolCalls.length === 0) {
          yield { type: "turn_end", turn };
          const output = extractText(response.content);
          yield { type: "final", output, usage: totalUsage, messages };
          return;
        }

        // --- Execute tool calls ---
        const toolResults = await this.executeToolCalls(
          toolCalls,
          hook,
          promptMsg,
          turn,
        );

        // Emit tool results
        for (const r of toolResults) {
          yield {
            type: "tool_result",
            turn,
            toolName: r.toolName,
            toolCallId: r.toolCallId,
            result: r.result,
          };
        }

        // Build tool result message
        const toolContent: ToolResultContent[] = toolResults.map((r) => ({
          toolCallId: r.toolCallId,
          content: r.result,
          isError: r.isError,
        }));
        messages.push(MessageFactory.tool(toolContent));

        yield { type: "turn_end", turn };

        // Check for termination from tool hooks
        const terminated = toolResults.find(
          (r) => r.action?.type === "terminate",
        );
        if (terminated) {
          const output = extractText(response.content);
          yield { type: "final", output, usage: totalUsage, messages };
          return;
        }
      }

      // Exceeded max turns
      yield { type: "error", error: new MaxTurnsError(this.maxTurnsValue) };
    } catch (err) {
      yield { type: "error", error: err };
    }
  }

  /**
   * Convert the stream to a ReadableStream for HTTP responses.
   * Each event is encoded as a JSONL (newline-delimited JSON) line.
   */
  readableStream(): ReadableStream<Uint8Array> {
    const encoder = new TextEncoder();
    const streamGen = this.stream();

    return new ReadableStream<Uint8Array>({
      async pull(controller) {
        try {
          const { value, done } = await streamGen.next();
          if (done) {
            controller.close();
            return;
          }
          const line = JSON.stringify(value) + "\n";
          controller.enqueue(encoder.encode(line));

          // Close after final or error events
          if (value.type === "final" || value.type === "error") {
            controller.close();
          }
        } catch (err) {
          const errorLine =
            JSON.stringify({
              type: "error",
              error: err instanceof Error ? err.message : String(err),
            }) + "\n";
          controller.enqueue(encoder.encode(errorLine));
          controller.close();
        }
      },
    });
  }
}

// ---------------------------------------------------------------------------
// Agent class
// ---------------------------------------------------------------------------

/**
 * An Agent wraps a CompletionModel with tools, instructions, and hooks
 * to provide a high-level interface for multi-turn LLM interactions.
 *
 * @example
 * ```ts
 * const agent = new Agent({
 *   id: "assistant",
 *   model: createModel({ provider: "openai", model: "gpt-4o" }),
 *   instructions: "You are a helpful assistant.",
 *   tools: ToolSet.fromTools([searchTool]),
 * });
 *
 * const response = await agent.prompt("Find info about TypeScript").send();
 * console.log(response.output);
 * ```
 */
export class Agent {
  constructor(private options: AgentOptions) {}

  get id(): string {
    return this.options.id;
  }

  get name(): string | undefined {
    return this.options.name;
  }

  get description(): string | undefined {
    return this.options.description;
  }

  get model(): CompletionModel {
    return this.options.model;
  }

  /**
   * Create a new prompt request for this agent.
   *
   * @param text - The prompt text or a pre-built Message.
   * @returns A PromptRequest that can be configured and executed.
   */
  prompt(text: string | Message): PromptRequest {
    return new PromptRequest(this.options, text);
  }

  /**
   * Wrap this agent as a tool that can be used by another agent.
   *
   * This enables agent-to-agent delegation: a parent agent can call
   * this agent as a tool, passing a prompt and receiving the output.
   *
   * @example
   * ```ts
   * const researchAgent = new Agent({ ... });
   * const parentAgent = new AgentBuilder("parent", model)
   *   .tool(researchAgent.asTool({
   *     name: "research",
   *     description: "Delegate research tasks to a specialized agent",
   *   }))
   *   .build();
   * ```
   */
  asTool(opts: {
    name: string;
    description: string;
    maxTurns?: number;
  }): AnyTool {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const agent = this;
    return createTool({
      name: opts.name,
      description: opts.description,
      input: z.object({
        prompt: z.string().describe("The prompt to send to the agent"),
      }),
      execute: async ({ prompt }) => {
        const request = agent.prompt(prompt);
        if (opts.maxTurns !== undefined) {
          request.maxTurns(opts.maxTurns);
        }
        const response = await request.send();
        return response.output;
      },
    });
  }
}
