"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useProject } from "@/lib/store/project";
import { apiFetch } from "@/lib/client/api";
import { fusionApi, type AvailableModel, type Fusion } from "@/lib/client/fusion";
import { FUSION_STRATEGIES, JUDGE_OPTIONS, DEFAULT_LIMITS } from "@/lib/ai/fusion/catalog";
import Link from "next/link";
import { LoadingState, Banner, PrimaryButton, Card } from "@/components/fusion/primitives";
import { FusionTester } from "@/components/fusion/FusionTester";
import { Save, Loader2, AlertTriangle, ArrowLeft, Plus, X } from "lucide-react";

type NamedRow = { id: string; label: string };

function BuilderInner() {
  const router = useRouter();
  const params = useSearchParams();
  const editId = params.get("id");
  const { activeWorkspace } = useProject();
  const ws = activeWorkspace?.id ?? "";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [tab, setTab] = useState<"configure" | "test">("configure");

  const [models, setModels] = useState<AvailableModel[]>([]);
  const [skills, setSkills] = useState<NamedRow[]>([]);
  const [rules, setRules] = useState<NamedRow[]>([]);
  const [knowledge, setKnowledge] = useState<NamedRow[]>([]);

  const [form, setForm] = useState<Partial<Fusion>>({
    name: "", description: "", modelIds: [], skillIds: [], ruleIds: [], knowledgeIds: [],
    strategy: "single", judge: "auto", limits: { ...DEFAULT_LIMITS },
  });

  useEffect(() => {
    if (!ws) return;
    (async () => {
      try {
        const [m, s, r, k] = await Promise.all([
          fusionApi.listModels(ws),
          apiFetch<{ skills: { id: string; name: string }[] }>(`/api/skills?workspaceId=${ws}`).catch(() => ({ skills: [] })),
          apiFetch<{ rules: { id: string; title: string }[] }>(`/api/rules?workspaceId=${ws}`).catch(() => ({ rules: [] })),
          apiFetch<{ items: { id: string; title: string }[] }>(`/api/knowledge?workspaceId=${ws}`).catch(() => ({ items: [] })),
        ]);
        setModels(m.models);
        setSkills(s.skills.map((x) => ({ id: x.id, label: x.name })));
        setRules(r.rules.map((x) => ({ id: x.id, label: x.title })));
        setKnowledge(k.items.map((x) => ({ id: x.id, label: x.title })));
        if (editId) {
          const { fusion } = await fusionApi.getFusion(ws, editId);
          setForm(fusion);
        }
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    })();
  }, [ws, editId]);

  if (!ws) return <Banner kind="error">Select a workspace.</Banner>;
  if (loading) return <LoadingState />;

  const patch = (f: Partial<Fusion>) => setForm((prev) => ({ ...prev, ...f }));

  const availableRefs = new Set(models.map((m) => m.ref));
  const missingModels = (form.modelIds ?? []).filter((r) => !availableRefs.has(r));

  const save = async () => {
    if (!form.name?.trim()) { setErr("Name is required"); return; }
    setSaving(true); setErr(null);
    const payload = {
      name: form.name, description: form.description ?? null,
      modelIds: form.modelIds ?? [], skillIds: form.skillIds ?? [],
      ruleIds: form.ruleIds ?? [], knowledgeIds: form.knowledgeIds ?? [],
      strategy: form.strategy, judge: form.judge, limits: form.limits,
    };
    try {
      if (editId) await fusionApi.updateFusion(ws, editId, payload);
      else await fusionApi.createFusion(ws, payload);
      router.push("/dashboard/fusion/library");
    } catch (e) { setErr(e instanceof Error ? e.message : "Failed to save"); setSaving(false); }
  };

  const limits = form.limits ?? DEFAULT_LIMITS;

  return (
    <div>
      {/* Breadcrumb header (drill-in detail; no second sidebar) */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <Link href="/dashboard/fusion/library" className="mb-1 inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-accent">
            <ArrowLeft size={13} /> Library
          </Link>
          <h1 className="truncate text-2xl font-bold tracking-tight">
            {form.name?.trim() || (editId ? "Fusion" : "New Fusion")}
          </h1>
        </div>
        <PrimaryButton onClick={() => void save()} disabled={saving}>
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Save
        </PrimaryButton>
      </div>

      {/* Configure / Test tabs */}
      <div className="mb-5 inline-flex rounded-xl border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-slate-900/60">
        {(["configure", "test"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-lg px-4 py-1.5 text-sm font-medium capitalize transition-colors ${
              tab === t ? "bg-accent text-white shadow-sm" : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {err && <Banner kind="error">{err}</Banner>}

      {tab === "test" ? (
        editId ? (
          <FusionTester workspaceId={ws} fusionId={editId} />
        ) : (
          <Card><p className="py-8 text-center text-sm text-slate-400">Save this Fusion first to test it.</p></Card>
        )
      ) : (
      <div className="space-y-4">
        <Card>
          <h2 className="mb-3 text-sm font-bold">Basic</h2>
          <input className="mb-3 w-full rounded-lg border border-slate-200 bg-transparent px-3 py-2 text-sm dark:border-slate-800" placeholder="Fusion name (e.g. Senior Fullstack)" value={form.name ?? ""} onChange={(e) => patch({ name: e.target.value })} />
          <input className="w-full rounded-lg border border-slate-200 bg-transparent px-3 py-2 text-sm dark:border-slate-800" placeholder="Description (optional)" value={form.description ?? ""} onChange={(e) => patch({ description: e.target.value })} />
        </Card>

        <AddRemovePicker
          title="Models"
          addLabel="Add model"
          hint="From your connected providers (Integrations)."
          empty="No connected models — add a provider in Integrations."
          items={models.map((m) => ({ id: m.ref, label: `${m.name} · ${m.providerLabel}` }))}
          selected={form.modelIds ?? []}
          onChange={(next) => patch({ modelIds: next })}
        />
        {missingModels.length > 0 && (
          <div className="-mt-2 flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
            <AlertTriangle size={12} /> Unavailable, will be skipped: {missingModels.join(", ")}
          </div>
        )}

        <AddRemovePicker title="Skills" addLabel="Add skill" empty="No installed skills." items={skills} selected={form.skillIds ?? []} onChange={(next) => patch({ skillIds: next })} />
        <AddRemovePicker title="Rules" addLabel="Add rule" empty="No rules." items={rules} selected={form.ruleIds ?? []} onChange={(next) => patch({ ruleIds: next })} />
        <AddRemovePicker title="Knowledge" addLabel="Add knowledge" empty="No knowledge items." items={knowledge} selected={form.knowledgeIds ?? []} onChange={(next) => patch({ knowledgeIds: next })} />

        <Card>
          <h2 className="mb-3 text-sm font-bold">Execution</h2>
          <div className="mb-3">
            <div className="mb-1 text-xs font-semibold text-slate-500">Strategy</div>
            <div className="flex flex-wrap gap-2">
              {FUSION_STRATEGIES.map((s) => (
                <button key={s} onClick={() => patch({ strategy: s })} className={`rounded-full px-3 py-1 text-xs font-medium ${form.strategy === s ? "bg-accent text-white" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"}`}>{s}</button>
              ))}
            </div>
            {form.strategy === "single" && <p className="mt-1 text-xs text-slate-400">Single uses one model — judge is not applied.</p>}
          </div>
          {form.strategy !== "single" && (
            <div className="mb-3">
              <div className="mb-1 text-xs font-semibold text-slate-500">Judge</div>
              <select value={form.judge} onChange={(e) => patch({ judge: e.target.value })} className="w-full rounded-lg border border-slate-200 bg-transparent px-3 py-2 text-sm dark:border-slate-800">
                {JUDGE_OPTIONS.map((j) => <option key={j} value={j}>{j === "auto" ? "Auto (Claude → GPT → Gemini)" : j}</option>)}
              </select>
            </div>
          )}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <LimitField label="Max Cost (USD)" value={limits.maxCostUsd} onChange={(v) => patch({ limits: { ...limits, maxCostUsd: v } })} />
            <LimitField label="Max Tokens" value={limits.maxTokens} onChange={(v) => patch({ limits: { ...limits, maxTokens: v } })} />
            <LimitField label="Timeout (ms)" value={limits.timeoutMs} onChange={(v) => patch({ limits: { ...limits, timeoutMs: v } })} />
          </div>
          <p className="mt-2 text-xs text-slate-400">Limits are best-effort operational targets — they don&rsquo;t guarantee precise mid-stream cutoff.</p>
        </Card>
      </div>
      )}
    </div>
  );
}

/**
 * Add/remove picker: shows the selected items as removable chips + a "＋ Add"
 * button that opens a searchable list of the not-yet-selected available items.
 */
function AddRemovePicker({
  title,
  addLabel,
  hint,
  empty,
  items,
  selected,
  onChange,
}: {
  title: string;
  addLabel: string;
  hint?: string;
  empty: string;
  items: NamedRow[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const labelOf = new Map(items.map((i) => [i.id, i.label]));
  const available = items.filter(
    (i) => !selected.includes(i.id) && i.label.toLowerCase().includes(q.toLowerCase())
  );

  const add = (id: string) => onChange([...selected, id]);
  const remove = (id: string) => onChange(selected.filter((x) => x !== id));

  return (
    <Card>
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold">{title}</h2>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          disabled={items.length === 0}
          className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-100 disabled:opacity-40 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800/50"
        >
          <Plus size={13} /> {addLabel}
        </button>
      </div>
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}

      {/* Selected chips */}
      {selected.length === 0 ? (
        <p className="mt-2 text-xs text-slate-400">{items.length === 0 ? empty : "Nothing added yet — click ＋."}</p>
      ) : (
        <div className="mt-2 flex flex-wrap gap-2">
          {selected.map((id) => (
            <span key={id} className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-2.5 py-1 text-xs font-medium text-accent">
              {labelOf.get(id) ?? id}
              <button type="button" onClick={() => remove(id)} className="hover:text-rose-500" aria-label="Remove">
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Add panel */}
      {open && items.length > 0 && (
        <div className="mt-3 rounded-lg border border-slate-200 dark:border-slate-800">
          <div className="border-b border-slate-100 p-2 dark:border-slate-800/60">
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={`Search to ${addLabel.toLowerCase()}…`}
              className="w-full rounded-md border border-slate-200 bg-transparent px-2.5 py-1.5 text-xs focus:border-accent focus:outline-none dark:border-slate-800"
            />
          </div>
          <div className="max-h-48 overflow-auto py-1">
            {available.length === 0 ? (
              <p className="px-3 py-2 text-xs text-slate-400">{q ? "No matches." : "All added."}</p>
            ) : (
              available.map((it) => (
                <button
                  key={it.id}
                  type="button"
                  onClick={() => add(it.id)}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-slate-50 dark:hover:bg-slate-800/40"
                >
                  <Plus size={12} className="text-slate-400" /> {it.label}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </Card>
  );
}

function LimitField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-slate-500">{label}</label>
      <input type="number" value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full rounded-lg border border-slate-200 bg-transparent px-3 py-2 text-sm dark:border-slate-800" />
    </div>
  );
}

export default function BuilderPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <BuilderInner />
    </Suspense>
  );
}
