import { prisma } from "@/lib/db";
import {
  apiSuccess,
  handleApiError,
  requireProjectAccess,
  validateBody,
  apiError,
} from "@/lib/api";
import { generateChangeSetSchema } from "@/lib/validators";
import { generateChangeSet } from "@/lib/ai/changeset";
import { isAIConfiguredAsync } from "@/lib/ai/provider";
import { enforceRateLimit } from "@/lib/rate-limit";
import { readFile } from "@/lib/storage";
import { checkQuota, recordUsage } from "@/lib/quota";

// POST /api/ai/generate-changeset
// Body: { projectId, instruction, selectedPaths?, model?, provider?, useQualityEngine? }
// Returns the persisted PENDING_REVIEW ChangeSet with its fileChanges.
export async function POST(req: Request) {
  try {
    const { projectId, instruction, selectedPaths, model, provider, useQualityEngine } =
      await validateBody(req, generateChangeSetSchema);

    const { user, project, member } = await requireProjectAccess(projectId);
    const workspaceId = project!.workspaceId;

    // Rate limit AI usage per user (20/min). Production should use Redis.
    await enforceRateLimit(`ai:changeset:${user.id}`, 20, 60_000);

    // Quota check: reserve ~2000 tokens for changeset generation.
    await checkQuota(workspaceId, "ai_tokens", 2000);

    if (!(await isAIConfiguredAsync(undefined, workspaceId))) {
      return apiError(
        "AI is not configured. Add an OpenAI key in Integrations to enable this.",
        503,
        "AI_NOT_CONFIGURED"
      );
    }

    // If quality engine is requested, use it for maximum quality code generation
    if (useQualityEngine) {
      const { runQualityEngine } = await import("@/lib/ai/quality-engine");
      const result = await runQualityEngine({
        task: instruction,
        projectId,
        storageKey: project!.storageKey,
        modelId: model,
        provider,
        workspaceId: member.workspaceId,
        qualityLevel: "maximum",
        selectedPaths,
        signal: req.signal,
      });

      // If the quality engine produced patches, create a changeset from them
      if (result.patches && result.patches.length > 0) {
        const fileChangeData = await Promise.all(
          result.patches.map(async (patch) => {
            let oldContent: string | null = null;
            try {
              oldContent = await readFile(project!.storageKey, patch.filePath);
            } catch {
              oldContent = null;
            }

            // Apply the search/replace to produce new content
            const newContent = oldContent
              ? oldContent.replace(patch.search, patch.replace)
              : patch.replace;

            return {
              filePath: patch.filePath,
              oldPath: null,
              changeType: oldContent ? ("UPDATE" as const) : ("CREATE" as const),
              oldContent,
              newContent,
              diff: null,
              status: "PENDING" as const,
            };
          })
        );

        const changeSet = await prisma.changeSet.create({
          data: {
            projectId,
            title: `Quality Engine: ${instruction.slice(0, 80)}`,
            description: `Generated with quality level "maximum" (score: ${result.quality.score.toFixed(2)}, grade: ${result.quality.grade})`,
            status: "PENDING_REVIEW",
            fileChanges: { create: fileChangeData },
          },
          include: { fileChanges: true },
        });

        // Record AI token usage for the quality engine path.
        const generatedChars = changeSet.fileChanges.reduce(
          (sum, fc) => sum + (fc.newContent?.length ?? 0),
          0
        );
        const actualTokens = Math.max(1, Math.ceil((instruction.length + generatedChars) / 4));
        await recordUsage(workspaceId, "ai_tokens", actualTokens, {
          source: "generate-changeset/quality-engine",
          changeSetId: changeSet.id,
        });

        return apiSuccess(
          {
            changeSet,
            quality: result.quality,
            metadata: result.metadata,
          },
          { status: 201 }
        );
      }

      // Fallback: no patches produced, use standard path
      const changeSet = await generateChangeSet(projectId, instruction, {
        selectedPaths,
        ai: { workspaceId },
      });

      // Record AI token usage for the quality engine path.
      const generatedChars = changeSet.fileChanges.reduce(
        (sum, fc) => sum + (fc.newContent?.length ?? 0),
        0
      );
      const actualTokens = Math.max(1, Math.ceil((instruction.length + generatedChars) / 4));
      await recordUsage(workspaceId, "ai_tokens", actualTokens, {
        source: "generate-changeset/quality-engine",
        changeSetId: changeSet.id,
      });

      return apiSuccess(
        {
          changeSet,
          quality: result.quality,
          metadata: result.metadata,
        },
        { status: 201 }
      );
    }

    // ─── Standard path (existing behavior) ─────────────────────────────────────

    const changeSet = await generateChangeSet(projectId, instruction, {
      selectedPaths,
      ai: { workspaceId },
    });

    // Record AI token usage for the changeset generation.
    // Rough heuristic: ~4 chars per token across instruction + new content.
    const generatedChars = changeSet.fileChanges.reduce(
      (sum, fc) => sum + (fc.newContent?.length ?? 0),
      0
    );
    const actualTokens = Math.max(1, Math.ceil((instruction.length + generatedChars) / 4));
    await recordUsage(workspaceId, "ai_tokens", actualTokens, {
      source: "generate-changeset",
      changeSetId: changeSet.id,
    });

    return apiSuccess({ changeSet }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
