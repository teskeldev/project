"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Plus,
  Trash2,
  Edit3,
  Loader2,
  X,
  Terminal,
  Lock,
  Eye,
  Zap,
} from "lucide-react";
import { useProject } from "@/lib/store/project";
import { ApiClientError } from "@/lib/client/api";
import {
  listCommands,
  createCommand,
  updateCommand,
  deleteCommand,
  resolveCommandTemplate,
  type SlashCommand,
  type CommandVariable,
} from "@/lib/client/commands";

type FormState = {
  name: string;
  description: string;
  template: string;
  variables: CommandVariable[];
};

const EMPTY_FORM: FormState = {
  name: "",
  description: "",
  template: "",
  variables: [],
};

export default function CommandsPage() {
  const { activeWorkspace } = useProject();
  const [commands, setCommands] = useState<SlashCommand[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [previewCmd, setPreviewCmd] = useState<SlashCommand | null>(null);
  const [previewValues, setPreviewValues] = useState<Record<string, string>>(
    {}
  );

  const load = useCallback(async () => {
    if (!activeWorkspace) return;
    setLoading(true);
    setError(null);
    try {
      const { commands: data } = await listCommands({
        workspaceId: activeWorkspace.id,
      });
      setCommands(data);
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.message : "Failed to load commands"
      );
    } finally {
      setLoading(false);
    }
  }, [activeWorkspace]);

  useEffect(() => {
    void load();
  }, [load]);

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setShowForm(true);
  };

  const openEdit = (cmd: SlashCommand) => {
    setEditingId(cmd.id);
    setForm({
      name: cmd.name,
      description: cmd.description,
      template: cmd.template,
      variables: cmd.variables,
    });
    setFormError(null);
    setShowForm(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeWorkspace || saving) return;
    setSaving(true);
    setFormError(null);

    try {
      if (editingId) {
        const { command } = await updateCommand(editingId, {
          name: form.name,
          description: form.description,
          template: form.template,
          variables: form.variables,
        });
        setCommands((prev) =>
          prev.map((c) => (c.id === editingId ? { ...command, builtin: false } : c))
        );
      } else {
        const { command } = await createCommand({
          workspaceId: activeWorkspace.id,
          name: form.name,
          description: form.description,
          template: form.template,
          variables: form.variables,
        });
        setCommands((prev) => [...prev, { ...command, builtin: false }]);
      }
      setShowForm(false);
    } catch (err) {
      setFormError(
        err instanceof ApiClientError ? err.message : "Failed to save command"
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (cmd: SlashCommand) => {
    if (!confirm(`Delete command "/${cmd.name}"?`)) return;
    setBusyId(cmd.id);
    try {
      await deleteCommand(cmd.id);
      setCommands((prev) => prev.filter((c) => c.id !== cmd.id));
    } catch {
      // Non-fatal
    } finally {
      setBusyId(null);
    }
  };

  const addVariable = () => {
    setForm((f) => ({
      ...f,
      variables: [
        ...f.variables,
        { name: "", description: "", required: true },
      ],
    }));
  };

  const updateVariable = (
    index: number,
    field: keyof CommandVariable,
    value: string | boolean
  ) => {
    setForm((f) => ({
      ...f,
      variables: f.variables.map((v, i) =>
        i === index ? { ...v, [field]: value } : v
      ),
    }));
  };

  const removeVariable = (index: number) => {
    setForm((f) => ({
      ...f,
      variables: f.variables.filter((_, i) => i !== index),
    }));
  };

  const openPreview = (cmd: SlashCommand) => {
    setPreviewCmd(cmd);
    const defaults: Record<string, string> = {};
    for (const v of cmd.variables) {
      defaults[v.name] = v.defaultValue ?? "";
    }
    setPreviewValues(defaults);
  };

  const builtinCommands = commands.filter((c) => c.builtin);
  const customCommands = commands.filter((c) => !c.builtin);

  if (!activeWorkspace) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-text-muted">
          Select a workspace to manage commands.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border bg-surface px-6 py-4">
        <div>
          <h1 className="text-lg font-semibold text-foreground">
            Slash Commands
          </h1>
          <p className="text-sm text-text-muted">
            Custom prompt templates triggered with /command-name in chat.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white hover:bg-accent-hover"
        >
          <Plus size={14} />
          New Command
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={20} className="animate-spin text-text-muted" />
          </div>
        ) : error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        ) : (
          <div className="space-y-6">
            {/* Built-in commands */}
            {builtinCommands.length > 0 && (
              <div>
                <h2 className="mb-2 text-xs font-medium uppercase tracking-wider text-text-muted">
                  Built-in Commands
                </h2>
                <div className="space-y-2">
                  {builtinCommands.map((cmd) => (
                    <div
                      key={cmd.id}
                      className="flex items-center justify-between rounded-lg border border-border bg-surface px-4 py-3"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <Terminal size={14} className="text-text-muted" />
                          <span className="text-sm font-medium text-foreground">
                            /{cmd.name}
                          </span>
                          <Lock size={10} className="text-text-muted" />
                        </div>
                        <p className="mt-0.5 pl-6 text-xs text-text-muted">
                          {cmd.description}
                        </p>
                      </div>
                      <button
                        onClick={() => openPreview(cmd)}
                        className="rounded p-1.5 text-text-muted hover:bg-surface-soft hover:text-text-secondary"
                        title="Preview"
                      >
                        <Eye size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Custom commands */}
            <div>
              <h2 className="mb-2 text-xs font-medium uppercase tracking-wider text-text-muted">
                Custom Commands
              </h2>
              {customCommands.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-10 text-center">
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-accent-light">
                    <Zap size={18} className="text-accent" />
                  </div>
                  <p className="text-sm font-medium text-text-secondary">
                    No custom commands yet
                  </p>
                  <p className="mt-1 text-xs text-text-muted">
                    Create reusable prompt templates for common tasks.
                  </p>
                  <button
                    onClick={openCreate}
                    className="mt-3 flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-hover"
                  >
                    <Plus size={12} />
                    Create Command
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {customCommands.map((cmd) => (
                    <div
                      key={cmd.id}
                      className="flex items-center justify-between rounded-lg border border-border bg-surface px-4 py-3 transition-colors hover:border-border-strong"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <Terminal size={14} className="text-accent" />
                          <span className="text-sm font-medium text-foreground">
                            /{cmd.name}
                          </span>
                          {cmd.variables.length > 0 && (
                            <span className="rounded bg-surface-soft px-1.5 py-0.5 text-[10px] text-text-muted">
                              {cmd.variables.length} var
                              {cmd.variables.length !== 1 ? "s" : ""}
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 pl-6 text-xs text-text-muted">
                          {cmd.description}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openPreview(cmd)}
                          className="rounded p-1.5 text-text-muted hover:bg-surface-soft hover:text-text-secondary"
                          title="Preview"
                        >
                          <Eye size={14} />
                        </button>
                        <button
                          onClick={() => openEdit(cmd)}
                          className="rounded p-1.5 text-text-muted hover:bg-surface-soft hover:text-text-secondary"
                          title="Edit"
                        >
                          <Edit3 size={14} />
                        </button>
                        <button
                          onClick={() => handleDelete(cmd)}
                          disabled={busyId === cmd.id}
                          className="rounded p-1.5 text-text-muted hover:bg-surface-soft hover:text-red-500 disabled:opacity-50"
                          title="Delete"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center animate-fade-in">
          <div
            className="absolute inset-0 bg-black/20 backdrop-blur-md"
            onClick={() => setShowForm(false)}
          />
          <form
            onSubmit={handleSave}
            className="animate-scale-in relative w-full max-w-2xl overflow-hidden rounded-2xl border border-border/80 bg-surface/95 shadow-2xl backdrop-blur-xl"
          >
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <h2 className="text-sm font-semibold text-foreground">
                {editingId ? "Edit Command" : "New Command"}
              </h2>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded p-1 text-text-muted hover:bg-surface-soft hover:text-text-secondary"
              >
                <X size={14} />
              </button>
            </div>
            <div className="max-h-[70vh] space-y-4 overflow-y-auto p-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-text-secondary">
                    Name (lowercase, hyphens)
                  </label>
                  <div className="flex items-center">
                    <span className="mr-1 text-sm text-text-muted">/</span>
                    <input
                      value={form.name}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, name: e.target.value }))
                      }
                      placeholder="my-command"
                      className="w-full rounded-lg border border-border bg-surface px-3 py-2 font-mono text-sm text-foreground placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent"
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-text-secondary">
                    Description
                  </label>
                  <input
                    value={form.description}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, description: e.target.value }))
                    }
                    placeholder="What this command does"
                    className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-text-secondary">
                  Template (use {"{{variable}}"} for placeholders)
                </label>
                <textarea
                  value={form.template}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, template: e.target.value }))
                  }
                  placeholder={"Review {{file}} and focus on {{aspect}}"}
                  rows={6}
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 font-mono text-sm text-foreground placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>

              {/* Variables */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-xs font-medium text-text-secondary">
                    Variables
                  </label>
                  <button
                    type="button"
                    onClick={addVariable}
                    className="flex items-center gap-1 rounded px-2 py-1 text-xs text-accent hover:bg-accent-light"
                  >
                    <Plus size={12} />
                    Add Variable
                  </button>
                </div>
                {form.variables.length === 0 ? (
                  <p className="text-xs text-text-muted">
                    No variables defined. Add {"{{placeholders}}"} in your
                    template and define them here.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {form.variables.map((v, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-2 rounded-lg border border-border bg-surface-soft p-2"
                      >
                        <input
                          value={v.name}
                          onChange={(e) =>
                            updateVariable(i, "name", e.target.value)
                          }
                          placeholder="name"
                          className="w-24 rounded border border-border bg-surface px-2 py-1 font-mono text-xs"
                        />
                        <input
                          value={v.description}
                          onChange={(e) =>
                            updateVariable(i, "description", e.target.value)
                          }
                          placeholder="Description"
                          className="flex-1 rounded border border-border bg-surface px-2 py-1 text-xs"
                        />
                        <label className="flex items-center gap-1 text-xs text-text-muted">
                          <input
                            type="checkbox"
                            checked={v.required}
                            onChange={(e) =>
                              updateVariable(i, "required", e.target.checked)
                            }
                            className="rounded"
                          />
                          Req
                        </label>
                        <button
                          type="button"
                          onClick={() => removeVariable(i)}
                          className="rounded p-1 text-text-muted hover:text-red-500"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {formError && (
                <p className="text-xs text-red-600">{formError}</p>
              )}
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded-lg px-3 py-1.5 text-sm text-text-secondary hover:bg-surface-soft"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={
                  !form.name.trim() ||
                  !form.template.trim() ||
                  saving
                }
                className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
              >
                {saving && <Loader2 size={14} className="animate-spin" />}
                {editingId ? "Save Changes" : "Create Command"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Preview Modal */}
      {previewCmd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center animate-fade-in">
          <div
            className="absolute inset-0 bg-black/20 backdrop-blur-md"
            onClick={() => setPreviewCmd(null)}
          />
          <div className="animate-scale-in relative w-full max-w-lg overflow-hidden rounded-2xl border border-border/80 bg-surface/95 shadow-2xl backdrop-blur-xl">
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <h2 className="text-sm font-semibold text-foreground">
                Preview: /{previewCmd.name}
              </h2>
              <button
                onClick={() => setPreviewCmd(null)}
                className="rounded p-1 text-text-muted hover:bg-surface-soft hover:text-text-secondary"
              >
                <X size={14} />
              </button>
            </div>
            <div className="space-y-4 p-5">
              <p className="text-xs text-text-muted">{previewCmd.description}</p>

              {previewCmd.variables.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-text-secondary">
                    Variables:
                  </p>
                  {previewCmd.variables.map((v) => (
                    <div key={v.name} className="flex items-center gap-2">
                      <label className="w-24 text-xs font-mono text-text-muted">
                        {v.name}
                        {v.required && (
                          <span className="text-red-400">*</span>
                        )}
                      </label>
                      <input
                        value={previewValues[v.name] ?? ""}
                        onChange={(e) =>
                          setPreviewValues((prev) => ({
                            ...prev,
                            [v.name]: e.target.value,
                          }))
                        }
                        placeholder={v.description}
                        className="flex-1 rounded border border-border bg-surface px-2 py-1 text-xs"
                      />
                    </div>
                  ))}
                </div>
              )}

              <div>
                <p className="mb-1 text-xs font-medium text-text-secondary">
                  Resolved output:
                </p>
                <pre className="whitespace-pre-wrap rounded-lg bg-surface-soft p-3 font-mono text-xs text-text-secondary">
                  {resolveCommandTemplate(previewCmd.template, previewValues)}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
