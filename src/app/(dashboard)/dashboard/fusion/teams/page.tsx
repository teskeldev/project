"use client";

import { useState } from "react";
import { useProject } from "@/lib/store/project";
import { fusionApi, type TeamRow, type ModelRow } from "@/lib/client/fusion";
import { useFusion } from "@/components/fusion/useFusion";
import { PageHeader, LoadingState, Banner, EmptyState, PrimaryButton, GhostButton, Card } from "@/components/fusion/primitives";
import { Users, Plus, Trash2, Loader2 } from "lucide-react";

export default function TeamsPage() {
  const { activeWorkspace } = useProject();
  const ws = activeWorkspace?.id ?? "";
  const { data, loading, error, reload } = useFusion(
    () => Promise.all([fusionApi.listTeams(ws), fusionApi.listModels(ws)]),
    [ws]
  );
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [modelIds, setModelIds] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  if (!ws) return <Banner kind="error">Select a workspace.</Banner>;
  const teams: TeamRow[] = data?.[0]?.teams ?? [];
  const models: ModelRow[] = data?.[1]?.models ?? [];
  const modelName = (id: string) => models.find((m) => m.id === id)?.name ?? id;

  const add = async () => {
    setBusy("add");
    setErr(null);
    try {
      await fusionApi.createTeam(ws, { name, description: description || undefined, modelIds });
      setAdding(false);
      setName(""); setDescription(""); setModelIds([]);
      reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(null);
    }
  };
  const remove = async (t: TeamRow) => { setBusy(t.id); try { await fusionApi.deleteTeam(ws, t.id); reload(); } finally { setBusy(null); } };

  return (
    <div>
      <PageHeader title="Teams" description="Group models into reusable teams (e.g. Coding, Research, Security)."
        action={<PrimaryButton onClick={() => setAdding((v) => !v)}><Plus size={16} /> New Team</PrimaryButton>} />
      {err && <Banner kind="error">{err}</Banner>}

      {adding && (
        <Card className="mb-4 space-y-3">
          <input className="w-full rounded-lg border border-slate-200 bg-transparent px-3 py-2 text-sm dark:border-slate-800" placeholder="Team name" value={name} onChange={(e) => setName(e.target.value)} />
          <input className="w-full rounded-lg border border-slate-200 bg-transparent px-3 py-2 text-sm dark:border-slate-800" placeholder="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} />
          <div>
            <div className="mb-1 text-xs font-semibold text-slate-500">Members</div>
            <div className="flex flex-wrap gap-2">
              {models.length === 0 && <span className="text-xs text-slate-400">No models — add some on the Models tab.</span>}
              {models.map((m) => {
                const on = modelIds.includes(m.id);
                return (
                  <button key={m.id} onClick={() => setModelIds((s) => on ? s.filter((x) => x !== m.id) : [...s, m.id])}
                    className={`rounded-full px-3 py-1 text-xs font-medium ${on ? "bg-accent text-white" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"}`}>
                    {m.name}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <GhostButton onClick={() => setAdding(false)}>Cancel</GhostButton>
            <PrimaryButton onClick={() => void add()} disabled={busy === "add" || !name}>{busy === "add" ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} Save</PrimaryButton>
          </div>
        </Card>
      )}

      {loading ? <LoadingState /> : error ? <Banner kind="error">{error}</Banner> : teams.length === 0 ? (
        <EmptyState icon={<Users size={32} />} title="No teams yet" description="Create model teams to power profiles and routing." />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {teams.map((t) => (
            <Card key={t.id}>
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-semibold">{t.name}</div>
                  {t.description && <div className="text-xs text-slate-400">{t.description}</div>}
                </div>
                <button onClick={() => void remove(t)} className="rounded p-1 text-slate-400 hover:text-rose-500"><Trash2 size={15} /></button>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {t.modelIds.map((id) => <span key={id} className="rounded bg-slate-100 px-2 py-0.5 text-xs dark:bg-slate-800">{modelName(id)}</span>)}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
