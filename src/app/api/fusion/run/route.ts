import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  apiSuccess,
  handleApiError,
  requireUser,
  requireRole,
  validateBody,
  ApiError,
} from "@/lib/api";
import { enforceRateLimit } from "@/lib/rate-limit";
import { executeFusion } from "@/lib/ai/fusion-panel";
import { getFusionConfig } from "@/lib/ai/fusion-config";
import { buildSmartContext } from "@/lib/ai/smart-context";

const runFusionSchema = z.object({
  task: z.string().min(1).max(8000),
  workspaceId: z.string().min(1),
  projectId: z.string().min(1).optional(),
  panelSlug: z.string().max(64).optional(),
});

/**
 * POST /api/fusion/run
 *
 * Runs the Multi-Model Fusion pipeline (panel → Opus judge) for a task and
 * returns the full FusionResult: the deliverable plus the audit trail
 * (panel slug, participating panelists, judge, Track A verification / merge
 * rationale or Track B five-section analysis).
 */
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const { task, workspaceId, projectId, panelSlug } = await validateBody(
      req,
      runFusionSchema
    );

    // Authorize: caller must be a writing member of the target workspace.
    const member = await prisma.workspaceMember.findFirst({
      where: { workspaceId, userId: user.id },
      select: { role: true },
    });
    if (!member) {
      throw new ApiError("You do not have access to this workspace", 403, "FORBIDDEN");
    }
    requireRole(member);

    // A fusion run is N× the cost of a single answer — throttle aggressively.
    await enforceRateLimit(`fusion:run:${user.id}`, 5, 60_000);

    const config = await getFusionConfig();

    // Optional project grounding: pull smart context so panelists can "research"
    // the codebase. Scoped to a project the user can access.
    let context: string | undefined;
    if (projectId) {
      const project = await prisma.project.findFirst({
        where: { id: projectId, workspace: { members: { some: { userId: user.id } } } },
        select: { id: true },
      });
      if (!project) {
        throw new ApiError("Project not found", 404, "NOT_FOUND");
      }
      try {
        const smart = await buildSmartContext(projectId, {
          query: task,
          includeRepoMap: true,
          includeRelevantFiles: true,
        });
        context = smart.system;
      } catch {
        // Non-fatal — fusion still runs without project grounding.
      }
    }

    const result = await executeFusion({
      task,
      context,
      workspaceId,
      projectId,
      panelSlug: panelSlug || config.defaultPanelSlug,
      // Track is auto-classified inside executeFusion; do not force it.
      runLint: config.trackAVerification.runLint,
    });

    return apiSuccess({ result });
  } catch (err) {
    return handleApiError(err);
  }
}
