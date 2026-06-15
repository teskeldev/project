"use client";

import { useState } from "react";
import { useProject } from "@/lib/store/project";
import { fusionApi, type JudgeRow, type ModelRow } from "@/lib/client/fusion";
import { useFusion } from "@/components/fusion/useFusion";
import { JUDGE_MODES } from "@/lib/ai/fusion/catalog";
import { PageHeader, LoadingState, Banner, EmptyState, PrimaryButton, GhostButton, Card } from "@/components/fusion/primitives";
import { Gavel, Plus, Trash2, Loader2 } from "lucide-react";

export default function JudgesPage() {
  const { activeWorkspace } = useProject();
  const ws = activeWorkspace?.id ?? "";
  const { data, loading, error, reload } = useFusion(
    () => Promise.all([fusionApi.listJudges(ws), fusionApi.listModels(ws)]),
    [ws]
  );
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [mode, setMode] = useState<string>("consensus");
  const [judgeModelId, setJudgeModelId] = useState("");
  const [threshold, setThreshold] = useState(0.7);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  if (!ws) return <Banner kind="error">Select a workspace.</Banner>;
  const judges: JudgeRow[] = data?.[0]?.judges ?? [];
  const models: ModelRow[] = data?.[1]?.models ?? [];

  const add = async () => {
    setBusy("add"); setErr(null);
    try {
      await fusionApi.createJudge(ws, { name, mode, judgeModelId: judgeModelId || undefined, config: { confidenceThreshold: threshold } });
      setAdding(false); setName(""); setJudgeModelId("");
      reload();
    } catch (e) { setErr(e instanceof Error ? e.message : "Failed"); } finally { setBusy(null); }
  };
  const remove = async (j: JudgeRow) => { setBusy(j.id); try { await fusionApi.deleteJudge(ws, j.id); reload(); } finally { setBusy(null); } };

  return (
    <div>
      <PageHeader title="Judges" description="How multiple model answers are reconciled into one."
        action={<PrimaryButton onClick={() => setAdding((v) => !v)}><Plus size={16} /> New Judge</PrimaryButton>} />
      {err && <Banner kind="error">{err}</Banner>}

      {adding && (
        <Card className="mb-4 space-y-3">
          <input className="w-full rounded-lg border border-slate-200 bg-transparent px-3 py-2 text-sm dark:border-slate-800" placeholder="Judge name" value={name} onChange={(e) => setName(e.target.value)} />
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <select value={mode} onChange={(e) => setMode(e.target.value)} className="w-full rounded-lg border border-slate-200 bg-transparent px-3 py-2 text-sm dark:border-slate-800">
              {JUDGE_MODES.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
            <select value={judgeModelId} onChange={(e) => setJudgeModelId(e.target.value)} className="w-full rounded-lg border border-slate-200 bg-transparent px-3 py-2 text-sm dark:border-slate-800">
              <option value="">Judge model (default: Opus 4.8)</option>
              {models.map((m) => <option key={m.id} value={m.modelId}>{m.name}</option>)}
            </select>
          </div>
          <label className="block text-xs text-slate-500">Confidence threshold ({threshold.toFixed(2)})
            <input type="range" min="0" max="1" step="0.05" value={threshold} onChange={(e) => setThreshold(+e.target.value)} className="mt-1 w-full accent-accent" />
          </label>
          <div className="flex justify-end gap-2">
            <GhostButton onClick={() => setAdding(false)}>Cancel</GhostButton>
            <PrimaryButton onClick={() => void add()} disabled={busy === "add" || !name}>{busy === "add" ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} Save</PrimaryButton>
          </div>
        </Card>
      )}

      {loading ? <LoadingState /> : error ? <Banner kind="error">{error}</Banner> : judges.length === 0 ? (
        <EmptyState icon={<Gavel size={32} />} title="No judges configured" description="Add consensus, majority-vote, debate, tournament, or merge judges." />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {judges.map((j) => (
            <Card key={j.id}>
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-semibold">{j.name}</div>
                  <div className="text-xs text-slate-400">mode: {j.mode}{j.judgeModelId ? ` · ${j.judgeModelId}` : ""}</div>
                </div>
                <button onClick={() => void remove(j)} className="rounded p-1 text-slate-400 hover:text-rose-500"><Trash2 size={15} /></button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
