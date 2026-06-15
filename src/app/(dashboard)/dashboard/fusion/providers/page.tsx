"use client";

import { useState } from "react";
import { useProject } from "@/lib/store/project";
import { fusionApi, type ProviderRow } from "@/lib/client/fusion";
import { useFusion } from "@/components/fusion/useFusion";
import { PROVIDER_CATALOG } from "@/lib/ai/fusion/catalog";
import {
  PageHeader,
  LoadingState,
  Banner,
  EmptyState,
  StatusDot,
  PrimaryButton,
  GhostButton,
  Card,
} from "@/components/fusion/primitives";
import { Plug, Plus, Trash2, Activity, Loader2 } from "lucide-react";

export default function ProvidersPage() {
  const { activeWorkspace } = useProject();
  const ws = activeWorkspace?.id ?? "";
  const { data, loading, error, reload } = useFusion(() => fusionApi.listProviders(ws), [ws]);
  const [adding, setAdding] = useState(false);
  const [kind, setKind] = useState("openai");
  const [name, setName] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  if (!ws) return <Banner kind="error">Select a workspace.</Banner>;

  const add = async () => {
    setBusy("add");
    setErr(null);
    try {
      await fusionApi.createProvider(ws, { kind, name: name || PROVIDER_CATALOG.find((p) => p.kind === kind)!.label, baseUrl: baseUrl || undefined });
      setAdding(false);
      setName("");
      setBaseUrl("");
      reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(null);
    }
  };

  const test = async (p: ProviderRow) => {
    setBusy(p.id);
    try {
      await fusionApi.testProvider(ws, p.id);
      reload();
    } finally {
      setBusy(null);
    }
  };

  const remove = async (p: ProviderRow) => {
    setBusy(p.id);
    try {
      await fusionApi.deleteProvider(ws, p.id);
      reload();
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <PageHeader
        title="Providers"
        description="Connect AI providers. API keys are stored encrypted via Integrations."
        action={
          <PrimaryButton onClick={() => setAdding((v) => !v)}>
            <Plus size={16} /> Connect Provider
          </PrimaryButton>
        }
      />

      {err && <Banner kind="error">{err}</Banner>}

      {adding && (
        <Card className="mb-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500">Provider</label>
              <select value={kind} onChange={(e) => setKind(e.target.value)} className="w-full rounded-lg border border-slate-200 bg-transparent px-3 py-2 text-sm dark:border-slate-800">
                {PROVIDER_CATALOG.map((p) => (
                  <option key={p.kind} value={p.kind}>{p.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500">Display name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="optional" className="w-full rounded-lg border border-slate-200 bg-transparent px-3 py-2 text-sm dark:border-slate-800" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500">Base URL override</label>
              <input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="optional (custom/azure)" className="w-full rounded-lg border border-slate-200 bg-transparent px-3 py-2 text-sm dark:border-slate-800" />
            </div>
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <GhostButton onClick={() => setAdding(false)}>Cancel</GhostButton>
            <PrimaryButton onClick={() => void add()} disabled={busy === "add"}>
              {busy === "add" ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} Add
            </PrimaryButton>
          </div>
        </Card>
      )}

      {loading ? (
        <LoadingState />
      ) : error ? (
        <Banner kind="error">{error}</Banner>
      ) : !data || data.providers.length === 0 ? (
        <EmptyState icon={<Plug size={32} />} title="No providers connected" description="Connect OpenAI, Anthropic, OpenRouter, Groq and more to start routing." />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {data.providers.map((p) => (
            <Card key={p.id}>
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-semibold">{p.name}</div>
                  <div className="text-xs text-slate-400">{p.kind}{p._count ? ` · ${p._count.models} models` : ""}</div>
                </div>
                <button onClick={() => void remove(p)} className="rounded p-1 text-slate-400 hover:text-rose-500" title="Delete">
                  <Trash2 size={15} />
                </button>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <StatusDot status={p.lastStatus} />
                {p.lastLatencyMs != null && <span className="text-xs text-slate-400">{p.lastLatencyMs}ms</span>}
              </div>
              <div className="mt-3">
                <GhostButton onClick={() => void test(p)} disabled={busy === p.id}>
                  {busy === p.id ? <Loader2 size={13} className="animate-spin" /> : <Activity size={13} />} Test
                </GhostButton>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
