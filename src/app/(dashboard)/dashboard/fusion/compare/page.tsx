"use client";

import { useState } from "react";
import { useProject } from "@/lib/store/project";
import { fusionApi, type ModelRow, type CompareResult } from "@/lib/client/fusion";
import { useFusion } from "@/components/fusion/useFusion";
import { PageHeader, Banner, PrimaryButton, Card } from "@/components/fusion/primitives";
import { GitCompare, Loader2, Play } from "lucide-react";

export default function ComparePage() {
  const { activeWorkspace } = useProject();
  const ws = activeWorkspace?.id ?? "";
  const { data } = useFusion(() => fusionApi.listModels(ws), [ws]);
  const models: ModelRow[] = data?.models ?? [];

  const [prompt, setPrompt] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<CompareResult[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  if (!ws) return <Banner kind="error">Select a workspace.</Banner>;

  const run = async () => {
    if (!prompt.trim() || selected.length === 0) return;
    setRunning(true); setErr(null); setResults(null);
    try {
      const r = await fusionApi.compare(ws, prompt, selected);
      setResults(r.results);
    } catch (e) { setErr(e instanceof Error ? e.message : "Failed"); } finally { setRunning(false); }
  };

  return (
    <div>
      <PageHeader title="Compare" description="Run one prompt across models side by side." />

      <Card className="mb-4">
        <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={4} placeholder="Prompt to send to every selected model…"
          className="w-full resize-y rounded-lg border border-slate-200 bg-transparent px-3 py-2 text-sm dark:border-slate-800" />
        <div className="mt-3">
          <div className="mb-1 text-xs font-semibold text-slate-500">Models (max 6)</div>
          <div className="flex flex-wrap gap-2">
            {models.length === 0 && <span className="text-xs text-slate-400">No models — add some on the Models tab.</span>}
            {models.map((m) => {
              const on = selected.includes(m.id);
              return (
                <button key={m.id} disabled={!on && selected.length >= 6}
                  onClick={() => setSelected((s) => on ? s.filter((x) => x !== m.id) : [...s, m.id])}
                  className={`rounded-full px-3 py-1 text-xs font-medium disabled:opacity-40 ${on ? "bg-accent text-white" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"}`}>
                  {m.name}
                </button>
              );
            })}
          </div>
        </div>
        <div className="mt-3 flex justify-end">
          <PrimaryButton onClick={() => void run()} disabled={running || !prompt.trim() || selected.length === 0}>
            {running ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />} Run Compare
          </PrimaryButton>
        </div>
      </Card>

      {err && <Banner kind="error">{err}</Banner>}

      {results && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {results.map((r) => (
            <Card key={r.modelId}>
              <div className="mb-2 flex items-center justify-between">
                <span className="font-semibold">{r.label}</span>
                <span className={`text-xs ${r.ok ? "text-emerald-500" : "text-rose-500"}`}>{r.ok ? "ok" : "error"}</span>
              </div>
              <div className="mb-2 flex flex-wrap gap-3 text-xs text-slate-400">
                <span>{r.latencyMs}ms</span>
                <span>{r.tokensOut} out tok</span>
                <span>${r.costUsd.toFixed(5)}</span>
                <span>quality {Math.round(r.qualityScore * 100)}%</span>
              </div>
              <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-950 p-3 text-xs text-slate-100">
                {r.ok ? r.response : r.error}
              </pre>
            </Card>
          ))}
        </div>
      )}

      {!results && !err && (
        <div className="flex flex-col items-center justify-center py-12 text-center text-slate-400">
          <GitCompare size={32} className="mb-2" />
          <p className="text-sm">Pick models and run a prompt to compare.</p>
        </div>
      )}
    </div>
  );
}
