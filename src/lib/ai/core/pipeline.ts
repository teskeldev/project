/**
 * Teskel Pipeline — composable data processing pipeline.
 *
 * Provides a fluent builder for chaining transformation steps, agent prompts,
 * structured extraction, and parallel branches into a single executable
 * pipeline. Supports bounded-concurrency batch processing.
 *
 * Inspired by Anvia's pipeline composition pattern.
 *
 * @example
 * ```ts
 * const pipeline = new PipelineBuilder<string>()
 *   .step((text) => text.trim().toLowerCase())
 *   .prompt(summaryAgent)
 *   .extract(sentimentExtractor)
 *   .build();
 *
 * const result = await pipeline.run("Some long text...");
 * // result is the extracted sentiment object
 *
 * // Batch processing with bounded concurrency
 * const results = await pipeline.batch(texts, { concurrency: 5 });
 * ```
 */
import type { Agent } from "./agent";
import type { Extractor } from "./extractor";

// ---------------------------------------------------------------------------
// PipelineOp interface
// ---------------------------------------------------------------------------

/**
 * A single pipeline operation that transforms an input to an output.
 * Both Pipeline and custom operations implement this interface,
 * enabling composition via `PipelineBuilder.use()`.
 */
export interface PipelineOp<Input = unknown, Output = unknown> {
  run(input: Input): Output | Promise<Output>;
}

// ---------------------------------------------------------------------------
// Pipeline
// ---------------------------------------------------------------------------

/**
 * An executable pipeline that transforms input to output.
 * Created via `PipelineBuilder.build()`.
 */
export class Pipeline<Input, Output> implements PipelineOp<Input, Output> {
  constructor(
    private executor: (input: Input) => Output | Promise<Output>,
  ) {}

  /**
   * Run the pipeline on a single input.
   */
  async run(input: Input): Promise<Output> {
    return this.executor(input);
  }

  /**
   * Run the pipeline on multiple inputs with bounded concurrency.
   *
   * Unlike `Promise.all`, this limits the number of concurrent executions
   * to avoid overwhelming rate limits or memory.
   *
   * @param inputs - Array of inputs to process.
   * @param options - Configuration with `concurrency` limit.
   * @returns Array of results in the same order as inputs.
   */
  async batch(
    inputs: Input[],
    options: { concurrency: number },
  ): Promise<Output[]> {
    const { concurrency } = options;
    const results: Output[] = new Array(inputs.length);
    const executing = new Set<Promise<void>>();

    for (let i = 0; i < inputs.length; i++) {
      const index = i;
      const p = this.run(inputs[index]).then((r) => {
        results[index] = r;
      });

      const tracked = p.then(
        () => {
          executing.delete(tracked);
        },
        () => {
          executing.delete(tracked);
        },
      );
      executing.add(tracked);

      if (executing.size >= concurrency) {
        await Promise.race(executing);
      }
    }

    await Promise.all(executing);
    return results;
  }
}

// ---------------------------------------------------------------------------
// PipelineBuilder
// ---------------------------------------------------------------------------

/**
 * Fluent builder for constructing pipelines by chaining steps.
 *
 * Each method returns a new builder with the accumulated transformation,
 * preserving type safety through the chain.
 */
export class PipelineBuilder<Input, Output = Input> {
  private executor: (input: Input) => Output | Promise<Output>;

  constructor(
    executor?: (input: Input) => Output | Promise<Output>,
  ) {
    this.executor =
      executor ?? ((input: Input) => input as unknown as Output);
  }

  /**
   * Add a transformation step to the pipeline.
   *
   * @param fn - A sync or async function that transforms the current output.
   * @returns A new builder with the step appended.
   */
  step<Next>(
    fn: (input: Awaited<Output>) => Next | Promise<Next>,
  ): PipelineBuilder<Input, Next> {
    const prev = this.executor;
    return new PipelineBuilder<Input, Next>(async (input: Input) => {
      const result = await prev(input);
      return fn(result as Awaited<Output>);
    });
  }

  /**
   * Add a PipelineOp (another pipeline or custom operation) as a step.
   *
   * @param op - A PipelineOp to use as the next step.
   * @returns A new builder with the operation appended.
   */
  use<Next>(
    op: PipelineOp<Awaited<Output>, Next>,
  ): PipelineBuilder<Input, Next> {
    return this.step((input) => op.run(input));
  }

  /**
   * Add an agent prompt step. The current output is converted to a string
   * and sent to the agent; the agent's text output becomes the next value.
   *
   * @param agent - The Agent to prompt.
   * @returns A new builder producing string output.
   */
  prompt(agent: Agent): PipelineBuilder<Input, string> {
    return this.step(async (input) => {
      const text =
        typeof input === "string" ? input : JSON.stringify(input);
      const response = await agent.prompt(text).send();
      return response.output;
    });
  }

  /**
   * Add a structured extraction step. The current output is converted to
   * a string and passed to the extractor; the validated data becomes the
   * next value.
   *
   * @param extractor - The Extractor to use.
   * @returns A new builder producing the extracted type.
   */
  extract<T>(extractor: Extractor<T>): PipelineBuilder<Input, T> {
    return this.step(async (input) => {
      const text =
        typeof input === "string" ? input : JSON.stringify(input);
      return extractor.extract(text);
    });
  }

  /**
   * Run multiple pipeline operations in parallel on the same input.
   * Results are collected into an object keyed by branch name.
   *
   * @param branches - A record of named PipelineOps to run in parallel.
   * @returns A new builder producing an object of branch results.
   *
   * @example
   * ```ts
   * const pipeline = new PipelineBuilder<string>()
   *   .parallel({
   *     summary: summaryPipeline,
   *     sentiment: sentimentPipeline,
   *     entities: entityPipeline,
   *   })
   *   .build();
   *
   * const result = await pipeline.run("Some text");
   * // { summary: "...", sentiment: {...}, entities: [...] }
   * ```
   */
  parallel<
    Branches extends Record<string, PipelineOp<Awaited<Output>, unknown>>,
  >(
    branches: Branches,
  ): PipelineBuilder<
    Input,
    {
      [K in keyof Branches]: Branches[K] extends PipelineOp<
        unknown,
        infer R
      >
        ? Awaited<R>
        : never;
    }
  > {
    return this.step(async (input) => {
      const entries = Object.entries(branches);
      const results = await Promise.all(
        entries.map(
          async ([key, op]) => [key, await op.run(input)] as const,
        ),
      );
      return Object.fromEntries(results) as {
        [K in keyof Branches]: Branches[K] extends PipelineOp<
          unknown,
          infer R
        >
          ? Awaited<R>
          : never;
      };
    });
  }

  /**
   * Build the pipeline into an executable Pipeline instance.
   *
   * @returns A Pipeline that can be run or batched.
   */
  build(): Pipeline<Input, Awaited<Output>> {
    const exec = this.executor;
    const fn = async (input: Input): Promise<Awaited<Output>> => {
      return (await exec(input)) as Awaited<Output>;
    };
    return new Pipeline<Input, Awaited<Output>>(fn);
  }
}
