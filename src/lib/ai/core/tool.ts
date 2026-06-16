/**
 * Teskel tool definition and creation system.
 *
 * Provides a type-safe way to define tools with Zod schemas for input
 * validation and optional output validation. Inspired by Anvia's approach
 * of schema-driven tool definitions with automatic JSON Schema generation.
 */
import { z, type ZodSchema, type ZodObject, type ZodRawShape } from "zod";
import type { ToolDefinition, JsonSchemaProperty } from "./types";

// ---------------------------------------------------------------------------
// Zod → JSON Schema conversion (simplified but functional)
// ---------------------------------------------------------------------------

/**
 * Convert a Zod schema to a JSON Schema property definition.
 * Handles the common types used in tool definitions: object, string, number,
 * boolean, array, enum, optional, nullable, and defaults.
 */
function zodToJsonSchemaProperty(schema: ZodSchema): JsonSchemaProperty {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const def = (schema as any)._def;
  const typeName: string = def?.typeName ?? "";

  switch (typeName) {
    case "ZodString": {
      const prop: JsonSchemaProperty = { type: "string" };
      if (def.description) prop.description = def.description;
      return prop;
    }

    case "ZodNumber": {
      const prop: JsonSchemaProperty = { type: "number" };
      if (def.description) prop.description = def.description;
      return prop;
    }

    case "ZodBoolean": {
      const prop: JsonSchemaProperty = { type: "boolean" };
      if (def.description) prop.description = def.description;
      return prop;
    }

    case "ZodEnum": {
      const prop: JsonSchemaProperty = {
        type: "string",
        enum: def.values as unknown[],
      };
      if (def.description) prop.description = def.description;
      return prop;
    }

    case "ZodNativeEnum": {
      const values = Object.values(def.values as Record<string, unknown>);
      const prop: JsonSchemaProperty = {
        type: "string",
        enum: values,
      };
      if (def.description) prop.description = def.description;
      return prop;
    }

    case "ZodArray": {
      const items = zodToJsonSchemaProperty(def.type as ZodSchema);
      const prop: JsonSchemaProperty = { type: "array", items };
      if (def.description) prop.description = def.description;
      return prop;
    }

    case "ZodObject": {
      return zodObjectToJsonSchema(schema as ZodObject<ZodRawShape>);
    }

    case "ZodOptional": {
      const inner = zodToJsonSchemaProperty(def.innerType as ZodSchema);
      if (def.description && !inner.description) {
        inner.description = def.description;
      }
      return inner;
    }

    case "ZodNullable": {
      const inner = zodToJsonSchemaProperty(def.innerType as ZodSchema);
      if (def.description && !inner.description) {
        inner.description = def.description;
      }
      return inner;
    }

    case "ZodDefault": {
      const inner = zodToJsonSchemaProperty(def.innerType as ZodSchema);
      inner.default = def.defaultValue();
      if (def.description && !inner.description) {
        inner.description = def.description;
      }
      return inner;
    }

    case "ZodLiteral": {
      const value = def.value;
      const prop: JsonSchemaProperty = {
        type:
          typeof value === "number"
            ? "number"
            : typeof value === "boolean"
              ? "boolean"
              : "string",
        enum: [value],
      };
      if (def.description) prop.description = def.description;
      return prop;
    }

    case "ZodUnion": {
      // For simple unions, try to infer a common type; otherwise fall back to string
      const prop: JsonSchemaProperty = { type: "string" };
      if (def.description) prop.description = def.description;
      return prop;
    }

    default: {
      // Fallback for unhandled types
      const prop: JsonSchemaProperty = { type: "string" };
      if (def?.description) prop.description = def.description;
      return prop;
    }
  }
}

/**
 * Convert a ZodObject schema to a JSON Schema object definition.
 */
function zodObjectToJsonSchema(
  schema: ZodObject<ZodRawShape>,
): JsonSchemaProperty {
  const shape = schema.shape;
  const properties: Record<string, JsonSchemaProperty> = {};
  const required: string[] = [];

  for (const key of Object.keys(shape)) {
    const fieldSchema = shape[key];
    properties[key] = zodToJsonSchemaProperty(fieldSchema as ZodSchema);

    // A field is required unless it's optional or has a default
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fieldDef = (fieldSchema as any)._def;    const fieldTypeName: string = fieldDef?.typeName ?? "";
    if (fieldTypeName !== "ZodOptional" && fieldTypeName !== "ZodDefault") {
      required.push(key);
    }
  }

  const prop: JsonSchemaProperty = {
    type: "object",
    properties,
  };

  if (required.length > 0) {
    prop.required = required;
  }

   
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const def = (schema as any)._def;
  if (def?.description) {
    prop.description = def.description;
  }

  return prop;
}

/**
 * Convert a Zod schema (expected to be a ZodObject at the top level) to a
 * JSON Schema parameters object for use in a ToolDefinition.
 */
function zodToParametersSchema(schema: ZodSchema): Record<string, unknown> {
  const result = zodToJsonSchemaProperty(schema);
  return {
    type: "object",
    properties: result.properties ?? {},
    ...(result.required && result.required.length > 0
      ? { required: result.required }
      : {}),
  };
}

// ---------------------------------------------------------------------------
// Tool interface
// ---------------------------------------------------------------------------

/** A fully-typed tool with schema validation and execution logic. */
export interface Tool<Args = unknown, Output = unknown> {
  /** Unique tool name (used as the function name in LLM calls). */
  readonly name: string;
  /** Human-readable description of what the tool does. */
  readonly description: string;
  /** Generate the ToolDefinition for LLM provider registration. */
  definition(): ToolDefinition;
  /** Execute the tool with validated arguments. */
  call(args: Args): Output | Promise<Output>;
  /** Parse and validate raw JSON string arguments. */
  parseArgs(raw: string): Args;
}

/** Type-erased tool for use in collections. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyTool = Tool<any, any>;

// ---------------------------------------------------------------------------
// CreateTool options & factory
// ---------------------------------------------------------------------------

/** Options for creating a tool via the factory function. */
export type CreateToolOptions<
  I extends ZodSchema,
  O extends ZodSchema | undefined = undefined,
> = {
  /** Unique tool name. */
  name: string;
  /** Human-readable description. */
  description: string;
  /** Zod schema for input validation. Must be a z.object(). */
  input: I;
  /** Optional Zod schema for output validation. */
  output?: O;
  /** The tool's execution function. Receives validated input. */
  execute: (
    args: z.output<I>,
  ) =>
    | (O extends ZodSchema ? z.output<O> : unknown)
    | Promise<O extends ZodSchema ? z.output<O> : unknown>;
};

/**
 * Create a type-safe tool with Zod schema validation.
 *
 * The tool's `definition()` method produces a flat `ToolDefinition` compatible
 * with the model layer. Model implementations handle wrapping it in the
 * provider-specific format (e.g., OpenAI's `{ type: "function", function: { ... } }`).
 *
 * @example
 * ```ts
 * const searchTool = createTool({
 *   name: "search",
 *   description: "Search the knowledge base",
 *   input: z.object({
 *     query: z.string().describe("Search query"),
 *     limit: z.number().optional().describe("Max results"),
 *   }),
 *   execute: async ({ query, limit }) => {
 *     return await search(query, limit ?? 10);
 *   },
 * });
 * ```
 */
export function createTool<
  I extends ZodSchema,
  O extends ZodSchema | undefined = undefined,
>(
  options: CreateToolOptions<I, O>,
): Tool<z.output<I>, O extends ZodSchema ? z.output<O> : unknown> {
  const { name, description, input, output, execute } = options;

  return {
    name,
    description,

    definition(): ToolDefinition {
      return {
        name,
        description,
        parameters: zodToParametersSchema(input),
      };
    },

    parseArgs(raw: string): z.output<I> {
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        throw new Error(
          `Invalid JSON arguments for tool "${name}": ${raw.slice(0, 200)}`,
        );
      }
      const result = input.safeParse(parsed);
      if (!result.success) {
        const issues = result.error.issues
          .map(
            (i: { path: Array<string | number>; message: string }) =>
              `  ${i.path.join(".")}: ${i.message}`,
          )
          .join("\n");
        throw new Error(`Invalid arguments for tool "${name}":\n${issues}`);
      }
      return result.data;
    },

    async call(args: z.output<I>) {
      const result = await execute(args);

      // Validate output if an output schema was provided
      if (output) {
        const outputResult = (output as ZodSchema).safeParse(result);
        if (!outputResult.success) {
          const issues = outputResult.error.issues
            .map(
              (i: { path: Array<string | number>; message: string }) =>
                `  ${i.path.join(".")}: ${i.message}`,
            )
            .join("\n");
          throw new Error(`Invalid output from tool "${name}":\n${issues}`);
        }
        return outputResult.data;
      }

      return result;
    },
  };
}

// ---------------------------------------------------------------------------
// Built-in tools
// ---------------------------------------------------------------------------

/**
 * Create a "think" tool for chain-of-thought reasoning.
 *
 * This tool allows the LLM to record its reasoning process before acting,
 * which improves accuracy on complex multi-step tasks. The thought is
 * returned as-is — it's a no-op tool that exists purely for structured
 * reasoning within the tool-call flow.
 */
export function createThinkTool(): Tool<{ thought: string }, string> {
  return createTool({
    name: "think",
    description:
      "Record your reasoning process. Use this to think through complex problems step by step before acting.",
    input: z.object({
      thought: z.string().describe("Your reasoning or analysis"),
    }),
    execute: ({ thought }) => thought,
  }) as Tool<{ thought: string }, string>;
}
