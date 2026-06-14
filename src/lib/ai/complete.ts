import { chat, isAIConfigured, type AIMessage } from "@/lib/ai/provider";

export type CompletionRequest = {
  content: string;
  line: number;
  column: number;
  language: string;
  filePath: string;
};

export type CompletionResult = {
  text: string;
};

const SYSTEM_PROMPT = `You are an AI code completion engine. You will receive code with a <CURSOR> marker showing where the user is typing. Provide 1-3 short, contextually appropriate code completions that would naturally follow at the cursor position.

Rules:
- Return ONLY a JSON array of strings, e.g. ["completion1", "completion2"]
- Each completion should be 1-5 lines of code
- Do NOT repeat code that already exists before the cursor
- Do NOT include markdown fences or explanations
- Match the existing code style, indentation, and language conventions
- If the cursor is mid-line, complete the current line first
- Completions should be syntactically valid`;

export async function getCompletions(
  req: CompletionRequest
): Promise<CompletionResult[]> {
  if (!isAIConfigured()) {
    return [];
  }

  // Build context window around cursor
  const lines = req.content.split("\n");
  const beforeLines = lines.slice(Math.max(0, req.line - 50), req.line - 1);
  const currentLine = lines[req.line - 1] || "";
  const afterLines = lines.slice(req.line, Math.min(lines.length, req.line + 20));

  const beforeCursor = currentLine.slice(0, req.column - 1);
  const afterCursor = currentLine.slice(req.column - 1);

  const contextBefore = beforeLines.join("\n") + "\n" + beforeCursor;
  const contextAfter = afterCursor + "\n" + afterLines.join("\n");

  const userPrompt = `Language: ${req.language || "unknown"}
File: ${req.filePath}

\`\`\`
${contextBefore}<CURSOR>${contextAfter}
\`\`\`

Provide completions at <CURSOR>:`;

  const messages: AIMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: userPrompt },
  ];

  try {
    const raw = await chat(messages, { temperature: 0, maxTokens: 200 });

    // Parse JSON array from response
    let parsed: unknown;
    try {
      const jsonMatch = raw.match(/\[[\s\S]*\]/);
      if (!jsonMatch) return [];
      parsed = JSON.parse(jsonMatch[0]);
    } catch {
      return [];
    }

    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter(
        (item): item is string => typeof item === "string" && item.trim().length > 0
      )
      .slice(0, 3)
      .map((text) => ({ text }));
  } catch {
    return [];
  }
}
