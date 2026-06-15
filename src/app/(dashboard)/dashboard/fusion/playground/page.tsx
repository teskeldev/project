"use client";

import { useState } from "react";
import { useProject } from "@/lib/store/project";
import { fusionApi, type AvailableModel, type PlaygroundResult } from "@/lib/client/fusion";
import { useFusion } from "@/components/fusion/useFusion";
import { ROUTING_STRATEGIES, JUDGE_MODES } from "@/lib/ai/fusion/catalog";
import { PageHeader, Banner, PrimaryButton, Card } from "@/components/fusion/primitives";
import { FlaskConical, Loader2, Play, Sparkles } from "lucide-react";

export default function PlaygroundPage() {
  const { activeWorkspace } = useProject();
  const ws = activeWorkspace?.id ?? "";
  const { data } = useFusion(() => fusionApi.listModels(ws), [ws]);
  const models: AvailableModel[] = data?.models ?? [];

  const [prompt, setPrompt] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [strategy, setStrategy] = useState<string>("parallel");
  const [judgeMode, setJudgeMode] = useState<string>("consensus");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<PlaygroundResult | null>(null);
  const [err, setErr] = useState<string | null>(null);

  if (!ws) return <Banner kind="error">Select a workspace.</Banner>;

  const run = async () => {
    if (!prompt.trim() || selected.length === 0) return;
    setRunning(true); setErr(null); setResult(null);
    try {
      const r = await fusionApi.playground(ws, { prompt, modelRefs: selected, strategy, judgeMode });
      setResult(r.result);
    } catch (e) { setErr(e instanceof Error ? e.message : "Failed"); } finally { setRunning(false); }
  };

  return (
    <div>
      <PageHeader title="Playground" description="Run a prompt across models, then reconcile with a judge." />

      <Card className="mb-4">
        <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={4}
          placeholder="Prompt to fan out across the selected models…"
          className="w-full resize-y rounded-lg border border-slate-200 bg-transparent px-3 py-2 text-sm dark:border-slate-800" />
        <div className="mt-3">
          <div className="mb-1 text-xs font-semibold text-slate-500">Models (max 6)</div>
          {models.length === 0 ? (
            <span className="text-xs text-slate-400">No connected models — add a provider in Integrations.</span>
          ) : (
            <div className="flex flex-wrap gap-2">
              {models.map((m) => {
                const on = selected.includes(m.ref);
                return (
                  <button key={m.ref} disabled={!on && selected.length >= 6}
                    onClick={() => setSelected((s) => on ? s.filter((x) => x !== m.ref) : [...s, m.ref])}
                    className={`rounded-full px-3 py-1 text-xs font-medium disabled:opacity-40 ${on ? "bg-accent text-white" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"}`}>
                    {m.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <label className="text-xs text-slate-500">Routing
            <select value={strategy} onChange={(e) => setStrategy(e.target.value)} className="ml-2 rounded-lg border border-slate-200 bg-transparent px-2 py-1 text-sm dark:border-slate-800">
              {ROUTING_STRATEGIES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <label className="text-xs text-slate-500">Judge
            <select value={judgeMode} onChange={(e) => setJudgeMode(e.target.value)} className="ml-2 rounded-lg border border-slate-200 bg-transparent px-2 py-1 text-sm dark:border-slate-800">
              {JUDGE_MODES.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </label>
          <PrimaryButton className="ml-auto" onClick={() => void run()} disabled={running || !prompt.trim() || selected.length === 0}>
            {running ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />} Run
          </PrimaryButton>
        </div>
      </Card>

      {err && <Banner kind="error">{err}</Banner>}

      {!result && !err && (
        <div className="flex flex-col items-center justify-center py-12 text-center text-slate-400">
          <FlaskConical size={32} className="mb-2" />
          <p className="text-sm">Pick models and run a prompt to see the fused result.</p>
        </div>
      )}

      {result && (
        <div className="space-y-4">
          <Card className="border-accent/30 dark:border-accent/40">
            <div className="mb-2 flex items-center gap-2">
              <Sparkles size={16} className="text-accent" />
              <h2 className="text-base font-bold">Fused Result</h2>
              <span className="ml-auto text-xs text-slate-400">judge: {result.judgeMode} ({result.judgeModel}) · {(result.durationMs / 1000).toFixed(1)}s</span>
            </div>
            <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-950 p-3 text-xs text-slate-100">{result.fused}</pre>
          </Card>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {result.runs.map((r) => (
              <Card key={r.ref}>
                <div className="mb-2 flex items-center justify-between">
                  <span className="font-semibold">{r.modelId}</span>
                  <span className={`text-xs ${r.ok ? "text-emerald-500" : "text-rose-500"}`}>{r.ok ? "ok" : "error"}</span>
                </div>
                <div className="mb-2 flex flex-wrap gap-3 text-xs text-slate-400">
                  <span>{r.provider}</span>
                  <span>{r.latencyMs}ms</span>
                  <span>{r.tokensOut} out tok</span>
                </div>
                <pre className="max-h-56 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-950 p-3 text-xs text-slate-100">{r.ok ? r.response : r.error}</pre>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
