"use client";

import { useState } from "react";
import { useProject } from "@/lib/store/project";
import { fusionApi, type ProfileRow, type TeamRow, type RoutingRow, type JudgeRow } from "@/lib/client/fusion";
import { useFusion } from "@/components/fusion/useFusion";
import { PageHeader, LoadingState, Banner, EmptyState, PrimaryButton, GhostButton, Card } from "@/components/fusion/primitives";
import { UserCog, Plus, Trash2, Star, Loader2 } from "lucide-react";

const DEFAULTS = {
  panelSlug: "auto",
  panelists: [{ model: "claude-opus-4-8", provider: "anthropic", temperature: 0.2 }],
  judge: { model: "claude-opus-4-8", provider: "anthropic" },
  trackAVerification: { validateSyntax: true, runLint: false, runTests: false },
};

export default function ProfilesPage() {
  const { activeWorkspace } = useProject();
  const ws = activeWorkspace?.id ?? "";
  const { data, loading, error, reload } = useFusion(
    () => Promise.all([fusionApi.listProfiles(ws), fusionApi.listTeams(ws), fusionApi.listRoutings(ws), fusionApi.listJudges(ws)]),
    [ws]
  );
  const [editing, setEditing] = useState<Partial<ProfileRow> | null>(null);
  const [skills, setSkills] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  if (!ws) return <Banner kind="error">Select a workspace.</Banner>;
  const profiles: ProfileRow[] = data?.[0]?.profiles ?? [];
  const teams: TeamRow[] = data?.[1]?.teams ?? [];
  const routings: RoutingRow[] = data?.[2]?.routings ?? [];
  const judges: JudgeRow[] = data?.[3]?.judges ?? [];

  const startNew = () => { setEditing({ name: "", systemPrompt: "", teamId: null, routingId: null, judgeId: null, skillSlugs: [] }); setSkills(""); };
  const startEdit = (p: ProfileRow) => { setEditing(p); setSkills((p.skillSlugs ?? []).join(", ")); };

  const save = async () => {
    if (!editing) return;
    setBusy("save"); setErr(null);
    const payload = {
      ...DEFAULTS,
      name: editing.name,
      systemPrompt: editing.systemPrompt ?? null,
      teamId: editing.teamId ?? null,
      routingId: editing.routingId ?? null,
      judgeId: editing.judgeId ?? null,
      skillSlugs: skills.split(",").map((s) => s.trim()).filter(Boolean),
    };
    try {
      if (editing.id) await fusionApi.updateProfile(ws, editing.id, payload);
      else await fusionApi.createProfile(ws, payload);
      setEditing(null);
      reload();
    } catch (e) { setErr(e instanceof Error ? e.message : "Failed"); } finally { setBusy(null); }
  };
  const setDefault = async (p: ProfileRow) => { setBusy(p.id); try { await fusionApi.updateProfile(ws, p.id, { isDefault: true }); reload(); } finally { setBusy(null); } };
  const remove = async (p: ProfileRow) => { setBusy(p.id); try { await fusionApi.deleteProfile(ws, p.id); reload(); } finally { setBusy(null); } };

  return (
    <div>
      <PageHeader title="Profiles" description="Reusable presets binding a team, routing, judge and skills with a system prompt."
        action={<PrimaryButton onClick={startNew}><Plus size={16} /> New Profile</PrimaryButton>} />
      {err && <Banner kind="error">{err}</Banner>}

      {editing && (
        <Card className="mb-4 space-y-3">
          <input className="w-full rounded-lg border border-slate-200 bg-transparent px-3 py-2 text-sm dark:border-slate-800" placeholder="Profile name (e.g. Security Auditor)" value={editing.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
          <textarea rows={3} className="w-full resize-y rounded-lg border border-slate-200 bg-transparent px-3 py-2 text-sm dark:border-slate-800" placeholder="System prompt" value={editing.systemPrompt ?? ""} onChange={(e) => setEditing({ ...editing, systemPrompt: e.target.value })} />
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <Bind label="Team" value={editing.teamId ?? ""} onChange={(v) => setEditing({ ...editing, teamId: v || null })} options={teams.map((t) => ({ value: t.id, label: t.name }))} />
            <Bind label="Routing" value={editing.routingId ?? ""} onChange={(v) => setEditing({ ...editing, routingId: v || null })} options={routings.map((r) => ({ value: r.id, label: r.name }))} />
            <Bind label="Judge" value={editing.judgeId ?? ""} onChange={(v) => setEditing({ ...editing, judgeId: v || null })} options={judges.map((j) => ({ value: j.id, label: j.name }))} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500">Skill slugs (comma-separated)</label>
            <input className="w-full rounded-lg border border-slate-200 bg-transparent px-3 py-2 text-sm dark:border-slate-800" value={skills} onChange={(e) => setSkills(e.target.value)} placeholder="security-audit, react-testing" />
          </div>
          <div className="flex justify-end gap-2">
            <GhostButton onClick={() => setEditing(null)}>Cancel</GhostButton>
            <PrimaryButton onClick={() => void save()} disabled={busy === "save" || !editing.name}>{busy === "save" ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} Save</PrimaryButton>
          </div>
        </Card>
      )}

      {loading ? <LoadingState /> : error ? <Banner kind="error">{error}</Banner> : profiles.length === 0 ? (
        <EmptyState icon={<UserCog size={32} />} title="No profiles yet" description="Create reusable orchestration presets." />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {profiles.map((p) => (
            <Card key={p.id}>
              <div className="flex items-start justify-between">
                <button onClick={() => startEdit(p)} className="text-left">
                  <div className="font-semibold">{p.name} {p.isDefault && <span className="ml-1 rounded bg-accent/10 px-1.5 py-0.5 text-[10px] font-bold text-accent">default</span>}</div>
                  <div className="text-xs text-slate-400">panel: {p.panelSlug}{p.skillSlugs?.length ? ` · ${p.skillSlugs.length} skills` : ""}</div>
                </button>
                <div className="flex gap-1">
                  {!p.isDefault && <button onClick={() => void setDefault(p)} className="rounded p-1 text-slate-400 hover:text-amber-500" title="Set default"><Star size={15} /></button>}
                  <button onClick={() => void remove(p)} className="rounded p-1 text-slate-400 hover:text-rose-500"><Trash2 size={15} /></button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function Bind({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
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
