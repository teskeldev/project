/**
 * AI-powered terminal command suggestion.
 * User describes what they want in natural language,
 * AI generates the appropriate shell command.
 */
import { chat, type AIMessage } from "@/lib/ai/provider";

const SYSTEM_PROMPT = `You are a terminal command generator. Given a natural language description, generate the exact shell command(s) to accomplish the task.

Rules:
- Return ONLY the command(s), one per line
- No explanations, no markdown fences
- Use common Unix/Linux commands
- For multi-step tasks, chain with && or use separate lines
- Prefer safe commands (avoid rm -rf, sudo unless explicitly asked)
- Use the project context to determine package manager (npm/yarn/pnpm)`;

export interface TerminalSuggestContext {
  cwd?: string;
  recentCommands?: string[];
  projectType?: string;
}

export async function suggestCommand(
  description: string,
  context?: TerminalSuggestContext,
  workspaceId?: string
): Promise<string> {
  // Build context-aware prompt
  const contextParts: string[] = [];
  if (context?.cwd) {
    contextParts.push(`Current directory: ${context.cwd}`);
  }
  if (context?.projectType) {
    contextParts.push(`Project type: ${context.projectType}`);
  }
  if (context?.recentCommands && context.recentCommands.length > 0) {
    contextParts.push(
      `Recent commands:\n${context.recentCommands.slice(-5).join("\n")}`
    );
  }

  const userContent = contextParts.length > 0
    ? `Context:\n${contextParts.join("\n")}\n\nTask: ${description}`
    : description;

  const messages: AIMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: userContent },
  ];

  // Call AI with low temperature for deterministic output
  const result = await chat(messages, {
    temperature: 0.2,
    maxTokens: 256,
    workspaceId,
  });

  // Clean up the response: strip any accidental markdown fences or whitespace
  return result
    .replace(/^```[\w]*\n?/gm, "")
    .replace(/```$/gm, "")
    .trim();
}
