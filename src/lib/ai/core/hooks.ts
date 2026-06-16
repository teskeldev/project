/**
 * Teskel hook/lifecycle system for agent prompt execution.
 *
 * Hooks allow intercepting and controlling the agent's multi-turn loop
 * at key points: before/after completion calls, and before/after tool
 * execution. Each hook method can return an action that continues,
 * terminates, or (for tool calls) skips execution.
 *
 * Inspired by Anvia's middleware-style hook composition.
 */
import type { CompletionResponse, Message } from "./types";

// ---------------------------------------------------------------------------
// Hook actions
// ---------------------------------------------------------------------------

/** Action returned by hook methods to control execution flow. */
export type HookAction =
  | { type: "continue" }
  | { type: "terminate"; reason: string };

/** Extended action for tool call hooks — adds the ability to skip a tool call. */
export type ToolCallHookAction =
  | HookAction
  | { type: "skip"; reason: string };

// ---------------------------------------------------------------------------
// Control objects passed to hooks
// ---------------------------------------------------------------------------

/** Control object for run-level decisions (continue or cancel the entire run). */
export type RunControl = {
  continue(): HookAction;
  cancel(reason: string): HookAction;
};

/** Control object for tool-call-level decisions (run, skip, or cancel). */
export type ToolCallControl = {
  run(): ToolCallHookAction;
  skip(reason: string): ToolCallHookAction;
  cancel(reason: string): ToolCallHookAction;
};

// ---------------------------------------------------------------------------
// Hook argument types
// ---------------------------------------------------------------------------

export type CompletionCallHookArgs = {
  prompt: Message;
  history: Message[];
  run: RunControl;
};

export type CompletionResponseHookArgs = {
  prompt: Message;
  response: CompletionResponse;
  run: RunControl;
};

export type ToolCallHookArgs = {
  toolName: string;
  toolCallId: string;
  args: string;
  tool: ToolCallControl;
};

export type ToolResultHookArgs = {
  toolName: string;
  toolCallId: string;
  args: string;
  result: string;
  run: RunControl;
};

// ---------------------------------------------------------------------------
// Hook interface
// ---------------------------------------------------------------------------

/**
 * Lifecycle hook interface for agent prompt execution.
 *
 * All methods are optional. Each can return an action synchronously,
 * return a Promise resolving to an action, or return void/undefined
 * to indicate "continue".
 */
export interface PromptHook {
  /** Called before each completion API call. */
  onCompletionCall?(
    args: CompletionCallHookArgs,
  ): HookAction | Promise<HookAction | undefined> | void;

  /** Called after each completion API response. */
  onCompletionResponse?(
    args: CompletionResponseHookArgs,
  ): HookAction | Promise<HookAction | undefined> | void;

  /** Called before each individual tool call is executed. */
  onToolCall?(
    args: ToolCallHookArgs,
  ): ToolCallHookAction | Promise<ToolCallHookAction | undefined> | void;

  /** Called after each individual tool call completes. */
  onToolResult?(
    args: ToolResultHookArgs,
  ): HookAction | Promise<HookAction | undefined> | void;
}

// ---------------------------------------------------------------------------
// Control factory helpers
// ---------------------------------------------------------------------------

/** Create a RunControl instance. */
export function createRunControl(): RunControl {
  return {
    continue: () => ({ type: "continue" }),
    cancel: (reason: string) => ({ type: "terminate", reason }),
  };
}

/** Create a ToolCallControl instance. */
export function createToolCallControl(): ToolCallControl {
  return {
    run: () => ({ type: "continue" }),
    skip: (reason: string) => ({ type: "skip", reason }),
    cancel: (reason: string) => ({ type: "terminate", reason }),
  };
}

// ---------------------------------------------------------------------------
// Hook factory
// ---------------------------------------------------------------------------

/**
 * Create a hook from a partial implementation.
 *
 * @example
 * ```ts
 * const loggingHook = createHook({
 *   onCompletionCall({ prompt, run }) {
 *     console.log("Calling model with:", prompt);
 *     return run.continue();
 *   },
 * });
 * ```
 */
export function createHook(hook: PromptHook): PromptHook {
  return hook;
}

// ---------------------------------------------------------------------------
// Hook composition
// ---------------------------------------------------------------------------

/**
 * Resolve a hook method's return value to a concrete action.
 * Handles void, undefined, and Promise returns.
 */
async function resolveHookResult<T extends HookAction | ToolCallHookAction>(
  result: T | Promise<T | undefined> | void,
): Promise<T | undefined> {
  if (result === undefined || result === null) {
    return undefined;
  }
  // Check if it's a promise
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (typeof (result as any).then === "function") {
    return (await result) ?? undefined;
  }
  return result as T;
}

/**
 * Compose two hooks into a single hook. The first hook (`a`) runs first;
 * if it returns a terminate or skip action, the second hook (`b`) is
 * short-circuited and the action is returned immediately.
 *
 * @example
 * ```ts
 * const combined = composeHooks(rateLimitHook, loggingHook);
 * ```
 */
export function composeHooks(a: PromptHook, b: PromptHook): PromptHook {
  return {
    async onCompletionCall(
      args: CompletionCallHookArgs,
    ): Promise<HookAction | undefined> {
      if (a.onCompletionCall) {
        const result = await resolveHookResult(a.onCompletionCall(args));
        if (result && result.type === "terminate") {
          return result;
        }
      }
      if (b.onCompletionCall) {
        return (await resolveHookResult(b.onCompletionCall(args))) ?? undefined;
      }
      return undefined;
    },

    async onCompletionResponse(
      args: CompletionResponseHookArgs,
    ): Promise<HookAction | undefined> {
      if (a.onCompletionResponse) {
        const result = await resolveHookResult(a.onCompletionResponse(args));
        if (result && result.type === "terminate") {
          return result;
        }
      }
      if (b.onCompletionResponse) {
        return (
          (await resolveHookResult(b.onCompletionResponse(args))) ?? undefined
        );
      }
      return undefined;
    },

    async onToolCall(
      args: ToolCallHookArgs,
    ): Promise<ToolCallHookAction | undefined> {
      if (a.onToolCall) {
        const result = await resolveHookResult(a.onToolCall(args));
        if (result && (result.type === "terminate" || result.type === "skip")) {
          return result;
        }
      }
      if (b.onToolCall) {
        return (await resolveHookResult(b.onToolCall(args))) ?? undefined;
      }
      return undefined;
    },

    async onToolResult(
      args: ToolResultHookArgs,
    ): Promise<HookAction | undefined> {
      if (a.onToolResult) {
        const result = await resolveHookResult(a.onToolResult(args));
        if (result && result.type === "terminate") {
          return result;
        }
      }
      if (b.onToolResult) {
        return (await resolveHookResult(b.onToolResult(args))) ?? undefined;
      }
      return undefined;
    },
  };
}

/**
 * Compose multiple hooks into a single hook, chaining them left to right.
 * Short-circuits on terminate/skip actions.
 *
 * @example
 * ```ts
 * const hook = composeAllHooks([rateLimitHook, loggingHook, metricsHook]);
 * ```
 */
export function composeAllHooks(hooks: PromptHook[]): PromptHook {
  if (hooks.length === 0) return {};
  if (hooks.length === 1) return hooks[0];
  return hooks.reduce((acc, hook) => composeHooks(acc, hook));
}
