"use client";

import { useState } from "react";
import { runPlaygroundStream, type FusionRunResult } from "@/lib/client/fusion";
import { Banner, PrimaryButton, Card } from "@/components/fusion/primitives";
import { Loader2, Play, Sparkles, AlertTriangle, FlaskConical, ChevronDown, CheckCircle2, XCircle, Gavel } from "lucide-react";

type LiveModel = { modelId: string; status: "running" | "ok" | "error"; latencyMs?: number };

/** Contextual Playground for a single saved Fusion (Builder "Test" tab) with live "thinking". */
export function FusionTester({ workspaceId, fusionId }: { workspaceId: string; fusionId: string }) {
  const [prompt, setPrompt] = useState("");
  const [running, setRunning] = useState(false);
  const [live, setLive] = useState<Record<string, LiveModel>>({});
  const [judging, setJudging] = useState(false);
  const [result, setResult] = useState<FusionRunResult | null>(null);
  const [showRationale, setShowRationale] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const run = async () => {
    if (!prompt.trim()) return;
    setRunning(true); setErr(null); setResult(null); setLive({}); setJudging(false); setShowRationale(false);
    await runPlaygroundStream(workspaceId, fusionId, prompt, {
      onProgress: (ev) => {
        if (ev.type === "model_start") {
          setLive((m) => ({ ...m, [ev.ref]: { modelId: ev.modelId, status: "running" } }));
        } else if (ev.type === "model_done") {
          setLive((m) => ({ ...m, [ev.ref]: { modelId: ev.modelId, status: ev.ok ? "ok" : "error", latencyMs: ev.latencyMs } }));
        } else if (ev.type === "judging") {
          setJudging(true);
        }
      },
      onResult: (r) => { setResult(r); setRunning(false); setJudging(false); },
      onError: (m) => { setErr(m); setRunning(false); setJudging(false); },
    });
  };

  const liveList = Object.values(live);

  return (
    <div>
      <Card className="mb-4">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={4}
          placeholder="Prompt to test this Fusion…"
          className="w-full resize-y rounded-lg border border-slate-200 bg-transparent px-3 py-2 text-sm dark:border-slate-800"
        />
        <div className="mt-3 flex justify-end">
          <PrimaryButton onClick={() => void run()} disabled={running || !prompt.trim()}>
            {running ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />} Run
          </PrimaryButton>
        </div>
      </Card>

      {err && <Banner kind="error">{err}</Banner>}

      {/* Live "thinking" panel */}
      {(running || liveList.length > 0) && !result && (
        <Card className="mb-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <Sparkles size={15} className="text-accent" /> Thinking…
          </div>
          <div className="flex flex-wrap gap-2">
            {liveList.map((m) => (
              <span
                key={m.modelId}
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                  m.status === "ok"
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                    : m.status === "error"
                      ? "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400"
                      : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                }`}
              >
                {m.status === "running" ? <Loader2 size={12} className="animate-spin" /> : m.status === "ok" ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                {m.modelId}
                {m.latencyMs != null && <span className="opacity-70">{m.latencyMs}ms</span>}
              </span>
            ))}
          </div>
          {judging && (
            <div className="mt-2 inline-flex items-center gap-1.5 text-xs text-slate-500">
              <Gavel size={12} /> Judge synthesizing…
            </div>
          )}
        </Card>
      )}

      {!result && !err && !running && liveList.length === 0 && (
        <div className="flex flex-col items-center justify-center py-10 text-center text-slate-400">
          <FlaskConical size={28} className="mb-2" />
          <p className="text-sm">Run a prompt to test this Fusion.</p>
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
              <h3 className="text-base font-bold">Fusion Result</h3>
              <span className="ml-auto text-xs text-slate-400">
                judge: {result.judgeUsed} · {result.metrics.tokens} tok · {(result.metrics.executionMs / 1000).toFixed(1)}s
              </span>
            </div>
            <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-950 p-3 text-xs text-slate-100">{result.fused}</pre>
            {result.mergeRationale && (
              <div className="mt-3">
                <button onClick={() => setShowRationale((v) => !v)} className="flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-accent">
                  <ChevronDown size={13} className={showRationale ? "rotate-180 transition-transform" : "transition-transform"} /> Merge rationale
                </button>
                {showRationale && <p className="mt-1 whitespace-pre-wrap text-xs text-slate-600 dark:text-slate-400">{result.mergeRationale}</p>}
              </div>
            )}
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
