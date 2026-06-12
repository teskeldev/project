import { z } from "zod";

/**
 * Local Phase 7a search schemas. STANDALONE module — intentionally NOT appended
 * to the shared `validators.ts`.
 */

export const searchTypeSchema = z.enum(["all", "code", "symbol", "file"]);
export type SearchType = z.infer<typeof searchTypeSchema>;

/**
 * Canonical, fully-typed search request. Used directly as the POST body schema
 * for the semantic endpoint and as the validation target for the GET endpoint
 * (after coercing string query params).
 */
export const searchQuerySchema = z.object({
  q: z.string().trim().min(1, "query is required").max(1000),
  type: searchTypeSchema.default("all"),
  caseSensitive: z.boolean().default(false),
  regex: z.boolean().default(false),
  maxResults: z.number().int().min(1).max(200).default(200),
});

export type SearchQuery = z.infer<typeof searchQuerySchema>;

/** Parse the "truthy" string forms of a boolean query param. */
function parseBool(value: string | null): boolean | undefined {
  if (value == null) return undefined;
  const v = value.toLowerCase();
  if (v === "true" || v === "1" || v === "yes") return true;
  if (v === "false" || v === "0" || v === "no") return false;
  return undefined;
}

function parseNum(value: string | null): number | undefined {
  if (value == null) return undefined;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Build a `SearchQuery` from URL search params, then validate. Throws ZodError
 * (-> handleApiError 422) on invalid input.
 */
export function parseSearchParams(params: URLSearchParams): SearchQuery {
  const raw = {
    q: params.get("q") ?? "",
    type: params.get("type") ?? undefined,
    caseSensitive: parseBool(params.get("caseSensitive")),
    regex: parseBool(params.get("regex")),
    maxResults: parseNum(params.get("maxResults")),
  };
  return searchQuerySchema.parse(raw);
}
