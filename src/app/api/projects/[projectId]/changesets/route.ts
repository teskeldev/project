import { prisma } from "@/lib/db";
import { apiSuccess, handleApiError, requireProjectAccess } from "@/lib/api";
import { diffStat } from "@/lib/diff";
import type { ChangeSetStatus } from "@prisma/client";

type RouteContext = { params: Promise<{ projectId: string }> };

const VALID_STATUSES: ChangeSetStatus[] = [
  "DRAFT",
  "PENDING_REVIEW",
  "APPLIED",
  "REJECTED",
];

// GET /api/projects/:projectId/changesets?status=PENDING_REVIEW
// Lists changesets (newest first) with fileChange count + additions/deletions
// summary derived from each FileChange.diff. Default scope: DRAFT + PENDING_REVIEW.
export async function GET(req: Request, ctx: RouteContext) {
  try {
    const { projectId } = await ctx.params;
    await requireProjectAccess(projectId);

    const url = new URL(req.url);
    const statusParam = url.searchParams.get("status");

    let statusFilter: ChangeSetStatus[];
    if (statusParam) {
      const requested = statusParam
        .split(",")
        .map((s) => s.trim().toUpperCase())
        .filter((s): s is ChangeSetStatus =>
          (VALID_STATUSES as string[]).includes(s)
        );
      statusFilter = requested.length > 0 ? requested : ["PENDING_REVIEW", "DRAFT"];
    } else {
      statusFilter = ["PENDING_REVIEW", "DRAFT"];
    }

    const rows = await prisma.changeSet.findMany({
      where: { projectId, status: { in: statusFilter } },
      orderBy: { createdAt: "desc" },
      include: {
        fileChanges: {
          select: { id: true, diff: true, status: true, changeType: true },
        },
      },
    });

    const changesets = rows.map((cs) => {
      let additions = 0;
      let deletions = 0;
      for (const fc of cs.fileChanges) {
        const stat = diffStat(fc.diff);
        additions += stat.additions;
        deletions += stat.deletions;
      }
      return {
        id: cs.id,
        projectId: cs.projectId,
        agentRunId: cs.agentRunId,
        title: cs.title,
        description: cs.description,
        status: cs.status,
        createdAt: cs.createdAt,
        updatedAt: cs.updatedAt,
        fileChangeCount: cs.fileChanges.length,
        summary: { additions, deletions },
      };
    });

    return apiSuccess({ changesets });
  } catch (err) {
    return handleApiError(err);
  }
}