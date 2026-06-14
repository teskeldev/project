import { z } from "zod";
import {
  apiSuccess,
  handleApiError,
  requireProjectAccess,
  validateBody,
} from "@/lib/api";
import { enforceRateLimit } from "@/lib/rate-limit";
import { getCompletions, type CompletionRequest } from "@/lib/ai/complete";
import { isAIConfiguredAsync } from "@/lib/ai/provider";
import { recordUsage, checkQuota } from "@/lib/quota";

/**
 * AI inline code completion endpoint.
 * Accepts a prompt and (optionally) selected file paths.
 * Returns 1-3 short completion suggestions.
 *
 * POST /api/ai/complete
 * Body: { projectId, prompt, selectedPaths?, model?, provider? }
 * Response: { completions: [{ text: string }] }
 */
const completeSchema = z.object({
  projectId: z.string(),
  prompt: z.string().max(64000),
  selectedPaths: z.array(z.string()).max(100).optional(),
  model: z.string().optional(),
  provider: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const body = await validateBody(req, completeSchema);
    const { projectId, prompt } = body;

    const { user, member } = await requireProjectAccess(projectId);

    // Rate limit: 60 completions per minute per user
    enforceRateLimit(`ai:complete:${user.id}`, 60, 60_000);

    // Quota check: completions are small but still consume tokens.
    await checkQuota(member.workspaceId, "ai_tokens", 200);

    if (!await isAIConfiguredAsync(undefined, member.workspaceId)) {
      return apiSuccess({ completions: [] });
    }

    // The new schema exposes `prompt` rather than legacy file/line/column
    // context. Map to CompletionRequest with safe defaults; downstream
    // completion logic is expected to migrate to the prompt-based shape.
    const completionReq: CompletionRequest = {
      content: prompt,
      line: 1,
      column: 1,
      language: "plaintext",
      filePath: "",
    };

    const results = await getCompletions(completionReq);

    // Record AI token usage for the completions.
    const generatedChars = results.reduce((sum, r) => sum + r.text.length, 0);
    const actualTokens = Math.max(1, Math.ceil((prompt.length + generatedChars) / 4));
    await recordUsage(member.workspaceId, "ai_tokens", actualTokens, {
      source: "ai/complete",
    });

    return apiSuccess({ completions: results });
  } catch (err) {
    return handleApiError(err);
  }
}
