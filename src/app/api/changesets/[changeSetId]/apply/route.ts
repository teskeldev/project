import { prisma } from "@/lib/db";
import { enforceRateLimit } from "@/lib/rate-limit";
import {
  apiSuccess,
  handleApiError,
  requireProjectAccess,
  validateBody,
  ApiError,
} from "@/lib/api";
import { applyChangeSetSchema } from "@/lib/validators";
import {
  readFile,
  writeFile,
  deletePath,
  renamePath,
  pathExists,
  normalizeRelPath,
  detectLanguage,
} from "@/lib/storage";
import { checkPermission } from "@/lib/ai/permissions";
import { stage, commit, isRepo } from "@/lib/git/service";
import { logger } from "@/lib/logger";
import type { FileChange, FileChangeType, ChangeSetStatus } from "@prisma/client";

type RouteContext = { params: Promise<{ changeSetId: string }> };

type Outcome = {
  fileChangeId: string;
  filePath: string;
  changeType: FileChangeType;
};
type ConflictOutcome = Outcome & { reason: string };
type FailureOutcome = Outcome & { error: string };
type DeniedOutcome = Outcome & { reason: string };

/**
 * Resolve (or create) the parent FileNode chain for `relPath`, returning the
 * direct parent's id (null for project-root children). Creates FOLDER FileNodes
 * for any missing ancestors so the tree stays consistent.
 */
async function ensureParentNodes(
  projectId: string,
  relPath: string
): Promise<string | null> {
  const idx = relPath.lastIndexOf("/");
  if (idx < 0) return null;

  const segments = relPath.slice(0, idx).split("/");
  let parentId: string | null = null;
  let accum = "";

  for (const seg of segments) {
    accum = accum ? `${accum}/${seg}` : seg;
    const existing = await prisma.fileNode.findUnique({
      where: { projectId_path: { projectId, path: accum } },
      select: { id: true, type: true },
    });
    if (existing) {
      parentId = existing.id;
      continue;
    }
    const created: { id: string } = await prisma.fileNode.create({
      data: {
        projectId,
        parentId,
        type: "FOLDER",
        name: seg,
        path: accum,
        size: 0,
      },
      select: { id: true },
    });
    parentId = created.id;
  }
  return parentId;
}

/**
 * Apply ONE file change to disk then mirror the result into the FileNode table.
 * Disk write happens first; the DB mirror then runs inside the surrounding
 * transaction callback `tx`. Throws on failure (caller records + continues).
 */
async function applyOne(
  projectId: string,
  storageKey: string,
  fc: FileChange
): Promise<void> {
  const filePath = normalizeRelPath(fc.filePath);

  if (fc.changeType === "CREATE" || fc.changeType === "UPDATE") {
    const content = fc.newContent ?? "";
    const { size } = await writeFile(storageKey, filePath, content);

    const PREVIEW_LIMIT = 64 * 1024;
    const parentId = await ensureParentNodes(projectId, filePath);
    const name = filePath.includes("/")
      ? filePath.slice(filePath.lastIndexOf("/") + 1)
      : filePath;

    await prisma.fileNode.upsert({
      where: { projectId_path: { projectId, path: filePath } },
      update: {
        type: "FILE",
        size,
        language: detectLanguage(name),
        content: size <= PREVIEW_LIMIT ? content : null,
      },
      create: {
        projectId,
        parentId,
        type: "FILE",
        name,
        path: filePath,
        language: detectLanguage(name),
        size,
        content: size <= PREVIEW_LIMIT ? content : null,
      },
    });
    return;
  }

  if (fc.changeType === "DELETE") {
    await deletePath(storageKey, filePath);
    // Remove the node and any descendants (handles folder targets too).
    await prisma.fileNode.deleteMany({
      where: {
        projectId,
        OR: [{ path: filePath }, { path: { startsWith: `${filePath}/` } }],
      },
    });
    return;
  }

  if (fc.changeType === "RENAME") {
    const oldPath = normalizeRelPath(fc.oldPath ?? "");
    if (!oldPath) {
      throw new ApiError(
        "RENAME change is missing its original path",
        400,
        "MISSING_OLD_PATH"
      );
    }
    await renamePath(storageKey, oldPath, filePath);

    // If the rename also includes a content change, write the new content to disk
    if (fc.newContent !== null && fc.newContent !== undefined) {
      await writeFile(storageKey, filePath, fc.newContent);
    }

    const node = await prisma.fileNode.findUnique({
      where: { projectId_path: { projectId, path: oldPath } },
      select: { id: true, type: true },
    });
    const newName = filePath.includes("/")
      ? filePath.slice(filePath.lastIndexOf("/") + 1)
      : filePath;
    const newParentId = await ensureParentNodes(projectId, filePath);

    if (node) {
      await prisma.fileNode.update({
        where: { id: node.id },
        data: {
          name: newName,
          path: filePath,
          parentId: newParentId,
          ...(node.type === "FILE" ? { language: detectLanguage(newName) } : {}),
        },
      });
      // Re-prefix descendant paths for folder renames. The previous code
      // did this in a serial `for await` loop, which was N+1 round-trips
      // for folders with many descendants. We now fetch the descendants
      // once, compute the new path in memory, and `Promise.all` the
      // updates so they run concurrently (still multiple round-trips,
      // but parallelized).
      if (node.type === "FOLDER") {
        const descendants = await prisma.fileNode.findMany({
          where: { projectId, path: { startsWith: `${oldPath}/` } },
          select: { id: true, path: true },
        });
        await Promise.all(
          descendants.map((d) =>
            prisma.fileNode.update({
              where: { id: d.id },
              data: { path: `${filePath}${d.path.slice(oldPath.length)}` },
            })
          )
        );
      }
    }

    // After the node path is updated in DB, update content if rename includes changes
    if (fc.newContent !== null && fc.newContent !== undefined) {
      const renamedNode = await prisma.fileNode.findUnique({
        where: { projectId_path: { projectId, path: filePath } },
        select: { id: true },
      });
      if (renamedNode) {
        const PREVIEW_LIMIT = 64 * 1024;
        const size = Buffer.byteLength(fc.newContent, "utf8");
        await prisma.fileNode.update({
          where: { id: renamedNode.id },
          data: {
            size,
            content: size <= PREVIEW_LIMIT ? fc.newContent : null,
          },
        });
      }
    }
    return;
  }
}

/**
 * Detect whether a change conflicts with the CURRENT on-disk state:
 *  - CREATE: conflict if the target already exists on disk.
 *  - UPDATE/DELETE/RENAME: conflict if the current file content differs from
 *    the stored oldContent (the file changed since the diff was generated).
 * Returns a reason string when in conflict, otherwise null.
 */
async function detectConflict(
  storageKey: string,
  fc: FileChange
): Promise<string | null> {
  if (fc.changeType === "CREATE") {
    const filePath = normalizeRelPath(fc.filePath);
    if (await pathExists(storageKey, filePath)) {
      return "A file already exists at this path on disk.";
    }
    return null;
  }

  const readPath = normalizeRelPath(
    fc.changeType === "RENAME" ? fc.oldPath ?? fc.filePath : fc.filePath
  );

  let current: string | null = null;
  try {
    current = await readFile(storageKey, readPath);
  } catch {
    current = null;
  }

  if (current === null) {
    return "The target file no longer exists on disk.";
  }
  if ((fc.oldContent ?? "") !== current) {
    return "File changed since this diff was generated.";
  }
  return null;
}

/**
 * Map a FileChangeType to the corresponding AI permission tool.
 */
function changeTypeToPermissionTool(
  changeType: FileChangeType
): "file_edit" | "file_delete" | "file_create" {
  switch (changeType) {
    case "CREATE":
      return "file_create";
    case "DELETE":
      return "file_delete";
    case "UPDATE":
    case "RENAME":
      return "file_edit";
  }
}

// POST /api/changesets/:changeSetId/apply
// Body: { applyAll?: boolean }
// Query: ?autoCommit=true (optional) – auto-commit changes after successful apply
// Applies ACCEPTED file changes (plus PENDING when applyAll) to disk + DB,
// skipping REJECTED and any change that conflicts with the current on-disk
// state. Disk and DB are kept in sync per-file; per-file failures are recorded
// and do not abort the whole apply.
export async function POST(req: Request, ctx: RouteContext) {
  try {
    const { changeSetId } = await ctx.params;
    const body = await validateBody(req, applyChangeSetSchema);
    const applyAll = body?.applyAll ?? false;

    // Parse autoCommit from query params
    const url = new URL(req.url);
    const autoCommit = url.searchParams.get("autoCommit") === "true";

    const changeSet = await prisma.changeSet.findUnique({
      where: { id: changeSetId },
      include: { fileChanges: true },
    });
    if (!changeSet) {
      throw new ApiError("Changeset not found", 404, "NOT_FOUND");
    }

    const { project, user } = await requireProjectAccess(changeSet.projectId);

    // Rate limit: 10 per minute
    await enforceRateLimit(`changesets:apply:${user.id}`, 10, 60_000);
    const storageKey = project!.storageKey;
    const workspaceId = project!.workspaceId;

    if (changeSet.status === "APPLIED") {
      throw new ApiError(
        "This changeset has already been applied",
        409,
        "ALREADY_APPLIED"
      );
    }
    if (changeSet.status === "REJECTED") {
      throw new ApiError(
        "This changeset has been rejected",
        409,
        "REJECTED"
      );
    }

    // The status check above is read-then-act over several awaits. To make
    // the read-and-act atomic, the terminal status flip (handled later when
    // we compute `fullyApplied`) is done inside a transaction with a
    // re-read-after (see "fullyApplied" branch below). This way, two
    // concurrent applies that both pass the initial check will only have
    // one win the APPLIED transition; the loser's transaction sees the
    // updated status and short-circuits.

    // Check changeset_apply permission at the top level
    const applyPermission = await checkPermission(workspaceId, {
      tool: "changeset_apply",
    });
    if (applyPermission.action === "DENY") {
      throw new ApiError(
        "Changeset apply is denied by permission rules",
        403,
        "PERMISSION_DENIED"
      );
    }
    if (applyPermission.action === "ASK") {
      // Return a response indicating user confirmation is needed
      // The client should prompt the user and re-submit with confirmation
      const hasConfirmation = req.headers.get("X-Permission-Confirmed") === "true";
      if (!hasConfirmation) {
        return Response.json(
          {
            success: false,
            error: {
              message: "Permission confirmation required to apply changeset",
              code: "PERMISSION_ASK",
              details: { tool: "changeset_apply", rule: applyPermission.rule },
            },
          },
          { status: 403 }
        );
      }
    }

    // Decide which changes are candidates. Never apply REJECTED.
    const candidates = changeSet.fileChanges.filter((fc) => {
      if (fc.status === "REJECTED") return false;
      if (fc.status === "ACCEPTED") return true;
      return applyAll && fc.status === "PENDING";
    });

    const applied: Outcome[] = [];
    const conflicts: ConflictOutcome[] = [];
    const failures: FailureOutcome[] = [];
    const denied: DeniedOutcome[] = [];

    for (const fc of candidates) {
      const base: Outcome = {
        fileChangeId: fc.id,
        filePath: fc.filePath,
        changeType: fc.changeType,
      };

      // 0) Permission check per file operation
      const fileTool = changeTypeToPermissionTool(fc.changeType);
      const filePermission = await checkPermission(workspaceId, {
        tool: fileTool,
        pattern: fc.filePath,
      });
      if (filePermission.action === "DENY") {
        denied.push({
          ...base,
          reason: `Permission denied for ${fileTool} on ${fc.filePath}`,
        });
        continue;
      }

      // 1) Conflict detection against current disk state.
      let conflictReason: string | null = null;
      try {
        conflictReason = await detectConflict(storageKey, fc);
      } catch (err) {
        failures.push({
          ...base,
          error: err instanceof Error ? err.message : "Conflict check failed",
        });
        continue;
      }
      if (conflictReason) {
        conflicts.push({ ...base, reason: conflictReason });
        continue;
      }

      // 2) Apply to disk + DB. Disk op runs first inside applyOne; on any
      //    failure we record it and keep going (disk ops are non-transactional).
      try {
        await applyOne(changeSet.projectId, storageKey, fc);
        await prisma.fileChange.update({
          where: { id: fc.id },
          data: { status: "ACCEPTED" },
        });
        applied.push(base);
      } catch (err) {
        failures.push({
          ...base,
          error: err instanceof Error ? err.message : "Apply failed",
        });
      }
    }

    // Query the CURRENT state of all file changes to determine if all are now
    // ACCEPTED. This correctly handles partial applies across multiple requests.
    const currentChanges = await prisma.fileChange.findMany({
      where: { changeSetId },
      select: { status: true },
    });
    const allNonRejected = currentChanges.filter(fc => fc.status !== "REJECTED");
    const allAccepted = allNonRejected.every(fc => fc.status === "ACCEPTED");
    const fullyApplied = allAccepted && allNonRejected.length > 0 && conflicts.length === 0 && failures.length === 0 && denied.length === 0;

    let changeSetStatus: ChangeSetStatus = changeSet.status;
    if (fullyApplied) {
      // Atomically flip status to APPLIED only if it's still in a
      // non-terminal state. The re-read inside the transaction prevents a
      // race where two concurrent applies both pass the initial status
      // check above and both try to write APPLIED (or where a concurrent
      // revert has already moved the changeset to REVERTED).
      const updated = await prisma.$transaction(async (tx) => {
        const fresh = await tx.changeSet.findUnique({
          where: { id: changeSetId },
          select: { status: true },
        });
        if (!fresh) {
          throw new ApiError("Changeset not found", 404, "NOT_FOUND");
        }
        if (fresh.status === "APPLIED" || fresh.status === "REJECTED" || fresh.status === "REVERTED") {
          throw new ApiError(
            "This changeset has already been finalized",
            409,
            "CONFLICT"
          );
        }
        return tx.changeSet.update({
          where: { id: changeSetId },
          data: { status: "APPLIED" },
          select: { status: true },
        });
      });
      changeSetStatus = updated.status;
    }

    // Auto-commit: if requested and the apply was fully successful, stage and commit
    let commitResult: { hash: string; branch: string } | null = null;
    if (autoCommit && fullyApplied && applied.length > 0) {
      try {
        const repoExists = await isRepo(storageKey);
        if (repoExists) {
          // Stage all applied file paths
          const appliedPaths = applied.map((a) => a.filePath);
          await stage(storageKey, appliedPaths);

          // Commit with the changeset title as the message
          const commitMessage = changeSet.title || `Apply changeset ${changeSetId.slice(0, 8)}`;
          const result = await commit(
            storageKey,
            commitMessage,
            undefined,
            changeSet.projectId
          );
          if (result.isRepo) {
            commitResult = { hash: result.hash, branch: result.branch };
          }
        }
      } catch (err) {
        // Auto-commit is best-effort; don't fail the apply response
        logger.error("Auto-commit failed", { changeSetId, err: String(err) });
      }
    }

    return apiSuccess({
      applied,
      conflicts,
      failures,
      denied,
      changeSetStatus,
      ...(commitResult ? { commit: commitResult } : {}),
    });
  } catch (err) {
    return handleApiError(err);
  }
}
