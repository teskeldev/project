import {
  apiSuccess,
  handleApiError,
  requireProjectAccess,
  ApiError,
} from "@/lib/api";
import { searchQuerySchema } from "@/lib/search/schema";
import { runSearch } from "@/lib/search/engine";

type RouteContext = { params: Promise<{ projectId: string }> };

/**
 * POST /api/projects/:projectId/search/semantic
 *
 * FALLBACK IMPLEMENTATION (Phase 7a):
 * There is no vector store / embedding pipeline yet, so "semantic" search
 * currently delegates to the same keyword engine and flags `semantic:false`.
 * We deliberately do NOT fabricate embeddings or similarity scores.
 *
 * TODO(Phase 7b): real semantic search. Introduce a `CodeEmbedding` model
 * (projectId, fileNodeId, chunkIndex, content, vector), a chunking step over
 * project files, an embedding provider, and an ANN/cosine query here. This
 * endpoint''s response shape is forward-compatible: add `score` per match and
 * set `semantic:true` once embeddings exist.
 */
export async function POST(req: Request, ctx: RouteContext) {
  try {
    const { projectId } = await ctx.params;
    const { project } = await requireProjectAccess(projectId);

    let json: unknown;
    try {
      json = await req.json();
    } catch {
      throw new ApiError("Invalid JSON body", 400, "INVALID_JSON");
    }
    // .parse -> applies defaults and yields the fully-resolved query (all
    // fields required); ZodError is mapped to 422 by handleApiError.
    const query = searchQuerySchema.parse(json);

    const result = await runSearch(projectId, project!.storageKey, query);

    return apiSuccess({ ...result, semantic: false });
  } catch (err) {
    return handleApiError(err);
  }
}

