"use client";

import { useEffect, useState } from "react";
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
  Play,
  Users,
  Gavel,
  GitMerge,
  Clock,
  AlertTriangle,
  Sparkles,
} from "lucide-react";
import { useProject } from "@/lib/store/project";

type PanelistConfig = {
  model: string;
  provider: string;
  temperature: number;
};

type FusionConfig = {
  defaultPanelSlug: string;
  panelists: PanelistConfig[];
  judge: {
    model: string;
    provider: string;
  };
  trackAVerification: {
    validateSyntax: boolean;
    runLint: boolean;
    runTests: boolean;
  };
};

type CandidateVerification = {
  ran: boolean;
  syntaxValid: boolean;
  lintPassed: boolean | null;
  testsPassed: boolean | null;
  feedback: string;
};

type Candidate = {
  model: string;
  provider: string;
  label: string;
  response: string;
  failed: boolean;
  verification?: CandidateVerification;
};

type FusionResult = {
  success: boolean;
  deliverable: string;
  panelSlug: string;
  panelists: string[];
  judge: string;
  track: "A" | "B";
  dropped: string[];
  downgraded: boolean;
  verified?: boolean;
  mergeAttempts?: number;
  analysis?: {
    consensus: string;
    contradictions: string;
    partial: string;
    unique: string;
    blindSpots: string;
  };
  candidates?: Candidate[];
  mergeRationale?: string;
  notes?: string;
  durationMs: number;
};

const PANEL_OPTIONS = [
  { value: "auto", label: "Auto-detect richest panel (Recommended)" },
  { value: "opus4.8-4.8", label: "Opus 4.8 × 2 — two cold runs" },
  { value: "opus4.8-gpt5.5", label: "Opus 4.8 + GPT-5.5" },
  { value: "opus4.8-gpt5.5-gemini3.1pro", label: "Opus 4.8 + GPT-5.5 + Gemini 3.1 Pro" },
];

export default function FusionPage() {
  const [tab, setTab] = useState<"run" | "settings">("run");
  const { activeWorkspace } = useProject();

  if (!activeWorkspace) {
    return (
      <div className="flex h-full items-center justify-center bg-slate-50 dark:bg-slate-950 p-6">
        <p className="text-sm font-medium text-slate-500">
          Select a workspace to use Fusion.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-slate-50/50 dark:bg-slate-950 p-8 text-slate-950 dark:text-slate-100 font-sans">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6">
          <h1 className="bg-gradient-to-r from-accent to-purple-600 bg-clip-text text-3xl font-extrabold tracking-tight text-transparent">
            Multi-Model Fusion
          </h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Fan one task out to a panel of independent models, then let Opus 4.8 judge and write the final answer.
          </p>
        </div>

        {/* Tabs */}
        <div className="mb-6 inline-flex rounded-xl border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-slate-900/60">
          {(["run", "settings"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-lg px-4 py-1.5 text-sm font-semibold capitalize transition-colors ${
                tab === t
                  ? "bg-accent text-white shadow"
                  : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === "run" ? <RunPanel workspaceId={activeWorkspace.id} /> : <SettingsPanel />}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Run panel — fan out, judge, present (deliverable first, then audit trail)  */
/* -------------------------------------------------------------------------- */

function RunPanel({ workspaceId }: { workspaceId: string }) {
  const { activeProject } = useProject();
  const [task, setTask] = useState("");
  const [panelSlug, setPanelSlug] = useState("auto");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<FusionResult | null>(null);

  const run = async () => {
    if (!task.trim()) return;
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/fusion/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task,
          workspaceId,
          projectId: activeProject?.id,
          panelSlug,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setResult(data.data.result as FusionResult);
      } else {
        setError(data.error?.message || "Fusion run failed");
      }
    } catch {
      setError("Network error running fusion");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Composer */}
      <div className="rounded-2xl border border-slate-200/60 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
        <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-400">
          Task
        </label>
        <textarea
          value={task}
          onChange={(e) => setTask(e.target.value)}
          rows={5}
          placeholder="Ask a hard question or describe an artifact to build. Each panelist answers independently; Opus 4.8 judges."
          className="w-full resize-y rounded-xl border border-slate-200 bg-transparent px-4 py-3 text-sm focus:border-accent focus:outline-none dark:border-slate-800"
        />
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <select
            value={panelSlug}
            onChange={(e) => setPanelSlug(e.target.value)}
            className="rounded-xl border border-slate-200 bg-transparent px-4 py-2.5 text-sm focus:border-accent focus:outline-none dark:border-slate-800"
          >
            {PANEL_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <button
            onClick={() => void run()}
            disabled={running || !task.trim()}
            className="flex items-center justify-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-accent/20 transition-all duration-200 hover:bg-accent-hover hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
          >
            {running ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
            {running ? "Running panel…" : "Run Fusion"}
          </button>
        </div>
        <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-400">
          <AlertTriangle size={12} />
          A panel costs ~N× a single answer and runs as slow as its slowest model. Use it for high-stakes work.
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-50/70 p-4 text-sm font-medium text-rose-600 dark:bg-rose-950/30 dark:text-rose-400">
          <HelpCircle size={18} />
          {error}
        </div>
      )}

      {running && !result && (
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200/60 bg-white p-6 text-sm text-slate-500 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
          <Loader2 size={18} className="animate-spin text-accent" />
          Fanning out to the panel in parallel, then judging…
        </div>
      )}

      <AnimatePresence>{result && <FusionResultView result={result} />}</AnimatePresence>
    </div>
  );
}

function FusionResultView({ result }: { result: FusionResult }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="space-y-6"
    >
      {/* Deliverable first (spec Step 4) */}
      <div className="rounded-2xl border border-accent/30 bg-white p-6 shadow-sm dark:border-accent/40 dark:bg-slate-900/60">
        <div className="mb-3 flex items-center gap-2">
          <Sparkles className="text-accent" size={18} />
          <h2 className="text-lg font-bold">
            {result.track === "A" ? "Merged Artifact" : "Final Answer"}
          </h2>
          {result.track === "A" && (
            <span
              className={`ml-auto rounded-full px-2.5 py-0.5 text-xs font-bold ${
                result.verified
                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                  : "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400"
              }`}
            >
              {result.verified ? "verified ✓" : "unverified"}
            </span>
          )}
        </div>
        <pre className="max-h-[28rem] overflow-auto whitespace-pre-wrap break-words rounded-xl bg-slate-950 p-4 text-xs leading-relaxed text-slate-100">
          {result.deliverable}
        </pre>
      </div>

      {/* Audit trail */}
      <div className="rounded-2xl border border-slate-200/60 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
        <h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-slate-400">
          Audit trail
        </h3>

        <div className="mb-4 flex flex-wrap gap-2">
          <Badge icon={<GitMerge size={12} />} label={`panel: ${result.panelSlug}`} />
          <Badge icon={<Gavel size={12} />} label={`judge: ${result.judge}`} />
          <Badge icon={<Clock size={12} />} label={`${(result.durationMs / 1000).toFixed(1)}s`} />
          <Badge label={`Track ${result.track}`} />
          {result.track === "A" && result.mergeAttempts != null && (
            <Badge label={`${result.mergeAttempts} merge pass${result.mergeAttempts > 1 ? "es" : ""}`} />
          )}
        </div>

        <div className="mb-4 flex items-start gap-2 text-sm">
          <Users size={16} className="mt-0.5 text-slate-400" />
          <div>
            <span className="font-semibold">Panelists:</span>{" "}
            {result.panelists.join(", ") || "none"}
          </div>
        </div>

        {result.downgraded && (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-50/70 p-3 text-xs text-amber-700 dark:bg-amber-950/30 dark:text-amber-400">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            <div>
              Panel downgraded{result.dropped.length ? ` — dropped: ${result.dropped.join(", ")}` : ""}.
              {result.notes ? ` ${result.notes}` : ""}
            </div>
          </div>
        )}

        {/* Track A: per-candidate verification + merge rationale */}
        {result.track === "A" && (
          <div className="space-y-4">
            {result.candidates
              ?.filter((c) => !c.failed)
              .map((c, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-slate-100 bg-slate-50/50 p-4 dark:border-slate-800/50 dark:bg-slate-950/20"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-semibold">{c.label}</span>
                    <span className="text-xs text-slate-400">{c.model}</span>
                  </div>
                  {c.verification && (
                    <div className="flex flex-wrap gap-1.5 text-xs">
                      <VerifyChip label="syntax" state={c.verification.syntaxValid} />
                      <VerifyChip label="lint" state={c.verification.lintPassed} />
                      <VerifyChip label="tests" state={c.verification.testsPassed} />
                      <span className="text-slate-400">{c.verification.feedback}</span>
                    </div>
                  )}
                </div>
              ))}
            {result.mergeRationale && (
              <div className="rounded-xl border border-slate-100 p-4 text-sm dark:border-slate-800">
                <p className="mb-1 font-semibold">Merge rationale</p>
                <p className="whitespace-pre-wrap text-slate-600 dark:text-slate-400">
                  {result.mergeRationale}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Track B: five-section structured analysis */}
        {result.track === "B" && result.analysis && (
          <div className="space-y-3">
            <Section title="Consensus" body={result.analysis.consensus} />
            <Section title="Contradictions" body={result.analysis.contradictions} />
            <Section title="Partial coverage" body={result.analysis.partial} />
            <Section title="Unique insights" body={result.analysis.unique} />
            <Section title="Blind spots" body={result.analysis.blindSpots} />
          </div>
        )}
      </div>
    </motion.div>
  );
}

function Badge({ icon, label }: { icon?: React.ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600 dark:border-slate-800 dark:bg-slate-950/30 dark:text-slate-300">
      {icon}
      {label}
    </span>
  );
}

function VerifyChip({ label, state }: { label: string; state: boolean | null }) {
  const cls =
    state === null
      ? "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
      : state
        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
        : "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400";
  const mark = state === null ? "–" : state ? "✓" : "✗";
  return <span className={`rounded px-1.5 py-0.5 font-semibold ${cls}`}>{label} {mark}</span>;
}

function Section({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-slate-100 p-4 dark:border-slate-800">
      <p className="mb-1 text-sm font-bold">{title}</p>
      <p className="whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-400">{body}</p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Settings panel — panel slug, panelists, judge, Track A verification        */
/* -------------------------------------------------------------------------- */

function SettingsPanel() {
  const [config, setConfig] = useState<FusionConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadConfig() {
      try {
        const res = await fetch("/api/fusion/config");
        const data = await res.json();
        if (data.success) setConfig(data.config);
        else setError(data.error || "Failed to load configuration");
      } catch {
        setError("Network error loading settings");
      } finally {
        setLoading(false);
      }
    }
    void loadConfig();
  }, []);

  const handleSave = async () => {
    if (!config) return;
    setSaving(true);
    setSuccess(false);
    setError(null);
    try {
      const res = await fetch("/api/fusion/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      } else {
        setError(data.error || "Failed to save configuration");
      }
    } catch {
      setError("Network error saving settings");
    } finally {
      setSaving(false);
    }
  };

  const addPanelist = () => {
    if (!config) return;
    setConfig({
      ...config,
      panelists: [...config.panelists, { model: "gpt-4o", provider: "openai", temperature: 0.3 }],
    });
  };

  const removePanelist = (index: number) => {
    if (!config) return;
    setConfig({ ...config, panelists: config.panelists.filter((_, i) => i !== index) });
  };

  const updatePanelist = (index: number, fields: Partial<PanelistConfig>) => {
    if (!config) return;
    setConfig({
      ...config,
      panelists: config.panelists.map((p, i) => (i === index ? { ...p, ...fields } : p)),
    });
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 size={36} className="animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-end">
        <button
          onClick={() => void handleSave()}
          disabled={saving || !config}
          className="flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-accent/20 transition-all duration-200 hover:bg-accent-hover hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          Save Configuration
        </button>
      </div>

      <AnimatePresence>
        {success && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mb-6 flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-50/70 p-4 text-sm font-medium text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400"
          >
            <CheckCircle size={18} />
            Settings saved successfully!
          </motion.div>
        )}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mb-6 flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-50/70 p-4 text-sm font-medium text-rose-600 dark:bg-rose-950/30 dark:text-rose-400"
          >
            <HelpCircle size={18} />
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {config && (
        <div className="space-y-6">
          {/* Panel slug */}
          <div className="rounded-2xl border border-slate-200/60 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
            <div className="mb-4 flex items-center gap-2">
              <Sliders className="text-accent" size={20} />
              <h2 className="text-lg font-bold">Orchestration Panel Slug</h2>
            </div>
            <select
              value={config.defaultPanelSlug}
              onChange={(e) => setConfig({ ...config, defaultPanelSlug: e.target.value })}
              className="w-full rounded-xl border border-slate-200 bg-transparent px-4 py-3 text-sm focus:border-accent focus:outline-none dark:border-slate-800"
            >
              <option value="auto">Auto-detect available providers (Recommended)</option>
              <option value="opus4.8-4.8">Opus 4.8 × 2 (two cold runs)</option>
              <option value="opus4.8-gpt5.5">Opus 4.8 + GPT-5.5</option>
              <option value="opus4.8-gpt5.5-gemini3.1pro">Opus 4.8 + GPT-5.5 + Gemini 3.1 Pro</option>
              <option value="custom">Custom panel (defined below)</option>
            </select>
            <p className="mt-3 text-xs text-slate-400">
              Opus 4.8 always judges and writes the final answer — the pipeline can&rsquo;t be reversed.
            </p>
          </div>

          {/* Panelists */}
          <div className="rounded-2xl border border-slate-200/60 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Cpu className="text-purple-500" size={20} />
                <h2 className="text-lg font-bold">Panelist Models</h2>
              </div>
              {config.defaultPanelSlug === "custom" && (
                <button
                  onClick={addPanelist}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-slate-100 dark:border-slate-800 dark:hover:bg-slate-800/50"
                >
                  <Plus size={14} /> Add Model
                </button>
              )}
            </div>

            {config.defaultPanelSlug !== "custom" ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Panelists are determined automatically based on selected mode. Change to &ldquo;Custom panel&rdquo; to manage individually.
              </p>
            ) : (
              <div className="space-y-4">
                {config.panelists.map((panelist, index) => (
                  <div
                    key={index}
                    className="flex flex-col gap-4 rounded-xl border border-slate-100 bg-slate-50/50 p-4 dark:border-slate-800/50 dark:bg-slate-950/20"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase text-slate-400">
                        Panelist #{index + 1}
                      </span>
                      {config.panelists.length > 1 && (
                        <button
                          onClick={() => removePanelist(index)}
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
                          value={panelist.provider}
                          onChange={(e) => updatePanelist(index, { provider: e.target.value })}
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
                          value={panelist.model}
                          onChange={(e) => updatePanelist(index, { model: e.target.value })}
                          placeholder="e.g. gpt-4o, claude-opus-4-8"
                          className="w-full rounded-lg border border-slate-200 bg-transparent px-3 py-2 text-sm focus:border-accent focus:outline-none dark:border-slate-800"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-semibold text-slate-500">
                          Temperature ({panelist.temperature.toFixed(1)})
                        </label>
                        <input
                          type="range"
                          min="0.0"
                          max="1.0"
                          step="0.1"
                          value={panelist.temperature}
                          onChange={(e) => updatePanelist(index, { temperature: parseFloat(e.target.value) })}
                          className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-slate-200 accent-accent dark:bg-slate-800"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Judge */}
          <div className="rounded-2xl border border-slate-200/60 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
            <div className="mb-4 flex items-center gap-2">
              <ShieldCheck className="text-emerald-500" size={20} />
              <h2 className="text-lg font-bold">Judge Synthesis Model</h2>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-500">Judge Provider</label>
                <select
                  value={config.judge.provider}
                  disabled={config.defaultPanelSlug !== "custom"}
                  onChange={(e) => setConfig({ ...config, judge: { ...config.judge, provider: e.target.value } })}
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
                  disabled={config.defaultPanelSlug !== "custom"}
                  value={config.judge.model}
                  onChange={(e) => setConfig({ ...config, judge: { ...config.judge, model: e.target.value } })}
                  placeholder="e.g. claude-opus-4-8, gpt-4o"
                  className="w-full rounded-lg border border-slate-200 bg-transparent px-3 py-2 text-sm focus:border-accent focus:outline-none disabled:opacity-50 dark:border-slate-800"
                />
              </div>
            </div>
          </div>

          {/* Track A verification */}
          <div className="rounded-2xl border border-slate-200/60 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
            <div className="mb-4 flex items-center gap-2">
              <Sliders className="text-accent" size={20} />
              <h2 className="text-lg font-bold">Track A Verification (Run-both-then-merge)</h2>
            </div>
            <div className="space-y-3">
              <Checkbox
                checked={config.trackAVerification.validateSyntax}
                onChange={(v) =>
                  setConfig({ ...config, trackAVerification: { ...config.trackAVerification, validateSyntax: v } })
                }
                title="Syntax Validation"
                desc="Check each candidate's code parses before the judge merges."
              />
              <Checkbox
                checked={config.trackAVerification.runLint}
                onChange={(v) =>
                  setConfig({ ...config, trackAVerification: { ...config.trackAVerification, runLint: v } })
                }
                title="Lint Check"
                desc="Run the linter on each candidate and on the merged artifact."
              />
              <Checkbox
                checked={config.trackAVerification.runTests}
                onChange={(v) =>
                  setConfig({ ...config, trackAVerification: { ...config.trackAVerification, runTests: v } })
                }
                title="Run Project Tests"
                desc="Execute project tests to see which candidate actually works (requires a project)."
              />
            </div>
          </div>
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
