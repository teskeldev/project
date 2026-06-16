"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Plus,
  FileText,
  Book,
  Folder,
  Link2,
  Star,
  Search,
  Trash2,
  Edit3,
  Loader2,
  X,
} from "lucide-react";
import { useProject } from "@/lib/store/project";
import { ApiClientError } from "@/lib/client/api";
import {
  listKnowledge,
  createKnowledge,
  updateKnowledge,
  deleteKnowledge,
  searchKnowledge,
  type KnowledgeItem,
  type KnowledgeType,
} from "@/lib/client/knowledge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type TypeFilter = "all" | "starred" | KnowledgeType;

const TYPE_META: Record<
  KnowledgeType,
  { label: string; icon: typeof FileText; cls: string }
> = {
  TEXT: { label: "Text", icon: Book, cls: "bg-accent-light text-accent" },
  NOTE: { label: "Note", icon: FileText, cls: "bg-purple-50 text-purple-600" },
  FILE: { label: "File", icon: Folder, cls: "bg-surface-soft text-text-secondary" },
  URL: { label: "URL", icon: Link2, cls: "bg-emerald-50 text-emerald-600" },
};

function isStarred(item: KnowledgeItem): boolean {
  const m = item.metadata;
  return !!(m && typeof m === "object" && (m as Record<string, unknown>).starred);
}

type FormState = {
  type: KnowledgeType;
  title: string;
  content: string;
};

const EMPTY_FORM: FormState = { type: "TEXT", title: "", content: "" };

export default function KnowledgeTab() {
  const { activeProject, activeWorkspace } = useProject();
  const projectId = activeProject?.id ?? null;
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<KnowledgeItem[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [activeFilter, setActiveFilter] = useState<TypeFilter>("all");

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { items: data } = await listKnowledge(projectId ?? undefined);
      setItems(data);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to load knowledge");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const q = search.trim();
    if (!q) { setSearchResults(null); setSearching(false); return; }
    setSearching(true);
    const handle = setTimeout(async () => {
      try {
        const { items: results } = await searchKnowledge(q, projectId);
        setSearchResults(results);
      } catch (err) {
        setError(err instanceof ApiClientError ? err.message : "Search failed");
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(handle);
  }, [search, projectId]);

  const source = searchResults ?? items;

  const filtered = useMemo(() => {
    if (activeFilter === "all") return source;
    if (activeFilter === "starred") return source.filter(isStarred);
    return source.filter((i) => i.type === activeFilter);
  }, [source, activeFilter]);

  const openCreate = () => { setEditingId(null); setForm(EMPTY_FORM); setFormError(null); setShowForm(true); };
  const openEdit = (item: KnowledgeItem) => { setEditingId(item.id); setForm({ type: item.type, title: item.title, content: item.content }); setFormError(null); setShowForm(true); };
  const closeForm = () => { setShowForm(false); setEditingId(null); setForm(EMPTY_FORM); setFormError(null); };

  const replaceItem = (next: KnowledgeItem) => {
    setItems((prev) => prev.map((i) => (i.id === next.id ? next : i)));
    setSearchResults((prev) => prev ? prev.map((i) => (i.id === next.id ? next : i)) : prev);
  };

  const handleToggleStar = async (item: KnowledgeItem) => {
    setBusyId(item.id);
    setError(null);
    const base = item.metadata && typeof item.metadata === "object" ? { ...(item.metadata as Record<string, unknown>) } : {};
    try {
      const { item: updated } = await updateKnowledge(item.id, { metadata: { ...base, starred: !isStarred(item) } });
      replaceItem(updated);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to update item");
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (item: KnowledgeItem) => {
    if (!window.confirm(`Delete "${item.title}"? This cannot be undone.`)) return;
    setBusyId(item.id);
    setError(null);
    try {
      await deleteKnowledge(item.id);
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      setSearchResults((prev) => prev ? prev.filter((i) => i.id !== item.id) : prev);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to delete item");
    } finally {
      setBusyId(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!form.title.trim() || !form.content.trim()) { setFormError("Title and content are required."); return; }
    setSaving(true);
    try {
      if (editingId) {
        const { item } = await updateKnowledge(editingId, { title: form.title.trim(), type: form.type, content: form.content.trim() });
        replaceItem(item);
      } else {
        if (!activeWorkspace) { setFormError("No active workspace available."); setSaving(false); return; }
        const { item } = await createKnowledge({ workspaceId: activeWorkspace.id, projectId: activeProject?.id, title: form.title.trim(), type: form.type, content: form.content.trim() });
        setItems((prev) => [item, ...prev]);
      }
      closeForm();
    } catch (err) {
      setFormError(err instanceof ApiClientError ? err.message : "Failed to save item");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-[22px] font-semibold text-foreground">Knowledge</h2>
            <p className="mt-1 text-[14px] text-text-secondary">Documents, URLs, and notes the AI can reference</p>
          </div>
          <Button onClick={openCreate} className="gap-2">
            <Plus size={14} />
            Add Knowledge
          </Button>
        </div>

        <div className="relative mb-6">
          {searching ? <Loader2 size={16} className="absolute left-3 top-1/2 -translate-y-1/2 animate-spin text-text-muted" /> : <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />}
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search knowledge base..." className="w-full py-2.5 pl-10 pr-4 text-[13px]" />
        </div>

        <div className="mb-6 flex flex-wrap gap-2">
          {([
            { key: "all", label: "All", icon: Folder },
            { key: "starred", label: "Starred", icon: Star },
            { key: "TEXT", label: "Text", icon: Book },
            { key: "NOTE", label: "Notes", icon: FileText },
            { key: "FILE", label: "Files", icon: Folder },
            { key: "URL", label: "URLs", icon: Link2 },
          ] as { key: TypeFilter; label: string; icon: typeof Folder }[]).map((f) => (
            <Button key={f.key} variant={activeFilter === f.key ? "default" : "secondary"} size="sm" onClick={() => setActiveFilter(f.key)} className="gap-1.5 text-[12px]">
              <f.icon size={12} />
              {f.label}
            </Button>
          ))}
        </div>

        {error && <Card className="mb-4 border-red-200 bg-red-50"><CardContent className="px-3 py-2"><p className="text-[13px] text-red-600">{error}</p></CardContent></Card>}

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-text-muted">
            <Loader2 size={18} className="animate-spin" />
            <span className="text-[13px]">Loading knowledge...</span>
          </div>
        ) : filtered.length === 0 ? (
          <Card className="border-dashed py-16 text-center">
            <CardContent>
              <p className="text-[14px] font-medium text-foreground">{searchResults !== null ? "No matching knowledge" : "No knowledge yet"}</p>
              <p className="mt-1 text-[13px] text-text-secondary">{searchResults !== null ? "Try a different search term." : "Add documents, notes, or context to feed your AI agents."}</p>
              {searchResults === null && <Button onClick={openCreate} className="mt-4 gap-2"><Plus size={14} />Add Knowledge</Button>}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filtered.map((item) => {
              const meta = TYPE_META[item.type];
              const Icon = meta.icon;
              const starred = isStarred(item);
              return (
                <Card key={item.id} className="p-5 transition-shadow hover:shadow-sm">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className={`mt-0.5 rounded-lg p-2 ${meta.cls}`}><Icon size={14} /></div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-[14px] font-semibold text-foreground">{item.title}</h3>
                          {starred && <Star size={12} className="fill-yellow-400 text-yellow-400" />}
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${meta.cls}`}>{meta.label}</span>
                        </div>
                        {item.projectId === null && <span className="mt-0.5 inline-block rounded bg-surface-soft px-1.5 py-0.5 text-[10px] font-medium text-text-secondary">workspace</span>}
                        <p className="mt-2 whitespace-pre-wrap text-[13px] leading-relaxed text-text-secondary">{item.content}</p>
                      </div>
                    </div>
                    <div className="ml-4 flex items-center gap-1">
                      <Button variant="ghost" size="icon" onClick={() => handleToggleStar(item)} disabled={busyId === item.id} className={`h-7 w-7 ${starred ? "text-yellow-500" : "text-text-muted hover:text-text-secondary"}`} aria-label={starred ? "Unstar" : "Star"}>
                        <Star size={14} className={starred ? "fill-yellow-400" : ""} />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => openEdit(item)} disabled={busyId === item.id} className="h-7 w-7 text-text-muted hover:text-text-secondary" aria-label="Edit"><Edit3 size={14} /></Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(item)} disabled={busyId === item.id} className="h-7 w-7 text-text-muted hover:text-destructive" aria-label="Delete"><Trash2 size={14} /></Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <Card className="w-full max-w-lg p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-[16px] font-semibold text-foreground">{editingId ? "Edit Knowledge" : "Add Knowledge"}</h2>
              <Button variant="ghost" size="icon" onClick={closeForm} className="h-7 w-7 text-text-muted hover:text-text-secondary" aria-label="Close"><X size={16} /></Button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-[12px] font-medium text-foreground">Type</label>
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(TYPE_META) as KnowledgeType[]).map((t) => {
                    const TypeIcon = TYPE_META[t].icon;
                    return (
                      <Button key={t} type="button" variant={form.type === t ? "default" : "secondary"} size="sm" onClick={() => setForm((f) => ({ ...f, type: t }))} className="gap-1.5 text-[12px]">
                        <TypeIcon size={12} />{TYPE_META[t].label}
                      </Button>
                    );
                  })}
                </div>
                {form.type === "FILE" && <p className="mt-1 text-[11px] text-text-secondary">Paste text content (markdown / txt / json). Binary upload is not yet supported.</p>}
                {form.type === "URL" && <p className="mt-1 text-[11px] text-text-secondary">Stores the URL as context. Automatic fetching is future work.</p>}
              </div>
              <div>
                <label className="mb-1 block text-[12px] font-medium text-foreground">Title</label>
                <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="e.g. Project Architecture" className="text-[13px]" />
              </div>
              <div>
                <label className="mb-1 block text-[12px] font-medium text-foreground">{form.type === "URL" ? "URL" : "Content"}</label>
                <textarea
                  value={form.content}
                  onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                  rows={form.type === "URL" ? 2 : 6}
                  placeholder={form.type === "URL" ? "https://example.com/docs" : "Paste content the AI should know about..."}
                  className="flex min-h-[80px] w-full resize-y rounded-lg border border-border bg-surface px-3 py-2 text-[13px] text-foreground shadow-sm transition-colors placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>
              {!editingId && <p className="text-[11px] text-text-secondary">Saved to {activeProject ? `project "${activeProject.name}"` : `workspace "${activeWorkspace?.name ?? "—"}"`}.</p>}
              {formError && <p className="text-[12px] text-destructive">{formError}</p>}
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="ghost" onClick={closeForm}>Cancel</Button>
                <Button type="submit" disabled={saving} className="gap-2">{saving && <Loader2 size={14} className="animate-spin" />}{editingId ? "Save changes" : "Create"}</Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
