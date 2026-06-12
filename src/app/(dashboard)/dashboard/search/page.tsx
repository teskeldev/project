"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import {
  Search,
  FileCode,
  FolderOpen,
  Hash,
  ArrowRight,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { useProject } from "@/lib/store/project";
import {
  searchProject,
  type SearchMatch,
  type SearchType,
} from "@/lib/client/search";
import { ApiClientError } from "@/lib/client/api";

const SUGGESTIONS = ["useState", "export default function", "ApiError", "prisma"];

/** Split a line into [before, match, after] for highlighting the matched span. */
function highlight(content: string, column: number, query: string) {
  // column is 1-based; for regex matches we only know the start, so highlight
  // a best-effort span of `query.length` (falls back gracefully).
  const start = Math.max(0, column - 1);
  const len = Math.max(1, query.length);
  const before = content.slice(0, start);
  const match = content.slice(start, start + len);
  const after = content.slice(start + len);
  return { before, match, after };
}

export default function SearchPage() {
  const { activeProject } = useProject();

  const [query, setQuery] = useState("");
  const [searchType, setSearchType] = useState<SearchType>("all");
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [regex, setRegex] = useState(false);

  const [results, setResults] = useState<SearchMatch[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runSearch = useCallback(
    async (rawQuery: string, type: SearchType) => {
      const q = rawQuery.trim();
      if (!q || !activeProject) return;

      setLoading(true);
      setError(null);
      setSearched(true);
      try {
        const res = await searchProject(activeProject.id, q, {
          type,
          caseSensitive,
          regex,
        });
        setResults(res.results);
        setTruncated(res.truncated);
      } catch (err) {
        setResults([]);
        setTruncated(false);
        setError(
          err instanceof ApiClientError ? err.message : "Search failed"
        );
      } finally {
        setLoading(false);
      }
    },
    [activeProject, caseSensitive, regex]
  );

  const handleSearch = () => void runSearch(query, searchType);

  const handleTypeChange = (type: SearchType) => {
    setSearchType(type);
    if (searched && query.trim()) void runSearch(query, type);
  };

  const runSuggestion = (q: string) => {
    setQuery(q);
    void runSearch(q, searchType);
  };

  // No active project -> empty state.
  if (!activeProject) {
    return (
      <div className="flex-1 overflow-auto p-6">
        <div className="mx-auto max-w-4xl">
          <div className="mt-24 text-center">
            <FolderOpen size={40} className="mx-auto text-gray-200" />
            <p className="mt-4 text-[14px] text-gray-400">
              Select or create a project to search its codebase.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-[22px] font-semibold text-gray-900">Search</h1>
          <p className="mt-1 text-[14px] text-gray-500">
            Search across{" "}
            <span className="font-medium text-gray-700">
              {activeProject.name}
            </span>
            {regex ? " with regular expressions" : " by keyword"}
          </p>
        </div>

        {/* Search bar */}
        <div className="mb-4">
          <div className="relative">
            <Search
              size={18}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder={
                regex ? "Search with a regex pattern…" : "Search code, symbols, files…"
              }
              className="w-full rounded-xl border border-gray-200 bg-white py-3.5 pl-12 pr-24 text-[14px] text-gray-900 shadow-sm placeholder-gray-400 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-50"
            />
            <button
              onClick={handleSearch}
              disabled={loading || !query.trim()}
              className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-1.5 rounded-lg bg-gray-900 px-4 py-1.5 text-[12px] font-medium text-white hover:bg-gray-800 disabled:opacity-50"
            >
              {loading && <Loader2 size={12} className="animate-spin" />}
              Search
            </button>
          </div>

          {/* Type tabs */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {(["all", "code", "symbol", "file"] as const).map((type) => (
              <button
                key={type}
                onClick={() => handleTypeChange(type)}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium capitalize transition-colors ${
                  searchType === type
                    ? "bg-gray-900 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {type === "code" && <FileCode size={12} />}
                {type === "symbol" && <Hash size={12} />}
                {type === "file" && <FolderOpen size={12} />}
                {type}
              </button>
            ))}

            <span className="mx-1 h-4 w-px bg-gray-200" />

            <label className="flex cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-medium text-gray-600 hover:bg-gray-100">
              <input
                type="checkbox"
                checked={caseSensitive}
                onChange={(e) => setCaseSensitive(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-gray-300"
              />
              Case sensitive
            </label>
            <label className="flex cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-medium text-gray-600 hover:bg-gray-100">
              <input
                type="checkbox"
                checked={regex}
                onChange={(e) => setRegex(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-gray-300"
              />
              Regex
            </label>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="mt-16 flex flex-col items-center text-gray-400">
            <Loader2 size={28} className="animate-spin" />
            <p className="mt-3 text-[13px]">Searching…</p>
          </div>
        )}

        {/* Results */}
        {!loading && searched && !error && (
          <div>
            <p className="mb-4 text-[13px] text-gray-500">
              {results.length} {results.length === 1 ? "result" : "results"}
              {truncated && " (truncated)"}
            </p>

            {results.length === 0 ? (
              <div className="mt-12 text-center text-[14px] text-gray-400">
                No matches found.
              </div>
            ) : (
              <div className="space-y-2">
                {results.map((result, i) => {
                  const { before, match, after } = highlight(
                    result.content,
                    result.column,
                    query
                  );
                  // TODO: editor does not consume `line` yet — link carries it
                  // so jump-to-line works once the editor supports it.
                  const href = `/dashboard/editor?file=${encodeURIComponent(
                    result.file
                  )}&line=${result.line}`;
                  return (
                    <Link
                      key={`${result.file}:${result.line}:${result.column}:${i}`}
                      href={href}
                      className="group block cursor-pointer rounded-lg border border-gray-200 bg-white p-4 transition-all hover:border-blue-200 hover:shadow-sm"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex min-w-0 items-center gap-2">
                          <span
                            className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                              result.type === "code"
                                ? "bg-blue-50 text-blue-600"
                                : result.type === "symbol"
                                  ? "bg-purple-50 text-purple-600"
                                  : "bg-gray-100 text-gray-600"
                            }`}
                          >
                            {result.type}
                          </span>
                          <span className="truncate text-[13px] font-medium text-gray-900">
                            {result.file}
                          </span>
                          <span className="shrink-0 text-[11px] text-gray-400">
                            :{result.line}
                          </span>
                        </div>
                        <ArrowRight
                          size={14}
                          className="shrink-0 text-gray-300 opacity-0 transition-opacity group-hover:opacity-100"
                        />
                      </div>
                      {result.type !== "file" && (
                        <div className="mt-2 overflow-hidden rounded bg-gray-50 px-3 py-2">
                          <code className="block truncate text-[12px] text-gray-700">
                            {before}
                            <mark className="rounded bg-yellow-200 px-0.5 text-gray-900">
                              {match}
                            </mark>
                            {after}
                          </code>
                        </div>
                      )}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Empty state */}
        {!loading && !searched && (
          <div className="mt-20 text-center">
            <Search size={40} className="mx-auto text-gray-200" />
            <p className="mt-4 text-[14px] text-gray-400">
              Enter a query to search across your codebase
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => runSuggestion(q)}
                  className="rounded-full border border-gray-200 px-3 py-1.5 text-[12px] text-gray-500 transition-colors hover:border-gray-300 hover:text-gray-700"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
