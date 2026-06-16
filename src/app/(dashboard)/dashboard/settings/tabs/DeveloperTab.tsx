"use client";

import { useState } from "react";
import { useProject } from "@/lib/store/project";
import { Download, Upload, Check, AlertCircle, Loader2 } from "lucide-react";
import { Separator } from "@/components/ui";
import KeysTab from "./KeysTab";

function DatabaseBackupSection() {
  const { activeWorkspace: currentWorkspace } = useProject();
  const workspaceId = currentWorkspace?.id;

  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  async function exportBackup() {
    if (!workspaceId) return;
    const res = await fetch(`/api/settings/database?workspaceId=${workspaceId}`);
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `teskel-backup-${workspaceId.slice(0, 8)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function importBackup(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !workspaceId) return;
    setImporting(true);
    setImportResult(null);
    setImportError(null);
    try {
      const text = await file.text();
      const backup = JSON.parse(text);
      const res = await fetch("/api/settings/database", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId, backup }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error?.message ?? "Import failed");
      const { imported } = j.data;
      setImportResult(
        `Imported ${imported.combos} combo(s), ${imported.modelAliases} alias(es).`
      );
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
      e.target.value = "";
    }
  }

  return (
    <div>
      <h2 className="mb-1 text-lg font-medium text-foreground">Database Backup</h2>
      <p className="mb-4 text-sm text-text-muted">
        Export your workspace configuration (combos, model aliases, routing settings) as JSON.
        Import to restore or migrate to another workspace.
      </p>

      <div className="rounded-xl border border-border bg-surface-soft p-5">
        <div className="flex flex-wrap gap-3">
          <button
            onClick={exportBackup}
            disabled={!workspaceId}
            className="flex items-center gap-2 rounded-lg border border-border bg-surface px-4 py-2 text-sm text-text-secondary hover:bg-surface-soft hover:text-foreground disabled:opacity-40"
          >
            <Download size={14} />
            Export Backup
          </button>

          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-surface px-4 py-2 text-sm text-text-secondary hover:bg-surface-soft hover:text-foreground">
            {importing ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Upload size={14} />
            )}
            Import Backup
            <input
              type="file"
              accept=".json"
              className="hidden"
              onChange={importBackup}
              disabled={importing}
            />
          </label>
        </div>

        {importResult && (
          <div className="mt-3 flex items-center gap-2 text-sm text-green-600">
            <Check size={14} />
            {importResult}
          </div>
        )}
        {importError && (
          <div className="mt-3 flex items-center gap-2 text-sm text-red-600">
            <AlertCircle size={14} />
            {importError}
          </div>
        )}
      </div>
    </div>
  );
}

export default function DeveloperTab() {
  return (
    <div className="space-y-10">
      <KeysTab />
      <Separator />
      <DatabaseBackupSection />
    </div>
  );
}
