"use client";

import { useState } from "react";
import { useProject } from "@/lib/store/project";
import { fusionApi, type RoutingRow, type AvailableModel } from "@/lib/client/fusion";
import { useFusion } from "@/components/fusion/useFusion";
import { ROUTING_STRATEGIES } from "@/lib/ai/fusion/catalog";
import { PageHeader, LoadingState, Banner, EmptyState, PrimaryButton, GhostButton, Card } from "@/components/fusion/primitives";
import { Route, Plus, Trash2, Loader2 } from "lucide-react";

const STRATEGY_HINT: Record<string, string> = {
  sequential: "run steps in order, stop at first success",
  parallel: "fan out to all steps at once (for a judge)",
  fallback: "try steps in order until one succeeds",
  cost: "prefer cheaper models first",
  latency: "prefer faster models first",
};

export default function RoutingPage() {
  const { activeWorkspace } = useProject();
  const ws = activeWorkspace?.id ?? "";
  const { data, loading, error, reload } = useFusion(
    () => Promise.all([fusionApi.listRoutings(ws), fusionApi.listModels(ws)]),
    [ws]
  );
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [strategy, setStrategy] = useState<string>("parallel");
  const [steps, setSteps] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  if (!ws) return <Banner kind="error">Select a workspace.</Banner>;
  const routings: RoutingRow[] = data?.[0]?.routings ?? [];
  const models: AvailableModel[] = data?.[1]?.models ?? [];

  const add = async () => {
    setBusy("add"); setErr(null);
    try {
      await fusionApi.createRouting(ws, { name, strategy, config: { steps } });
      setAdding(false); setName(""); setSteps([]);
      reload();
    } catch (e) { setErr(e instanceof Error ? e.message : "Failed"); } finally { setBusy(null); }
  };
  const remove = async (r: RoutingRow) => { setBusy(r.id); try { await fusionApi.deleteRouting(ws, r.id); reload(); } finally { setBusy(null); } };
  const modelName = (ref: string) => models.find((m) => m.ref === ref)?.name ?? ref;

  return (
    <div>
      <PageHeader title="Routing" description="Pipelines that decide how a request fans out across models."
        action={<PrimaryButton onClick={() => setAdding((v) => !v)}><Plus size={16} /> New Pipeline</PrimaryButton>} />
      {err && <Banner kind="error">{err}</Banner>}

      {adding && (
        <Card className="mb-4 space-y-3">
          <input className="w-full rounded-lg border border-slate-200 bg-transparent px-3 py-2 text-sm dark:border-slate-800" placeholder="Pipeline name" value={name} onChange={(e) => setName(e.target.value)} />
          <div>
            <select value={strategy} onChange={(e) => setStrategy(e.target.value)} className="w-full rounded-lg border border-slate-200 bg-transparent px-3 py-2 text-sm dark:border-slate-800">
              {ROUTING_STRATEGIES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <p className="mt-1 text-xs text-slate-400">{STRATEGY_HINT[strategy]}</p>
          </div>
          <div>
            <div className="mb-1 text-xs font-semibold text-slate-500">Steps (models, in order)</div>
            {models.length === 0 ? (
              <span className="text-xs text-slate-400">No connected models — add a provider in Integrations.</span>
            ) : (
              <div className="flex flex-wrap gap-2">
                {models.map((m) => {
                  const i = steps.indexOf(m.ref);
                  const on = i !== -1;
                  return (
                    <button key={m.ref} onClick={() => setSteps((s) => on ? s.filter((x) => x !== m.ref) : [...s, m.ref])}
                      className={`rounded-full px-3 py-1 text-xs font-medium ${on ? "bg-accent text-white" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"}`}>
                      {on ? `${i + 1}. ` : ""}{m.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <GhostButton onClick={() => setAdding(false)}>Cancel</GhostButton>
            <PrimaryButton onClick={() => void add()} disabled={busy === "add" || !name || steps.length === 0}>{busy === "add" ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} Save</PrimaryButton>
          </div>
        </Card>
      )}

      {loading ? <LoadingState /> : error ? <Banner kind="error">{error}</Banner> : routings.length === 0 ? (
        <EmptyState icon={<Route size={32} />} title="No pipelines yet" description="Create a sequential, parallel, fallback, cost or latency pipeline." />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {routings.map((r) => (
            <Card key={r.id}>
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-semibold">{r.name}</div>
                  <div className="text-xs text-slate-400">{r.strategy}</div>
                </div>
                <button onClick={() => void remove(r)} className="rounded p-1 text-slate-400 hover:text-rose-500"><Trash2 size={15} /></button>
              </div>
              {(r.config.steps ?? []).length > 0 && (
                <div className="mt-2 text-xs text-slate-400">{(r.config.steps ?? []).map(modelName).join(" → ")}</div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
