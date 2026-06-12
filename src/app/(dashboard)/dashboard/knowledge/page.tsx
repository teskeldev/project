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

type TypeFilter = "all" | "starred" | KnowledgeType;

const TYPE_META: Record<
  KnowledgeType,
  { label: string; icon: typeof FileText; cls: string }
> = {
  TEXT: { label: "Text", icon: Book, cls: "bg-blue-50 text-blue-600" },
  NOTE: { label: "Note", icon: FileText, cls: "bg-purple-50 text-purple-600" },
  FILE: { label: "File", icon: Folder, cls: "bg-gray-100 text-gray-600" },
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

export default function KnowledgePage() {
  const { activeProject, activeWorkspace } = useProject();
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<KnowledgeItem[] | null>(
    null
  );
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
      const { items: data } = await listKnowledge(activeProject?.id);
      setItems(data);
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : "Failed to load knowledge"
      );
    } finally {
      setLoading(false);
    }
  }, [activeProject]);

  useEffect(() => {
    void load();
  }, [load]);

  // Debounced server-side search wired to /api/knowledge/search.
  useEffect(() => {
    const q = search.trim();
    if (!q) {
      setSearchResults(null);
      setSearching(false);
      return;
    }
    setSearching(true);
    const handle = setTimeout(async () => {
      try {
        const { items: results } = await searchKnowledge(q, activeProject?.id);
        setSearchResults(results);
      } catch (err) {
        setError(
          err instanceof ApiClientError ? err.message : "Search failed"
        );
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(handle);
  }, [search, activeProject]);

  const source = searchResults ?? items;

  const filtered = useMemo(() => {
    if (activeFilter === "all") return source;
    if (activeFilter === "starred") return source.filter(isStarred);
    return source.filter((i) => i.type === activeFilter);
  }, [source, activeFilter]);

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setShowForm(true);
  };

  const openEdit = (item: KnowledgeItem) => {
    setEditingId(item.id);
    setForm({ type: item.type, title: item.title, content: item.content });
    setFormError(null);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError(null);
  };

  const replaceItem = (next: KnowledgeItem) => {
    setItems((prev) => prev.map((i) => (i.id === next.id ? next : i)));
    setSearchResults((prev) =>
      prev ? prev.map((i) => (i.id === next.id ? next : i)) : prev
    );
  };

  const handleToggleStar = async (item: KnowledgeItem) => {
    setBusyId(item.id);
    setError(null);
    const base =
      item.metadata && typeof item.metadata === "object"
        ? { ...(item.metadata as Record<string, unknown>) }
        : {};
    try {
      const { item: updated } = await updateKnowledge(item.id, {
        metadata: { ...base, starred: !isStarred(item) },
      });
      replaceItem(updated);
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.message : "Failed to update item"
      );
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (item: KnowledgeItem) => {
    if (
      !window.confirm(`Delete "${item.title}"? This cannot be undone.`)
    )
      return;
    setBusyId(item.id);
    setError(null);
    try {
      await deleteKnowledge(item.id);
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      setSearchResults((prev) =>
        prev ? prev.filter((i) => i.id !== item.id) : prev
      );
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.message : "Failed to delete item"
      );
    } finally {
      setBusyId(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!form.title.trim() || !form.content.trim()) {
      setFormError("Title and content are required.");
      return;
    }

    setSaving(true);
    try {
      if (editingId) {
        const { item } = await updateKnowledge(editingId, {
          title: form.title.trim(),
          type: form.type,
          content: form.content.trim(),
        });
        replaceItem(item);
      } else {
        if (!activeWorkspace) {
          setFormError("No active workspace available.");
          setSaving(false);
          return;
        }
        const { item } = await createKnowledge({
          workspaceId: activeWorkspace.id,
          projectId: activeProject?.id,
          title: form.title.trim(),
          type: form.type,
          content: form.content.trim(),
        });
        setItems((prev) => [item, ...prev]);
      }
      closeForm();
    } catch (err) {
      setFormError(
        err instanceof ApiClientError ? err.message : "Failed to save item"
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-[22px] font-semibold text-gray-900">
              Projects &amp; Knowledge
            </h1>
            <p className="mt-1 text-[14px] text-gray-500">
              Custom instructions and context for your AI agents
            </p>
          </div>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-[13px] font-medium text-white hover:bg-gray-800"
          >
            <Plus size={14} />
            Add Knowledge
          </button>
        </div>

        <p className="mb-6 rounded-lg bg-blue-50 px-3 py-2 text-[12px] text-blue-700">
          Knowledge is available to AI as project context.
        </p>

        {/* Search */}
        <div className="relative mb-6">
          {searching ? (
            <Loader2
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 animate-spin text-gray-400"
            />
          ) : (
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
          )}
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search knowledge base..."
            className="w-full rounded-lg border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-[13px] text-gray-900 placeholder-gray-400 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-50"
          />
        </div>

        {/* Filter tabs */}
        <div className="mb-6 flex flex-wrap gap-2">
          {(
            [
              { key: "all", label: "All", icon: Folder },
              { key: "starred", label: "Starred", icon: Star },
              { key: "TEXT", label: "Text", icon: Book },
              { key: "NOTE", label: "Notes", icon: FileText },
              { key: "FILE", label: "Files", icon: Folder },
              { key: "URL", label: "URLs", icon: Link2 },
            ] as { key: TypeFilter; label: string; icon: typeof Folder }[]
          ).map((f) => (
            <button
              key={f.key}
              onClick={() => setActiveFilter(f.key)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium transition-colors ${
                activeFilter === f.key
                  ? "bg-gray-900 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              <f.icon size={12} />
              {f.label}
            </button>
          ))}
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-600">
            {error}
          </div>
        )}

        {/* States */}
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-gray-400">
            <Loader2 size={18} className="animate-spin" />
            <span className="text-[13px]">Loading knowledge...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-200 bg-white py-16 text-center">
            <p className="text-[14px] font-medium text-gray-700">
              {searchResults !== null
                ? "No matching knowledge"
                : "No knowledge yet"}
            </p>
            <p className="mt-1 text-[13px] text-gray-500">
              {searchResults !== null
                ? "Try a different search term."
                : "Add documents, notes, or context to feed your AI agents."}
            </p>
            {searchResults === null && (
              <button
                onClick={openCreate}
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-[13px] font-medium text-white hover:bg-gray-800"
              >
                <Plus size={14} />
                Add Knowledge
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((item) => {
              const meta = TYPE_META[item.type];
              const Icon = meta.icon;
              const starred = isStarred(item);
              return (
                <div
                  key={item.id}
                  className="rounded-xl border border-gray-200 bg-white p-5 transition-shadow hover:shadow-sm"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className={`mt-0.5 rounded-lg p-2 ${meta.cls}`}>
                        <Icon size={14} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-[14px] font-semibold text-gray-900">
                            {item.title}
                          </h3>
                          {starred && (
                            <Star
                              size={12}
                              className="fill-yellow-400 text-yellow-400"
                            />
                          )}
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${meta.cls}`}
                          >
                            {meta.label}
                          </span>
                        </div>
                        {item.projectId === null && (
                          <span className="mt-0.5 inline-block rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500">
                            workspace
                          </span>
                        )}
                        <p className="mt-2 whitespace-pre-wrap text-[13px] leading-relaxed text-gray-500">
                          {item.content}
                        </p>
                      </div>
                    </div>
                    <div className="ml-4 flex items-center gap-1">
                      <button
                        onClick={() => handleToggleStar(item)}
                        disabled={busyId === item.id}
                        className={`rounded p-1.5 hover:bg-gray-100 disabled:opacity-50 ${
                          starred
                            ? "text-yellow-500"
                            : "text-gray-400 hover:text-gray-600"
                        }`}
                        aria-label={starred ? "Unstar" : "Star"}
                      >
                        <Star
                          size={14}
                          className={starred ? "fill-yellow-400" : ""}
                        />
                      </button>
                      <button
                        onClick={() => openEdit(item)}
                        disabled={busyId === item.id}
                        className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-50"
                        aria-label="Edit"
                      >
                        <Edit3 size={14} />
                      </button>
                      <button
                        onClick={() => handleDelete(item)}
                        disabled={busyId === item.id}
                        className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-red-500 disabled:opacity-50"
                        aria-label="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create / edit modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-[16px] font-semibold text-gray-900">
                {editingId ? "Edit Knowledge" : "Add Knowledge"}
              </h2>
              <button
                onClick={closeForm}
                className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-[12px] font-medium text-gray-700">
                  Type
                </label>
                <div className="flex flex-wrap gap-2">
                  {(
                    Object.keys(TYPE_META) as KnowledgeType[]
                  ).map((t) => {
                    const Icon = TYPE_META[t].icon;
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, type: t }))}
                        className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium ${
                          form.type === t
                            ? "bg-gray-900 text-white"
                            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        }`}
                      >
                        <Icon size={12} />
                        {TYPE_META[t].label}
                      </button>
                    );
                  })}
                </div>
                {form.type === "FILE" && (
                  <p className="mt-1 text-[11px] text-gray-500">
                    Paste text content (markdown / txt / json). Binary upload is
                    not yet supported.
                  </p>
                )}
                {form.type === "URL" && (
                  <p className="mt-1 text-[11px] text-gray-500">
                    Stores the URL as context. Automatic fetching is future
                    work.
                  </p>
                )}
              </div>

              <div>
                <label className="mb-1 block text-[12px] font-medium text-gray-700">
                  Title
                </label>
                <input
                  value={form.title}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, title: e.target.value }))
                  }
                  placeholder="e.g. Project Architecture"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-[13px] text-gray-900 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-50"
                />
              </div>

              <div>
                <label className="mb-1 block text-[12px] font-medium text-gray-700">
                  {form.type === "URL" ? "URL" : "Content"}
                </label>
                <textarea
                  value={form.content}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, content: e.target.value }))
                  }
                  rows={form.type === "URL" ? 2 : 6}
                  placeholder={
                    form.type === "URL"
                      ? "https://example.com/docs"
                      : "Paste content the AI should know about..."
                  }
                  className="w-full resize-y rounded-lg border border-gray-200 px-3 py-2 text-[13px] text-gray-900 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-50"
                />
              </div>

              {!editingId && (
                <p className="text-[11px] text-gray-500">
                  Saved to{" "}
                  {activeProject
                    ? `project "${activeProject.name}"`
                    : `workspace "${activeWorkspace?.name ?? "—"}"`}
                  .
                </p>
              )}

              {formError && (
                <p className="text-[12px] text-red-600">{formError}</p>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeForm}
                  className="rounded-lg px-4 py-2 text-[13px] font-medium text-gray-600 hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-[13px] font-medium text-white hover:bg-gray-800 disabled:opacity-60"
                >
                  {saving && <Loader2 size={14} className="animate-spin" />}
                  {editingId ? "Save changes" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
