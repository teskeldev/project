"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Search,
  Download,
  Star,
  Check,
  Puzzle,
  ChevronDown,
  ExternalLink,
  TrendingUp,
  Loader2,
  X,
} from "lucide-react";
import { useProject } from "@/lib/store/project";
import {
  fetchRegistry,
  listInstalled,
  installExtension,
  uninstallExtension,
  type RegistryExtension,
  type InstalledExtension,
} from "@/lib/client/extensions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

type ExtTab = "marketplace" | "installed";
type SortKey = "installs" | "rating" | "name";

/** Parse install count string like "32M" to a number for sorting. */
function parseInstalls(s: string): number {
  const num = parseFloat(s);
  if (s.endsWith("M")) return num * 1_000_000;
  if (s.endsWith("K")) return num * 1_000;
  return num;
}

export default function ExtensionsPage() {
  const { activeWorkspace } = useProject();
  const [tab, setTab] = useState<ExtTab>("marketplace");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("installs");
  const [showCategoryMenu, setShowCategoryMenu] = useState(false);
  const [showSortMenu, setShowSortMenu] = useState(false);

  const [registry, setRegistry] = useState<RegistryExtension[]>([]);
  const [installed, setInstalled] = useState<InstalledExtension[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Fetch data
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [registryRes, installedRes] = await Promise.all([
        fetchRegistry(),
        activeWorkspace
          ? listInstalled(activeWorkspace.id)
          : Promise.resolve({ extensions: [] as InstalledExtension[] }),
      ]);
      setRegistry(registryRes.extensions);
      setInstalled(installedRes.extensions);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load extensions");
    } finally {
      setLoading(false);
    }
  }, [activeWorkspace]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  // Build installed lookup
  const installedMap = useMemo(() => {
    const map = new Map<string, InstalledExtension>();
    for (const ext of installed) {
      map.set(ext.registryId, ext);
    }
    return map;
  }, [installed]);

  // Extract categories
  const categories = useMemo(() => {
    const cats = new Set<string>();
    for (const ext of registry) {
      cats.add(ext.category);
    }
    return Array.from(cats).sort();
  }, [registry]);

  // Filter and sort
  const filtered = useMemo(() => {
    let items = registry;

    // Tab filter
    if (tab === "installed") {
      items = items.filter((e) => installedMap.has(e.registryId));
    }

    // Search filter
    if (query) {
      const q = query.toLowerCase();
      items = items.filter(
        (e) =>
          e.name.toLowerCase().includes(q) ||
          e.description.toLowerCase().includes(q) ||
          e.author.toLowerCase().includes(q)
      );
    }

    // Category filter
    if (category) {
      items = items.filter((e) => e.category === category);
    }

    // Sort
    items = [...items].sort((a, b) => {
      if (sortKey === "installs") return parseInstalls(b.installs) - parseInstalls(a.installs);
      if (sortKey === "rating") return b.rating - a.rating;
      return a.name.localeCompare(b.name);
    });

    return items;
  }, [registry, tab, query, category, sortKey, installedMap]);

  // Install handler
  const handleInstall = useCallback(
    async (ext: RegistryExtension) => {
      if (!activeWorkspace) return;
      setActionLoading(ext.registryId);
      try {
        const { extension } = await installExtension({
          workspaceId: activeWorkspace.id,
          registryId: ext.registryId,
          name: ext.name,
          author: ext.author,
          version: "1.0.0",
        });
        setInstalled((prev) => [...prev, extension]);
        window.dispatchEvent(new Event("extensions-changed"));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to install extension");
      } finally {
        setActionLoading(null);
      }
    },
    [activeWorkspace]
  );

  // Uninstall handler
  const handleUninstall = useCallback(
    async (registryId: string) => {
      const ext = installedMap.get(registryId);
      if (!ext) return;
      setActionLoading(registryId);
      try {
        await uninstallExtension(ext.id);
        setInstalled((prev) => prev.filter((e) => e.id !== ext.id));
        window.dispatchEvent(new Event("extensions-changed"));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to uninstall extension");
      } finally {
        setActionLoading(null);
      }
    },
    [installedMap]
  );

  if (!activeWorkspace) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <Puzzle size={48} className="mx-auto mb-4 text-[var(--text-muted)]" />
          <p className="text-[var(--text-secondary)]">Select a workspace to browse extensions</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-[var(--surface)]">
      {/* Header */}
      <div className="border-b border-[var(--border)] px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Puzzle size={20} className="text-[var(--accent)]" />
            <h1 className="text-lg font-semibold text-[var(--foreground)]">Extensions</h1>
          </div>
          <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
            <span>{installed.length} installed</span>
            <span>&middot;</span>
            <span>{registry.length} available</span>
          </div>
        </div>

        {/* Search */}
        <div className="mt-4 flex items-center gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <Input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search extensions..."
              className="pl-9 pr-8"
            />
            {query && (
              <button onClick={() => setQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--foreground)]">
                <X size={14} />
              </button>
            )}
          </div>

          {/* Category dropdown */}
          <div className="relative">
            <Button
              variant={category ? "default" : "outline"}
              size="sm"
              onClick={() => { setShowCategoryMenu(!showCategoryMenu); setShowSortMenu(false); }}
            >
              {category || "Category"} <ChevronDown size={12} />
            </Button>
            {showCategoryMenu && (
              <div className="absolute right-0 top-full z-10 mt-1 w-44 rounded-lg border border-[var(--border)] bg-[var(--surface)] py-1 shadow-lg">
                <button
                  onClick={() => { setCategory(null); setShowCategoryMenu(false); }}
                  className={`w-full px-3 py-1.5 text-left text-xs hover:bg-[var(--surface-soft)] ${!category ? "font-medium text-[var(--accent)]" : "text-[var(--text-secondary)]"}`}
                >
                  All Categories
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => { setCategory(cat); setShowCategoryMenu(false); }}
                    className={`w-full px-3 py-1.5 text-left text-xs hover:bg-[var(--surface-soft)] ${category === cat ? "font-medium text-[var(--accent)]" : "text-[var(--text-secondary)]"}`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Sort dropdown */}
          <div className="relative">
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setShowSortMenu(!showSortMenu); setShowCategoryMenu(false); }}
            >
              <TrendingUp size={12} /> Sort
            </Button>
            {showSortMenu && (
              <div className="absolute right-0 top-full z-10 mt-1 w-36 rounded-lg border border-[var(--border)] bg-[var(--surface)] py-1 shadow-lg">
                {([["installs", "Most Installs"], ["rating", "Highest Rated"], ["name", "Name (A-Z)"]] as const).map(
                  ([key, label]) => (
                    <button
                      key={key}
                      onClick={() => { setSortKey(key); setShowSortMenu(false); }}
                      className={`w-full px-3 py-1.5 text-left text-xs hover:bg-[var(--surface-soft)] ${sortKey === key ? "font-medium text-[var(--accent)]" : "text-[var(--text-secondary)]"}`}
                    >
                      {label}
                    </button>
                  )
                )}
              </div>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-4 flex gap-4">
          <button
            onClick={() => setTab("marketplace")}
            className={`pb-2 text-sm font-medium ${
              tab === "marketplace"
                ? "border-b-2 border-[var(--accent)] text-[var(--foreground)]"
                : "text-[var(--text-secondary)] hover:text-[var(--foreground)]"
            }`}
          >
            Marketplace
          </button>
          <button
            onClick={() => setTab("installed")}
            className={`pb-2 text-sm font-medium ${
              tab === "installed"
                ? "border-b-2 border-[var(--accent)] text-[var(--foreground)]"
                : "text-[var(--text-secondary)] hover:text-[var(--foreground)]"
            }`}
          >
            Installed ({installed.length})
          </button>
        </div>
      </div>

      {/* Extension list */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={24} className="animate-spin text-[var(--text-muted)]" />
          </div>
        ) : error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600">
            {error}
            <button onClick={fetchData} className="ml-2 underline hover:no-underline">
              Retry
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-sm text-[var(--text-muted)]">
            {tab === "installed" ? "No extensions installed yet." : "No extensions match your search."}
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((ext) => {
              const isInstalled = installedMap.has(ext.registryId);
              const isLoading = actionLoading === ext.registryId;

              return (
                <Card
                  key={ext.registryId}
                  className="flex items-start gap-4 p-4 transition-colors hover:border-[var(--border-hover)]"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--surface-soft)] text-2xl">
                    {ext.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-[var(--foreground)]">
                        {ext.name}
                      </h3>
                      <Badge variant="outline" className="text-[10px]">
                        {ext.category}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-[var(--text-secondary)]">by {ext.author}</p>
                    <p className="mt-1 line-clamp-1 text-xs text-[var(--text-secondary)]">
                      {ext.description}
                    </p>
                    <div className="mt-2 flex items-center gap-3 text-[11px] text-[var(--text-muted)]">
                      <span className="flex items-center gap-1">
                        <Download size={10} /> {ext.installs}
                      </span>
                      <span className="flex items-center gap-1">
                        <Star size={10} className="text-amber-400" /> {ext.rating}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isLoading ? (
                      <Button variant="outline" size="sm" disabled>
                        <Loader2 size={12} className="animate-spin" />
                      </Button>
                    ) : isInstalled ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleUninstall(ext.registryId)}
                      >
                        <Check size={12} className="text-green-500" />
                        Installed
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => handleInstall(ext)}
                      >
                        Install
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" className="h-7 w-7">
                      <ExternalLink size={14} />
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
