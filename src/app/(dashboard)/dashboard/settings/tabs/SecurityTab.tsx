"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Plus,
  Trash2,
  Loader2,
  Shield,
  FileEdit,
  FileX,
  FilePlus,
  Terminal,
  GitCommit,
  GitBranch,
  Bot,
  Layers,
  Globe,
  Search,
} from "lucide-react";
import { useProject } from "@/lib/store/project";
import { ApiClientError } from "@/lib/client/api";

type PermissionAction = "ALLOW" | "ASK" | "DENY";

type Permission = {
  id: string;
  workspaceId: string;
  tool: string;
  pattern: string;
  action: PermissionAction;
  createdAt: string;
  updatedAt: string;
};

type AITool =
  | "file_edit" | "file_delete" | "file_create" | "terminal"
  | "git_commit" | "git_push" | "agent_run" | "changeset_apply"
  | "web_fetch" | "search";

const TOOL_INFO: Record<AITool, { label: string; description: string; icon: typeof Shield }> = {
  file_edit: { label: "File Edit", description: "Edit or write existing files", icon: FileEdit },
  file_delete: { label: "File Delete", description: "Delete files from the project", icon: FileX },
  file_create: { label: "File Create", description: "Create new files in the project", icon: FilePlus },
  terminal: { label: "Terminal", description: "Execute terminal/shell commands", icon: Terminal },
  git_commit: { label: "Git Commit", description: "Create git commits", icon: GitCommit },
  git_push: { label: "Git Push", description: "Push commits to remote repository", icon: GitBranch },
  agent_run: { label: "Agent Run", description: "Start background AI agents", icon: Bot },
  changeset_apply: { label: "Changeset Apply", description: "Apply code changesets to disk", icon: Layers },
  web_fetch: { label: "Web Fetch", description: "Fetch content from external URLs", icon: Globe },
  search: { label: "Search", description: "Search the codebase", icon: Search },
};

const DEFAULTS: Record<AITool, PermissionAction> = {
  file_edit: "ALLOW", file_delete: "ASK", file_create: "ALLOW", terminal: "ASK",
  git_commit: "ALLOW", git_push: "ASK", agent_run: "ASK", changeset_apply: "ASK",
  web_fetch: "ALLOW", search: "ALLOW",
};

const ACTION_BADGE: Record<PermissionAction, string> = {
  ALLOW: "bg-green-50 text-green-700 border-green-200",
  ASK: "bg-amber-50 text-amber-700 border-amber-200",
  DENY: "bg-red-50 text-red-700 border-red-200",
};

const ACTION_DOT: Record<PermissionAction, string> = {
  ALLOW: "bg-green-500",
  ASK: "bg-amber-500",
  DENY: "bg-red-500",
};

export default function SecurityTab() {
  const { activeWorkspace } = useProject();
  const workspaceId = activeWorkspace?.id ?? null;

  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formTool, setFormTool] = useState<AITool>("file_edit");
  const [formPattern, setFormPattern] = useState("*");
  const [formAction, setFormAction] = useState<PermissionAction>("ASK");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/permissions?workspaceId=${workspaceId}`);
      if (!res.ok) throw new Error(`Request failed: ${res.status}`);
      const body = await res.json();
      if (!body.success) throw new Error(body.error?.message ?? "Failed to load");
      setPermissions(body.data.permissions);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : err instanceof Error ? err.message : "Failed to load permissions");
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => { void load(); }, [load]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspaceId || saving) return;
    setSaving(true);
    setFormError(null);
    try {
      const res = await fetch("/api/permissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId, tool: formTool, pattern: formPattern || "*", action: formAction }),
      });
      if (!res.ok) throw new Error(`Request failed: ${res.status}`);
      const body = await res.json();
      if (!body.success) throw new Error(body.error?.message ?? "Failed to create");
      setPermissions((prev) => [...prev, body.data.permission]);
      setShowForm(false);
      setFormTool("file_edit");
      setFormPattern("*");
      setFormAction("ASK");
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to create rule");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateAction = async (id: string, action: PermissionAction) => {
    setBusyId(id);
    try {
      const res = await fetch(`/api/permissions/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
      if (!res.ok) throw new Error(`Request failed: ${res.status}`);
      const body = await res.json();
      if (!body.success) throw new Error(body.error?.message ?? "Failed to update");
      setPermissions((prev) => prev.map((p) => (p.id === id ? { ...p, action } : p)));
    } catch { /* non-fatal */ } finally { setBusyId(null); }
  };

  const handleDelete = async (id: string) => {
    setBusyId(id);
    try {
      const res = await fetch(`/api/permissions/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`Request failed: ${res.status}`);
      const body = await res.json();
      if (!body.success) throw new Error(body.error?.message ?? "Failed to delete");
      setPermissions((prev) => prev.filter((p) => p.id !== id));
    } catch { /* non-fatal */ } finally { setBusyId(null); }
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-lg font-medium text-foreground">Tool Permissions</h2>
        <p className="mt-1 text-sm text-text-muted">
          Control which actions AI agents can take automatically vs. requiring your approval.
        </p>
      </div>

      {!workspaceId ? (
        <p className="text-sm text-text-muted">Select a workspace to manage permissions.</p>
      ) : (
        <>
          <div className="mb-6 flex items-center justify-between">
            <h3 className="text-sm font-medium text-text-secondary">Permission Rules</h3>
            <button onClick={() => setShowForm(true)} className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white hover:bg-accent-hover">
              <Plus size={14} />Add Rule
            </button>
          </div>

          {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3"><p className="text-sm text-red-700">{error}</p></div>}

          {showForm && (
            <form onSubmit={handleCreate} className="mb-6 rounded-xl border border-border bg-surface p-4 shadow-sm">
              <h4 className="mb-3 text-sm font-medium text-foreground">New Permission Rule</h4>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-text-secondary">Tool</label>
                  <select value={formTool} onChange={(e) => setFormTool(e.target.value as AITool)} className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent">
                    {(Object.keys(TOOL_INFO) as AITool[]).map((tool) => <option key={tool} value={tool}>{TOOL_INFO[tool].label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-text-secondary">Pattern <span className="text-text-muted">(glob)</span></label>
                  <input value={formPattern} onChange={(e) => setFormPattern(e.target.value)} placeholder="*.ts, src/**, *" className="w-full rounded-lg border border-border px-3 py-2 text-sm placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-text-secondary">Action</label>
                  <select value={formAction} onChange={(e) => setFormAction(e.target.value as PermissionAction)} className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent">
                    <option value="ALLOW">ALLOW (silent)</option>
                    <option value="ASK">ASK (prompt user)</option>
                    <option value="DENY">DENY (block)</option>
                  </select>
                </div>
              </div>
              {formError && <p className="mt-2 text-xs text-red-600">{formError}</p>}
              <div className="mt-4 flex items-center gap-2">
                <button type="submit" disabled={saving} className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50">
                  {saving && <Loader2 size={12} className="animate-spin" />}Create Rule
                </button>
                <button type="button" onClick={() => setShowForm(false)} className="rounded-lg px-3 py-1.5 text-sm text-text-secondary hover:bg-surface-soft">Cancel</button>
              </div>
            </form>
          )}

          <div className="mb-6">
            <h4 className="mb-3 text-sm font-medium text-text-secondary">Default Permissions</h4>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(TOOL_INFO) as AITool[]).map((tool) => {
                const info = TOOL_INFO[tool];
                const defaultAction = DEFAULTS[tool];
                const Icon = info.icon;
                return (
                  <div key={tool} className="flex items-center gap-3 rounded-lg border border-border bg-surface-soft/50 px-3 py-2">
                    <Icon size={14} className="shrink-0 text-text-muted" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-text-secondary">{info.label}</p>
                      <p className="truncate text-[10px] text-text-muted">{info.description}</p>
                    </div>
                    <span className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${ACTION_BADGE[defaultAction]}`}>
                      <span className={`inline-block h-1.5 w-1.5 rounded-full ${ACTION_DOT[defaultAction]}`} />
                      {defaultAction}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <h4 className="mb-3 text-sm font-medium text-text-secondary">Custom Rules</h4>
            {loading ? (
              <div className="flex items-center justify-center py-8"><Loader2 size={20} className="animate-spin text-text-muted" /></div>
            ) : permissions.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border px-6 py-8 text-center">
                <Shield size={32} className="mx-auto mb-2 text-text-muted" />
                <p className="text-sm text-text-muted">No custom permission rules yet.</p>
                <p className="mt-1 text-xs text-text-muted">Add rules to override the defaults for specific tools or file patterns.</p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-border">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-border bg-surface-soft">
                    <tr>
                      <th className="px-4 py-2.5 text-xs font-medium text-text-muted">Tool</th>
                      <th className="px-4 py-2.5 text-xs font-medium text-text-muted">Pattern</th>
                      <th className="px-4 py-2.5 text-xs font-medium text-text-muted">Action</th>
                      <th className="px-4 py-2.5 text-xs font-medium text-text-muted"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {permissions.map((perm) => {
                      const toolInfo = TOOL_INFO[perm.tool as AITool];
                      const Icon = toolInfo?.icon ?? Shield;
                      return (
                        <tr key={perm.id} className="hover:bg-surface-soft">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <Icon size={14} className="text-text-muted" />
                              <span className="font-medium text-text-secondary">{toolInfo?.label ?? perm.tool}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3"><code className="rounded bg-surface-soft px-1.5 py-0.5 text-xs text-text-secondary">{perm.pattern}</code></td>
                          <td className="px-4 py-3">
                            <select value={perm.action} onChange={(e) => handleUpdateAction(perm.id, e.target.value as PermissionAction)} disabled={busyId === perm.id} className={`rounded-full border px-2 py-0.5 text-xs font-medium cursor-pointer focus:outline-none ${ACTION_BADGE[perm.action]}`}>
                              <option value="ALLOW">ALLOW</option>
                              <option value="ASK">ASK</option>
                              <option value="DENY">DENY</option>
                            </select>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button onClick={() => handleDelete(perm.id)} disabled={busyId === perm.id} className="rounded p-1 text-text-muted hover:bg-red-50 hover:text-red-500 disabled:opacity-50" title="Delete rule">
                              {busyId === perm.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
