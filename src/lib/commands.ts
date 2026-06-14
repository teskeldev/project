/**
 * Slash commands — user-defined prompt templates triggered with /name.
 *
 * Templates support {{variable}} placeholders that are filled in
 * before sending to the AI.
 */
import { prisma } from "@/lib/db";

export type CommandVariable = {
  name: string;
  description: string;
  required: boolean;
  defaultValue?: string;
};

export type SlashCommandDef = {
  id: string;
  name: string;
  description: string;
  template: string;
  variables: CommandVariable[];
  builtin?: boolean;
};

/**
 * Resolve a command: replace {{variables}} with provided values.
 * Unresolved optional variables are replaced with empty string.
 */
export function resolveCommand(
  template: string,
  values: Record<string, string>
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, varName: string) => {
    return values[varName] ?? "";
  });
}

/**
 * Extract variable names from a template string.
 */
export function extractVariables(template: string): string[] {
  const matches = template.matchAll(/\{\{(\w+)\}\}/g);
  const names = new Set<string>();
  for (const m of matches) {
    names.add(m[1]);
  }
  return Array.from(names);
}

/**
 * List all commands for a workspace (custom from DB).
 */
export async function listCommands(
  workspaceId: string
): Promise<SlashCommandDef[]> {
  const commands = await prisma.slashCommand.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "asc" },
  });

  return commands.map((cmd) => ({
    id: cmd.id,
    name: cmd.name,
    description: cmd.description,
    template: cmd.template,
    variables: (cmd.variables as CommandVariable[]) ?? [],
    builtin: false,
  }));
}

/**
 * Built-in commands available to all workspaces.
 */
export const BUILTIN_COMMANDS: SlashCommandDef[] = [
  {
    id: "builtin-review",
    name: "review",
    description: "Review code in a file",
    template:
      "Review the following code and suggest improvements:\n\nFile: {{file}}\n\nFocus on: {{focus}}",
    variables: [
      { name: "file", description: "File path to review", required: true },
      {
        name: "focus",
        description: "What to focus on (performance, security, readability)",
        required: false,
        defaultValue: "general quality",
      },
    ],
    builtin: true,
  },
  {
    id: "builtin-test",
    name: "test",
    description: "Generate tests for a file",
    template:
      "Write comprehensive tests for {{file}}. Use {{framework}} testing framework. Cover edge cases and error scenarios.",
    variables: [
      { name: "file", description: "File to generate tests for", required: true },
      {
        name: "framework",
        description: "Testing framework (jest, vitest, pytest, etc.)",
        required: false,
        defaultValue: "vitest",
      },
    ],
    builtin: true,
  },
  {
    id: "builtin-explain",
    name: "explain",
    description: "Explain code in detail",
    template:
      "Explain this code in detail, including its purpose, how it works, and any notable patterns:\n\n{{code}}",
    variables: [
      { name: "code", description: "Code snippet or file path to explain", required: true },
    ],
    builtin: true,
  },
  {
    id: "builtin-refactor",
    name: "refactor",
    description: "Refactor code for improvement",
    template:
      "Refactor {{file}} to improve {{aspect}}. Keep the same functionality but make the code better. Explain your changes.",
    variables: [
      { name: "file", description: "File to refactor", required: true },
      {
        name: "aspect",
        description: "What to improve (readability, performance, modularity)",
        required: false,
        defaultValue: "readability and maintainability",
      },
    ],
    builtin: true,
  },
  {
    id: "builtin-fix",
    name: "fix",
    description: "Fix a bug",
    template:
      "Fix this bug: {{description}}\n\nRelevant file: {{file}}\n\nProvide the corrected code and explain what was wrong.",
    variables: [
      { name: "description", description: "Description of the bug", required: true },
      { name: "file", description: "Relevant file path", required: false },
    ],
    builtin: true,
  },
  {
    id: "builtin-deploy",
    name: "deploy",
    description: "Help with deployment",
    template:
      "Help me deploy this project. Target: {{target}}. Current setup: {{setup}}. Provide step-by-step instructions.",
    variables: [
      {
        name: "target",
        description: "Deployment target (Vercel, AWS, Docker, etc.)",
        required: true,
      },
      {
        name: "setup",
        description: "Current project setup/framework",
        required: false,
        defaultValue: "Next.js application",
      },
    ],
    builtin: true,
  },
];
