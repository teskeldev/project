import {
  apiSuccess,
  handleApiError,
  requireProjectAccess,
  ApiError,
} from "@/lib/api";
import { searchQuerySchema } from "@/lib/search/schema";
import { runSearch } from "@/lib/search/engine";
import { hybridSearch, type HybridSearchResult } from "@/lib/search/hybrid";

type RouteContext = { params: Promise<{ projectId: string }> };

/**
 * POST /api/projects/:projectId/search/semantic
 *
 * Hybrid search combining keyword (BM25) + semantic (vector) search.
 * Uses Reciprocal Rank Fusion (RRF) to merge ranked results.
 *
 * Falls back to keyword-only search if the vector store is unavailable.
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

    const query = searchQuerySchema.parse(json);

    // Attempt hybrid search (keyword + semantic via RRF)
    let hybridResults: HybridSearchResult[] | null = null;
    try {
      hybridResults = await hybridSearch(
        projectId,
        project!.storageKey,
        query.q,
        {
          topK: query.maxResults,
          includeContent: true,
        }
      );
    } catch {
      // Hybrid search failed (e.g., vector store not indexed) — fall through to keyword
    }

    if (hybridResults && hybridResults.length > 0) {
      return apiSuccess({
        results: hybridResults.map((r) => ({
          file: r.filePath,
          content: r.content,
          startLine: r.startLine,
          endLine: r.endLine,
          score: r.score,
          scores: r.scores,
          matchType: r.matchType,
        })),
        total: hybridResults.length,
        semantic: true,
      });
    }

    // Fallback: keyword-only search
    const result = await runSearch(projectId, project!.storageKey, query);

    return apiSuccess({ ...result, semantic: false });
  } catch (err) {
    return handleApiError(err);
  }
}
