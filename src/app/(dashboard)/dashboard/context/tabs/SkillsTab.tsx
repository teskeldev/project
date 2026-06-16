"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Plus,
  ToggleLeft,
  ToggleRight,
  Trash2,
  Edit3,
  Loader2,
  X,
  BookOpen,
  Eye,
  Zap,
  Download,
  Search,
  Library,
  ChevronLeft,
  ChevronRight,
  Check,
} from "lucide-react";
import { useProject } from "@/lib/store/project";
import { ApiClientError } from "@/lib/client/api";
import {
  listSkills,
  createSkill,
  updateSkill,
  deleteSkill,
  type Skill,
} from "@/lib/client/skills";
import { SKILL_TEMPLATES, type SkillTemplate } from "@/data/skill-templates";
import { SKILLS_REGISTRY_COUNT } from "@/data/skills-registry";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type FormState = { name: string; slug: string; description: string; content: string };
const EMPTY_FORM: FormState = { name: "", slug: "", description: "", content: "" };

type RegistryEntry = { slug: string; name: string; description: string; category: string; source: "builtin" | "composio" };
type RegistryResponse = { items: RegistryEntry[]; pagination: { page: number; limit: number; total: number; totalPages: number }; categories: Record<string, { label: string; description: string }>; totalRegistry: number };
type TabId = "my-skills" | "registry";

const CATEGORY_COLORS: Record<string, string> = {
  development: "bg-accent-light text-accent border-accent",
  productivity: "bg-green-50 text-green-700 border-green-200",
  integrations: "bg-purple-50 text-purple-700 border-purple-200",
  "ai-ml": "bg-orange-50 text-orange-700 border-orange-200",
  design: "bg-pink-50 text-pink-700 border-pink-200",
  communication: "bg-cyan-50 text-cyan-700 border-cyan-200",
  finance: "bg-emerald-50 text-emerald-700 border-emerald-200",
  marketing: "bg-amber-50 text-amber-700 border-amber-200",
  data: "bg-indigo-50 text-indigo-700 border-indigo-200",
  security: "bg-red-50 text-red-700 border-red-200",
  devops: "bg-slate-50 text-slate-700 border-slate-200",
};

export default function SkillsTab() {
  const { activeWorkspace } = useProject();
  const workspaceId = activeWorkspace?.id ?? null;
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [previewSkill, setPreviewSkill] = useState<Skill | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("my-skills");
  const [registryData, setRegistryData] = useState<RegistryResponse | null>(null);
  const [registryLoading, setRegistryLoading] = useState(false);
  const [registryError, setRegistryError] = useState<string | null>(null);
  const [registrySearch, setRegistrySearch] = useState("");
  const [registryCategory, setRegistryCategory] = useState<string>("");
  const [registryPage, setRegistryPage] = useState(1);
  const [registryPreview, setRegistryPreview] = useState<{ entry: RegistryEntry; content: string | null; loading: boolean } | null>(null);
  const [installingSlug, setInstallingSlug] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");

  const load = useCallback(async () => {
    if (!workspaceId) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const { skills: data } = await listSkills({ workspaceId });
      setSkills(data);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to load skills");
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => { void load(); }, [load]);

  const loadRegistry = useCallback(async () => {
    setRegistryLoading(true);
    setRegistryError(null);
    try {
      const params = new URLSearchParams();
      if (registryCategory) params.set("category", registryCategory);
      if (registrySearch) params.set("search", registrySearch);
      params.set("page", String(registryPage));
      params.set("limit", "50");
      const res = await fetch(`/api/skills/registry?${params.toString()}`);
      const json = await res.json();
      if (json.success) { setRegistryData(json.data); } else { setRegistryError(json.error?.message ?? "Failed to load registry"); }
    } catch { setRegistryError("Failed to load skills registry"); } finally { setRegistryLoading(false); }
  }, [registryCategory, registrySearch, registryPage]);

  useEffect(() => { if (activeTab === "registry") { void loadRegistry(); } }, [activeTab, loadRegistry]);

  useEffect(() => {
    const timer = setTimeout(() => { setRegistrySearch(searchInput); setRegistryPage(1); }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const openCreate = () => { setEditingId(null); setForm(EMPTY_FORM); setFormError(null); setShowForm(true); };
  const openEdit = (skill: Skill) => { setEditingId(skill.id); setForm({ name: skill.name, slug: skill.slug, description: skill.description, content: skill.content }); setFormError(null); setShowForm(true); };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspaceId || saving) return;
    setSaving(true);
    setFormError(null);
    try {
      if (editingId) {
        const { skill } = await updateSkill(editingId, { name: form.name, slug: form.slug, description: form.description, content: form.content });
        setSkills((prev) => prev.map((s) => (s.id === editingId ? skill : s)));
      } else {
        const { skill } = await createSkill({ workspaceId, name: form.name, slug: form.slug, description: form.description, content: form.content });
        setSkills((prev) => [...prev, skill]);
      }
      setShowForm(false);
    } catch (err) {
      setFormError(err instanceof ApiClientError ? err.message : "Failed to save skill");
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (skill: Skill) => {
    setBusyId(skill.id);
    try {
      const { skill: updated } = await updateSkill(skill.id, { enabled: !skill.enabled });
      setSkills((prev) => prev.map((s) => (s.id === skill.id ? updated : s)));
    } catch { /* non-fatal */ } finally { setBusyId(null); }
  };

  const handleDelete = async (skill: Skill) => {
    if (!confirm(`Delete skill "${skill.name}"?`)) return;
    setBusyId(skill.id);
    try {
      await deleteSkill(skill.id);
      setSkills((prev) => prev.filter((s) => s.id !== skill.id));
    } catch { /* non-fatal */ } finally { setBusyId(null); }
  };

  const installTemplate = async (template: SkillTemplate) => {
    if (!workspaceId) return;
    const existing = skills.find((s) => s.slug === template.slug);
    if (existing) { setFormError(`Skill "${template.name}" is already installed.`); return; }
    setSaving(true);
    try {
      const { skill } = await createSkill({ workspaceId, name: template.name, slug: template.slug, description: template.description, content: template.content });
      setSkills((prev) => [...prev, skill]);
      setShowTemplates(false);
    } catch (err) {
      setFormError(err instanceof ApiClientError ? err.message : "Failed to install template");
    } finally { setSaving(false); }
  };

  const installFromRegistry = async (entry: RegistryEntry) => {
    if (!workspaceId) return;
    const existing = skills.find((s) => s.slug === entry.slug);
    if (existing) return;
    setInstallingSlug(entry.slug);
    try {
      const res = await fetch(`/api/skills/registry/${entry.slug}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? "Failed to load skill content");
      const { skill } = await createSkill({ workspaceId, name: entry.name, slug: entry.slug, description: entry.description, content: json.data.content });
      setSkills((prev) => [...prev, skill]);
    } catch (err) {
      setRegistryError(err instanceof Error ? err.message : "Failed to install skill");
      setTimeout(() => setRegistryError(null), 3000);
    } finally { setInstallingSlug(null); }
  };

  const previewRegistrySkill = async (entry: RegistryEntry) => {
    setRegistryPreview({ entry, content: null, loading: true });
    try {
      const res = await fetch(`/api/skills/registry/${entry.slug}`);
      const json = await res.json();
      setRegistryPreview({ entry, content: json.success ? json.data.content : "Content not available.", loading: false });
    } catch { setRegistryPreview({ entry, content: "Failed to load content.", loading: false }); }
  };

  const autoSlug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const enabledCount = useMemo(() => skills.filter((s) => s.enabled).length, [skills]);
  const installedSlugs = useMemo(() => new Set(skills.map((s) => s.slug)), [skills]);

  if (!activeWorkspace) {
    return <div className="flex h-full items-center justify-center"><p className="text-sm text-text-secondary">Select a workspace to manage skills.</p></div>;
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border bg-surface px-6 py-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Skills</h2>
          <p className="text-sm text-text-secondary">
            Domain-specific instruction sets injected into AI context.{" "}
            {skills.length > 0 && <span className="text-text-muted">{enabledCount} of {skills.length} active</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowTemplates(true)}><Download size={14} />Templates</Button>
          <Button size="sm" onClick={openCreate}><Plus size={14} />New Skill</Button>
        </div>
      </div>

      <div className="border-b border-border bg-surface px-6">
        <div className="flex gap-6">
          {(["my-skills", "registry"] as TabId[]).map((t) => (
            <button key={t} onClick={() => setActiveTab(t)} className={`relative py-3 text-sm font-medium transition-colors ${activeTab === t ? "text-accent" : "text-text-secondary hover:text-foreground"}`}>
              {t === "my-skills" ? "My Skills" : <><Library size={14} className="inline mr-1" />Browse Registry <Badge variant="outline" className="text-[10px] px-1.5 py-0.5">{SKILLS_REGISTRY_COUNT}</Badge></>}
              {activeTab === t && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent" />}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {activeTab === "my-skills" ? (
          <div className="p-6">
            {loading ? (
              <div className="flex items-center justify-center py-12"><Loader2 size={20} className="animate-spin text-text-muted" /></div>
            ) : error ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
            ) : skills.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-accent-light"><BookOpen size={22} className="text-accent" /></div>
                <h3 className="text-base font-semibold text-foreground">No skills yet</h3>
                <p className="mt-1 max-w-sm text-sm text-text-secondary">Skills provide domain-specific knowledge to the AI. Create a custom skill or install from the registry.</p>
                <div className="mt-4 flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setActiveTab("registry")}><Library size={14} />Browse Registry</Button>
                  <Button size="sm" onClick={openCreate}><Plus size={14} />Create Skill</Button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {skills.map((skill) => (
                  <Card key={skill.id} className="flex items-center justify-between px-4 py-3 transition-colors hover:border-border-hover">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Zap size={14} className={skill.enabled ? "text-accent" : "text-text-muted"} />
                        <span className="text-sm font-medium text-foreground">{skill.name}</span>
                        <Badge variant="outline" className="font-mono text-[10px] px-1.5 py-0.5">{skill.slug}</Badge>
                      </div>
                      <p className="mt-0.5 truncate pl-6 text-xs text-text-secondary">{skill.description}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" onClick={() => setPreviewSkill(skill)} title="Preview" className="h-7 w-7"><Eye size={14} /></Button>
                      <Button variant="ghost" size="icon" onClick={() => openEdit(skill)} title="Edit" className="h-7 w-7"><Edit3 size={14} /></Button>
                      <Button variant="ghost" size="icon" onClick={() => handleToggle(skill)} disabled={busyId === skill.id} title={skill.enabled ? "Disable" : "Enable"} className="h-7 w-7">
                        {skill.enabled ? <ToggleRight size={14} className="text-accent" /> : <ToggleLeft size={14} />}
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(skill)} disabled={busyId === skill.id} title="Delete" className="h-7 w-7 hover:text-red-500"><Trash2 size={14} /></Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="p-6">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                <Input type="text" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder={`Search ${SKILLS_REGISTRY_COUNT} skills...`} className="pl-9" />
              </div>
              <select value={registryCategory} onChange={(e) => { setRegistryCategory(e.target.value); setRegistryPage(1); }} className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20">
                <option value="">All Categories</option>
                {registryData?.categories && Object.entries(registryData.categories).map(([key, val]) => <option key={key} value={key}>{val.label}</option>)}
              </select>
            </div>

            {registryData?.categories && !registryCategory && (
              <div className="mb-4 flex flex-wrap gap-2">
                {Object.entries(registryData.categories).map(([key, val]) => (
                  <button key={key} onClick={() => { setRegistryCategory(key); setRegistryPage(1); }} className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors hover:opacity-80 ${CATEGORY_COLORS[key] ?? "bg-surface-soft text-foreground border-border"}`}>{val.label}</button>
                ))}
              </div>
            )}

            {registryCategory && (
              <div className="mb-4 flex items-center gap-2">
                <span className="text-xs text-text-secondary">Filtered by:</span>
                <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${CATEGORY_COLORS[registryCategory] ?? "bg-surface-soft text-foreground border-border"}`}>
                  {registryData?.categories?.[registryCategory]?.label ?? registryCategory}
                  <button onClick={() => { setRegistryCategory(""); setRegistryPage(1); }} className="ml-0.5 rounded-full p-0.5 hover:bg-black/5"><X size={10} /></button>
                </span>
              </div>
            )}

            {registryError && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{registryError}</div>}

            {registryLoading ? (
              <div className="flex items-center justify-center py-12"><Loader2 size={20} className="animate-spin text-text-muted" /></div>
            ) : registryData ? (
              <>
                <div className="mb-3 text-xs text-text-secondary">
                  Showing {(registryData.pagination.page - 1) * registryData.pagination.limit + 1}–{Math.min(registryData.pagination.page * registryData.pagination.limit, registryData.pagination.total)} of {registryData.pagination.total} skills
                </div>
                <div className="space-y-2">
                  {registryData.items.map((entry) => {
                    const isInstalled = installedSlugs.has(entry.slug);
                    const isInstalling = installingSlug === entry.slug;
                    return (
                      <Card key={entry.slug} className="flex items-center justify-between px-4 py-3 transition-colors hover:border-border-hover">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-foreground">{entry.name}</span>
                            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${CATEGORY_COLORS[entry.category] ?? "bg-surface-soft text-text-secondary border-border"}`}>
                              {registryData.categories[entry.category]?.label ?? entry.category}
                            </span>
                            {entry.source === "builtin" && <Badge variant="default" className="text-[10px] px-1.5 py-0.5">Featured</Badge>}
                          </div>
                          <p className="mt-0.5 truncate text-xs text-text-secondary">{entry.description}</p>
                        </div>
                        <div className="ml-3 flex items-center gap-1.5">
                          <Button variant="ghost" size="icon" onClick={() => previewRegistrySkill(entry)} title="Preview" className="h-7 w-7"><Eye size={14} /></Button>
                          {isInstalled ? (
                            <Badge variant="success" className="flex items-center gap-1 px-2.5 py-1.5"><Check size={12} />Installed</Badge>
                          ) : (
                            <Button variant="ghost" size="sm" onClick={() => installFromRegistry(entry)} disabled={isInstalling} className="text-accent hover:bg-accent/10">
                              {isInstalling ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}Install
                            </Button>
                          )}
                        </div>
                      </Card>
                    );
                  })}
                </div>
                {registryData.pagination.totalPages > 1 && (
                  <div className="mt-4 flex items-center justify-between">
                    <Button variant="outline" size="sm" onClick={() => setRegistryPage((p) => Math.max(1, p - 1))} disabled={registryData.pagination.page <= 1}><ChevronLeft size={14} />Previous</Button>
                    <span className="text-xs text-text-secondary">Page {registryData.pagination.page} of {registryData.pagination.totalPages}</span>
                    <Button variant="outline" size="sm" onClick={() => setRegistryPage((p) => Math.min(registryData.pagination.totalPages, p + 1))} disabled={registryData.pagination.page >= registryData.pagination.totalPages}>Next<ChevronRight size={14} /></Button>
                  </div>
                )}
              </>
            ) : null}
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center animate-fade-in">
          <div className="absolute inset-0 bg-black/20 backdrop-blur-md" onClick={() => setShowForm(false)} />
          <form onSubmit={handleSave} className="animate-scale-in relative w-full max-w-2xl overflow-hidden rounded-2xl border border-border bg-surface/95 shadow-2xl backdrop-blur-xl">
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <h2 className="text-sm font-semibold text-foreground">{editingId ? "Edit Skill" : "New Skill"}</h2>
              <Button type="button" variant="ghost" size="icon" onClick={() => setShowForm(false)} className="h-7 w-7"><X size={14} /></Button>
            </div>
            <div className="max-h-[70vh] space-y-4 overflow-y-auto p-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-text-secondary">Name</label>
                  <Input value={form.name} onChange={(e) => { const name = e.target.value; setForm((f) => ({ ...f, name, slug: editingId ? f.slug : autoSlug(name) })); }} placeholder="Next.js App Router" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-text-secondary">Slug</label>
                  <Input value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))} placeholder="nextjs-app-router" className="font-mono" />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-text-secondary">Description</label>
                <Input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Best practices for Next.js 14+ App Router" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-text-secondary">Content (Markdown)</label>
                <Textarea value={form.content} onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))} placeholder={"# Skill Title\n\n## Section\n- Instruction 1\n- Instruction 2"} rows={14} className="font-mono" />
              </div>
              {formError && <p className="text-xs text-red-600">{formError}</p>}
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">
              <Button type="button" variant="ghost" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button type="submit" size="sm" disabled={!form.name.trim() || !form.slug.trim() || !form.content.trim() || saving}>
                {saving && <Loader2 size={14} className="animate-spin" />}{editingId ? "Save Changes" : "Create Skill"}
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Templates Modal */}
      {showTemplates && (
        <div className="fixed inset-0 z-50 flex items-center justify-center animate-fade-in">
          <div className="absolute inset-0 bg-black/20 backdrop-blur-md" onClick={() => setShowTemplates(false)} />
          <div className="animate-scale-in relative w-full max-w-2xl overflow-hidden rounded-2xl border border-border bg-surface/95 shadow-2xl backdrop-blur-xl">
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <h2 className="text-sm font-semibold text-foreground">Skill Templates</h2>
              <Button variant="ghost" size="icon" onClick={() => setShowTemplates(false)} className="h-7 w-7"><X size={14} /></Button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto p-5">
              {formError && <p className="mb-3 text-xs text-red-600">{formError}</p>}
              <div className="space-y-3">
                {SKILL_TEMPLATES.map((template) => {
                  const installed = skills.some((s) => s.slug === template.slug);
                  return (
                    <Card key={template.slug} className="flex items-center justify-between px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <BookOpen size={14} className="text-accent" />
                          <span className="text-sm font-medium text-foreground">{template.name}</span>
                        </div>
                        <p className="mt-0.5 pl-6 text-xs text-text-secondary">{template.description}</p>
                      </div>
                      <Button variant={installed ? "secondary" : "ghost"} size="sm" onClick={() => installTemplate(template)} disabled={installed || saving} className={installed ? "opacity-60" : "text-accent hover:bg-accent/10"}>
                        {installed ? "Installed" : "Install"}
                      </Button>
                    </Card>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal (My Skills) */}
      {previewSkill && (
        <div className="fixed inset-0 z-50 flex items-center justify-center animate-fade-in">
          <div className="absolute inset-0 bg-black/20 backdrop-blur-md" onClick={() => setPreviewSkill(null)} />
          <div className="animate-scale-in relative w-full max-w-2xl overflow-hidden rounded-2xl border border-border bg-surface/95 shadow-2xl backdrop-blur-xl">
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <h2 className="text-sm font-semibold text-foreground">{previewSkill.name}</h2>
              <Button variant="ghost" size="icon" onClick={() => setPreviewSkill(null)} className="h-7 w-7"><X size={14} /></Button>
            </div>
            <div className="max-h-[70vh] overflow-y-auto p-5">
              <pre className="whitespace-pre-wrap font-mono text-sm text-text-secondary leading-relaxed">{previewSkill.content}</pre>
            </div>
          </div>
        </div>
      )}

      {/* Registry Preview Modal */}
      {registryPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center animate-fade-in">
          <div className="absolute inset-0 bg-black/20 backdrop-blur-md" onClick={() => setRegistryPreview(null)} />
          <div className="animate-scale-in relative w-full max-w-2xl overflow-hidden rounded-2xl border border-border bg-surface/95 shadow-2xl backdrop-blur-xl">
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-foreground">{registryPreview.entry.name}</h2>
                <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${CATEGORY_COLORS[registryPreview.entry.category] ?? "bg-surface-soft text-text-secondary border-border"}`}>{registryPreview.entry.category}</span>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setRegistryPreview(null)} className="h-7 w-7"><X size={14} /></Button>
            </div>
            <div className="max-h-[70vh] overflow-y-auto p-5">
              {registryPreview.loading ? <div className="flex items-center justify-center py-8"><Loader2 size={20} className="animate-spin text-text-muted" /></div> : <pre className="whitespace-pre-wrap font-mono text-sm text-text-secondary leading-relaxed">{registryPreview.content}</pre>}
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">
              <Button variant="ghost" size="sm" onClick={() => setRegistryPreview(null)}>Close</Button>
              {!installedSlugs.has(registryPreview.entry.slug) && (
                <Button size="sm" onClick={() => { installFromRegistry(registryPreview.entry); setRegistryPreview(null); }}><Download size={14} />Install Skill</Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
