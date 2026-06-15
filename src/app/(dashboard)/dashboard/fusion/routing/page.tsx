"use client";

import { useState } from "react";
import { useProject } from "@/lib/store/project";
import { fusionApi, type RoutingRow } from "@/lib/client/fusion";
import { useFusion } from "@/components/fusion/useFusion";
import { ROUTING_STRATEGIES } from "@/lib/ai/fusion/catalog";
import { PageHeader, LoadingState, Banner, EmptyState, PrimaryButton, GhostButton, Card } from "@/components/fusion/primitives";
import { Route, Plus, Trash2, Loader2 } from "lucide-react";

export default function RoutingPage() {
  const { activeWorkspace } = useProject();
  const ws = activeWorkspace?.id ?? "";
  const { data, loading, error, reload } = useFusion(() => fusionApi.listRoutings(ws), [ws]);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [strategy, setStrategy] = useState<string>("fastest");
  const [fallback, setFallback] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  if (!ws) return <Banner kind="error">Select a workspace.</Banner>;
  const routings: RoutingRow[] = data?.routings ?? [];

  const add = async () => {
    setBusy("add"); setErr(null);
    try {
      const config = strategy === "fallback" ? { fallbackChain: fallback.split(",").map((s) => s.trim()).filter(Boolean) } : {};
      await fusionApi.createRouting(ws, { name, strategy, config });
      setAdding(false); setName(""); setFallback("");
      reload();
    } catch (e) { setErr(e instanceof Error ? e.message : "Failed"); } finally { setBusy(null); }
  };
  const remove = async (r: RoutingRow) => { setBusy(r.id); try { await fusionApi.deleteRouting(ws, r.id); reload(); } finally { setBusy(null); } };

  return (
    <div>
      <PageHeader title="Routing" description="Strategies that pick which model handles a request, with fallback chains."
        action={<PrimaryButton onClick={() => setAdding((v) => !v)}><Plus size={16} /> New Strategy</PrimaryButton>} />
      {err && <Banner kind="error">{err}</Banner>}

      {adding && (
        <Card className="mb-4 space-y-3">
          <input className="w-full rounded-lg border border-slate-200 bg-transparent px-3 py-2 text-sm dark:border-slate-800" placeholder="Strategy name" value={name} onChange={(e) => setName(e.target.value)} />
          <select value={strategy} onChange={(e) => setStrategy(e.target.value)} className="w-full rounded-lg border border-slate-200 bg-transparent px-3 py-2 text-sm dark:border-slate-800">
            {ROUTING_STRATEGIES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          {strategy === "fallback" && (
            <input className="w-full rounded-lg border border-slate-200 bg-transparent px-3 py-2 text-sm dark:border-slate-800" placeholder="Fallback model ids, comma-separated" value={fallback} onChange={(e) => setFallback(e.target.value)} />
          )}
          <div className="flex justify-end gap-2">
            <GhostButton onClick={() => setAdding(false)}>Cancel</GhostButton>
            <PrimaryButton onClick={() => void add()} disabled={busy === "add" || !name}>{busy === "add" ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} Save</PrimaryButton>
          </div>
        </Card>
      )}

      {loading ? <LoadingState /> : error ? <Banner kind="error">{error}</Banner> : routings.length === 0 ? (
        <EmptyState icon={<Route size={32} />} title="No routing strategies" description="Add Fastest, Cheapest, Quality, or custom fallback chains." />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {routings.map((r) => (
            <Card key={r.id}>
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-semibold">{r.name}</div>
                  <div className="text-xs text-slate-400">strategy: {r.strategy}</div>
                </div>
                <button onClick={() => void remove(r)} className="rounded p-1 text-slate-400 hover:text-rose-500"><Trash2 size={15} /></button>
              </div>
              {Array.isArray((r.config as { fallbackChain?: string[] }).fallbackChain) && (
                <div className="mt-2 text-xs text-slate-400">chain: {((r.config as { fallbackChain?: string[] }).fallbackChain ?? []).join(" → ")}</div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
