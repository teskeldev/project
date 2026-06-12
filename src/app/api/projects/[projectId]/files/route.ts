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
    const { project } = await requireProjectAccess(projectId);
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

    if (type === "FOLDER") {
      await createDir(storageKey, fullPath);
    } else {
      await writeFile(storageKey, fullPath, content);
    }

    const node = await prisma.fileNode.create({
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

    return apiSuccess({ node }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}

// PATCH -> save file content (editor Save).
export async function PATCH(req: Request, ctx: RouteContext) {
  try {
    const { projectId } = await ctx.params;
    const { project } = await requireProjectAccess(projectId);
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

    try {
      const PREVIEW_LIMIT = 64 * 1024;
      await prisma.fileNode.update({
        where: { id: node.id },
        data: {
          size,
          content: size <= PREVIEW_LIMIT ? body.content : null,
        },
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
    const { project } = await requireProjectAccess(projectId);
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

    // Remove from disk (recursive, idempotent).
    await deletePath(storageKey, relPath);

    // Remove the node and all descendants (path == p OR startsWith p + "/").
    await prisma.fileNode.deleteMany({
      where: {
        projectId,
        OR: [{ path: relPath }, { path: { startsWith: `${relPath}/` } }],
      },
    });

    return apiSuccess({ deleted: true, path: relPath });
  } catch (err) {
    return handleApiError(err);
  }
}
