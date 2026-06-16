import { z } from "zod";
import {
  apiSuccess,
  handleApiError,
  requireProjectAccess,
  validateBody,
  ApiError,
} from "@/lib/api";
import { enforceRateLimit } from "@/lib/rate-limit";
import { isAIConfiguredAsync } from "@/lib/ai/provider";
import { suggestCommand } from "@/lib/ai/terminal-suggest";

const terminalSuggestSchema = z.object({
  projectId: z.string(),
  description: z.string().max(2000),
  cwd: z.string().max(4096).optional(),
});

/**
 * AI terminal command suggestion endpoint.
 *
 * POST /api/ai/terminal-suggest
 * Body: { description: string, projectId: string, context?: { cwd?, recentCommands?, projectType? } }
 * Response: { command: string }
 */
export async function POST(req: Request) {
  try {
    const { projectId, description, cwd } = await validateBody(req, terminalSuggestSchema);

    const { user, project } = await requireProjectAccess(projectId);
    const workspaceId = project!.workspaceId;

    // Rate limit: 30 suggestions per minute per user
    await enforceRateLimit(`ai:terminal-suggest:${user.id}`, 30, 60_000);

    if (!(await isAIConfiguredAsync(undefined, workspaceId))) {
      throw new ApiError(
        "AI is not configured. Add an API key in Integrations to enable suggestions.",
        503,
        "AI_NOT_CONFIGURED"
      );
    }

    const command = await suggestCommand(description.trim(), cwd ? { cwd } : undefined, workspaceId);

    return apiSuccess({ command });
  } catch (err) {
    return handleApiError(err);
  }
}
