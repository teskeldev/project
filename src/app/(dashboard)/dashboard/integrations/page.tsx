"use client";

import { Suspense, useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Search, Check, X, Loader2, AlertCircle, Lock,
  ChevronDown, ChevronUp, ExternalLink, Shield,
  ArrowRight, PlayCircle, Plus, Trash2, Tag,
  ArrowRightLeft, Layers, Copy,
  Terminal,
} from "lucide-react";
import { useProject } from "@/lib/store/project";
import { ApiClientError } from "@/lib/client/api";
import { listIntegrations, type SafeIntegration } from "@/lib/client/integrations";
import {
  PROVIDER_CATALOG,
  COMING_SOON_PROVIDERS,
  type ProviderMeta,
  type ComingSoonProvider,
} from "@/lib/integrations/providers";
import { AI_PROVIDER_REGISTRY } from "@/lib/ai/provider-registry";

type IntegrationsTab = "providers" | "routing" | "aliases" | "setup";

/* ========================================================================== */
/* Shared helpers                                                               */
/* ========================================================================== */

function ProviderBadge({ icon, color, size = 10 }: { icon: string; color?: string; size?: number }) {
  return (
    <div
      className="flex items-center justify-center rounded-lg font-bold text-white shrink-0"
      style={{
        backgroundColor: color ?? "#64748b",
        width: size * 4,
        height: size * 4,
        fontSize: Math.max(9, size * 1.1),
        minWidth: size * 4,
      }}
    >
      {icon}
    </div>
  );
}

/* ========================================================================== */
/* PROVIDERS TAB                                                                */
/* ========================================================================== */

function ProviderCard({ meta, connections }: { meta: ProviderMeta; connections: SafeIntegration[] }) {
  const entry = AI_PROVIDER_REGISTRY.find((p) => p.id === meta.id);
  const isLocal = entry?.local ?? false;
  const activeCount = connections.filter((c) => c.enabled).length;
  const isConnected = connections.length > 0;
  return (
    <Link
      href={`/dashboard/integrations/${encodeURIComponent(meta.id)}`}
      className="group relative flex flex-col rounded-xl border border-border bg-surface p-4 transition-all hover:shadow-md hover:border-accent/30 hover:-translate-y-px"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <ProviderBadge icon={meta.icon} color={meta.color} size={9} />
          <div className="min-w-0">
            <h3 className="truncate text-[13px] font-semibold text-foreground group-hover:text-accent transition-colors">
              {meta.name}
            </h3>
            <div className="flex items-center gap-1 mt-0.5">
              {isLocal ? (
                <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">Free</span>
              ) : meta.authType === "oauth" ? (
                <span className="flex items-center gap-0.5 rounded-full bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">
                  <Shield size={8} />OAuth
                </span>
              ) : (
                <span className="text-[10px] text-text-muted">{meta.category}</span>
              )}
            </div>
          </div>
        </div>
        {isConnected ? (
          <span className="shrink-0 flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-semibold text-green-700">
            <Check size={9} />{activeCount > 1 ? `${activeCount}` : ""}
          </span>
        ) : (
          <ArrowRight size={14} className="shrink-0 text-text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
        )}
      </div>
      <p className="mt-2.5 text-[12px] leading-relaxed text-text-muted line-clamp-2 flex-1">{meta.description}</p>
      {meta.website && !isConnected ? (
        <span className="mt-2 inline-flex items-center gap-1 text-[11px] text-text-muted">
          <ExternalLink size={10} />{meta.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
        </span>
      ) : null}
      {isConnected ? (
        <span className="mt-2.5 text-[11px] text-text-muted">
          {connections.length} connection{connections.length > 1 ? "s" : ""} · click to manage
        </span>
      ) : null}
    </Link>
  );
}

function ComingSoonCard({ p }: { p: ComingSoonProvider }) {
  return (
    <div className="rounded-xl border border-border/50 bg-surface/60 p-4 opacity-70">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <ProviderBadge icon={p.icon} color={p.color} size={9} />
          <div className="min-w-0">
            <h3 className="truncate text-[13px] font-semibold text-text-secondary">{p.name}</h3>
            <div className="flex items-center gap-1 mt-0.5">
              {p.authType === "oauth" ? (
                <span className="flex items-center gap-0.5 rounded-full bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">
                  <Lock size={8} />OAuth
                </span>
              ) : null}
            </div>
          </div>
        </div>
        <span className="shrink-0 rounded-full bg-surface-soft px-2 py-0.5 text-[10px] font-medium text-text-muted">Soon</span>
      </div>
      <p className="mt-2.5 text-[12px] leading-relaxed text-text-muted line-clamp-2">{p.description}</p>
    </div>
  );
}

function SectionHeader({ title, count, connectedCount }: { title: string; count: number; connectedCount?: number }) {
  return (
    <div className="flex items-center gap-3">
      <h2 className="text-[13px] font-bold uppercase tracking-widest text-text-muted">{title}</h2>
      <div className="h-px flex-1 bg-border" />
      <div className="flex items-center gap-2">
        {connectedCount !== undefined && connectedCount > 0 ? (
          <span className="flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-[11px] font-semibold text-green-700">
            <Check size={10} />{connectedCount} connected
          </span>
        ) : null}
        <span className="rounded-full bg-surface-soft px-2 py-0.5 text-[11px] font-medium text-text-muted">{count}</span>
      </div>
    </div>
  );
}

const INITIAL_VISIBLE = 20;

function ProviderSection({ title, providers, connectionsByProvider }: {
  title: string;
  providers: ProviderMeta[];
  connectionsByProvider: Map<string, SafeIntegration[]>;
}) {
  const [showAll, setShowAll] = useState(false);
  const connectedCount = providers.filter((p) => (connectionsByProvider.get(p.id) ?? []).length > 0).length;
  const visible = showAll ? providers : providers.slice(0, INITIAL_VISIBLE);
  const hidden = providers.length - INITIAL_VISIBLE;
  if (providers.length === 0) return null;
  return (
    <div className="space-y-3">
      <SectionHeader title={title} count={providers.length} connectedCount={connectedCount} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {visible.map((meta) => (
          <ProviderCard key={meta.id} meta={meta} connections={connectionsByProvider.get(meta.id) ?? []} />
        ))}
      </div>
      {hidden > 0 && !showAll ? (
        <button onClick={() => setShowAll(true)} className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border py-2 text-[12px] font-medium text-text-muted hover:text-text-secondary hover:border-border/80 transition-colors">
          <ChevronDown size={14} />Show {hidden} more {title.toLowerCase()} providers
        </button>
      ) : hidden > 0 && showAll ? (
        <button onClick={() => setShowAll(false)} className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border py-2 text-[12px] font-medium text-text-muted hover:text-text-secondary transition-colors">
          <ChevronUp size={14} />Show less
        </button>
      ) : null}
    </div>
  );
}

const SECTION_ORDER: Array<{ key: string; label: string }> = [
  { key: "AI Providers",      label: "AI Providers" },
  { key: "OpenAI-compatible", label: "OpenAI Compatible" },
  { key: "Chinese Providers", label: "Chinese Providers" },
  { key: "Tools",             label: "Tools" },
  { key: "Local",             label: "Local Runtimes" },
];

const OAUTH_CATALOG = PROVIDER_CATALOG.filter((p) => p.authType === "oauth");

function ProvidersTab() {
  const { activeWorkspace, loading: projectLoading } = useProject();
  const [integrations, setIntegrations] = useState<SafeIntegration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [testingAll, setTestingAll] = useState(false);
  const [testAllResult, setTestAllResult] = useState<{ passed: number; failed: number; skipped: number; total: number } | null>(null);

  const workspaceId = activeWorkspace?.id ?? null;

  const refresh = useCallback(async () => {
    if (!workspaceId) { setIntegrations([]); setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const { integrations: rows } = await listIntegrations(workspaceId);
      setIntegrations(rows);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to load integrations");
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => { void refresh(); }, [refresh]);

  async function testAll() {
    if (!workspaceId) return;
    setTestingAll(true);
    setTestAllResult(null);
    try {
      const res = await fetch(`/api/integrations/test-all?workspaceId=${workspaceId}`, { method: "POST" });
      const json = await res.json();
      if (json.data) setTestAllResult(json.data);
    } catch { /* silent */ } finally { setTestingAll(false); }
  }

  const connectionsByProvider = useMemo(() => {
    const map = new Map<string, SafeIntegration[]>();
    for (const it of integrations) {
      const list = map.get(it.provider) ?? [];
      list.push(it);
      map.set(it.provider, list);
    }
    return map;
  }, [integrations]);

  const q = search.toLowerCase().trim();
  const matches = (name: string, description: string) =>
    !q || name.toLowerCase().includes(q) || description.toLowerCase().includes(q);

  const catalogByCategory = useMemo(() => {
    const map = new Map<string, ProviderMeta[]>();
    for (const p of PROVIDER_CATALOG) {
      if (p.authType === "oauth") continue;
      if (!matches(p.name, p.description)) continue;
      const list = map.get(p.category) ?? [];
      list.push(p);
      map.set(p.category, list);
    }
    return map;
  }, [q]); // eslint-disable-line react-hooks/exhaustive-deps

  const visibleComingSoon = COMING_SOON_PROVIDERS.filter((p) => matches(p.name, p.description));
  const oauthComingSoon = visibleComingSoon.filter((p) => p.authType === "oauth");
  const toolsComingSoon = visibleComingSoon.filter((p) => !p.authType);
  const totalProviders = PROVIDER_CATALOG.length;
  const connectedCount = connectionsByProvider.size;

  return (
    <div className="space-y-6">
      {/* Stats + actions row */}
      <div className="flex flex-wrap items-center gap-2 text-[12px] text-text-muted">
        {connectedCount > 0 ? (
          <span className="flex items-center gap-1.5 rounded-full bg-green-50 px-3 py-1.5 font-semibold text-green-700">
            <Check size={12} />{connectedCount} connected
          </span>
        ) : null}
        <span className="rounded-full bg-surface-soft px-3 py-1.5 font-medium">{totalProviders} providers</span>
        {connectedCount > 0 && (
          <button onClick={testAll} disabled={testingAll} className="flex items-center gap-1.5 rounded-full border border-border bg-surface-soft px-3 py-1.5 font-medium hover:bg-surface hover:text-foreground disabled:opacity-60">
            {testingAll ? <Loader2 size={11} className="animate-spin" /> : <PlayCircle size={11} />}
            {testingAll ? "Testing..." : "Test All"}
          </button>
        )}
        {testAllResult && (
          <span className={`rounded-full px-3 py-1.5 font-medium ${testAllResult.failed > 0 ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>
            {testAllResult.passed}/{testAllResult.total} passed
          </span>
        )}
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search providers..."
          className="w-full rounded-xl border border-border bg-surface py-2.5 pl-10 pr-4 text-[13px] text-foreground placeholder:text-text-muted outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
        />
        {search ? (
          <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary">
            <X size={14} />
          </button>
        ) : null}
      </div>

      {!activeWorkspace && !projectLoading ? (
        <div className="rounded-xl border border-dashed border-border bg-surface-soft p-12 text-center">
          <p className="text-[14px] font-medium text-text-secondary">No active workspace</p>
          <p className="mt-1 text-[13px] text-text-muted">Select or create a workspace to manage integrations.</p>
        </div>
      ) : loading || projectLoading ? (
        <div className="flex items-center justify-center gap-2 py-20 text-[13px] text-text-muted">
          <Loader2 size={16} className="animate-spin" />Loading integrations...
        </div>
      ) : error ? (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-[13px] text-red-700">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <div>
            <p className="font-medium">Could not load integrations</p>
            <p className="mt-0.5">{error}</p>
            <button onClick={() => void refresh()} className="mt-2 rounded-md bg-red-600 px-3 py-1 text-[12px] font-medium text-white hover:bg-red-700">Retry</button>
          </div>
        </div>
      ) : (
        <div className="space-y-10">
          {(() => {
            const visible = OAUTH_CATALOG.filter((p) => matches(p.name, p.description));
            if (visible.length === 0) return null;
            const cnt = visible.filter((p) => (connectionsByProvider.get(p.id) ?? []).length > 0).length;
            return (
              <div className="space-y-3">
                <SectionHeader title="OAuth AI Providers" count={visible.length} connectedCount={cnt} />
                <p className="text-[12px] text-text-muted">Connect via browser OAuth — no API key required.</p>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {visible.map((meta) => <ProviderCard key={meta.id} meta={meta} connections={connectionsByProvider.get(meta.id) ?? []} />)}
                </div>
              </div>
            );
          })()}
          {SECTION_ORDER.map(({ key, label }) => (
            <ProviderSection key={key} title={label} providers={catalogByCategory.get(key) ?? []} connectionsByProvider={connectionsByProvider} />
          ))}
          {oauthComingSoon.length > 0 ? (
            <div className="space-y-3">
              <SectionHeader title="OAuth Providers (Coming Soon)" count={oauthComingSoon.length} />
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {oauthComingSoon.map((p) => <ComingSoonCard key={p.id} p={p} />)}
              </div>
            </div>
          ) : null}
          {toolsComingSoon.length > 0 ? (
            <div className="space-y-3">
              <SectionHeader title="Tools (Coming Soon)" count={toolsComingSoon.length} />
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {toolsComingSoon.map((p) => <ComingSoonCard key={p.id} p={p} />)}
              </div>
            </div>
          ) : null}
          {q && OAUTH_CATALOG.filter((p) => matches(p.name, p.description)).length === 0 &&
            SECTION_ORDER.every(({ key }) => (catalogByCategory.get(key) ?? []).length === 0) &&
            visibleComingSoon.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-surface-soft p-12 text-center text-[13px] text-text-muted">
              No providers match &quot;{search}&quot;.
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

/* ========================================================================== */
/* ROUTING TAB — routing strategy + model combos                               */
/* ========================================================================== */

interface ComboModel { id: string; provider: string; model: string; position: number; }
interface Combo { id: string; name: string; description: string | null; strategy: "fallback" | "round-robin"; models: ComboModel[]; createdAt: string; }
interface ModelEntry { provider: string; model: string; }

function StrategyBadge({ strategy }: { strategy: Combo["strategy"] }) {
  return strategy === "round-robin" ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2 py-0.5 text-xs text-blue-400">
      <ArrowRightLeft className="h-3 w-3" />Round-robin
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs text-amber-400">
      <Shield className="h-3 w-3" />Fallback
    </span>
  );
}

function ComboForm({ initial, onSave, onCancel, saving }: {
  initial?: Combo;
  onSave: (data: { name: string; description: string; strategy: "fallback" | "round-robin"; models: ModelEntry[] }) => Promise<void>;
  onCancel: () => void;
  saving: boolean;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [strategy, setStrategy] = useState<"fallback" | "round-robin">(initial?.strategy ?? "fallback");
  const [models, setModels] = useState<ModelEntry[]>(
    initial?.models.map((m) => ({ provider: m.provider, model: m.model })) ?? [{ provider: "", model: "" }]
  );

  function addModel() { setModels((prev) => [...prev, { provider: "", model: "" }]); }
  function removeModel(i: number) { setModels((prev) => prev.filter((_, idx) => idx !== i)); }
  function moveUp(i: number) {
    if (i === 0) return;
    setModels((prev) => { const next = [...prev]; [next[i - 1], next[i]] = [next[i], next[i - 1]]; return next; });
  }
  function moveDown(i: number) {
    setModels((prev) => { if (i >= prev.length - 1) return prev; const next = [...prev]; [next[i], next[i + 1]] = [next[i + 1], next[i]]; return next; });
  }
  function setModelField(i: number, field: "provider" | "model", value: string) {
    setModels((prev) => { const next = [...prev]; next[i] = { ...next[i], [field]: value }; return next; });
  }
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const valid = models.filter((m) => m.provider.trim() && m.model.trim());
    if (!valid.length) return;
    await onSave({ name, description, strategy, models: valid });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs text-zinc-400">Name</label>
          <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="My Fallback Chain"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:border-violet-500 focus:outline-none" />
        </div>
        <div>
          <label className="mb-1 block text-xs text-zinc-400">Strategy</label>
          <select value={strategy} onChange={(e) => setStrategy(e.target.value as "fallback" | "round-robin")}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white focus:border-violet-500 focus:outline-none">
            <option value="fallback">Fallback (try in order)</option>
            <option value="round-robin">Round-robin (distribute load)</option>
          </select>
        </div>
      </div>
      <div>
        <label className="mb-1 block text-xs text-zinc-400">Description (optional)</label>
        <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe when to use this combo"
          className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:border-violet-500 focus:outline-none" />
      </div>
      <div>
        <div className="mb-2 flex items-center justify-between">
          <label className="text-xs text-zinc-400">Models ({models.length})</label>
          <button type="button" onClick={addModel} className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-violet-400 hover:bg-violet-500/10">
            <Plus className="h-3 w-3" />Add model
          </button>
        </div>
        <div className="space-y-2">
          {models.map((m, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="flex flex-col gap-0.5">
                <button type="button" onClick={() => moveUp(i)} disabled={i === 0} className="rounded p-0.5 text-zinc-500 hover:text-zinc-300 disabled:opacity-30"><ChevronUp className="h-3.5 w-3.5" /></button>
                <button type="button" onClick={() => moveDown(i)} disabled={i === models.length - 1} className="rounded p-0.5 text-zinc-500 hover:text-zinc-300 disabled:opacity-30"><ChevronDown className="h-3.5 w-3.5" /></button>
              </div>
              <span className="w-4 text-center text-xs text-zinc-600">{i + 1}</span>
              <input value={m.provider} onChange={(e) => setModelField(i, "provider", e.target.value)} placeholder="Provider (e.g. openai)"
                className="flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-white placeholder:text-zinc-600 focus:border-violet-500 focus:outline-none" />
              <input value={m.model} onChange={(e) => setModelField(i, "model", e.target.value)} placeholder="Model ID (e.g. gpt-4o)"
                className="flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-white placeholder:text-zinc-600 focus:border-violet-500 focus:outline-none" />
              <button type="button" onClick={() => removeModel(i)} disabled={models.length === 1} className="rounded p-1 text-zinc-600 hover:text-red-400 disabled:opacity-30">
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onCancel} className="rounded-lg px-4 py-2 text-sm text-zinc-400 hover:text-white">Cancel</button>
        <button type="submit" disabled={saving} className="flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-60">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          {initial ? "Update" : "Create"} Combo
        </button>
      </div>
    </form>
  );
}

function RoutingTab() {
  const { activeWorkspace } = useProject();
  const workspaceId = activeWorkspace?.id;

  // ─── Global routing strategy ────────────────────────────────────────────
  const [routingStrategy, setRoutingStrategy] = useState("fill-first");
  const [stickyLimit, setStickyLimit] = useState(1);
  const [routingLoading, setRoutingLoading] = useState(true);
  const [routingSaving, setRoutingSaving] = useState(false);
  const [routingSaved, setRoutingSaved] = useState(false);
  const [routingError, setRoutingError] = useState<string | null>(null);

  useEffect(() => {
    if (!workspaceId) { setRoutingLoading(false); return; }
    setRoutingLoading(true);
    fetch(`/api/workspaces/${workspaceId}/routing`)
      .then((r) => r.json())
      .then((j) => { if (j.data) { setRoutingStrategy(j.data.routingStrategy ?? "fill-first"); setStickyLimit(j.data.stickyLimit ?? 1); } })
      .catch(() => {})
      .finally(() => setRoutingLoading(false));
  }, [workspaceId]);

  async function saveRouting() {
    if (!workspaceId) return;
    setRoutingSaving(true);
    setRoutingError(null);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/routing`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ routingStrategy, stickyLimit }),
      });
      if (!res.ok) { const j = await res.json(); throw new Error(j.error?.message ?? "Failed to save"); }
      setRoutingSaved(true);
      setTimeout(() => setRoutingSaved(false), 2000);
    } catch (e) {
      setRoutingError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setRoutingSaving(false);
    }
  }

  // ─── Combos ─────────────────────────────────────────────────────────────
  const [combos, setCombos] = useState<Combo[]>([]);
  const [combosLoading, setCombosLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [comboError, setComboError] = useState<string | null>(null);

  const fetchCombos = useCallback(async () => {
    if (!workspaceId) { setCombosLoading(false); return; }
    setCombosLoading(true);
    try {
      const res = await fetch(`/api/combos?workspaceId=${workspaceId}`);
      const json = await res.json();
      if (!res.ok) setComboError(json.error?.message ?? "Failed to load combos");
      else if (json.data?.combos) setCombos(json.data.combos);
    } catch { setComboError("Failed to load combos. Please try refreshing."); }
    finally { setCombosLoading(false); }
  }, [workspaceId]);

  useEffect(() => { fetchCombos(); }, [fetchCombos]);

  async function handleCreate(data: { name: string; description: string; strategy: "fallback" | "round-robin"; models: ModelEntry[] }) {
    if (!workspaceId) return;
    setSaving(true);
    try {
      const res = await fetch("/api/combos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ workspaceId, ...data }) });
      if (!res.ok) { const j = await res.json(); throw new Error(j.error?.message ?? "Failed to create"); }
      setCreating(false);
      fetchCombos();
    } catch (e) { setComboError(e instanceof Error ? e.message : "Failed to create combo"); }
    finally { setSaving(false); }
  }

  async function handleUpdate(id: string, data: { name: string; description: string; strategy: "fallback" | "round-robin"; models: ModelEntry[] }) {
    setSaving(true);
    try {
      const res = await fetch(`/api/combos/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      if (!res.ok) { const j = await res.json(); throw new Error(j.error?.message ?? "Failed to update"); }
      setEditing(null);
      fetchCombos();
    } catch (e) { setComboError(e instanceof Error ? e.message : "Failed to update combo"); }
    finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/combos/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      fetchCombos();
    } catch (e) { setComboError(e instanceof Error ? e.message : "Failed to delete combo"); }
    finally { setDeletingId(null); }
  }

  return (
    <div className="space-y-8">
      {/* ── Default routing strategy ───────────────────────────────────── */}
      <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
        <div className="mb-4 flex items-center gap-2">
          <ArrowRightLeft className="h-4 w-4 text-violet-400" />
          <h3 className="text-sm font-semibold text-zinc-200">Default Routing Strategy</h3>
        </div>
        <p className="mb-4 text-xs text-zinc-500">
          Controls how Teskel selects among multiple connections for the same provider when no Combo overrides it.
        </p>
        {routingLoading ? (
          <div className="flex items-center gap-2 text-zinc-600"><Loader2 className="h-4 w-4 animate-spin" /><span className="text-sm">Loading...</span></div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-xs text-zinc-400">Strategy</label>
              <select value={routingStrategy} onChange={(e) => setRoutingStrategy(e.target.value)}
                className="w-full max-w-xs rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white focus:border-violet-500 focus:outline-none">
                <option value="fill-first">Fill-first (exhaust one key before moving on)</option>
                <option value="round-robin">Round-robin (distribute evenly across keys)</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-zinc-400">Sticky limit <span className="text-zinc-600">(round-robin only)</span></label>
              <input type="number" min={1} max={100} value={stickyLimit} onChange={(e) => setStickyLimit(Number(e.target.value))}
                className="w-24 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white focus:border-violet-500 focus:outline-none" />
              <p className="mt-1 text-xs text-zinc-600">Requests to stick with the same key before rotating.</p>
            </div>
            {routingError && <div className="flex items-center gap-2 text-sm text-red-400"><AlertCircle className="h-4 w-4" />{routingError}</div>}
            <button onClick={saveRouting} disabled={routingSaving}
              className="flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-60">
              {routingSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : routingSaved ? <Check className="h-4 w-4" /> : null}
              {routingSaved ? "Saved!" : "Save Strategy"}
            </button>
          </div>
        )}
      </section>

      {/* ── Model Combos ─────────────────────────────────────────────────── */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-200">
              <Layers className="h-4 w-4 text-violet-400" />Model Combos
            </h3>
            <p className="mt-1 text-xs text-zinc-500">
              Define named fallback chains and round-robin pools. When a model fails or rate-limits, Teskel routes to the next in the chain.
            </p>
          </div>
          {!creating && (
            <button onClick={() => setCreating(true)} className="flex items-center gap-2 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-500">
              <Plus className="h-3.5 w-3.5" />New Combo
            </button>
          )}
        </div>

        {comboError && (
          <div className="mb-4 flex items-center gap-2 rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-400">
            <X className="h-4 w-4 shrink-0" />{comboError}
            <button onClick={() => setComboError(null)} className="ml-auto"><X className="h-4 w-4" /></button>
          </div>
        )}

        {creating && (
          <div className="mb-4 rounded-xl border border-violet-500/30 bg-zinc-900 p-5">
            <h4 className="mb-4 text-sm font-semibold text-zinc-200">New Combo</h4>
            <ComboForm onSave={handleCreate} onCancel={() => setCreating(false)} saving={saving} />
          </div>
        )}

        {combosLoading ? (
          <div className="flex items-center justify-center py-10 gap-2 text-zinc-600"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : combos.length === 0 && !creating ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-zinc-800 py-12 text-center">
            <Layers className="mb-3 h-8 w-8 text-zinc-700" />
            <p className="text-sm font-medium text-zinc-400">No combos yet</p>
            <p className="mt-1 text-xs text-zinc-600">Create a combo to define fallback routing between models.</p>
            <button onClick={() => setCreating(true)} className="mt-4 flex items-center gap-2 rounded-lg bg-violet-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-500">
              <Plus className="h-4 w-4" />New Combo
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {combos.map((combo) => (
              <div key={combo.id} className="rounded-xl border border-zinc-800 bg-zinc-900">
                {editing === combo.id ? (
                  <div className="p-5">
                    <h4 className="mb-4 text-sm font-semibold text-zinc-200">Edit Combo</h4>
                    <ComboForm initial={combo} onSave={(data) => handleUpdate(combo.id, data)} onCancel={() => setEditing(null)} saving={saving} />
                  </div>
                ) : (
                  <div className="p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-zinc-100">{combo.name}</span>
                          <StrategyBadge strategy={combo.strategy} />
                        </div>
                        {combo.description && <p className="mt-0.5 text-sm text-zinc-500">{combo.description}</p>}
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => setEditing(combo.id)} className="rounded-lg px-2.5 py-1 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-white">Edit</button>
                        <button onClick={() => handleDelete(combo.id)} disabled={deletingId === combo.id} className="rounded-lg p-1.5 text-zinc-600 hover:bg-red-500/10 hover:text-red-400 disabled:opacity-40">
                          {deletingId === combo.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {combo.models.map((m, i) => (
                        <div key={m.id} className="flex items-center gap-1.5 rounded-lg border border-zinc-700/50 bg-zinc-800/50 px-3 py-1">
                          <span className="text-xs text-zinc-500">{i + 1}.</span>
                          <span className="text-xs font-mono text-zinc-300">{m.provider}:{m.model}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ========================================================================== */
/* ALIASES TAB                                                                  */
/* ========================================================================== */

interface ModelAlias { id: string; alias: string; provider: string; model: string; createdAt: string; }

function AliasesTab() {
  const { activeWorkspace } = useProject();
  const workspaceId = activeWorkspace?.id;

  const [aliases, setAliases] = useState<ModelAlias[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [newAlias, setNewAlias] = useState("");
  const [newProvider, setNewProvider] = useState("");
  const [newModel, setNewModel] = useState("");
  const [creating, setCreating] = useState(false);

  const fetchAliases = useCallback(async () => {
    if (!workspaceId) { setLoading(false); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/model-aliases?workspaceId=${workspaceId}`);
      const json = await res.json();
      if (!res.ok) setError(json.error?.message ?? "Failed to load aliases");
      else if (json.data?.aliases) setAliases(json.data.aliases);
    } catch { setError("Failed to load aliases. Please try refreshing."); }
    finally { setLoading(false); }
  }, [workspaceId]);

  useEffect(() => { fetchAliases(); }, [fetchAliases]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!workspaceId || !newAlias.trim() || !newProvider.trim() || !newModel.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/model-aliases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId, alias: newAlias.trim(), provider: newProvider.trim(), model: newModel.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? "Failed to create alias");
      setNewAlias(""); setNewProvider(""); setNewModel("");
      setSuccess("Alias created.");
      setTimeout(() => setSuccess(null), 2000);
      fetchAliases();
    } catch (e) { setError(e instanceof Error ? e.message : "Failed to create alias"); }
    finally { setCreating(false); }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/model-aliases/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      fetchAliases();
    } catch (e) { setError(e instanceof Error ? e.message : "Failed to delete alias"); }
    finally { setDeletingId(null); }
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-200">
          <Tag className="h-4 w-4 text-violet-400" />Model Aliases
        </h3>
        <p className="mt-1 text-xs text-zinc-500">
          Map a short name (e.g. <code className="rounded bg-zinc-800 px-1 text-violet-300">fast</code>) to a specific{" "}
          <code className="rounded bg-zinc-800 px-1 text-zinc-300">provider:model</code> combination. Use the alias anywhere a model is expected.
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-500/10 px-3 py-2.5 text-sm text-red-400">
          <AlertCircle className="h-4 w-4 shrink-0" />{error}
          <button onClick={() => setError(null)} className="ml-auto"><X className="h-4 w-4" /></button>
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 rounded-lg bg-green-500/10 px-3 py-2.5 text-sm text-green-400">
          <Check className="h-4 w-4" />{success}
        </div>
      )}

      {/* Create form */}
      <form onSubmit={handleCreate} className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
        <h4 className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-500">New Alias</h4>
        <div className="flex flex-wrap gap-2">
          <input value={newAlias} onChange={(e) => setNewAlias(e.target.value)} placeholder="Alias (e.g. fast)" required
            className="flex-1 min-w-[120px] rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:border-violet-500 focus:outline-none font-mono" />
          <input value={newProvider} onChange={(e) => setNewProvider(e.target.value)} placeholder="Provider (e.g. anthropic)" required
            className="flex-1 min-w-[150px] rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:border-violet-500 focus:outline-none" />
          <input value={newModel} onChange={(e) => setNewModel(e.target.value)} placeholder="Model ID (e.g. claude-haiku-4-5-20251001)" required
            className="flex-1 min-w-[200px] rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:border-violet-500 focus:outline-none font-mono" />
          <button type="submit" disabled={creating} className="flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-60">
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}Add
          </button>
        </div>
      </form>

      {/* Alias list */}
      {loading ? (
        <div className="flex items-center justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-zinc-600" /></div>
      ) : aliases.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-zinc-800 py-12 text-center">
          <Tag className="mb-3 h-8 w-8 text-zinc-700" />
          <p className="text-sm font-medium text-zinc-400">No aliases yet</p>
          <p className="mt-1 text-xs text-zinc-600">Create an alias to use a short name instead of a full provider:model string.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {aliases.map((alias) => (
            <div key={alias.id} className="flex items-center gap-4 rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-3">
              <span className="min-w-0 flex-1 font-mono text-sm font-medium text-violet-300">{alias.alias}</span>
              <ArrowRight className="h-3.5 w-3.5 shrink-0 text-zinc-600" />
              <span className="min-w-0 flex-1 font-mono text-sm text-zinc-300">{alias.provider}:{alias.model}</span>
              <button onClick={() => handleDelete(alias.id)} disabled={deletingId === alias.id} className="rounded p-1 text-zinc-600 hover:bg-red-500/10 hover:text-red-400 disabled:opacity-30">
                {deletingId === alias.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ========================================================================== */
/* SETUP GUIDE TAB (formerly CLI Tools)                                        */
/* ========================================================================== */

interface ToolStep { title: string; code?: string; note?: string; }
interface Tool { id: string; name: string; description: string; category: "editor" | "cli" | "proxy"; icon: string; steps: ToolStep[]; docsUrl?: string; }

const TOOLS: Tool[] = [
  {
    id: "claude-code", name: "Claude Code", description: "Anthropic's official CLI for AI-assisted coding.", category: "cli", icon: "🤖",
    docsUrl: "https://docs.anthropic.com/claude-code",
    steps: [
      { title: "Install Claude Code", code: "npm install -g @anthropic-ai/claude-code" },
      { title: "Connect via OAuth", note: "Go to Providers → Claude Code and click Connect. This opens an OAuth popup that grants Teskel permission to create an API key on your behalf." },
      { title: "Set the API key in your shell", code: 'export ANTHROPIC_API_KEY="<paste key from Teskel integrations>"' },
      { title: "Verify the connection", code: "claude --version && claude -p 'Say hello'" },
    ],
  },
  {
    id: "cursor", name: "Cursor", description: "AI-powered code editor built on VS Code.", category: "editor", icon: "⚡",
    docsUrl: "https://cursor.sh/docs",
    steps: [
      { title: "Download Cursor", note: "Install Cursor from cursor.sh. It includes a built-in AI assistant powered by Claude and GPT-4." },
      { title: "Open Cursor Settings", code: "Cmd/Ctrl + Shift + J → Models" },
      { title: "Add your Anthropic API Key", note: "Paste your API key from Teskel Integrations (Anthropic provider) into the Anthropic API Key field." },
      { title: "Select model", note: "Choose claude-3-5-sonnet-20241022 or claude-sonnet-4-6 for best results." },
    ],
  },
  {
    id: "cline", name: "Cline (VS Code)", description: "Autonomous AI coding agent extension for VS Code.", category: "editor", icon: "🧩",
    docsUrl: "https://github.com/cline/cline",
    steps: [
      { title: "Install Cline", code: "code --install-extension saoudrizwan.claude-dev", note: "Or search 'Cline' in VS Code Extensions marketplace." },
      { title: "Open Cline settings", note: "Click the Cline icon in the activity bar, then the gear icon." },
      { title: "Choose API Provider", note: "Select 'Anthropic' or 'OpenAI Compatible' for custom endpoints." },
      { title: "Enter API key", note: "Paste the key from your Teskel Integrations page for the relevant provider." },
    ],
  },
  {
    id: "github-copilot", name: "GitHub Copilot", description: "AI pair programmer integrated into GitHub and VS Code.", category: "editor", icon: "🐙",
    docsUrl: "https://docs.github.com/copilot",
    steps: [
      { title: "Connect GitHub Copilot to Teskel", note: "Go to Providers → GitHub Copilot and click Connect. This starts a device_code flow — you will see a code to enter on github.com/login/device." },
      { title: "Install Copilot extension in VS Code", code: "code --install-extension GitHub.copilot" },
      { title: "Sign in", note: "VS Code will prompt you to sign into GitHub. Once authenticated, Copilot is active." },
      { title: "Verify", code: "// Start typing any function and accept the suggestion with Tab" },
    ],
  },
  {
    id: "kilo-code", name: "Kilo Code", description: "Open-source AI coding assistant with multi-provider support.", category: "editor", icon: "⚖️",
    docsUrl: "https://kilo.ai/docs",
    steps: [
      { title: "Connect Kilo Code to Teskel", note: "Go to Providers → Kilo Code and click Connect. A device code will be shown — enter it at the URL displayed to authorize Teskel." },
      { title: "Install the VS Code extension", code: "code --install-extension kilocode.kilo-code" },
      { title: "Configure your provider", note: "Open Kilo Code settings and enter your API key from Teskel Integrations." },
    ],
  },
  {
    id: "aider", name: "Aider", description: "AI pair programming in your terminal via git.", category: "cli", icon: "🔧",
    docsUrl: "https://aider.chat/docs",
    steps: [
      { title: "Install Aider", code: "pip install aider-chat" },
      { title: "Set environment variable", code: 'export ANTHROPIC_API_KEY="<key-from-teskel>"' },
      { title: "Run Aider with Claude", code: "aider --model claude-sonnet-4-6" },
    ],
  },
  {
    id: "openai-proxy", name: "OpenAI-compatible proxy", description: "Use any provider with the OpenAI SDK by pointing baseURL at Teskel.", category: "proxy", icon: "🔀",
    steps: [
      { title: "Get your Teskel API key", note: "Go to Settings → API Keys and create a key. This key authenticates your requests through the Teskel proxy." },
      { title: "Configure any OpenAI SDK client", code: `import OpenAI from "openai";\n\nconst client = new OpenAI({\n  baseURL: "https://app.teskel.ai/api/v1",\n  apiKey: process.env.TESKEL_API_KEY,\n});\n\nconst resp = await client.chat.completions.create({\n  model: "anthropic:claude-sonnet-4-6",  // provider:model format\n  messages: [{ role: "user", content: "Hello" }],\n});` },
    ],
  },
];

const TOOL_CATEGORIES = [
  { id: "all", label: "All" },
  { id: "editor", label: "Editors" },
  { id: "cli", label: "CLI" },
  { id: "proxy", label: "Proxy / SDK" },
] as const;

function SetupCodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() { await navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000); }
  return (
    <div className="group relative mt-2 rounded-lg bg-zinc-950 p-3">
      <pre className="overflow-x-auto text-xs text-zinc-300"><code>{code}</code></pre>
      <button onClick={copy} className="absolute right-2 top-2 rounded p-1 text-zinc-600 opacity-0 transition-opacity hover:text-zinc-300 group-hover:opacity-100">
        {copied ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}

function SetupTab() {
  const [category, setCategory] = useState<"all" | "editor" | "cli" | "proxy">("all");
  const visible = category === "all" ? TOOLS : TOOLS.filter((t) => t.category === category);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-200">
          <Terminal className="h-4 w-4 text-violet-400" />Setup Guide
        </h3>
        <p className="mt-1 text-xs text-zinc-500">
          Step-by-step instructions for connecting popular AI coding tools to your Teskel integrations.
        </p>
      </div>

      {/* Category filter */}
      <div className="flex gap-1">
        {TOOL_CATEGORIES.map((c) => (
          <button key={c.id} onClick={() => setCategory(c.id as typeof category)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${category === c.id ? "bg-violet-600 text-white" : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"}`}>
            {c.label}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {visible.map((tool) => <SetupToolCard key={tool.id} tool={tool} />)}
      </div>
    </div>
  );
}

function SetupToolCard({ tool }: { tool: Tool }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-4 p-4 text-left">
        <span className="text-2xl">{tool.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-zinc-100">{tool.name}</span>
            <span className={`rounded-full px-2 py-0.5 text-xs ${tool.category === "cli" ? "bg-violet-500/10 text-violet-400" : tool.category === "proxy" ? "bg-blue-500/10 text-blue-400" : "bg-zinc-700/50 text-zinc-400"}`}>
              {tool.category}
            </span>
          </div>
          <p className="mt-0.5 text-sm text-zinc-500">{tool.description}</p>
        </div>
        <div className="flex items-center gap-2">
          {tool.docsUrl && (
            <a href={tool.docsUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="rounded p-1 text-zinc-600 hover:text-zinc-300">
              <ExternalLink className="h-4 w-4" />
            </a>
          )}
          {open ? <ChevronUp className="h-4 w-4 text-zinc-600" /> : <ChevronDown className="h-4 w-4 text-zinc-600" />}
        </div>
      </button>
      {open && (
        <div className="border-t border-zinc-800 px-5 pb-5 pt-4">
          <ol className="space-y-4">
            {tool.steps.map((step, i) => (
              <li key={i} className="flex gap-3">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-violet-600/20 text-xs font-bold text-violet-400">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-zinc-200">{step.title}</p>
                  {step.note && <p className="mt-1 text-sm text-zinc-500">{step.note}</p>}
                  {step.code && <SetupCodeBlock code={step.code} />}
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

/* ========================================================================== */
/* Page shell                                                                   */
/* ========================================================================== */

const TABS: { id: IntegrationsTab; label: string }[] = [
  { id: "providers", label: "Providers" },
  { id: "routing",   label: "Routing" },
  { id: "aliases",   label: "Aliases" },
  { id: "setup",     label: "Setup Guide" },
];

function IntegrationsInner() {
  const router = useRouter();
  const params = useSearchParams();
  const tab = (params.get("tab") ?? "providers") as IntegrationsTab;

  function setTab(t: IntegrationsTab) {
    router.push(`/dashboard/integrations?tab=${t}`, { scroll: false });
  }

  return (
    <div className="flex-1 overflow-auto">
      <div className="mx-auto max-w-5xl space-y-6 p-6">
        {/* Header */}
        <div>
          <h1 className="text-[22px] font-semibold text-foreground">Integrations</h1>
          <p className="mt-1 text-[13px] text-text-muted">
            Connect AI providers, configure routing, manage aliases, and set up external tools.
          </p>
        </div>

        {/* Tab nav */}
        <div className="flex gap-0 border-b border-border">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2.5 text-[13px] font-medium border-b-2 -mb-px transition-colors ${
                tab === t.id
                  ? "border-accent text-foreground"
                  : "border-transparent text-text-muted hover:text-text-secondary"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {tab === "providers" && <ProvidersTab />}
        {tab === "routing"   && <RoutingTab />}
        {tab === "aliases"   && <AliasesTab />}
        {tab === "setup"     && <SetupTab />}
      </div>
    </div>
  );
}

export default function IntegrationsPage() {
  return (
    <Suspense fallback={
      <div className="flex flex-1 items-center justify-center">
        <Loader2 size={20} className="animate-spin text-text-muted" />
      </div>
    }>
      <IntegrationsInner />
    </Suspense>
  );
}
