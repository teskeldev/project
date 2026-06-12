/**
 * Client-side typed helpers for the Phase 7a search API.
 *
 * STANDALONE module: it does not modify the shared `client/api.ts`; it only
 * reuses `apiFetch` for envelope unwrapping + error behaviour.
 */

import { apiFetch } from "@/lib/client/api";

/* ------------------------------- types ----------------------------------- */

export type SearchType = "all" | "code" | "symbol" | "file";

export type SearchMatch = {
  file: string;
  line: number;
  column: number;
  content: string;
  type: "code" | "symbol" | "file";
};

export type SearchResponse = {
  results: SearchMatch[];
  truncated: boolean;
  count: number;
};

export type SemanticSearchResponse = SearchResponse & { semantic: boolean };

export type SearchOptions = {
  type?: SearchType;
  caseSensitive?: boolean;
  regex?: boolean;
  maxResults?: number;
};

/* ----------------------------- endpoints --------------------------------- */

const base = (projectId: string) =>
  `/api/projects/${encodeURIComponent(projectId)}/search`;

/** Keyword/symbol/filename search (GET). */
export function searchProject(
  projectId: string,
  q: string,
  opts: SearchOptions = {}
): Promise<SearchResponse> {
  const params = new URLSearchParams({ q });
  if (opts.type) params.set("type", opts.type);
  if (opts.caseSensitive != null)
    params.set("caseSensitive", String(opts.caseSensitive));
  if (opts.regex != null) params.set("regex", String(opts.regex));
  if (opts.maxResults != null)
    params.set("maxResults", String(opts.maxResults));

  return apiFetch(`${base(projectId)}?${params.toString()}`);
}

/**
 * Semantic search (POST). Currently a keyword fallback on the server
 * (`semantic:false`); see the route''s TODO for real embeddings.
 */
export function semanticSearchProject(
  projectId: string,
  q: string,
  opts: SearchOptions = {}
): Promise<SemanticSearchResponse> {
  return apiFetch(`${base(projectId)}/semantic`, {
    method: "POST",
    body: JSON.stringify({ q, ...opts }),
  });
}
