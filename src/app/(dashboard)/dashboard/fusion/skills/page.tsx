"use client";

import { useEffect, useState } from "react";
import { SKILL_CATEGORIES } from "@/data/skills-registry";
import { PageHeader, LoadingState, Banner, Card } from "@/components/fusion/primitives";
import { Sparkles, Search } from "lucide-react";

type RegistrySkill = { slug: string; name: string; description: string; category: string; source: string };

export default function SkillsPage() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [items, setItems] = useState<RegistrySkill[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ limit: "48" });
        if (query) params.set("search", query);
        if (category) params.set("category", category);
        const res = await fetch(`/api/skills/registry?${params}`, { signal: ctrl.signal });
        const data = await res.json();
        if (data.success) {
          setItems(data.data.items);
          setTotal(data.data.pagination?.total ?? data.data.items.length);
        } else setError(data.error || "Failed");
      } catch {
        /* aborted */
      } finally {
        setLoading(false);
      }
    }, 200);
    return () => { ctrl.abort(); clearTimeout(t); };
  }, [query, category]);

  return (
    <div>
      <PageHeader title="Skills" description="Browse the skills marketplace. Attach skills to profiles, teams, and workflows." />

      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search skills…"
            className="w-full rounded-lg border border-slate-200 bg-transparent py-2 pl-9 pr-3 text-sm dark:border-slate-800" />
        </div>
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="rounded-lg border border-slate-200 bg-transparent px-3 py-2 text-sm dark:border-slate-800">
          <option value="">All categories</option>
          {Object.entries(SKILL_CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      {error && <Banner kind="error">{error}</Banner>}
      {loading ? <LoadingState /> : (
        <>
          <p className="mb-3 text-xs text-slate-400">{total.toLocaleString()} skills available</p>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {items.map((s) => (
              <Card key={s.slug}>
                <div className="flex items-start gap-2">
                  <Sparkles size={16} className="mt-0.5 shrink-0 text-accent" />
                  <div className="min-w-0">
                    <div className="font-semibold">{s.name}</div>
                    <div className="line-clamp-2 text-xs text-slate-400">{s.description}</div>
                    <div className="mt-2 flex gap-1.5">
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] dark:bg-slate-800">{s.category}</span>
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] dark:bg-slate-800">{s.source}</span>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
