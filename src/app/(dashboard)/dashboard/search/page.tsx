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
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

const SUGGESTIONS = ["useState", "export default function", "ApiError", "prisma"];

/** Split a line into [before, match, after] for highlighting the matched span. */
function highlight(content: string, column: number, query: string) {
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
            <FolderOpen size={40} className="mx-auto text-[var(--text-muted)]" />
            <p className="mt-4 text-[14px] text-[var(--text-secondary)]">
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
          <h1 className="text-[22px] font-semibold text-[var(--foreground)]">Search</h1>
          <p className="mt-1 text-[14px] text-[var(--text-secondary)]">
            Search across{" "}
            <span className="font-medium text-[var(--foreground)]">
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
              className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
            />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder={
                regex ? "Search with a regex pattern…" : "Search code, symbols, files…"
              }
              className="h-12 rounded-xl pl-12 pr-24 text-[14px] shadow-sm"
            />
            <Button
              onClick={handleSearch}
              disabled={loading || !query.trim()}
              size="sm"
              className="absolute right-3 top-1/2 -translate-y-1/2"
            >
              {loading && <Loader2 size={12} className="animate-spin" />}
              Search
            </Button>
          </div>

          {/* Type tabs */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {(["all", "code", "symbol", "file"] as const).map((type) => (
              <Button
                key={type}
                variant={searchType === type ? "default" : "secondary"}
                size="sm"
                onClick={() => handleTypeChange(type)}
                className="capitalize"
              >
                {type === "code" && <FileCode size={12} />}
                {type === "symbol" && <Hash size={12} />}
                {type === "file" && <FolderOpen size={12} />}
                {type}
              </Button>
            ))}

            <span className="mx-1 h-4 w-px bg-[var(--border)]" />

            <label className="flex cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-soft)]">
              <input
                type="checkbox"
                checked={caseSensitive}
                onChange={(e) => setCaseSensitive(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-[var(--border)]"
              />
              Case sensitive
            </label>
            <label className="flex cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-soft)]">
              <input
                type="checkbox"
                checked={regex}
                onChange={(e) => setRegex(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-[var(--border)]"
              />
              Regex
            </label>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-400">
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="mt-16 flex flex-col items-center text-[var(--text-muted)]">
            <Loader2 size={28} className="animate-spin" />
            <p className="mt-3 text-[13px]">Searching…</p>
          </div>
        )}

        {/* Results */}
        {!loading && searched && !error && (
          <div>
            <p className="mb-4 text-[13px] text-[var(--text-secondary)]">
              {results.length} {results.length === 1 ? "result" : "results"}
              {truncated && " (truncated)"}
            </p>

            {results.length === 0 ? (
              <div className="mt-12 text-center text-[14px] text-[var(--text-muted)]">
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
                  const href = `/dashboard/editor?file=${encodeURIComponent(
                    result.file
                  )}&line=${result.line}`;
                  return (
                    <Link
                      key={`${result.file}:${result.line}:${result.column}:${i}`}
                      href={href}
                      className="group block"
                    >
                      <Card className="cursor-pointer p-4 transition-all hover:border-[var(--accent)]/40 hover:shadow-sm">
                        <div className="flex items-center justify-between">
                          <div className="flex min-w-0 items-center gap-2">
                            <Badge
                              variant={
                                result.type === "code"
                                  ? "default"
                                  : result.type === "symbol"
                                    ? "warning"
                                    : "outline"
                              }
                              className="text-[10px]"
                            >
                              {result.type}
                            </Badge>
                            <span className="truncate text-[13px] font-medium text-[var(--foreground)]">
                              {result.file}
                            </span>
                            <span className="shrink-0 text-[11px] text-[var(--text-muted)]">
                              :{result.line}
                            </span>
                          </div>
                          <ArrowRight
                            size={14}
                            className="shrink-0 text-[var(--text-muted)] opacity-0 transition-opacity group-hover:opacity-100"
                          />
                        </div>
                        {result.type !== "file" && (
                          <div className="mt-2 overflow-hidden rounded bg-[var(--surface-soft)] px-3 py-2">
                            <code className="block truncate text-[12px] text-[var(--text-secondary)]">
                              {before}
                              <mark className="rounded bg-yellow-200 px-0.5 text-[var(--foreground)] dark:bg-yellow-500/30">
                                {match}
                              </mark>
                              {after}
                            </code>
                          </div>
                        )}
                      </Card>
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
            <Search size={40} className="mx-auto text-[var(--text-muted)]" />
            <p className="mt-4 text-[14px] text-[var(--text-secondary)]">
              Enter a query to search across your codebase
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((q) => (
                <Button
                  key={q}
                  variant="outline"
                  size="sm"
                  onClick={() => runSuggestion(q)}
                  className="rounded-full"
                >
                  {q}
                </Button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
