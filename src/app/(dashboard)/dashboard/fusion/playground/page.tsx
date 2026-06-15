"use client";

import { useState } from "react";
import { useProject } from "@/lib/store/project";
import { fusionApi, type Fusion, type FusionRunResult } from "@/lib/client/fusion";
import { useFusion } from "@/components/fusion/useFusion";
import { PageHeader, Banner, PrimaryButton, Card } from "@/components/fusion/primitives";
import { FlaskConical, Loader2, Play, Sparkles, AlertTriangle } from "lucide-react";

export default function PlaygroundPage() {
  const { activeWorkspace } = useProject();
  const ws = activeWorkspace?.id ?? "";
  const { data } = useFusion(() => fusionApi.listFusions(ws), [ws]);
  const fusions: Fusion[] = data?.fusions ?? [];

  const [fusionId, setFusionId] = useState("");
  const [prompt, setPrompt] = useState("");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<FusionRunResult | null>(null);
  const [err, setErr] = useState<string | null>(null);

  if (!ws) return <Banner kind="error">Select a workspace.</Banner>;

  const run = async () => {
    if (!fusionId || !prompt.trim()) return;
    setRunning(true); setErr(null); setResult(null);
    try {
      const r = await fusionApi.runPlayground(ws, fusionId, prompt);
      setResult(r.result);
    } catch (e) { setErr(e instanceof Error ? e.message : "Failed"); } finally { setRunning(false); }
  };

  return (
    <div>
      <PageHeader title="Playground" description="Test a Fusion before using it elsewhere." />

      <Card className="mb-4">
        <select value={fusionId} onChange={(e) => setFusionId(e.target.value)} className="mb-3 w-full rounded-lg border border-slate-200 bg-transparent px-3 py-2 text-sm dark:border-slate-800">
          <option value="">Select a Fusion…</option>
          {fusions.map((f) => <option key={f.id} value={f.id}>{f.name} ({f.strategy})</option>)}
        </select>
        <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={4} placeholder="Prompt…"
          className="w-full resize-y rounded-lg border border-slate-200 bg-transparent px-3 py-2 text-sm dark:border-slate-800" />
        <div className="mt-3 flex justify-end">
          <PrimaryButton onClick={() => void run()} disabled={running || !fusionId || !prompt.trim()}>
            {running ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />} Run Fusion
          </PrimaryButton>
        </div>
      </Card>

      {err && <Banner kind="error">{err}</Banner>}

      {!result && !err && (
        <div className="flex flex-col items-center justify-center py-12 text-center text-slate-400">
          <FlaskConical size={32} className="mb-2" />
          <p className="text-sm">Select a Fusion and run a prompt.</p>
        </div>
      )}

      {result && (
        <div className="space-y-4">
          {result.warnings.length > 0 && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-50/70 p-3 text-xs text-amber-700 dark:bg-amber-950/30 dark:text-amber-400">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              <div>{result.warnings.join(" · ")}</div>
            </div>
          )}

          <Card className="border-accent/30 dark:border-accent/40">
            <div className="mb-2 flex items-center gap-2">
              <Sparkles size={16} className="text-accent" />
              <h2 className="text-base font-bold">Fusion Result</h2>
              <span className="ml-auto text-xs text-slate-400">
                judge: {result.judgeUsed} · {result.metrics.tokens} tok · {(result.metrics.executionMs / 1000).toFixed(1)}s
              </span>
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
                  <span>{r.provider}</span><span>{r.latencyMs}ms</span><span>{r.tokensOut} out tok</span>
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
