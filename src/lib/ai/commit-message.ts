/**
 * AI-powered commit message generation.
 * Reads the staged diff and generates a conventional commit message.
 */
import { chat, isAIConfigured, type AIMessage } from "@/lib/ai/provider";
import { diff as gitDiff } from "@/lib/git/service";

const SYSTEM_PROMPT = `You are a commit message generator. Given a git diff, generate a concise, descriptive commit message following the Conventional Commits format.

Rules:
- Use format: type(scope): description
- Types: feat, fix, refactor, docs, style, test, chore, perf, ci, build
- Keep the first line under 72 characters
- Add a blank line then bullet points for details if the change is complex
- Do NOT include the diff itself in the message
- Be specific about what changed, not how
- Return ONLY the commit message, no markdown fences or explanations`;

export async function generateCommitMessage(
  storageKey: string,
  options?: { workspaceId?: string }
): Promise<string> {
  if (!isAIConfigured()) {
    throw new Error("AI is not configured");
  }

  // Get staged diff
  const result = await gitDiff(storageKey, { staged: true });
  if (!result || !('diff' in result) || !result.diff) {
    throw new Error("No staged changes to generate a message for");
  }

  const diffText = result.diff.slice(0, 8000); // Cap diff size

  const messages: AIMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: `Generate a commit message for this diff:\n\n${diffText}` },
  ];

  return await chat(messages, { temperature: 0.3, maxTokens: 200, workspaceId: options?.workspaceId });
}
