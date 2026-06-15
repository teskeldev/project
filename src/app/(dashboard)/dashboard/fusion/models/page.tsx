"use client";

import { useState } from "react";
import { useProject } from "@/lib/store/project";
import { fusionApi, type ModelRow, type ProviderRow } from "@/lib/client/fusion";
import { useFusion } from "@/components/fusion/useFusion";
import { DEFAULT_CAPABILITIES } from "@/lib/ai/fusion/catalog";
import {
  PageHeader,
  LoadingState,
  Banner,
  EmptyState,
  PrimaryButton,
  GhostButton,
  Card,
} from "@/components/fusion/primitives";
import { Boxes, Plus, Trash2, Play, Loader2 } from "lucide-react";

const CAP_KEYS = ["reasoning", "vision", "tools", "structuredOutput", "jsonMode"] as const;

export default function ModelsPage() {
  const { activeWorkspace } = useProject();
  const ws = activeWorkspace?.id ?? "";
  const { data, loading, error, reload } = useFusion(
    () => Promise.all([fusionApi.listModels(ws), fusionApi.listProviders(ws)]),
    [ws]
  );
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({
    providerId: "",
    name: "",
    modelId: "",
    contextWindow: 128000,
    input: 0,
    output: 0,
    capabilities: { ...DEFAULT_CAPABILITIES } as Record<string, boolean>,
  });
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [probe, setProbe] = useState<Record<string, string>>({});

  if (!ws) return <Banner kind="error">Select a workspace.</Banner>;

  const models: ModelRow[] = data?.[0]?.models ?? [];
  const providers: ProviderRow[] = data?.[1]?.providers ?? [];

  const add = async () => {
    setBusy("add");
    setErr(null);
    try {
      await fusionApi.createModel(ws, {
        providerId: form.providerId || providers[0]?.id,
        name: form.name,
        modelId: form.modelId,
        contextWindow: form.contextWindow,
        pricing: { input: form.input, output: form.output },
        capabilities: form.capabilities,
      });
      setAdding(false);
      setForm({ ...form, name: "", modelId: "" });
      reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(null);
    }
  };

  const test = async (m: ModelRow) => {
    setBusy(m.id);
    try {
      const r = await fusionApi.testModel(ws, m.id);
      setProbe((p) => ({ ...p, [m.id]: r.ok ? `OK ${r.latencyMs}ms` : `Error: ${r.error?.slice(0, 60)}` }));
    } finally {
      setBusy(null);
    }
  };

  const remove = async (m: ModelRow) => {
    setBusy(m.id);
    try {
      await fusionApi.deleteModel(ws, m.id);
      reload();
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <PageHeader
        title="Models"
        description="Register the models available across your providers."
        action={
          <PrimaryButton onClick={() => setAdding((v) => !v)} disabled={providers.length === 0}>
            <Plus size={16} /> Add Model
          </PrimaryButton>
        }
      />

      {providers.length === 0 && !loading && (
        <Banner kind="error">Connect a provider first on the Providers tab.</Banner>
      )}
      {err && <Banner kind="error">{err}</Banner>}

      {adding && (
        <Card className="mb-4 space-y-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Field label="Provider">
              <select value={form.providerId} onChange={(e) => setForm({ ...form, providerId: e.target.value })} className="input">
                {providers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </Field>
            <Field label="Display name"><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="GPT-5.5" /></Field>
            <Field label="Model ID"><input className="input" value={form.modelId} onChange={(e) => setForm({ ...form, modelId: e.target.value })} placeholder="gpt-4o" /></Field>
            <Field label="Context window"><input type="number" className="input" value={form.contextWindow} onChange={(e) => setForm({ ...form, contextWindow: +e.target.value })} /></Field>
            <Field label="Price in ($/1M)"><input type="number" className="input" value={form.input} onChange={(e) => setForm({ ...form, input: +e.target.value })} /></Field>
            <Field label="Price out ($/1M)"><input type="number" className="input" value={form.output} onChange={(e) => setForm({ ...form, output: +e.target.value })} /></Field>
          </div>
          <div className="flex flex-wrap gap-3">
            {CAP_KEYS.map((c) => (
              <label key={c} className="flex items-center gap-1.5 text-xs">
                <input type="checkbox" checked={form.capabilities[c]} onChange={(e) => setForm({ ...form, capabilities: { ...form.capabilities, [c]: e.target.checked } })} />
                {c}
              </label>
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <GhostButton onClick={() => setAdding(false)}>Cancel</GhostButton>
            <PrimaryButton onClick={() => void add()} disabled={busy === "add" || !form.modelId}>
              {busy === "add" ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} Save
            </PrimaryButton>
          </div>
        </Card>
      )}

      {loading ? (
        <LoadingState />
      ) : error ? (
        <Banner kind="error">{error}</Banner>
      ) : models.length === 0 ? (
        <EmptyState icon={<Boxes size={32} />} title="No models registered" description="Add models from your connected providers." />
      ) : (
        <Card className="!p-0">
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {models.map((m) => (
              <div key={m.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <div className="font-semibold">{m.name} <span className="ml-1 text-xs font-normal text-slate-400">{m.provider?.kind}</span></div>
                  <div className="text-xs text-slate-400">{m.modelId} · {m.contextWindow.toLocaleString()} ctx · ${m.pricing.input}/${m.pricing.output} per 1M</div>
                </div>
                <div className="flex items-center gap-3">
                  {probe[m.id] && <span className="text-xs text-slate-400">{probe[m.id]}</span>}
                  <div className="flex flex-wrap gap-1">
                    {CAP_KEYS.filter((c) => m.capabilities[c]).map((c) => (
                      <span key={c} className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 dark:bg-slate-800">{c}</span>
                    ))}
                  </div>
                  <GhostButton onClick={() => void test(m)} disabled={busy === m.id}>
                    {busy === m.id ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />} Test
                  </GhostButton>
                  <button onClick={() => void remove(m)} className="rounded p-1 text-slate-400 hover:text-rose-500"><Trash2 size={15} /></button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <style jsx>{`
        :global(.input) {
          width: 100%;
          border-radius: 0.5rem;
          border: 1px solid rgb(226 232 240);
          background: transparent;
          padding: 0.5rem 0.75rem;
          font-size: 0.875rem;
        }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-slate-500">{label}</label>
      {children}
    </div>
  );
}
