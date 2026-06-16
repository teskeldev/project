import { prisma } from "@/lib/db";
import { apiSuccess, handleApiError, requireUser } from "@/lib/api";
import { withRouteMetrics } from "@/lib/observability/metrics";

/**
 * GET /api/dashboard/summary?projectId=
 *
 * Returns real aggregates for the dashboard home, scoped strictly to the
 * authenticated user's workspaces/projects.
 *
 * - recentProjects: newest projects across all the user's workspaces.
 * - A "focus" project (the `projectId` query param if accessible, otherwise
 *   the newest project) drives the contextual panels so the numbers match the
 *   project-scoped feature pages (chat / agents / composer / git):
 *     - recentThreads (newest, with title)
 *     - recentAgentRuns (status)
 *     - pendingChangesCount (ChangeSet status PENDING_REVIEW)
 *     - git (branch + dirty file count from GitState, if present)
 * - counts: workspace/project totals plus the focus project's activity counts.
 */

type DirtyShape =
  | unknown[]
  | Record<string, unknown>
  | null
  | undefined;

/** Best-effort dirty-file count from the GitState.status JSON blob. */
function countDirty(status: DirtyShape): number {
  if (!status) return 0;
  if (Array.isArray(status)) return status.length;
  if (typeof status === "object") {
    let total = 0;
    for (const value of Object.values(status)) {
      if (Array.isArray(value)) total += value.length;
    }
    return total;
  }
  return 0;
}

export const GET = withRouteMetrics("/api/dashboard/summary", async (req: Request) => {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(req.url);
    const requestedProjectId = searchParams.get("projectId");

    // Workspaces the user is a member of.
    const memberships = await prisma.workspaceMember.findMany({
      where: { userId: user.id },
      select: { workspaceId: true },
    });
    const workspaceIds = memberships.map((m) => m.workspaceId);

    // No workspaces yet -> empty summary (new user / onboarding state).
    if (workspaceIds.length === 0) {
      return apiSuccess({
        focusProject: null,
        recentProjects: [],
        recentThreads: [],
        recentAgentRuns: [],
        git: null,
        counts: {
          workspaces: 0,
          projects: 0,
          threads: 0,
          agentRuns: 0,
          pendingChanges: 0,
        },
      });
    }

    // Recent projects across all the user's workspaces.
    const projects = await prisma.project.findMany({
      where: { workspaceId: { in: workspaceIds } },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        workspaceId: true,
        defaultBranch: true,
        updatedAt: true,
        createdAt: true,
      },
    });

    const projectCount = projects.length;

    // Resolve the focus project: the requested id (only if the user can access
    // it) or the most-recently-updated project.
    let focus = projects[0] ?? null;
    if (requestedProjectId) {
      const match = projects.find((p) => p.id === requestedProjectId);
      // Only honor the requested id if it is within the user's workspaces.
      // (If it isn't accessible we silently fall back to the newest project
      // rather than leaking existence via an error.)
      if (match) focus = match;
    }

    if (!focus) {
      return apiSuccess({
        focusProject: null,
        recentProjects: projects.map((p) => ({
          id: p.id,
          name: p.name,
          slug: p.slug,
          description: p.description,
          workspaceId: p.workspaceId,
          updatedAt: p.updatedAt.toISOString(),
        })),
        recentThreads: [],
        recentAgentRuns: [],
        git: null,
        counts: {
          workspaces: workspaceIds.length,
          projects: projectCount,
          threads: 0,
          agentRuns: 0,
          pendingChanges: 0,
        },
      });
    }

    const focusId = focus.id;

    const [
      recentThreads,
      recentAgentRuns,
      gitState,
      threadCount,
      agentRunCount,
      pendingChanges,
    ] = await Promise.all([
      prisma.chatThread.findMany({
        where: { projectId: focusId },
        orderBy: { updatedAt: "desc" },
        take: 5,
        select: { id: true, title: true, projectId: true, updatedAt: true },
      }),
      prisma.agentRun.findMany({
        where: { projectId: focusId },
        orderBy: { updatedAt: "desc" },
        take: 5,
        select: {
          id: true,
          goal: true,
          status: true,
          projectId: true,
          updatedAt: true,
        },
      }),
      prisma.gitState.findUnique({
        where: { projectId: focusId },
        select: { branch: true, status: true, lastCommitHash: true },
      }),
      prisma.chatThread.count({ where: { projectId: focusId } }),
      prisma.agentRun.count({ where: { projectId: focusId } }),
      prisma.changeSet.count({
        where: { projectId: focusId, status: "PENDING_REVIEW" },
      }),
    ]);

    return apiSuccess({
      focusProject: {
        id: focus.id,
        name: focus.name,
        slug: focus.slug,
        workspaceId: focus.workspaceId,
        defaultBranch: focus.defaultBranch,
      },
      recentProjects: projects.slice(0, 6).map((p) => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        description: p.description,
        workspaceId: p.workspaceId,
        updatedAt: p.updatedAt.toISOString(),
      })),
      recentThreads: recentThreads.map((t) => ({
        id: t.id,
        title: t.title,
        projectId: t.projectId,
        updatedAt: t.updatedAt.toISOString(),
      })),
      recentAgentRuns: recentAgentRuns.map((r) => ({
        id: r.id,
        goal: r.goal,
        status: r.status,
        projectId: r.projectId,
        updatedAt: r.updatedAt.toISOString(),
      })),
      git: gitState
        ? {
            branch: gitState.branch,
            dirtyCount: countDirty(gitState.status as DirtyShape),
            lastCommitHash: gitState.lastCommitHash,
          }
        : null,
      counts: {
        workspaces: workspaceIds.length,
        projects: projectCount,
        threads: threadCount,
        agentRuns: agentRunCount,
        pendingChanges,
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
});
