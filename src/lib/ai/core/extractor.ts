/**
 * Teskel Extractor — structured data extraction using the agent system.
 *
 * Uses a "submit" tool with a Zod schema to force the model to produce
 * structured output matching the target type. The model MUST call the
 * submit tool (toolChoice: "required"), and the arguments are validated
 * against the schema.
 *
 * Inspired by Anvia's extraction pattern: define a schema, wrap it in a
 * tool, and let the model fill in the structured data.
 *
 * @example
 * ```ts
 * const extractor = new ExtractorBuilder(model, z.object({
 *   sentiment: z.enum(["positive", "negative", "neutral"]),
 *   confidence: z.number().min(0).max(1),
 *   summary: z.string(),
 * }))
 *   .instructions("Analyze the sentiment of the given text.")
 *   .build();
 *
 * const result = await extractor.extract("I love this product!");
 * // { sentiment: "positive", confidence: 0.95, summary: "..." }
 * ```
 */
import { type ZodSchema } from "zod";
import type {
  AssistantContent,
  CompletionModel,
  Message,
  ToolCallContent,
  Usage,
} from "./types";
import { Agent } from "./agent";
import { AgentBuilder } from "./agent-builder";
import { createTool } from "./tool";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ExtractionResponse<T> = {
  data: T;
  usage: Usage;
};

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class ExtractionError extends Error {
  constructor(
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "ExtractionError";
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Find the "submit" tool call in the agent's response messages.
 * Searches assistant messages in reverse order to find the most recent call.
 */
function findSubmitToolCall(
  messages: Message[],
): ToolCallContent | undefined {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role === "assistant" && Array.isArray(msg.content)) {
      const toolCall = (msg.content as AssistantContent[]).find(
        (c): c is ToolCallContent =>
          c.type === "tool_call" && c.name === "submit",
      );
      if (toolCall) return toolCall;
    }
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Extractor
// ---------------------------------------------------------------------------

/**
 * Extracts structured data from text using an agent with a forced tool call.
 *
 * The agent is configured with a "submit" tool whose input schema matches
 * the target extraction type. With `toolChoice: "required"`, the model is
 * forced to call the submit tool, producing validated structured output.
 */
export class Extractor<T> {
  constructor(
    private agent: Agent,
    private schema: ZodSchema<T>,
    private retryCount: number,
  ) {}

  /**
   * Extract structured data from the input.
   *
   * @param input - A string or Message to extract data from.
   * @returns The extracted and validated data.
   * @throws {ExtractionError} If extraction fails after all retries.
   */
  async extract(input: string | Message): Promise<T> {
    const response = await this.extractWithUsage(input);
    return response.data;
  }

  /**
   * Extract structured data from the input, including token usage info.
   *
   * @param input - A string or Message to extract data from.
   * @returns The extracted data and usage statistics.
   * @throws {ExtractionError} If extraction fails after all retries.
   */
  async extractWithUsage(
    input: string | Message,
  ): Promise<ExtractionResponse<T>> {
    let lastError: unknown;

    for (let attempt = 0; attempt <= this.retryCount; attempt++) {
      try {
        const promptInput =
          attempt === 0
            ? input
            : typeof input === "string"
              ? `${input}\n\n[Previous extraction attempt failed. Please try again, ensuring your response matches the required schema exactly.]`
              : input;

        const response = await this.agent.prompt(promptInput).send();

        // The agent was configured with toolChoice: "required", so the model
        // must have called the "submit" tool. Find the submit tool call
        // in the response messages.
        const submitCall = findSubmitToolCall(response.messages);

        if (!submitCall) {
          throw new ExtractionError(
            "Model did not call the submit tool. No structured data was produced.",
          );
        }

        // Parse the tool call arguments
        let rawArgs: unknown;
        try {
          rawArgs = JSON.parse(submitCall.arguments);
        } catch (parseErr) {
          throw new ExtractionError(
            `Failed to parse submit tool arguments as JSON: ${submitCall.arguments.slice(0, 200)}`,
            parseErr,
          );
        }

        // Validate against the Zod schema
        const result = this.schema.safeParse(rawArgs);
        if (!result.success) {
          const issues = result.error.issues
            .map(
              (i: { path: Array<string | number>; message: string }) =>
                `  ${i.path.join(".")}: ${i.message}`,
            )
            .join("\n");
          throw new ExtractionError(
            `Extracted data does not match schema:\n${issues}`,
          );
        }

        return {
          data: result.data,
          usage: response.usage,
        };
      } catch (err) {
        lastError = err;

        // Don't retry on the last attempt
        if (attempt >= this.retryCount) {
          break;
        }
      }
    }

    throw new ExtractionError(
      `Extraction failed after ${this.retryCount + 1} attempt(s)`,
      lastError,
    );
  }
}

// ---------------------------------------------------------------------------
// ExtractorBuilder
// ---------------------------------------------------------------------------

/**
 * Fluent builder for constructing Extractor instances.
 *
 * @example
 * ```ts
 * const extractor = new ExtractorBuilder(model, schema)
 *   .instructions("Extract entities from the text.")
 *   .temperature(0.1)
 *   .retryCount(2)
 *   .build();
 * ```
 */
export class ExtractorBuilder<T> {
  private instructionsText?: string;
  private temp?: number;
  private maxTok?: number;
  private retries = 1;

  constructor(
    private model: CompletionModel,
    private schema: ZodSchema<T>,
  ) {}

  /** Set extraction instructions for the model. */
  instructions(text: string): this {
    this.instructionsText = text;
    return this;
  }

  /** Set the temperature for the extraction completion. */
  temperature(temp: number): this {
    this.temp = temp;
    return this;
  }

  /** Set the maximum tokens for the extraction completion. */
  maxTokens(tokens: number): this {
    this.maxTok = tokens;
    return this;
  }

  /** Set the number of retry attempts on extraction failure. */
  retryCount(count: number): this {
    this.retries = count;
    return this;
  }

  /** Build and return the configured Extractor. */
  build(): Extractor<T> {
    // Create the "submit" tool with the extraction schema.
    // The tool is a no-op — its purpose is to force the model to produce
    // structured output matching the schema via tool-call arguments.
    const submitTool = createTool({
      name: "submit",
      description:
        "Submit the extracted structured data. You MUST call this tool with the extracted data matching the required schema.",
      input: this.schema as ZodSchema,
      execute: (args: unknown) => args,
    });

    // Build the agent with the submit tool and toolChoice: "required"
    const builder = new AgentBuilder("extractor", this.model)
      .tool(submitTool)
      .toolChoice("required")
      .defaultMaxTurns(1); // Only one turn needed — model calls submit

    if (this.instructionsText) {
      builder.instructions(this.instructionsText);
    }

    if (this.temp !== undefined) {
      builder.temperature(this.temp);
    }

    if (this.maxTok !== undefined) {
      builder.maxTokens(this.maxTok);
    }

    const agent = builder.build();

    return new Extractor<T>(agent, this.schema, this.retries);
  }
}
