import { apiSuccess, handleApiError, requireProjectAccess } from "@/lib/api";
import { parseSearchParams } from "@/lib/search/schema";
import { runSearch } from "@/lib/search/engine";

type RouteContext = { params: Promise<{ projectId: string }> };

/**
 * GET /api/projects/:projectId/search
 *   ?q=<query>&type=all|code|symbol|file&caseSensitive=bool&regex=bool&maxResults=n
 *
 * Real keyword/symbol/filename search over the project''s files. Disk reads go
 * through the SAFE storage layer; scan + result counts are hard-capped in the
 * engine. Invalid regex -> 400; invalid params -> 422.
 */
export async function GET(req: Request, ctx: RouteContext) {
  try {
    const { projectId } = await ctx.params;
    const { project } = await requireProjectAccess(projectId);

    const url = new URL(req.url);
    const query = parseSearchParams(url.searchParams);

    const result = await runSearch(projectId, project!.storageKey, query);
    return apiSuccess(result);
  } catch (err) {
    return handleApiError(err);
  }
}
