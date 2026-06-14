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
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type ScopeFilter = "all" | "GLOBAL" | "PROJECT" | "FILE";

const SCOPE_BADGE_VARIANT: Record<RuleScope, "default" | "success" | "warning" | "destructive" | "outline"> = {
  GLOBAL: "default",
  WORKSPACE: "success",
  PROJECT: "warning",
  FILE: "destructive",
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
            <h1 className="text-[22px] font-semibold text-[var(--foreground)]">
              Rules &amp; Context
            </h1>
            <p className="mt-1 text-[14px] text-[var(--text-secondary)]">
              Configure how Teskel writes and reviews code
            </p>
          </div>
          <Button onClick={openCreate}>
            <Plus size={14} />
            Add Rule
          </Button>
        </div>

        <div className="mb-6 rounded-lg bg-accent-light px-3 py-2 text-[12px] text-accent">
          Enabled rules are injected into AI chat &amp; agent context.
        </div>

        {/* Scope filters */}
        <div className="mb-6 flex gap-2">
          {[
            { key: "all", label: "All Rules", icon: FileCode },
            { key: "GLOBAL", label: "Global", icon: Globe },
            { key: "PROJECT", label: "Project", icon: FolderOpen },
            { key: "FILE", label: "File Pattern", icon: FileCode },
          ].map((f) => (
            <Button
              key={f.key}
              variant={activeScope === f.key ? "default" : "secondary"}
              size="sm"
              onClick={() => setActiveScope(f.key as ScopeFilter)}
            >
              <f.icon size={12} />
              {f.label}
            </Button>
          ))}
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-600">
            {error}
          </div>
        )}

        {/* States */}
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-[var(--text-muted)]">
            <Loader2 size={18} className="animate-spin" />
            <span className="text-[13px]">Loading rules...</span>
          </div>
        ) : filtered.length === 0 ? (
          <Card className="border-dashed py-16 text-center">
            <p className="text-[14px] font-medium text-[var(--foreground)]">
              No rules yet
            </p>
            <p className="mt-1 text-[13px] text-[var(--text-secondary)]">
              Add a rule to guide how Teskel writes and reviews code.
            </p>
            <Button onClick={openCreate} className="mt-4">
              <Plus size={14} />
              Add Rule
            </Button>
          </Card>
        ) : (
          <div className="space-y-3">
            {filtered.map((rule) => (
              <Card
                key={rule.id}
                className={`p-5 transition-all ${
                  rule.enabled ? "" : "opacity-60"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-3">
                      <h3 className="text-[14px] font-semibold text-[var(--foreground)]">
                        {rule.title}
                      </h3>
                      <Badge variant={SCOPE_BADGE_VARIANT[rule.scope]}>
                        {rule.scope.toLowerCase()}
                      </Badge>
                      {rule.filePattern && (
                        <Badge variant="outline" className="font-mono text-[10px]">
                          {rule.filePattern}
                        </Badge>
                      )}
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-[13px] leading-relaxed text-[var(--text-secondary)]">
                      {rule.content}
                    </p>
                  </div>
                  <div className="ml-4 flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEdit(rule)}
                      disabled={busyId === rule.id}
                      aria-label="Edit rule"
                      className="h-7 w-7"
                    >
                      <Edit3 size={14} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(rule)}
                      disabled={busyId === rule.id}
                      aria-label="Delete rule"
                      className="h-7 w-7 hover:text-red-500"
                    >
                      <Trash2 size={14} />
                    </Button>
                    <button
                      onClick={() => handleToggle(rule)}
                      disabled={busyId === rule.id}
                      className={`${rule.enabled ? "text-[var(--accent)]" : "text-[var(--text-muted)]"} disabled:opacity-50`}
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
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Create / edit modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <Card className="w-full max-w-lg p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-[16px] font-semibold text-[var(--foreground)]">
                {editingId ? "Edit Rule" : "Add Rule"}
              </h2>
              <Button
                variant="ghost"
                size="icon"
                onClick={closeForm}
                aria-label="Close"
                className="h-7 w-7"
              >
                <X size={16} />
              </Button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {!editingId && (
                <div>
                  <label className="mb-1 block text-[12px] font-medium text-[var(--text-secondary)]">
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
                      <Button
                        key={s.v}
                        type="button"
                        variant={form.scope === s.v ? "default" : "secondary"}
                        size="sm"
                        onClick={() => setForm((f) => ({ ...f, scope: s.v }))}
                      >
                        <s.icon size={12} />
                        {s.label}
                      </Button>
                    ))}
                  </div>
                  {form.scope === "PROJECT" && (
                    <p className="mt-1 text-[11px] text-[var(--text-secondary)]">
                      Targets:{" "}
                      {activeProject
                        ? activeProject.name
                        : "no active project selected"}
                    </p>
                  )}
                  {form.scope === "WORKSPACE" && (
                    <p className="mt-1 text-[11px] text-[var(--text-secondary)]">
                      Targets:{" "}
                      {activeWorkspace
                        ? activeWorkspace.name
                        : "no active workspace"}
                    </p>
                  )}
                </div>
              )}

              <div>
                <label className="mb-1 block text-[12px] font-medium text-[var(--text-secondary)]">
                  Title
                </label>
                <Input
                  value={form.title}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, title: e.target.value }))
                  }
                  placeholder="e.g. TypeScript Strict"
                />
              </div>

              {form.scope === "FILE" && (
                <div>
                  <label className="mb-1 block text-[12px] font-medium text-[var(--text-secondary)]">
                    File pattern
                  </label>
                  <Input
                    value={form.filePattern}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, filePattern: e.target.value }))
                    }
                    placeholder="**/*.test.{ts,tsx}"
                    className="font-mono"
                  />
                </div>
              )}

              <div>
                <label className="mb-1 block text-[12px] font-medium text-[var(--text-secondary)]">
                  Content
                </label>
                <Textarea
                  value={form.content}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, content: e.target.value }))
                  }
                  rows={6}
                  placeholder="Describe the rule the AI should follow..."
                />
              </div>

              {formError && (
                <p className="text-[12px] text-red-600">{formError}</p>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={closeForm}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={saving}
                >
                  {saving && <Loader2 size={14} className="animate-spin" />}
                  {editingId ? "Save changes" : "Create rule"}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
