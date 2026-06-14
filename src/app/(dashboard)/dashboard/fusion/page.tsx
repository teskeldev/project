"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sliders,
  Plus,
  Trash2,
  Save,
  Loader2,
  ShieldCheck,
  Cpu,
  HelpCircle,
  CheckCircle,
  Sparkles,
  Search,
  X,
  Star,
} from "lucide-react";
import { useProject } from "@/lib/store/project";

type Panelist = {
  model: string;
  provider: string;
  temperature?: number;
  skillSlugs?: string[];
};

type TrackAVerification = {
  validateSyntax: boolean;
  runLint: boolean;
  runTests: boolean;
};

type FusionProfile = {
  id?: string;
  name: string;
  isDefault: boolean;
  panelSlug: string;
  panelists: Panelist[];
  judge: { model: string; provider: string };
  skillSlugs: string[];
  trackAVerification: TrackAVerification;
};

type RegistrySkill = { slug: string; name: string; description: string };

const PANEL_OPTIONS = [
  { value: "auto", label: "Auto-detect richest panel (Recommended)" },
  { value: "opus4.8-4.8", label: "Opus 4.8 × 2 (two cold runs)" },
  { value: "opus4.8-gpt5.5", label: "Opus 4.8 + GPT-5.5" },
  { value: "opus4.8-gpt5.5-gemini3.1pro", label: "Opus 4.8 + GPT-5.5 + Gemini 3.1 Pro" },
  { value: "custom", label: "Custom panel (defined below)" },
];

const BLANK_PROFILE: FusionProfile = {
  name: "New profile",
  isDefault: false,
  panelSlug: "auto",
  panelists: [
    { model: "claude-opus-4-8", provider: "anthropic", temperature: 0.2 },
    { model: "gpt-4o", provider: "openai", temperature: 0.4 },
  ],
  judge: { model: "claude-opus-4-8", provider: "anthropic" },
  skillSlugs: [],
  trackAVerification: { validateSyntax: true, runLint: false, runTests: false },
};

export default function FusionPage() {
  const { activeWorkspace } = useProject();

  if (!activeWorkspace) {
    return (
      <div className="flex h-full items-center justify-center bg-slate-50 p-6 dark:bg-slate-950">
        <p className="text-sm font-medium text-slate-500">Select a workspace to configure Fusion.</p>
      </div>
    );
  }

  return <Studio workspaceId={activeWorkspace.id} />;
}

function Studio({ workspaceId }: { workspaceId: string }) {
  const [profiles, setProfiles] = useState<FusionProfile[]>([]);
  const [draft, setDraft] = useState<FusionProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadProfiles = useCallback(async () => {
    try {
      const res = await fetch(`/api/fusion/profiles?workspaceId=${encodeURIComponent(workspaceId)}`);
      const data = await res.json();
      if (data.success) {
        const list: FusionProfile[] = data.data.profiles;
        setProfiles(list);
        setDraft((prev) => prev ?? list.find((p) => p.isDefault) ?? list[0] ?? { ...BLANK_PROFILE });
      } else {
        setError(data.error?.message || "Failed to load profiles");
      }
    } catch {
      setError("Network error loading profiles");
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    void loadProfiles();
  }, [loadProfiles]);

  const flash = (msg: string) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(null), 3000);
  };

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    setError(null);
    try {
      const isUpdate = !!draft.id;
      const url = isUpdate ? `/api/fusion/profiles/${draft.id}` : "/api/fusion/profiles";
      const res = await fetch(url, {
        method: isUpdate ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId, ...draft }),
      });
      const data = await res.json();
      if (data.success) {
        setDraft(data.data.profile);
        await loadProfiles();
        flash(isUpdate ? "Profile saved" : "Profile created");
      } else {
        setError(data.error?.message || "Failed to save profile");
      }
    } catch {
      setError("Network error saving profile");
    } finally {
      setSaving(false);
    }
  };

  const setDefault = async () => {
    if (!draft?.id) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/fusion/profiles/${draft.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId, isDefault: true }),
      });
      const data = await res.json();
      if (data.success) {
        await loadProfiles();
        setDraft({ ...draft, isDefault: true });
        flash("Set as default");
      } else setError(data.error?.message || "Failed");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!draft?.id) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/fusion/profiles/${draft.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId }),
      });
      const data = await res.json();
      if (data.success) {
        setDraft(null);
        await loadProfiles();
        flash("Profile deleted");
      } else setError(data.error?.message || "Failed to delete");
    } finally {
      setSaving(false);
    }
  };

  const patch = (fields: Partial<FusionProfile>) => draft && setDraft({ ...draft, ...fields });

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-slate-50 dark:bg-slate-950">
        <Loader2 size={36} className="animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="min-h-full bg-slate-50/50 p-8 font-sans text-slate-950 dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6">
          <h1 className="bg-gradient-to-r from-accent to-purple-600 bg-clip-text text-3xl font-extrabold tracking-tight text-transparent">
            Fusion Configuration
          </h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Define which AI models form the Fusion panel and which skills are fused into them. Opus 4.8 always judges.
          </p>
        </div>

        {/* Profile bar */}
        <div className="mb-6 flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200/60 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
          <select
            value={draft?.id ?? "__new__"}
            onChange={(e) => {
              if (e.target.value === "__new__") setDraft({ ...BLANK_PROFILE });
              else setDraft(profiles.find((p) => p.id === e.target.value) ?? { ...BLANK_PROFILE });
            }}
            className="rounded-xl border border-slate-200 bg-transparent px-4 py-2 text-sm focus:border-accent focus:outline-none dark:border-slate-800"
          >
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.isDefault ? " (default)" : ""}
              </option>
            ))}
            <option value="__new__">+ New profile…</option>
          </select>

          <div className="ml-auto flex items-center gap-2">
            {draft?.id && !draft.isDefault && (
              <button
                onClick={() => void setDefault()}
                disabled={saving}
                className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold transition-colors hover:bg-slate-100 disabled:opacity-50 dark:border-slate-800 dark:hover:bg-slate-800/50"
              >
                <Star size={14} /> Set default
              </button>
            )}
            {draft?.id && (
              <button
                onClick={() => void remove()}
                disabled={saving}
                className="flex items-center gap-1.5 rounded-lg border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-600 transition-colors hover:bg-rose-50 disabled:opacity-50 dark:border-rose-900/50 dark:hover:bg-rose-950/30"
              >
                <Trash2 size={14} /> Delete
              </button>
            )}
            <button
              onClick={() => void save()}
              disabled={saving || !draft}
              className="flex items-center gap-2 rounded-xl bg-accent px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-accent/20 transition-all duration-200 hover:scale-[1.02] hover:bg-accent-hover active:scale-[0.98] disabled:opacity-50"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              Save
            </button>
          </div>
        </div>

        <AnimatePresence>
          {success && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-6 flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-50/70 p-4 text-sm font-medium text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400"
            >
              <CheckCircle size={18} /> {success}
            </motion.div>
          )}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-6 flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-50/70 p-4 text-sm font-medium text-rose-600 dark:bg-rose-950/30 dark:text-rose-400"
            >
              <HelpCircle size={18} /> {error}
            </motion.div>
          )}
        </AnimatePresence>

        {draft && (
          <div className="space-y-6">
            {/* Identity */}
            <Card icon={<Sliders className="text-accent" size={20} />} title="Profile">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-400">Name</label>
              <input
                type="text"
                value={draft.name}
                onChange={(e) => patch({ name: e.target.value })}
                className="mb-4 w-full rounded-xl border border-slate-200 bg-transparent px-4 py-2.5 text-sm focus:border-accent focus:outline-none dark:border-slate-800"
              />
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-400">Panel mode</label>
              <select
                value={draft.panelSlug}
                onChange={(e) => patch({ panelSlug: e.target.value })}
                className="w-full rounded-xl border border-slate-200 bg-transparent px-4 py-2.5 text-sm focus:border-accent focus:outline-none dark:border-slate-800"
              >
                {PANEL_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <p className="mt-3 text-xs text-slate-400">
                Opus 4.8 always judges and writes the final answer — the pipeline can&rsquo;t be reversed. Unavailable providers are dropped automatically at run time.
              </p>
            </Card>

            {/* Panelist models */}
            <Card icon={<Cpu className="text-purple-500" size={20} />} title="Panelist Models">
              {draft.panelSlug !== "custom" ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Panelists are determined automatically by the selected panel mode. Switch to &ldquo;Custom panel&rdquo; to edit models individually.
                </p>
              ) : (
                <PanelistEditor
                  workspaceId={workspaceId}
                  panelists={draft.panelists}
                  onChange={(panelists) => patch({ panelists })}
                />
              )}
            </Card>

            {/* Skills fusion */}
            <Card icon={<Sparkles className="text-accent" size={20} />} title="Skills Fusion (shared)">
              <p className="mb-3 text-xs text-slate-400">
                Selected skills are injected as domain knowledge into <strong>every</strong> panelist&rsquo;s system prompt
                (kept uniform to preserve independence).
              </p>
              <SkillPicker
                selected={draft.skillSlugs}
                onChange={(skillSlugs) => patch({ skillSlugs })}
              />
            </Card>

            {/* Judge */}
            <Card icon={<ShieldCheck className="text-emerald-500" size={20} />} title="Judge Synthesis Model">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-500">Judge Provider</label>
                  <select
                    value={draft.judge.provider}
                    disabled={draft.panelSlug !== "custom"}
                    onChange={(e) => patch({ judge: { ...draft.judge, provider: e.target.value } })}
                    className="w-full rounded-lg border border-slate-200 bg-transparent px-3 py-2 text-sm focus:border-accent focus:outline-none disabled:opacity-50 dark:border-slate-800"
                  >
                    <option value="anthropic">Anthropic (Claude)</option>
                    <option value="openai">OpenAI (GPT)</option>
                    <option value="google">Google (Gemini)</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-500">Judge Model ID</label>
                  <input
                    type="text"
                    disabled={draft.panelSlug !== "custom"}
                    value={draft.judge.model}
                    onChange={(e) => patch({ judge: { ...draft.judge, model: e.target.value } })}
                    placeholder="e.g. claude-opus-4-8"
                    className="w-full rounded-lg border border-slate-200 bg-transparent px-3 py-2 text-sm focus:border-accent focus:outline-none disabled:opacity-50 dark:border-slate-800"
                  />
                </div>
              </div>
              <p className="mt-3 text-xs text-slate-400">
                Locked to Opus 4.8 unless a custom panel is selected.
              </p>
            </Card>

            {/* Track A verification */}
            <Card icon={<Sliders className="text-accent" size={20} />} title="Track A Verification (run-both-then-merge)">
              <div className="space-y-3">
                <Checkbox
                  checked={draft.trackAVerification.validateSyntax}
                  onChange={(v) => patch({ trackAVerification: { ...draft.trackAVerification, validateSyntax: v } })}
                  title="Syntax Validation"
                  desc="Check each candidate parses before the judge merges."
                />
                <Checkbox
                  checked={draft.trackAVerification.runLint}
                  onChange={(v) => patch({ trackAVerification: { ...draft.trackAVerification, runLint: v } })}
                  title="Lint Check"
                  desc="Run the linter on each candidate and the merged artifact."
                />
                <Checkbox
                  checked={draft.trackAVerification.runTests}
                  onChange={(v) => patch({ trackAVerification: { ...draft.trackAVerification, runTests: v } })}
                  title="Run Project Tests"
                  desc="Execute project tests to see which candidate actually works (requires a project)."
                />
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Sub-components                                                              */
/* -------------------------------------------------------------------------- */

function Card({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200/60 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
      <div className="mb-4 flex items-center gap-2">
        {icon}
        <h2 className="text-lg font-bold">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function PanelistEditor({
  workspaceId,
  panelists,
  onChange,
}: {
  workspaceId: string;
  panelists: Panelist[];
  onChange: (p: Panelist[]) => void;
}) {
  void workspaceId;
  const update = (i: number, fields: Partial<Panelist>) =>
    onChange(panelists.map((p, idx) => (idx === i ? { ...p, ...fields } : p)));

  return (
    <div className="space-y-4">
      {panelists.map((p, i) => (
        <div
          key={i}
          className="rounded-xl border border-slate-100 bg-slate-50/50 p-4 dark:border-slate-800/50 dark:bg-slate-950/20"
        >
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-slate-400">Panelist #{i + 1}</span>
            {panelists.length > 1 && (
              <button
                onClick={() => onChange(panelists.filter((_, idx) => idx !== i))}
                className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-rose-500 dark:hover:bg-slate-800"
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500">Provider</label>
              <select
                value={p.provider}
                onChange={(e) => update(i, { provider: e.target.value })}
                className="w-full rounded-lg border border-slate-200 bg-transparent px-3 py-2 text-sm focus:border-accent focus:outline-none dark:border-slate-800"
              >
                <option value="anthropic">Anthropic (Claude)</option>
                <option value="openai">OpenAI (GPT)</option>
                <option value="google">Google (Gemini)</option>
                <option value="groq">Groq (Llama)</option>
                <option value="ollama">Ollama (Local)</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500">Model ID</label>
              <input
                type="text"
                value={p.model}
                onChange={(e) => update(i, { model: e.target.value })}
                placeholder="e.g. claude-opus-4-8"
                className="w-full rounded-lg border border-slate-200 bg-transparent px-3 py-2 text-sm focus:border-accent focus:outline-none dark:border-slate-800"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500">
                Temperature ({(p.temperature ?? 0.3).toFixed(1)})
              </label>
              <input
                type="range"
                min="0.0"
                max="1.0"
                step="0.1"
                value={p.temperature ?? 0.3}
                onChange={(e) => update(i, { temperature: parseFloat(e.target.value) })}
                className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-slate-200 accent-accent dark:bg-slate-800"
              />
            </div>
          </div>
          <div className="mt-3">
            <label className="mb-1 block text-xs font-semibold text-slate-500">
              Per-panelist skill slugs (advanced, comma-separated)
            </label>
            <input
              type="text"
              value={(p.skillSlugs ?? []).join(", ")}
              onChange={(e) =>
                update(i, {
                  skillSlugs: e.target.value
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
                })
              }
              placeholder="leave blank to use only shared skills"
              className="w-full rounded-lg border border-slate-200 bg-transparent px-3 py-2 text-sm focus:border-accent focus:outline-none dark:border-slate-800"
            />
          </div>
        </div>
      ))}
      <button
        onClick={() => onChange([...panelists, { model: "gpt-4o", provider: "openai", temperature: 0.3 }])}
        className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-slate-100 dark:border-slate-800 dark:hover:bg-slate-800/50"
      >
        <Plus size={14} /> Add Model
      </button>
    </div>
  );
}

function SkillPicker({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (slugs: string[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<RegistrySkill[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(
          `/api/skills/registry?search=${encodeURIComponent(query)}&limit=20`,
          { signal: ctrl.signal }
        );
        const data = await res.json();
        if (data.success) setResults(data.data.items as RegistrySkill[]);
      } catch {
        /* aborted or network — ignore */
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => {
      ctrl.abort();
      clearTimeout(t);
    };
  }, [query]);

  const add = (slug: string) => {
    if (!selected.includes(slug)) onChange([...selected, slug]);
    setQuery("");
    setResults([]);
  };

  return (
    <div>
      {selected.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {selected.map((slug) => (
            <span
              key={slug}
              className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-2.5 py-1 text-xs font-medium text-accent"
            >
              {slug}
              <button onClick={() => onChange(selected.filter((s) => s !== slug))} className="hover:text-rose-500">
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search the skills registry to fuse…"
          className="w-full rounded-lg border border-slate-200 bg-transparent py-2 pl-9 pr-3 text-sm focus:border-accent focus:outline-none dark:border-slate-800"
        />
        {searching && <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-slate-400" />}
      </div>
      {results.length > 0 && (
        <div className="mt-2 max-h-56 overflow-auto rounded-lg border border-slate-200 dark:border-slate-800">
          {results.map((s) => (
            <button
              key={s.slug}
              onClick={() => add(s.slug)}
              disabled={selected.includes(s.slug)}
              className="flex w-full flex-col items-start border-b border-slate-100 px-3 py-2 text-left last:border-0 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-800/50 dark:hover:bg-slate-800/30"
            >
              <span className="text-sm font-semibold">{s.name}</span>
              <span className="line-clamp-1 text-xs text-slate-400">{s.description}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Checkbox({
  checked,
  onChange,
  title,
  desc,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  title: string;
  desc: string;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-100 p-3 transition-colors hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-950/20">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-slate-300 text-accent focus:ring-accent dark:border-slate-800"
      />
      <div>
        <span className="text-sm font-semibold">{title}</span>
        <p className="text-xs text-slate-400">{desc}</p>
      </div>
    </label>
  );
}
