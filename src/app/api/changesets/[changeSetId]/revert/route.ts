import { prisma } from "@/lib/db";
import {
  apiSuccess,
  handleApiError,
  requireProjectAccess,
  ApiError,
} from "@/lib/api";
import {
  writeFile,
  deletePath,
  renamePath,
  normalizeRelPath,
  detectLanguage,
} from "@/lib/storage";
import type { FileChange, FileChangeType } from "@prisma/client";
import { enforceRateLimit } from "@/lib/rate-limit";

type RouteContext = { params: Promise<{ changeSetId: string }> };

/**
 * Revert a single file change to its pre-apply state.
 */
async function revertOne(
  projectId: string,
  storageKey: string,
  fc: FileChange
): Promise<void> {
  const filePath = normalizeRelPath(fc.filePath);

  switch (fc.changeType) {
    case "UPDATE": {
      // Restore oldContent to disk + DB
      const content = fc.oldContent ?? "";
      const { size } = await writeFile(storageKey, filePath, content);
      const PREVIEW_LIMIT = 64 * 1024;
      await prisma.fileNode.updateMany({
        where: { projectId, path: filePath },
        data: {
          size,
          content: size <= PREVIEW_LIMIT ? content : null,
        },
      });
      break;
    }

    case "CREATE": {
      // Delete the created file
      await deletePath(storageKey, filePath);
      await prisma.fileNode.deleteMany({
        where: {
          projectId,
          OR: [{ path: filePath }, { path: { startsWith: `${filePath}/` } }],
        },
      });
      break;
    }

    case "DELETE": {
      // Restore the file from oldContent
      const content = fc.oldContent ?? "";
      const { size } = await writeFile(storageKey, filePath, content);
      const PREVIEW_LIMIT = 64 * 1024;
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
          parentId: null,
          type: "FILE",
          name,
          path: filePath,
          language: detectLanguage(name),
          size,
          content: size <= PREVIEW_LIMIT ? content : null,
        },
      });
      break;
    }

    case "RENAME": {
      // Rename back to oldPath
      const oldPath = normalizeRelPath(fc.oldPath ?? "");
      if (!oldPath) {
        throw new ApiError(
          "RENAME change is missing its original path",
          400,
          "MISSING_OLD_PATH"
        );
      }

      // Rename the file back: current filePath -> oldPath
      await renamePath(storageKey, filePath, oldPath);

      // If there was content change, restore oldContent
      if (fc.oldContent !== null && fc.oldContent !== undefined) {
        await writeFile(storageKey, oldPath, fc.oldContent);
      }

      // Update DB node
      const node = await prisma.fileNode.findUnique({
        where: { projectId_path: { projectId, path: filePath } },
        select: { id: true, type: true },
      });
      if (node) {
        const oldName = oldPath.includes("/")
          ? oldPath.slice(oldPath.lastIndexOf("/") + 1)
          : oldPath;
        await prisma.fileNode.update({
          where: { id: node.id },
          data: {
            name: oldName,
            path: oldPath,
            ...(node.type === "FILE" ? { language: detectLanguage(oldName) } : {}),
          },
        });
      }
      break;
    }
  }
}

/**
 * POST /api/changesets/:changeSetId/revert
 *
 * Reverts an APPLIED changeset by undoing each file change.
 * Updates changeset status to REVERTED.
 */
export async function POST(req: Request, ctx: RouteContext) {
  try {
    const { changeSetId } = await ctx.params;

    const changeSet = await prisma.changeSet.findUnique({
      where: { id: changeSetId },
      include: { fileChanges: true },
    });
    if (!changeSet) {
      throw new ApiError("Changeset not found", 404, "NOT_FOUND");
    }

    const { user, project } = await requireProjectAccess(changeSet.projectId);
    const storageKey = project!.storageKey;

    await enforceRateLimit(`changesets:revert:${user.id}`, 10, 60_000);

    if (changeSet.status !== "APPLIED") {
      throw new ApiError(
        "Only APPLIED changesets can be reverted",
        409,
        "INVALID_STATUS"
      );
    }

    // Revert each file change that was ACCEPTED (applied)
    const acceptedChanges = changeSet.fileChanges.filter(
      (fc) => fc.status === "ACCEPTED"
    );

    const reverted: { fileChangeId: string; filePath: string; changeType: FileChangeType }[] = [];
    const failures: { fileChangeId: string; filePath: string; error: string }[] = [];

    for (const fc of acceptedChanges) {
      try {
        await revertOne(changeSet.projectId, storageKey, fc);
        reverted.push({
          fileChangeId: fc.id,
          filePath: fc.filePath,
          changeType: fc.changeType,
        });
      } catch (err) {
        failures.push({
          fileChangeId: fc.id,
          filePath: fc.filePath,
          error: err instanceof Error ? err.message : "Revert failed",
        });
      }
    }

    // Update changeset status to REVERTED inside a transaction with a
    // re-read-after, so a concurrent revert can't double-flip and a
    // concurrent apply can't move the changeset out of APPLIED under us.
    // The status flip happens AFTER all disk reverts, so a partial-failure
    // on disk leaves the changeset in APPLIED state (the caller can retry
    // or inspect `failures`).
    if (failures.length > 0) {
      // Partial failure: do NOT flip to REVERTED; surface failures to the
      // caller and let them decide whether to retry.
      return apiSuccess({
        reverted: false,
        partial: true,
        revertedFiles: reverted,
        failures,
      });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const fresh = await tx.changeSet.findUnique({
        where: { id: changeSetId },
        select: { status: true },
      });
      if (!fresh) {
        throw new ApiError("Changeset not found", 404, "NOT_FOUND");
      }
      if (fresh.status !== "APPLIED") {
        throw new ApiError(
          "Only APPLIED changesets can be reverted",
          409,
          "INVALID_STATUS"
        );
      }
      return tx.changeSet.update({
        where: { id: changeSetId },
        data: { status: "REVERTED" },
      });
    });

    return apiSuccess({ reverted: true, revertedFiles: reverted, failures, changeSet: updated });
  } catch (err) {
    return handleApiError(err);
  }
}
