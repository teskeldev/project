"use client";

import { useEffect, useState } from "react";
import { useProject } from "@/lib/store/project";
import { fusionApi, type FusionSettingsRow, type ProviderRow, type TeamRow, type JudgeRow, type RoutingRow } from "@/lib/client/fusion";
import { PageHeader, LoadingState, Banner, PrimaryButton, Card } from "@/components/fusion/primitives";
import { Loader2, Save } from "lucide-react";

const FLAGS = [
  { key: "experimentalModels", label: "Experimental Models", desc: "Allow not-yet-GA models in routing." },
  { key: "betaProviders", label: "Beta Providers", desc: "Surface providers still in beta." },
  { key: "autoFallback", label: "Auto Fallback", desc: "Fall through the chain when a model errors." },
  { key: "autoRetry", label: "Auto Retry", desc: "Retry transient provider failures once." },
];

export default function SettingsPage() {
  const { activeWorkspace } = useProject();
  const ws = activeWorkspace?.id ?? "";
  const [settings, setSettings] = useState<FusionSettingsRow | null>(null);
  const [providers, setProviders] = useState<ProviderRow[]>([]);
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [judges, setJudges] = useState<JudgeRow[]>([]);
  const [routings, setRoutings] = useState<RoutingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!ws) return;
    (async () => {
      try {
        const [s, p, t, j, r] = await Promise.all([
          fusionApi.getSettings(ws), fusionApi.listProviders(ws), fusionApi.listTeams(ws),
          fusionApi.listJudges(ws), fusionApi.listRoutings(ws),
        ]);
        setSettings(s.settings); setProviders(p.providers); setTeams(t.teams); setJudges(j.judges); setRoutings(r.routings);
      } catch (e) { setErr(e instanceof Error ? e.message : "Failed"); } finally { setLoading(false); }
    })();
  }, [ws]);

  if (!ws) return <Banner kind="error">Select a workspace.</Banner>;
  if (loading) return <LoadingState />;
  if (!settings) return <Banner kind="error">{err ?? "Failed to load settings"}</Banner>;

  const setDefault = (k: string, v: string) => setSettings({ ...settings, defaults: { ...settings.defaults, [k]: v || null } });
  const setFlag = (k: string, v: boolean) => setSettings({ ...settings, featureFlags: { ...settings.featureFlags, [k]: v } });

  const save = async () => {
    setSaving(true); setErr(null); setMsg(null);
    try {
      await fusionApi.updateSettings(ws, { defaults: settings.defaults, featureFlags: settings.featureFlags });
      setMsg("Settings saved");
      setTimeout(() => setMsg(null), 2500);
    } catch (e) { setErr(e instanceof Error ? e.message : "Failed"); } finally { setSaving(false); }
  };

  return (
    <div>
      <PageHeader title="Settings" description="Global Fusion defaults and feature flags."
        action={<PrimaryButton onClick={() => void save()} disabled={saving}>{saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Save</PrimaryButton>} />
      {msg && <Banner kind="success">{msg}</Banner>}
      {err && <Banner kind="error">{err}</Banner>}

      <Card className="mb-4">
        <h2 className="mb-3 text-sm font-bold">Defaults</h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Select label="Default Provider" value={settings.defaults.defaultProvider ?? ""} onChange={(v) => setDefault("defaultProvider", v)} options={providers.map((p) => ({ value: p.id, label: p.name }))} />
          <Select label="Default Team" value={settings.defaults.defaultTeam ?? ""} onChange={(v) => setDefault("defaultTeam", v)} options={teams.map((t) => ({ value: t.id, label: t.name }))} />
          <Select label="Default Judge" value={settings.defaults.defaultJudge ?? ""} onChange={(v) => setDefault("defaultJudge", v)} options={judges.map((j) => ({ value: j.id, label: j.name }))} />
          <Select label="Default Routing" value={settings.defaults.defaultRouting ?? ""} onChange={(v) => setDefault("defaultRouting", v)} options={routings.map((r) => ({ value: r.id, label: r.name }))} />
        </div>
      </Card>

      <Card>
        <h2 className="mb-3 text-sm font-bold">Feature Flags</h2>
        <div className="space-y-2">
          {FLAGS.map((f) => (
            <label key={f.key} className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-100 p-3 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-950/20">
              <input type="checkbox" checked={!!settings.featureFlags[f.key]} onChange={(e) => setFlag(f.key, e.target.checked)} className="h-4 w-4 accent-accent" />
              <div>
                <div className="text-sm font-semibold">{f.label}</div>
                <div className="text-xs text-slate-400">{f.desc}</div>
              </div>
            </label>
          ))}
        </div>
      </Card>
    </div>
  );
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-slate-500">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-lg border border-slate-200 bg-transparent px-3 py-2 text-sm dark:border-slate-800">
        <option value="">None</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}
