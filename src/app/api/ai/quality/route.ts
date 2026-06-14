import {
  apiSuccess,
  handleApiError,
  requireProjectAccess,
  apiError,
  ApiError,
} from "@/lib/api";
import { isAIConfiguredAsync } from "@/lib/ai/provider";
import { enforceRateLimit } from "@/lib/rate-limit";
import { z } from "zod";

const qualityRequestSchema = z.object({
  projectId: z.string().min(1, "projectId is required"),
  task: z.string().min(1, "task is required"),
  qualityLevel: z.enum(["fast", "balanced", "maximum"]).optional().default("balanced"),
  selectedPaths: z.array(z.string()).optional(),
  model: z.string().optional(),
  provider: z.string().optional(),
});

// POST /api/ai/quality
// Body: { projectId, task, qualityLevel?, selectedPaths?, model?, provider? }
// Returns the full QualityEngineResult.
export async function POST(req: Request) {
  try {
    let json: unknown;
    try {
      json = await req.json();
    } catch {
      throw new ApiError("Invalid JSON body", 400, "INVALID_JSON");
    }

    const body = qualityRequestSchema.parse(json);

    const { user, project, member } = await requireProjectAccess(body.projectId);
    const workspaceId = project!.workspaceId;

    // Rate limit: 10 requests per minute per user
    await enforceRateLimit(`ai:quality:${user.id}`, 10, 60_000);

    if (!(await isAIConfiguredAsync(undefined, workspaceId))) {
      return apiError(
        "AI is not configured. Add an OpenAI key in Integrations to enable this.",
        503,
        "AI_NOT_CONFIGURED"
      );
    }

    const { runQualityEngine } = await import("@/lib/ai/quality-engine");

    const result = await runQualityEngine({
      task: body.task,
      projectId: body.projectId,
      storageKey: project!.storageKey,
      modelId: body.model,
      provider: body.provider,
      workspaceId: member.workspaceId,
      qualityLevel: body.qualityLevel,
      selectedPaths: body.selectedPaths,
      signal: req.signal,
    });

    return apiSuccess(result);
  } catch (err) {
    return handleApiError(err);
  }
}
