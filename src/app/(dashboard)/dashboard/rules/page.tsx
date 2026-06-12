"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Plus,
  FileCode,
  Globe,
  FolderOpen,
  Building2,
  ToggleLeft,
  ToggleRight,
  Trash2,
  Edit3,
  Loader2,
  X,
} from "lucide-react";
import { useProject } from "@/lib/store/project";
import { ApiClientError } from "@/lib/client/api";
import {
  listRules,
  createRule,
  updateRule,
  deleteRule,
  type Rule,
  type RuleScope,
} from "@/lib/client/rules";

type ScopeFilter = "all" | "GLOBAL" | "PROJECT" | "FILE";

const SCOPE_BADGE: Record<RuleScope, string> = {
  GLOBAL: "bg-blue-50 text-blue-600",
  WORKSPACE: "bg-emerald-50 text-emerald-600",
  PROJECT: "bg-purple-50 text-purple-600",
  FILE: "bg-orange-50 text-orange-600",
};

type FormState = {
  scope: RuleScope;
  title: string;
  content: string;
  filePattern: string;
};

const EMPTY_FORM: FormState = {
  scope: "GLOBAL",
  title: "",
  content: "",
  filePattern: "",
};

export default function RulesPage() {
  const { activeProject, activeWorkspace } = useProject();
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeScope, setActiveScope] = useState<ScopeFilter>("all");

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
      const { rules: data } = await listRules(
        activeProject ? { projectId: activeProject.id } : undefined
      );
      setRules(data);
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.message : "Failed to load rules"
      );
    } finally {
      setLoading(false);
    }
  }, [activeProject]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    if (activeScope === "all") return rules;
    if (activeScope === "PROJECT")
      return rules.filter((r) => r.scope === "PROJECT");
    return rules.filter((r) => r.scope === activeScope);
  }, [rules, activeScope]);

  const openCreate = () => {
    setEditingId(null);
    setForm({
      ...EMPTY_FORM,
      scope: activeProject ? "PROJECT" : "GLOBAL",
    });
    setFormError(null);
    setShowForm(true);
  };

  const openEdit = (rule: Rule) => {
    setEditingId(rule.id);
    setForm({
      scope: rule.scope,
      title: rule.title,
      content: rule.content,
      filePattern: rule.filePattern ?? "",
    });
    setFormError(null);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError(null);
  };

  const handleToggle = async (rule: Rule) => {
    setBusyId(rule.id);
    setError(null);
    // Optimistic flip.
    setRules((prev) =>
      prev.map((r) => (r.id === rule.id ? { ...r, enabled: !r.enabled } : r))
    );
    try {
      const { rule: updated } = await updateRule(rule.id, {
        enabled: !rule.enabled,
      });
      setRules((prev) => prev.map((r) => (r.id === rule.id ? updated : r)));
    } catch (err) {
      // Revert on failure.
      setRules((prev) =>
        prev.map((r) => (r.id === rule.id ? rule : r))
      );
      setError(
        err instanceof ApiClientError ? err.message : "Failed to update rule"
      );
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (rule: Rule) => {
    if (
      !window.confirm(`Delete rule "${rule.title}"? This cannot be undone.`)
    )
      return;
    setBusyId(rule.id);
    setError(null);
    try {
      await deleteRule(rule.id);
      setRules((prev) => prev.filter((r) => r.id !== rule.id));
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.message : "Failed to delete rule"
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
        const { rule } = await updateRule(editingId, {
          title: form.title.trim(),
          content: form.content.trim(),
          filePattern:
            form.scope === "FILE" ? form.filePattern.trim() || null : null,
        });
        setRules((prev) => prev.map((r) => (r.id === editingId ? rule : r)));
      } else {
        // Resolve scope -> ids.
        if (form.scope === "PROJECT" && !activeProject) {
          setFormError("Select a project to create a project-scoped rule.");
          setSaving(false);
          return;
        }
        if (
          (form.scope === "WORKSPACE" || form.scope === "FILE") &&
          !activeWorkspace
        ) {
          setFormError("No active workspace available.");
          setSaving(false);
          return;
        }
        if (form.scope === "FILE" && !form.filePattern.trim()) {
          setFormError("File-scoped rules require a file pattern.");
          setSaving(false);
          return;
        }

        const { rule } = await createRule({
          scope: form.scope,
          title: form.title.trim(),
          content: form.content.trim(),
          filePattern:
            form.scope === "FILE" ? form.filePattern.trim() : undefined,
          projectId:
            form.scope === "PROJECT" || form.scope === "FILE"
              ? activeProject?.id
              : undefined,
          workspaceId:
            form.scope === "WORKSPACE"
              ? activeWorkspace?.id
              : form.scope === "FILE" && !activeProject
                ? activeWorkspace?.id
                : undefined,
        });
        setRules((prev) => [...prev, rule]);
      }
      closeForm();
    } catch (err) {
      setFormError(
        err instanceof ApiClientError ? err.message : "Failed to save rule"
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
              Rules &amp; Context
            </h1>
            <p className="mt-1 text-[14px] text-gray-500">
              Configure how Teskel writes and reviews code
            </p>
          </div>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-[13px] font-medium text-white hover:bg-gray-800"
          >
            <Plus size={14} />
            Add Rule
          </button>
        </div>

        <p className="mb-6 rounded-lg bg-blue-50 px-3 py-2 text-[12px] text-blue-700">
          Enabled rules are injected into AI chat &amp; agent context.
        </p>

        {/* Scope filters */}
        <div className="mb-6 flex gap-2">
          {[
            { key: "all", label: "All Rules", icon: FileCode },
            { key: "GLOBAL", label: "Global", icon: Globe },
            { key: "PROJECT", label: "Project", icon: FolderOpen },
            { key: "FILE", label: "File Pattern", icon: FileCode },
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => setActiveScope(f.key as ScopeFilter)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium transition-colors ${
                activeScope === f.key
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
            <span className="text-[13px]">Loading rules...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-200 bg-white py-16 text-center">
            <p className="text-[14px] font-medium text-gray-700">
              No rules yet
            </p>
            <p className="mt-1 text-[13px] text-gray-500">
              Add a rule to guide how Teskel writes and reviews code.
            </p>
            <button
              onClick={openCreate}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-[13px] font-medium text-white hover:bg-gray-800"
            >
              <Plus size={14} />
              Add Rule
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((rule) => (
              <div
                key={rule.id}
                className={`rounded-xl border bg-white p-5 transition-all ${
                  rule.enabled
                    ? "border-gray-200"
                    : "border-gray-100 opacity-60"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-3">
                      <h3 className="text-[14px] font-semibold text-gray-900">
                        {rule.title}
                      </h3>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${SCOPE_BADGE[rule.scope]}`}
                      >
                        {rule.scope.toLowerCase()}
                      </span>
                      {rule.filePattern && (
                        <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[10px] text-gray-500">
                          {rule.filePattern}
                        </span>
                      )}
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-[13px] leading-relaxed text-gray-500">
                      {rule.content}
                    </p>
                  </div>
                  <div className="ml-4 flex items-center gap-2">
                    <button
                      onClick={() => openEdit(rule)}
                      disabled={busyId === rule.id}
                      className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-50"
                      aria-label="Edit rule"
                    >
                      <Edit3 size={14} />
                    </button>
                    <button
                      onClick={() => handleDelete(rule)}
                      disabled={busyId === rule.id}
                      className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-red-500 disabled:opacity-50"
                      aria-label="Delete rule"
                    >
                      <Trash2 size={14} />
                    </button>
                    <button
                      onClick={() => handleToggle(rule)}
                      disabled={busyId === rule.id}
                      className={`${rule.enabled ? "text-blue-600" : "text-gray-300"} disabled:opacity-50`}
                      aria-label={rule.enabled ? "Disable rule" : "Enable rule"}
                    >
                      {rule.enabled ? (
                        <ToggleRight size={22} />
                      ) : (
                        <ToggleLeft size={22} />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create / edit modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-[16px] font-semibold text-gray-900">
                {editingId ? "Edit Rule" : "Add Rule"}
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
              {!editingId && (
                <div>
                  <label className="mb-1 block text-[12px] font-medium text-gray-700">
                    Scope
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {(
                      [
                        { v: "GLOBAL", label: "Global", icon: Globe },
                        {
                          v: "WORKSPACE",
                          label: "Workspace",
                          icon: Building2,
                        },
                        {
                          v: "PROJECT",
                          label: "Project",
                          icon: FolderOpen,
                        },
                        { v: "FILE", label: "File", icon: FileCode },
                      ] as { v: RuleScope; label: string; icon: typeof Globe }[]
                    ).map((s) => (
                      <button
                        key={s.v}
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, scope: s.v }))}
                        className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium ${
                          form.scope === s.v
                            ? "bg-gray-900 text-white"
                            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        }`}
                      >
                        <s.icon size={12} />
                        {s.label}
                      </button>
                    ))}
                  </div>
                  {form.scope === "PROJECT" && (
                    <p className="mt-1 text-[11px] text-gray-500">
                      Targets:{" "}
                      {activeProject
                        ? activeProject.name
                        : "no active project selected"}
                    </p>
                  )}
                  {form.scope === "WORKSPACE" && (
                    <p className="mt-1 text-[11px] text-gray-500">
                      Targets:{" "}
                      {activeWorkspace
                        ? activeWorkspace.name
                        : "no active workspace"}
                    </p>
                  )}
                </div>
              )}

              <div>
                <label className="mb-1 block text-[12px] font-medium text-gray-700">
                  Title
                </label>
                <input
                  value={form.title}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, title: e.target.value }))
                  }
                  placeholder="e.g. TypeScript Strict"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-[13px] text-gray-900 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-50"
                />
              </div>

              {form.scope === "FILE" && (
                <div>
                  <label className="mb-1 block text-[12px] font-medium text-gray-700">
                    File pattern
                  </label>
                  <input
                    value={form.filePattern}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, filePattern: e.target.value }))
                    }
                    placeholder="**/*.test.{ts,tsx}"
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 font-mono text-[13px] text-gray-900 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-50"
                  />
                </div>
              )}

              <div>
                <label className="mb-1 block text-[12px] font-medium text-gray-700">
                  Content
                </label>
                <textarea
                  value={form.content}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, content: e.target.value }))
                  }
                  rows={6}
                  placeholder="Describe the rule the AI should follow..."
                  className="w-full resize-y rounded-lg border border-gray-200 px-3 py-2 text-[13px] text-gray-900 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-50"
                />
              </div>

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
                  {editingId ? "Save changes" : "Create rule"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
