"use client";

import { useState } from "react";
import { useProject } from "@/lib/store/project";
import { fusionApi, type McpRow } from "@/lib/client/fusion";
import { useFusion } from "@/components/fusion/useFusion";
import { MCP_KINDS } from "@/lib/ai/fusion/catalog";
import { PageHeader, LoadingState, Banner, EmptyState, StatusDot, PrimaryButton, GhostButton, Card } from "@/components/fusion/primitives";
import { Server, Plus, Trash2, Activity, Loader2 } from "lucide-react";

export default function McpPage() {
  const { activeWorkspace } = useProject();
  const ws = activeWorkspace?.id ?? "";
  const { data, loading, error, reload } = useFusion(() => fusionApi.listMcp(ws), [ws]);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<string>("filesystem");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  if (!ws) return <Banner kind="error">Select a workspace.</Banner>;
  const servers: McpRow[] = data?.servers ?? [];

  const add = async () => {
    setBusy("add"); setErr(null);
    try {
      await fusionApi.createMcp(ws, { name, kind, url: url || undefined });
      setAdding(false); setName(""); setUrl("");
      reload();
    } catch (e) { setErr(e instanceof Error ? e.message : "Failed"); } finally { setBusy(null); }
  };
  const check = async (s: McpRow) => { setBusy(s.id); try { await fusionApi.healthMcp(ws, s.id); reload(); } finally { setBusy(null); } };
  const remove = async (s: McpRow) => { setBusy(s.id); try { await fusionApi.deleteMcp(ws, s.id); reload(); } finally { setBusy(null); } };

  return (
    <div>
      <PageHeader title="MCP" description="Connect Model Context Protocol servers (filesystem, GitHub, Postgres, Notion…)."
        action={<PrimaryButton onClick={() => setAdding((v) => !v)}><Plus size={16} /> Connect Server</PrimaryButton>} />
      {err && <Banner kind="error">{err}</Banner>}

      {adding && (
        <Card className="mb-4 space-y-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <select value={kind} onChange={(e) => setKind(e.target.value)} className="w-full rounded-lg border border-slate-200 bg-transparent px-3 py-2 text-sm dark:border-slate-800">
              {MCP_KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
            <input className="w-full rounded-lg border border-slate-200 bg-transparent px-3 py-2 text-sm dark:border-slate-800" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
            <input className="w-full rounded-lg border border-slate-200 bg-transparent px-3 py-2 text-sm dark:border-slate-800" placeholder="URL (https://…) optional" value={url} onChange={(e) => setUrl(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2">
            <GhostButton onClick={() => setAdding(false)}>Cancel</GhostButton>
            <PrimaryButton onClick={() => void add()} disabled={busy === "add" || !name}>{busy === "add" ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} Save</PrimaryButton>
          </div>
        </Card>
      )}

      {loading ? <LoadingState /> : error ? <Banner kind="error">{error}</Banner> : servers.length === 0 ? (
        <EmptyState icon={<Server size={32} />} title="No MCP servers" description="Connect tools your models can call." />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {servers.map((s) => (
            <Card key={s.id}>
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-semibold">{s.name}</div>
                  <div className="text-xs text-slate-400">{s.kind}</div>
                </div>
                <button onClick={() => void remove(s)} className="rounded p-1 text-slate-400 hover:text-rose-500"><Trash2 size={15} /></button>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <StatusDot status={s.lastStatus} />
                <GhostButton onClick={() => void check(s)} disabled={busy === s.id}>
                  {busy === s.id ? <Loader2 size={13} className="animate-spin" /> : <Activity size={13} />} Health
                </GhostButton>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
