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
          <Puzzle size={48} className="mx-auto mb-4 text-gray-300" />
          <p className="text-gray-500">Select a workspace to browse extensions</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-white">
      {/* Header */}
      <div className="border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Puzzle size={20} className="text-blue-500" />
            <h1 className="text-lg font-semibold text-gray-900">Extensions</h1>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span>{installed.length} installed</span>
            <span>&middot;</span>
            <span>{registry.length} available</span>
          </div>
        </div>

        {/* Search */}
        <div className="mt-4 flex items-center gap-3">
          <div className="flex flex-1 items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2.5">
            <Search size={16} className="text-gray-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search extensions..."
              className="flex-1 bg-transparent text-sm placeholder:text-gray-400 focus:outline-none"
            />
            {query && (
              <button onClick={() => setQuery("")} className="text-gray-400 hover:text-gray-600">
                <X size={14} />
              </button>
            )}
          </div>

          {/* Category dropdown */}
          <div className="relative">
            <button
              onClick={() => { setShowCategoryMenu(!showCategoryMenu); setShowSortMenu(false); }}
              className={`flex items-center gap-1 rounded-lg border px-3 py-2.5 text-xs hover:bg-gray-50 ${
                category ? "border-blue-300 bg-blue-50 text-blue-700" : "border-gray-200 text-gray-600"
              }`}
            >
              {category || "Category"} <ChevronDown size={12} />
            </button>
            {showCategoryMenu && (
              <div className="absolute right-0 top-full z-10 mt-1 w-44 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                <button
                  onClick={() => { setCategory(null); setShowCategoryMenu(false); }}
                  className={`w-full px-3 py-1.5 text-left text-xs hover:bg-gray-50 ${!category ? "font-medium text-blue-600" : "text-gray-600"}`}
                >
                  All Categories
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => { setCategory(cat); setShowCategoryMenu(false); }}
                    className={`w-full px-3 py-1.5 text-left text-xs hover:bg-gray-50 ${category === cat ? "font-medium text-blue-600" : "text-gray-600"}`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Sort dropdown */}
          <div className="relative">
            <button
              onClick={() => { setShowSortMenu(!showSortMenu); setShowCategoryMenu(false); }}
              className="flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2.5 text-xs text-gray-600 hover:bg-gray-50"
            >
              <TrendingUp size={12} /> Sort
            </button>
            {showSortMenu && (
              <div className="absolute right-0 top-full z-10 mt-1 w-36 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                {([["installs", "Most Installs"], ["rating", "Highest Rated"], ["name", "Name (A-Z)"]] as const).map(
                  ([key, label]) => (
                    <button
                      key={key}
                      onClick={() => { setSortKey(key); setShowSortMenu(false); }}
                      className={`w-full px-3 py-1.5 text-left text-xs hover:bg-gray-50 ${sortKey === key ? "font-medium text-blue-600" : "text-gray-600"}`}
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
                ? "border-b-2 border-blue-500 text-gray-900"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Marketplace
          </button>
          <button
            onClick={() => setTab("installed")}
            className={`pb-2 text-sm font-medium ${
              tab === "installed"
                ? "border-b-2 border-blue-500 text-gray-900"
                : "text-gray-500 hover:text-gray-700"
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
            <Loader2 size={24} className="animate-spin text-gray-400" />
          </div>
        ) : error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600">
            {error}
            <button onClick={fetchData} className="ml-2 underline hover:no-underline">
              Retry
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-sm text-gray-400">
            {tab === "installed" ? "No extensions installed yet." : "No extensions match your search."}
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((ext) => {
              const isInstalled = installedMap.has(ext.registryId);
              const isLoading = actionLoading === ext.registryId;

              return (
                <div
                  key={ext.registryId}
                  className="flex items-start gap-4 rounded-xl border border-gray-200 p-4 transition-colors hover:border-gray-300"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gray-100 text-2xl">
                    {ext.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-gray-900">
                        {ext.name}
                      </h3>
                      <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500">
                        {ext.category}
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-500">by {ext.author}</p>
                    <p className="mt-1 line-clamp-1 text-xs text-gray-600">
                      {ext.description}
                    </p>
                    <div className="mt-2 flex items-center gap-3 text-[11px] text-gray-400">
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
                      <button
                        disabled
                        className="flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-400"
                      >
                        <Loader2 size={12} className="animate-spin" />
                      </button>
                    ) : isInstalled ? (
                      <button
                        onClick={() => handleUninstall(ext.registryId)}
                        className="flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-50"
                      >
                        <Check size={12} className="text-green-500" />
                        Installed
                      </button>
                    ) : (
                      <button
                        onClick={() => handleInstall(ext)}
                        className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800"
                      >
                        Install
                      </button>
                    )}
                    <button className="rounded p-1.5 text-gray-400 hover:bg-gray-100">
                      <ExternalLink size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
