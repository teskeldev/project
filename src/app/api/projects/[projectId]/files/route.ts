import { prisma } from "@/lib/db";
import {
  apiSuccess,
  handleApiError,
  requireProjectAccess,
  validateBody,
  ApiError,
} from "@/lib/api";
import {
  createFileNodeSchema,
  saveFileSchema,
  deleteNodeSchema,
} from "@/lib/validators";
import {
  resolveSafe,
  normalizeRelPath,
  readFile,
  writeFile,
  createDir,
  deletePath,
  pathExists,
  detectLanguage,
  assertValidName,
  joinRelPath,
} from "@/lib/storage";
import type { FileType } from "@prisma/client";

type RouteContext = { params: Promise<{ projectId: string }> };

// POST -> create a file or folder.
export async function POST(req: Request, ctx: RouteContext) {
  try {
    const { projectId } = await ctx.params;
    const { project, member } = await requireProjectAccess(projectId);

    // Role check: viewers cannot create files/folders
    if (member.role === "VIEWER") {
      throw new ApiError("Insufficient permissions", 403, "FORBIDDEN");
    }

    const storageKey = project!.storageKey;

    const body = await validateBody(req, createFileNodeSchema);
    const name = assertValidName(body.name);
    const type = body.type as FileType;

    // Compute the full project-relative path.
    let fullPath: string;
    if (body.path) {
      // Explicit full path provided; the trailing segment must match name? Be
      // pragmatic: trust `path` as the target and ignore name for path-building
      // but still validate the basename.
      fullPath = normalizeRelPath(body.path);
    } else {
      fullPath = joinRelPath(body.parentPath ?? "", name);
    }

    if (!fullPath) {
      throw new ApiError("Invalid target path", 400, "INVALID_PATH");
    }

    // Security checkpoint.
    resolveSafe(storageKey, fullPath);

    // Conflict if already exists (DB or disk).
    const existing = await prisma.fileNode.findUnique({
      where: { projectId_path: { projectId, path: fullPath } },
      select: { id: true },
    });
    if (existing || (await pathExists(storageKey, fullPath))) {
      throw new ApiError("A file or folder already exists at this path", 409, "ALREADY_EXISTS");
    }

    // Resolve/create the parent FileNode chain.
    const idx = fullPath.lastIndexOf("/");
    const parentPath = idx >= 0 ? fullPath.slice(0, idx) : "";
    const baseName = idx >= 0 ? fullPath.slice(idx + 1) : fullPath;

    let parentId: string | null = null;
    if (parentPath) {
      const parent = await prisma.fileNode.findUnique({
        where: { projectId_path: { projectId, path: parentPath } },
        select: { id: true, type: true },
      });
      if (!parent || parent.type !== "FOLDER") {
        throw new ApiError("Parent folder does not exist", 400, "INVALID_PARENT");
      }
      parentId = parent.id;
    }

    const content = body.content ?? "";

    // Disk first (source of truth), then DB. The DB create is wrapped in a
    // transaction with a re-check for an existing row at the same path; if
    // a concurrent create inserted a row between our pre-check and now,
    // we'll either surface a unique-violation OR (with the re-check) just
    // see the row and roll back the disk write. This closes the
    // check-then-insert race on the (projectId, path) unique index.
    if (type === "FOLDER") {
      await createDir(storageKey, fullPath);
    } else {
      await writeFile(storageKey, fullPath, content);
    }

    let node;
    try {
      node = await prisma.$transaction(async (tx) => {
        // Re-check inside the transaction: a concurrent POST may have
        // created a row at the same path while we were writing to disk.
        const concurrent = await tx.fileNode.findUnique({
          where: { projectId_path: { projectId, path: fullPath } },
          select: { id: true },
        });
        if (concurrent) {
          throw new ApiError(
            "A file or folder already exists at this path",
            409,
            "ALREADY_EXISTS"
          );
        }
        return tx.fileNode.create({
          data: {
            projectId,
            parentId,
            type,
            name: baseName,
            path: fullPath,
            language: type === "FILE" ? detectLanguage(baseName) : null,
            content: type === "FILE" ? content : null,
            size: type === "FILE" ? Buffer.byteLength(content, "utf8") : 0,
          },
        });
      });
    } catch (err) {
      // Compensate: roll back the disk write on DB failure.
      try {
        await deletePath(storageKey, fullPath);
      } catch {
        /* best effort */
      }
      throw err;
    }

    return apiSuccess({ node }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}

// PATCH -> save file content (editor Save).
export async function PATCH(req: Request, ctx: RouteContext) {
  try {
    const { projectId } = await ctx.params;
    const { project, member } = await requireProjectAccess(projectId);

    // Role check: viewers cannot modify files
    if (member.role === "VIEWER") {
      throw new ApiError("Insufficient permissions", 403, "FORBIDDEN");
    }

    const storageKey = project!.storageKey;

    const body = await validateBody(req, saveFileSchema);
    const relPath = normalizeRelPath(body.path);
    if (!relPath) {
      throw new ApiError("Invalid path", 400, "INVALID_PATH");
    }

    const node = await prisma.fileNode.findUnique({
      where: { projectId_path: { projectId, path: relPath } },
      select: { id: true, type: true },
    });
    if (!node || node.type !== "FILE") {
      throw new ApiError("File not found", 404, "NOT_FOUND");
    }

    // Read old content for potential rollback
    let oldContent: string | undefined;
    let fileExistedBefore = false;
    try {
      oldContent = await readFile(storageKey, relPath);
      fileExistedBefore = true;
    } catch {
      // File might not exist on disk yet (edge case)
    }

    const { size } = await writeFile(storageKey, relPath, body.content);

    // NOTE: disk writes are the source of truth. The DB FileNode is just a
    // cache / preview of what's on disk. We write to disk first and only
    // then update the DB. The DB update is wrapped in a transaction with a
    // re-read-after to make the size + content update atomic w.r.t. other
    // concurrent DB writers (e.g. another PATCH racing on the same node).
    // The disk write above is non-transactional by definition.
    try {
      const PREVIEW_LIMIT = 64 * 1024;
      await prisma.$transaction(async (tx) => {
        // Re-read inside the transaction to get a fresh row state and avoid
        // overwriting a concurrent update that landed between the original
        // read and now.
        const fresh = await tx.fileNode.findUnique({
          where: { id: node.id },
          select: { id: true },
        });
        if (!fresh) {
          throw new ApiError("File not found", 404, "NOT_FOUND");
        }
        await tx.fileNode.update({
          where: { id: fresh.id },
          data: {
            size,
            content: size <= PREVIEW_LIMIT ? body.content : null,
          },
        });
      });
    } catch (dbErr) {
      // Compensate: restore disk state on DB failure
      if (fileExistedBefore && oldContent !== undefined) {
        try { await writeFile(storageKey, relPath, oldContent); } catch { /* best effort */ }
      } else if (!fileExistedBefore) {
        try { await deletePath(storageKey, relPath); } catch { /* best effort */ }
      }
      throw dbErr;
    }

    return apiSuccess({ path: relPath, size });
  } catch (err) {
    return handleApiError(err);
  }
}

// DELETE -> remove a file/folder (and descendants). Path via body or ?path=.
export async function DELETE(req: Request, ctx: RouteContext) {
  try {
    const { projectId } = await ctx.params;
    const { project, member } = await requireProjectAccess(projectId);

    // Role check: viewers cannot delete files/folders
    if (member.role === "VIEWER") {
      throw new ApiError("Insufficient permissions", 403, "FORBIDDEN");
    }

    const storageKey = project!.storageKey;

    // Accept path from query string or JSON body.
    const url = new URL(req.url);
    let rawPath = url.searchParams.get("path") ?? undefined;
    if (!rawPath) {
      try {
        const body = await validateBody(req, deleteNodeSchema);
        rawPath = body.path;
      } catch {
        throw new ApiError("path is required", 400, "BAD_REQUEST");
      }
    }

    const relPath = normalizeRelPath(rawPath);
    if (!relPath) {
      throw new ApiError("Cannot delete project root", 400, "INVALID_PATH");
    }

    // Security checkpoint (also inside deletePath).
    resolveSafe(storageKey, relPath);

    // Remove from disk first (recursive, idempotent). Disk is the source
    // of truth; the DB FileNode rows are an index/cache.
    await deletePath(storageKey, relPath);

    // Remove the node and all descendants inside a transaction with a
    // re-read-after, so a concurrent re-create of the same path during the
    // delete can't be clobbered silently.
    await prisma.$transaction(async (tx) => {
      const existing = await tx.fileNode.findFirst({
        where: {
          projectId,
          OR: [{ path: relPath }, { path: { startsWith: `${relPath}/` } }],
        },
        select: { id: true },
      });
      if (!existing) {
        // Nothing to delete in DB; the disk op already succeeded.
        return;
      }
      await tx.fileNode.deleteMany({
        where: {
          projectId,
          OR: [{ path: relPath }, { path: { startsWith: `${relPath}/` } }],
        },
      });
    });

    return apiSuccess({ deleted: true, path: relPath });
  } catch (err) {
    return handleApiError(err);
  }
}
