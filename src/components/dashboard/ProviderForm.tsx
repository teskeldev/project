"use client";

import { useCallback, useState } from "react";
import { X, Loader2, AlertCircle, ExternalLink } from "lucide-react";
import { useProject } from "@/lib/store/project";
import { ApiClientError } from "@/lib/client/api";
import {
  createIntegration,
  updateIntegration,
  type SafeIntegration,
} from "@/lib/client/integrations";
import type { ProviderMeta } from "@/lib/integrations/providers";

function ProviderBadge({ icon, color, size = 10 }: { icon: string; color?: string; size?: number }) {
  return (
    <div
      className="flex items-center justify-center rounded-lg font-bold text-white shrink-0"
      style={{
        backgroundColor: color ?? "#64748b",
        width: size * 4,
        height: size * 4,
        fontSize: Math.max(9, size * 1.1),
        minWidth: size * 4,
      }}
    >
      {icon}
    </div>
  );
}

export function ProviderForm({
  meta,
  existing,
  workspaceId: workspaceIdProp,
  onClose,
  onSaved,
}: {
  meta: ProviderMeta;
  existing: SafeIntegration | null;
  workspaceId?: string;
  onClose: () => void;
  onSaved: (integration: SafeIntegration) => void;
}) {
  const { activeWorkspace } = useProject();
  const effectiveWorkspaceId = workspaceIdProp ?? activeWorkspace?.id;

  const [name, setName] = useState(existing?.name ?? meta.name);
  const [priority, setPriority] = useState<number>(existing?.priority ?? 100);
  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const field of meta.fields) {
      init[field.key] = field.secret ? "" : (existing?.configHints[field.key] ?? "");
    }
    return init;
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEdit = existing !== null;

  const handleSubmit = useCallback(async () => {
    setError(null);
    if (!effectiveWorkspaceId) {
      setError("No active workspace selected.");
      return;
    }
    const config: Record<string, unknown> = {};
    for (const field of meta.fields) {
      const raw = values[field.key]?.trim() ?? "";
      if (raw.length > 0) {
        config[field.key] = raw;
      } else if (field.required && !(isEdit && field.secret)) {
        setError(`${field.label} is required.`);
        return;
      }
    }
    setSaving(true);
    try {
      let result: SafeIntegration;
      if (isEdit && existing) {
        const r = await updateIntegration(existing.id, { name: name.trim(), config });
        result = r.integration;
      } else {
        const r = await createIntegration({
          workspaceId: effectiveWorkspaceId,
          provider: meta.id,
          name: name.trim() || meta.name,
          config,
          priority,
        });
        result = r.integration;
      }
      onSaved(result);
      onClose();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to save integration");
    } finally {
      setSaving(false);
    }
  }, [effectiveWorkspaceId, meta, values, name, priority, isEdit, existing, onSaved, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-surface shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-3">
            <ProviderBadge icon={meta.icon} color={meta.color} size={10} />
            <div>
              <h2 className="text-[15px] font-semibold text-foreground">
                {isEdit ? "Edit" : "Add"} {meta.name} connection
              </h2>
              <p className="text-[11px] text-text-muted">{meta.category}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-text-muted hover:bg-surface-soft hover:text-text-secondary"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 px-5 py-5">
          {meta.apiKeyUrl ? (
            <a
              href={meta.apiKeyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-[12px] font-medium text-accent hover:underline"
            >
              <ExternalLink size={11} />
              Get API key ↗
            </a>
          ) : null}

          <div>
            <label className="mb-1 block text-[12px] font-medium text-text-secondary">
              Connection name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-[13px] text-foreground outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
          </div>

          <div>
            <label className="mb-1 block text-[12px] font-medium text-text-secondary">
              Priority{" "}
              <span className="text-text-muted">(lower = higher priority when multiple keys exist)</span>
            </label>
            <input
              type="number"
              value={priority}
              onChange={(e) => setPriority(Number.parseInt(e.target.value, 10) || 100)}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-[13px] text-foreground outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
          </div>

          {meta.fields.map((field) => {
            const masked =
              field.secret && existing?.maskedSecrets[field.key]
                ? existing.maskedSecrets[field.key]
                : null;
            return (
              <div key={field.key}>
                <label className="mb-1 block text-[12px] font-medium text-text-secondary">
                  {field.label}
                  {field.required ? <span className="ml-1 text-red-500">*</span> : null}
                </label>
                <input
                  type={field.type === "password" ? "password" : "text"}
                  value={values[field.key] ?? ""}
                  onChange={(e) =>
                    setValues((prev) => ({ ...prev, [field.key]: e.target.value }))
                  }
                  placeholder={
                    masked
                      ? `Currently set (${masked}). Leave blank to keep.`
                      : field.placeholder
                  }
                  autoComplete="off"
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-[13px] text-foreground placeholder:text-text-muted outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                />
                {field.secret ? (
                  <p className="mt-1 text-[11px] text-text-muted">
                    Stored encrypted. Never shown after saving.
                  </p>
                ) : null}
              </div>
            );
          })}

          {error ? (
            <div className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-[12px] text-red-700">
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          ) : null}
        </div>

        <div className="flex justify-end gap-2 border-t border-border px-5 py-4">
          <button
            onClick={onClose}
            disabled={saving}
            className="rounded-lg px-4 py-2 text-[13px] font-medium text-text-secondary hover:bg-surface-soft disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-foreground px-4 py-2 text-[13px] font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : null}
            {isEdit ? "Save changes" : "Add connection"}
          </button>
        </div>
      </div>
    </div>
  );
}
