import { prisma } from "@/lib/db";
import { apiSuccess, handleApiError, requireProjectAccess, ApiError } from "@/lib/api";
import { readFile, detectLanguage } from "@/lib/storage";

type RouteContext = { params: Promise<{ projectId: string }> };

// GET /api/projects/:projectId/files/content?path= -> file content from disk.
export async function GET(req: Request, ctx: RouteContext) {
  try {
    const { projectId } = await ctx.params;
    const { project } = await requireProjectAccess(projectId);

    const url = new URL(req.url);
    const relPath = url.searchParams.get("path");
    if (!relPath) {
      throw new ApiError("path query parameter is required", 400, "BAD_REQUEST");
    }

    // resolveSafe runs inside readFile; throws 404 if not a file.
    const content = await readFile(project!.storageKey, relPath);
    const size = Buffer.byteLength(content, "utf8");

    // Prefer the stored language if present; else detect from filename.
    const node = await prisma.fileNode.findUnique({
      where: { projectId_path: { projectId, path: relPath.replace(/^\/+/, "") } },
      select: { language: true, path: true },
    });

    const language = node?.language ?? detectLanguage(relPath);

    return apiSuccess({
      path: node?.path ?? relPath.replace(/^\/+/, ""),
      content,
      language,
      size,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
