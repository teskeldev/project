import { prisma } from "@/lib/db";
import {
  apiSuccess,
  handleApiError,
  requireProjectAccess,
  validateBody,
  ApiError,
  NO_STORE_HEADERS,
} from "@/lib/api";
import { updateProjectSchema } from "@/lib/validators";
import { deletePath } from "@/lib/storage";

/**
 * In-memory log of orphan project directories whose disk cleanup failed.
 * A real deployment would push these to a queue (e.g. SQS, BullMQ) for
 * a background worker; for now we log them to a dedicated namespace so
 * operators can sweep them.
 */
const ORPHAN_CLEANUP_LOG = "[orphan-project-cleanup]";

type RouteContext = { params: Promise<{ projectId: string }> };

// GET /api/projects/:projectId -> project detail.
export async function GET(_req: Request, ctx: RouteContext) {
  try {
    const { projectId } = await ctx.params;
    const { project } = await requireProjectAccess(projectId);
    // Strip the on-disk storage key from the response. It's a server-side
    // concern and must never be exposed to the client: it would let any
    // project member predict/guess the workspace storage layout.
    const { storageKey: _, ...safeProject } = project!;
    return apiSuccess({ project: safeProject });
  } catch (err) {
    return handleApiError(err);
  }
}

// PATCH /api/projects/:projectId -> update name/description/defaultBranch.
export async function PATCH(req: Request, ctx: RouteContext) {
  try {
    const { projectId } = await ctx.params;
    await requireProjectAccess(projectId);
    const data = await validateBody(req, updateProjectSchema);

    const project = await prisma.project.update({
      where: { id: projectId },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.description !== undefined
          ? { description: data.description }
          : {}),
        ...(data.defaultBranch !== undefined
          ? { defaultBranch: data.defaultBranch }
          : {}),
      },
    });

    return apiSuccess({ project }, { headers: NO_STORE_HEADERS });
  } catch (err) {
    return handleApiError(err);
  }
}

// DELETE /api/projects/:projectId -> remove project (OWNER/ADMIN only).
export async function DELETE(_req: Request, ctx: RouteContext) {
  try {
    const { projectId } = await ctx.params;
    const { project, role } = await requireProjectAccess(projectId);

    if (role !== "OWNER" && role !== "ADMIN") {
      throw new ApiError(
        "Only workspace owners or admins can delete projects",
        403,
        "FORBIDDEN"
      );
    }

    // requireProjectAccess guarantees project is non-null here.
    const storageKey = project!.storageKey;
    const projectIdForLog = projectId;

    // Remove DB rows first (FileNode cascades via project relation). The
    // disk is the source of truth, so the disk cleanup is the second
    // step. To avoid orphaning the directory if disk cleanup throws, we
    // log the storage key to a dedicated orphan-cleanup channel that a
    // background process (or operator) can sweep.
    await prisma.project.delete({ where: { id: projectId } });

    // Best-effort disk cleanup; never fail the request on disk errors.
    // If it fails, record the orphan for a later sweep. We do a single
    // inline retry after a short delay to ride out transient FS hiccups
    // (e.g. EBUSY from a background process still holding the dir).
    let cleanupOk = false;
    try {
      await deletePath(storageKey, "");
      cleanupOk = true;
    } catch {
      // Retry once after a short backoff. A long-running sweep worker
      // would handle persistent failures, but a quick retry covers the
      // common "transient FS error" case without blocking the request.
      await new Promise((r) => setTimeout(r, 250));
      try {
        await deletePath(storageKey, "");
        cleanupOk = true;
      } catch (err2) {
        console.error(
          `${ORPHAN_CLEANUP_LOG} project=${projectIdForLog} storageKey=${storageKey} disk delete failed:`,
          err2 instanceof Error ? err2.message : err2
        );
      }
    }

    return apiSuccess({ deleted: true, diskCleanedUp: cleanupOk });
  } catch (err) {
    return handleApiError(err);
  }
}
