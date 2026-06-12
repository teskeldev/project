import { prisma } from "@/lib/db";
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
import type { FileChange, FileChangeType, ChangeSetStatus } from "@prisma/client";

type RouteContext = { params: Promise<{ changeSetId: string }> };

type Outcome = {
  fileChangeId: string;
  filePath: string;
  changeType: FileChangeType;
};
type ConflictOutcome = Outcome & { reason: string };
type FailureOutcome = Outcome & { error: string };

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
      // Re-prefix descendant paths for folder renames.
      if (node.type === "FOLDER") {
        const descendants = await prisma.fileNode.findMany({
          where: { projectId, path: { startsWith: `${oldPath}/` } },
          select: { id: true, path: true },
        });
        for (const d of descendants) {
          const suffix = d.path.slice(oldPath.length);
          await prisma.fileNode.update({
            where: { id: d.id },
            data: { path: `${filePath}${suffix}` },
          });
        }
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

// POST /api/changesets/:changeSetId/apply
// Body: { applyAll?: boolean }
// Applies ACCEPTED file changes (plus PENDING when applyAll) to disk + DB,
// skipping REJECTED and any change that conflicts with the current on-disk
// state. Disk and DB are kept in sync per-file; per-file failures are recorded
// and do not abort the whole apply.
export async function POST(req: Request, ctx: RouteContext) {
  try {
    const { changeSetId } = await ctx.params;
    const body = await validateBody(req, applyChangeSetSchema);
    const applyAll = body?.applyAll ?? false;

    const changeSet = await prisma.changeSet.findUnique({
      where: { id: changeSetId },
      include: { fileChanges: true },
    });
    if (!changeSet) {
      throw new ApiError("Changeset not found", 404, "NOT_FOUND");
    }

    const { project } = await requireProjectAccess(changeSet.projectId);
    const storageKey = project!.storageKey;

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

    // Decide which changes are candidates. Never apply REJECTED.
    const candidates = changeSet.fileChanges.filter((fc) => {
      if (fc.status === "REJECTED") return false;
      if (fc.status === "ACCEPTED") return true;
      return applyAll && fc.status === "PENDING";
    });

    const applied: Outcome[] = [];
    const conflicts: ConflictOutcome[] = [];
    const failures: FailureOutcome[] = [];

    for (const fc of candidates) {
      const base: Outcome = {
        fileChangeId: fc.id,
        filePath: fc.filePath,
        changeType: fc.changeType,
      };

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
    const fullyApplied = allAccepted && allNonRejected.length > 0 && conflicts.length === 0 && failures.length === 0;

    let changeSetStatus: ChangeSetStatus = changeSet.status;
    if (fullyApplied) {
      const updated = await prisma.changeSet.update({
        where: { id: changeSetId },
        data: { status: "APPLIED" },
        select: { status: true },
      });
      changeSetStatus = updated.status;
    }

    return apiSuccess({
      applied,
      conflicts,
      failures,
      changeSetStatus,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
