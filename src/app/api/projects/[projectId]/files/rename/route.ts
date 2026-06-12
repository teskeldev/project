import { prisma } from "@/lib/db";
import {
  apiSuccess,
  handleApiError,
  requireProjectAccess,
  validateBody,
  ApiError,
} from "@/lib/api";
import { renameNodeSchema } from "@/lib/validators";
import {
  resolveSafe,
  normalizeRelPath,
  renamePath,
  pathExists,
  detectLanguage,
  assertValidName,
} from "@/lib/storage";

type RouteContext = { params: Promise<{ projectId: string }> };

// POST /api/projects/:projectId/files/rename
// body: {oldPath,newPath} OR {path,newName}
export async function POST(req: Request, ctx: RouteContext) {
  try {
    const { projectId } = await ctx.params;
    const { project } = await requireProjectAccess(projectId);
    const storageKey = project!.storageKey;

    const body = await validateBody(req, renameNodeSchema);

    // Resolve old and new project-relative paths.
    const oldPath = normalizeRelPath(body.oldPath ?? body.path ?? "");
    if (!oldPath) {
      throw new ApiError("Source path is required", 400, "INVALID_PATH");
    }

    let newPath: string;
    if (body.newPath) {
      newPath = normalizeRelPath(body.newPath);
    } else {
      // {path,newName}: keep the same parent, swap the basename.
      const newName = assertValidName(body.newName!);
      const idx = oldPath.lastIndexOf("/");
      const parent = idx >= 0 ? oldPath.slice(0, idx) : "";
      newPath = parent ? `${parent}/${newName}` : newName;
    }

    if (!newPath) {
      throw new ApiError("Target path is required", 400, "INVALID_PATH");
    }
    if (newPath === oldPath) {
      throw new ApiError("Source and target are identical", 400, "NO_CHANGE");
    }

    // Security checkpoints for both ends.
    resolveSafe(storageKey, oldPath);
    resolveSafe(storageKey, newPath);

    const node = await prisma.fileNode.findUnique({
      where: { projectId_path: { projectId, path: oldPath } },
    });
    if (!node) {
      throw new ApiError("Source not found", 404, "NOT_FOUND");
    }

    const targetExists = await prisma.fileNode.findUnique({
      where: { projectId_path: { projectId, path: newPath } },
      select: { id: true },
    });
    if (targetExists || (await pathExists(storageKey, newPath))) {
      throw new ApiError("Target already exists", 409, "ALREADY_EXISTS");
    }

    // Move on disk first.
    await renamePath(storageKey, oldPath, newPath);

    const newIdx = newPath.lastIndexOf("/");
    const newName = newIdx >= 0 ? newPath.slice(newIdx + 1) : newPath;
    const newParentPath = newIdx >= 0 ? newPath.slice(0, newIdx) : "";

    // Resolve new parentId (folders are guaranteed to pre-exist for a simple
    // rename within the same parent; for moves the parent must already exist).
    let newParentId: string | null = null;
    if (newParentPath) {
      const parent = await prisma.fileNode.findUnique({
        where: { projectId_path: { projectId, path: newParentPath } },
        select: { id: true, type: true },
      });
      if (!parent || parent.type !== "FOLDER") {
        // Roll back the disk move to keep state consistent.
        await renamePath(storageKey, newPath, oldPath);
        throw new ApiError("Target parent folder does not exist", 400, "INVALID_PARENT");
      }
      newParentId = parent.id;
    }

    const updated = await prisma.$transaction(async (tx) => {
      // Update the node itself.
      const self = await tx.fileNode.update({
        where: { id: node.id },
        data: {
          name: newName,
          path: newPath,
          parentId: newParentId,
          ...(node.type === "FILE"
            ? { language: detectLanguage(newName) }
            : {}),
        },
      });

      // Rewrite descendant paths (prefix swap) for folder renames/moves.
      if (node.type === "FOLDER") {
        const descendants = await tx.fileNode.findMany({
          where: { projectId, path: { startsWith: `${oldPath}/` } },
          select: { id: true, path: true },
        });
        for (const d of descendants) {
          const suffix = d.path.slice(oldPath.length); // includes leading "/"
           
          await tx.fileNode.update({
            where: { id: d.id },
            data: { path: `${newPath}${suffix}` },
          });
        }
      }

      return self;
    });

    return apiSuccess({ node: updated });
  } catch (err) {
    return handleApiError(err);
  }
}
