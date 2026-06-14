"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sliders, Plus, Trash2, Save, Loader2, ShieldCheck, Cpu, HelpCircle, CheckCircle } from "lucide-react";
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

export default function FusionSettingsPage() {
  const { activeWorkspace } = useProject();
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
        if (data.success) {
          setConfig(data.config);
        } else {
          setError(data.error || "Failed to load configuration");
        }
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
    const newPanelists = [
      ...config.panelists,
      { model: "gpt-4o-mini", provider: "openai", temperature: 0.3 },
    ];
    setConfig({ ...config, panelists: newPanelists });
  };

  const removePanelist = (index: number) => {
    if (!config) return;
    const newPanelists = config.panelists.filter((_, i) => i !== index);
    setConfig({ ...config, panelists: newPanelists });
  };

  const updatePanelist = (index: number, fields: Partial<PanelistConfig>) => {
    if (!config) return;
    const newPanelists = config.panelists.map((p, i) =>
      i === index ? { ...p, ...fields } : p
    );
    setConfig({ ...config, panelists: newPanelists });
  };

  if (!activeWorkspace) {
    return (
      <div className="flex h-full items-center justify-center bg-slate-50 dark:bg-slate-950 p-6">
        <p className="text-sm font-medium text-slate-500">
          Select a workspace to manage Fusion settings.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-slate-50 dark:bg-slate-950">
        <Loader2 size={36} className="animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="min-h-full bg-slate-50/50 dark:bg-slate-950 p-8 text-slate-950 dark:text-slate-100 font-sans">
      <div className="mx-auto max-w-4xl">
        {/* Header with Smooth Gradient Text */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="bg-gradient-to-r from-accent to-purple-600 bg-clip-text text-3xl font-extrabold tracking-tight text-transparent">
              Multi-Model Fusion Settings
            </h1>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              Configure independent panelist models, temperature routing, and verification checks.
            </p>
          </div>
          <button
            onClick={() => void handleSave()}
            disabled={saving || !config}
            className="flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-accent/20 hover:bg-accent-hover hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 disabled:opacity-50"
          >
            {saving ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Save size={16} />
            )}
            Save Configuration
          </button>
        </div>

        {/* Error / Success Banners */}
        <AnimatePresence>
          {success && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-6 flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-50/70 p-4 text-sm font-medium text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400 backdrop-blur-md"
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
              className="mb-6 flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-50/70 p-4 text-sm font-medium text-rose-600 dark:bg-rose-950/30 dark:text-rose-400 backdrop-blur-md"
            >
              <HelpCircle size={18} />
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        {config && (
          <div className="space-y-6">
            {/* Card 1: Default Panel Slug */}
            <div className="rounded-2xl border border-slate-200/60 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/60 backdrop-blur-xl">
              <div className="mb-4 flex items-center gap-2">
                <Sliders className="text-accent" size={20} />
                <h2 className="text-lg font-bold">Orchestration Panel Slug</h2>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Panel Mode
                </label>
                <select
                  value={config.defaultPanelSlug}
                  onChange={(e) => setConfig({ ...config, defaultPanelSlug: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-transparent px-4 py-3 text-sm focus:border-accent focus:outline-none dark:border-slate-800"
                >
                  <option value="auto">Auto-detect available keys (Recommended)</option>
                  <option value="opus4.8-4.8">Frontier Model Twice (opus4.8-4.8)</option>
                  <option value="opus4.8-gpt5.5">Dual Frontier (opus4.8-gpt5.5)</option>
                  <option value="opus4.8-gpt5.5-gemini3.1pro">Triple Frontier (opus4.8-gpt5.5-gemini3.1pro)</option>
                  <option value="custom">Custom Panel configuration (Defined below)</option>
                </select>
              </div>
            </div>

            {/* Card 2: Panelists configuration */}
            <div className="rounded-2xl border border-slate-200/60 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/60 backdrop-blur-xl">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Cpu className="text-purple-500" size={20} />
                  <h2 className="text-lg font-bold">Panelist Models</h2>
                </div>
                {config.defaultPanelSlug === "custom" && (
                  <button
                    onClick={addPanelist}
                    className="flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-800 px-3 py-1.5 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <Plus size={14} /> Add Model
                  </button>
                )}
              </div>

              {config.defaultPanelSlug !== "custom" ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Panelists are determined automatically based on selected mode. Change to &ldquo;Custom Panel&rdquo; mode to manage individually.
                </p>
              ) : (
                <div className="space-y-4">
                  {config.panelists.map((panelist, index) => (
                    <div
                      key={index}
                      className="flex flex-col gap-4 rounded-xl border border-slate-100 bg-slate-50/50 p-4 dark:border-slate-800/50 dark:bg-slate-950/20"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-400 uppercase">
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

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="mb-1 block text-xs font-semibold text-slate-500">
                            Provider
                          </label>
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
                          <label className="mb-1 block text-xs font-semibold text-slate-500">
                            Model ID
                          </label>
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
                            className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-accent"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Card 3: Judge configuration */}
            <div className="rounded-2xl border border-slate-200/60 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/60 backdrop-blur-xl">
              <div className="mb-4 flex items-center gap-2">
                <ShieldCheck className="text-emerald-500" size={20} />
                <h2 className="text-lg font-bold">Judge Synthesis Model</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-500">
                    Judge Provider
                  </label>
                  <select
                    value={config.judge.provider}
                    disabled={config.defaultPanelSlug !== "custom"}
                    onChange={(e) => setConfig({ ...config, judge: { ...config.judge, provider: e.target.value } })}
                    className="w-full rounded-lg border border-slate-200 bg-transparent px-3 py-2 text-sm focus:border-accent focus:outline-none dark:border-slate-800 disabled:opacity-50"
                  >
                    <option value="anthropic">Anthropic (Claude)</option>
                    <option value="openai">OpenAI (GPT)</option>
                    <option value="google">Google (Gemini)</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-500">
                    Judge Model ID
                  </label>
                  <input
                    type="text"
                    disabled={config.defaultPanelSlug !== "custom"}
                    value={config.judge.model}
                    onChange={(e) => setConfig({ ...config, judge: { ...config.judge, model: e.target.value } })}
                    placeholder="e.g. claude-opus-4-8, gpt-4o"
                    className="w-full rounded-lg border border-slate-200 bg-transparent px-3 py-2 text-sm focus:border-accent focus:outline-none dark:border-slate-800 disabled:opacity-50"
                  />
                </div>
              </div>
            </div>

            {/* Card 4: Track A Verification options */}
            <div className="rounded-2xl border border-slate-200/60 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/60 backdrop-blur-xl">
              <div className="mb-4 flex items-center gap-2">
                <Sliders className="text-accent" size={20} />
                <h2 className="text-lg font-bold">Track A Verification (Code Merging)</h2>
              </div>
              <div className="space-y-3">
                <label className="flex items-center gap-3 rounded-lg border border-slate-100 p-3 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-950/20 cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={config.trackAVerification.validateSyntax}
                    onChange={(e) => setConfig({
                      ...config,
                      trackAVerification: { ...config.trackAVerification, validateSyntax: e.target.checked }
                    })}
                    className="h-4 w-4 rounded border-slate-300 text-accent focus:ring-accent dark:border-slate-800"
                  />
                  <div>
                    <span className="text-sm font-semibold">Syntax Validation</span>
                    <p className="text-xs text-slate-400">Compile and check code syntax on fanned out candidates.</p>
                  </div>
                </label>

                <label className="flex items-center gap-3 rounded-lg border border-slate-100 p-3 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-950/20 cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={config.trackAVerification.runLint}
                    onChange={(e) => setConfig({
                      ...config,
                      trackAVerification: { ...config.trackAVerification, runLint: e.target.checked }
                    })}
                    className="h-4 w-4 rounded border-slate-300 text-accent focus:ring-accent dark:border-slate-800"
                  />
                  <div>
                    <span className="text-sm font-semibold">Lint Check</span>
                    <p className="text-xs text-slate-400">Run linter execution before merge phase.</p>
                  </div>
                </label>

                <label className="flex items-center gap-3 rounded-lg border border-slate-100 p-3 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-950/20 cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={config.trackAVerification.runTests}
                    onChange={(e) => setConfig({
                      ...config,
                      trackAVerification: { ...config.trackAVerification, runTests: e.target.checked }
                    })}
                    className="h-4 w-4 rounded border-slate-300 text-accent focus:ring-accent dark:border-slate-800"
                  />
                  <div>
                    <span className="text-sm font-semibold">Run Project Tests</span>
                    <p className="text-xs text-slate-400">Execute tests on each candidate build to determine which candidate runs better.</p>
                  </div>
                </label>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
