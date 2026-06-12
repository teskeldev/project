import {
  apiSuccess,
  handleApiError,
  requireProjectAccess,
  validateBody,
  apiError,
} from "@/lib/api";
import { generateChangeSetSchema } from "@/lib/validators";
import { generateChangeSet } from "@/lib/ai/changeset";
import { isAIConfigured } from "@/lib/ai/provider";
import { enforceRateLimit } from "@/lib/rate-limit";

// POST /api/ai/generate-changeset
// Body: { projectId, instruction, selectedPaths? }
// Returns the persisted PENDING_REVIEW ChangeSet with its fileChanges.
export async function POST(req: Request) {
  try {
    const { projectId, instruction, selectedPaths } = await validateBody(
      req,
      generateChangeSetSchema
    );

    const { user } = await requireProjectAccess(projectId);

    // Rate limit AI usage per user (20/min). Production should use Redis.
    enforceRateLimit(`ai:changeset:${user.id}`, 20, 60_000);

    if (!isAIConfigured()) {
      return apiError(
        "AI is not configured. Add an OpenAI key in Integrations to enable this.",
        503,
        "AI_NOT_CONFIGURED"
      );
    }

    const changeSet = await generateChangeSet(projectId, instruction, {
      selectedPaths,
    });

    return apiSuccess({ changeSet }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
