"use client";

/**
 * Integrations (Phase 7c) — REAL, workspace-scoped integrations with secrets
 * encrypted at rest (AES-256-GCM on the server).
 *
 * NOTE ON AI WIRING: The "OpenAI" integration is intended to back Teskel's AI
 * features (chat + agents). For THIS phase, `src/lib/ai/provider.ts` still reads
 * its credentials from the environment (OPENAI_API_KEY/OPENAI_BASE_URL/
 * OPENAI_MODEL) — env remains the live source. Storing/testing config here is
 * step one.
 * TODO(phase-future): wire `provider.ts` to read the active workspace's stored
 * OpenAI integration (decrypted server-side) instead of only the environment.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Search,
  Check,
  Plus,
  X,
  Power,
  Trash2,
  Loader2,
  AlertCircle,
  Zap,
} from "lucide-react";
import { useProject } from "@/lib/store/project";
import { ApiClientError } from "@/lib/client/api";
import {
  listIntegrations,
  createIntegration,
  updateIntegration,
  deleteIntegration,
  testIntegration,
  type SafeIntegration,
  type IntegrationTestResult,
} from "@/lib/client/integrations";
import {
  PROVIDER_CATALOG,
  COMING_SOON_PROVIDERS,
  type ProviderMeta,
} from "@/lib/integrations/providers";

/* -------------------------------------------------------------------------- */
/* Connect / edit form modal                                                  */
/* -------------------------------------------------------------------------- */

function ProviderForm({
  meta,
  existing,
  onClose,
  onSaved,
}: {
  meta: ProviderMeta;
  existing: SafeIntegration | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { activeWorkspace } = useProject();
  const [name, setName] = useState(existing?.name ?? meta.name);
  const [priority, setPriority] = useState<number>(existing?.priority ?? 100);
  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const field of meta.fields) {
      // Pre-fill non-secret hints; never pre-fill secrets.
      init[field.key] = field.secret ? "" : existing?.configHints[field.key] ?? "";
    }
    return init;
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEdit = existing !== null;

  const handleSubmit = useCallback(async () => {
    setError(null);

    if (!activeWorkspace) {
      setError("No active workspace. Create or select a workspace first.");
      return;
    }

    // Build a config object, dropping empty secret fields on edit (so the user
    // can leave them blank to keep the existing secret).
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
      if (isEdit && existing) {
        await updateIntegration(existing.id, { name: name.trim(), config });
      } else {
        await createIntegration({
          workspaceId: activeWorkspace.id,
          provider: meta.id,
          name: name.trim() || meta.name,
          config,
          priority,
        });
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.message : "Failed to save integration"
      );
    } finally {
      setSaving(false);
    }
  }, [activeWorkspace, meta, values, name, priority, isEdit, existing, onSaved, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-surface shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-3">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-lg text-[12px] font-bold text-white"
              style={{ backgroundColor: meta.color ?? "#64748b" }}
            >
              {meta.icon}
            </div>
            <h2 className="text-[15px] font-semibold text-foreground">
              {isEdit ? "Configure" : "Connect"} {meta.name}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-text-muted hover:bg-surface-soft hover:text-text-secondary"
            aria-label="Close"
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
              className="inline-flex items-center gap-1 text-[12px] font-medium text-accent hover:underline"
            >
              Get an API key ↗
            </a>
          ) : null}
          <div>
            <label className="mb-1 block text-[12px] font-medium text-text-secondary">
              Display name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-[13px] text-foreground outline-none focus:border-accent focus:ring-2 focus:ring-accent"
            />
          </div>
          <div>
            <label className="mb-1 block text-[12px] font-medium text-text-secondary">
              Priority <span className="text-text-muted">(lower = preferred when multiple keys exist)</span>
            </label>
            <input
              type="number"
              value={priority}
              onChange={(e) => setPriority(Number.parseInt(e.target.value, 10) || 100)}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-[13px] text-foreground outline-none focus:border-accent focus:ring-2 focus:ring-accent"
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
                  {field.required ? (
                    <span className="ml-1 text-red-500">*</span>
                  ) : null}
                </label>
                <input
                  type={field.type === "password" ? "password" : "text"}
                  value={values[field.key] ?? ""}
                  onChange={(e) =>
                    setValues((prev) => ({
                      ...prev,
                      [field.key]: e.target.value,
                    }))
                  }
                  placeholder={
                    masked
                      ? `Currently set (${masked}). Leave blank to keep.`
                      : field.placeholder
                  }
                  autoComplete="off"
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-[13px] text-foreground placeholder:text-text-muted outline-none focus:border-accent focus:ring-2 focus:ring-accent"
                />
                {field.secret ? (
                  <p className="mt-1 text-[11px] text-text-muted">
                    Stored encrypted. Never shown again after saving.
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
            className="flex items-center gap-2 rounded-lg bg-foreground px-4 py-2 text-[13px] font-medium text-white hover:bg-foreground disabled:opacity-50"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : null}
            {isEdit ? "Save changes" : "Connect"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Connected integration card                                                 */
/* -------------------------------------------------------------------------- */

function ConnectedCard({
  meta,
  integration,
  onChanged,
}: {
  meta: ProviderMeta;
  integration: SafeIntegration;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<IntegrationTestResult | null>(
    null
  );
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleEnabled = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      await updateIntegration(integration.id, { enabled: !integration.enabled });
      onChanged();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }, [integration, onChanged]);

  const handleTest = useCallback(async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await testIntegration(integration.id);
      setTestResult(result);
    } catch (err) {
      setTestResult({
        ok: false,
        message:
          err instanceof ApiClientError ? err.message : "Test request failed",
      });
    } finally {
      setTesting(false);
    }
  }, [integration.id]);

  const handleDelete = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      await deleteIntegration(integration.id);
      onChanged();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  }, [integration.id, onChanged]);

  const secretSummary = useMemo(() => {
    const entries = Object.entries(integration.maskedSecrets);
    return entries.length > 0
      ? entries.map(([k, v]) => `${k}: ${v}`).join("  ·  ")
      : null;
  }, [integration.maskedSecrets]);

  return (
    <div className="rounded-xl border border-border bg-surface p-5 transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-soft text-[12px] font-bold text-text-secondary">
            {meta.icon}
          </div>
          <div>
            <h3 className="text-[14px] font-semibold text-foreground">
              {integration.name}
            </h3>
            <p className="text-[11px] text-text-muted">{meta.category}</p>
          </div>
        </div>
        {integration.enabled ? (
          <span className="flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-1 text-[11px] font-medium text-green-700">
            <Check size={12} />
            Connected
          </span>
        ) : (
          <span className="rounded-full bg-surface-soft px-2.5 py-1 text-[11px] font-medium text-text-muted">
            Disabled
          </span>
        )}
      </div>

      <p className="mt-3 text-[13px] leading-relaxed text-text-muted">
        {meta.description}
      </p>

      {(secretSummary || Object.keys(integration.configHints).length > 0) && (
        <div className="mt-3 space-y-1 rounded-lg bg-surface-soft px-3 py-2 text-[11px] text-text-muted">
          {secretSummary ? <div>{secretSummary}</div> : null}
          {Object.entries(integration.configHints).map(([k, v]) => (
            <div key={k}>
              {k}: <span className="text-text-secondary">{v}</span>
            </div>
          ))}
        </div>
      )}

      {testResult ? (
        <div
          className={`mt-3 flex items-start gap-2 rounded-lg px-3 py-2 text-[12px] ${
            testResult.ok
              ? "bg-green-50 text-green-700"
              : "bg-red-50 text-red-700"
          }`}
        >
          {testResult.ok ? (
            <Check size={14} className="mt-0.5 shrink-0" />
          ) : (
            <AlertCircle size={14} className="mt-0.5 shrink-0" />
          )}
          <span>{testResult.message}</span>
        </div>
      ) : null}

      {error ? (
        <div className="mt-3 flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-[12px] text-red-700">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          onClick={handleTest}
          disabled={testing}
          className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[12px] font-medium text-text-secondary hover:bg-surface-soft disabled:opacity-50"
        >
          {testing ? (
            <Loader2 size={13} className="animate-spin" />
          ) : (
            <Zap size={13} />
          )}
          Test connection
        </button>
        <button
          onClick={() => setEditing(true)}
          disabled={busy}
          className="rounded-lg border border-border px-3 py-1.5 text-[12px] font-medium text-text-secondary hover:bg-surface-soft disabled:opacity-50"
        >
          Configure
        </button>
        <button
          onClick={toggleEnabled}
          disabled={busy}
          className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[12px] font-medium text-text-secondary hover:bg-surface-soft disabled:opacity-50"
        >
          <Power size={13} />
          {integration.enabled ? "Disable" : "Enable"}
        </button>
        <button
          onClick={handleDelete}
          disabled={busy}
          className="ml-auto flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-[12px] font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
        >
          <Trash2 size={13} />
          Disconnect
        </button>
      </div>

      {editing ? (
        <ProviderForm
          meta={meta}
          existing={integration}
          onClose={() => setEditing(false)}
          onSaved={onChanged}
        />
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Page                                                                       */
/* -------------------------------------------------------------------------- */

const CATEGORIES = [
  ...new Set([
    ...PROVIDER_CATALOG.map((p) => p.category),
    ...COMING_SOON_PROVIDERS.map((p) => p.category),
  ]),
];

export default function IntegrationsPage() {
  const { activeWorkspace, loading: projectLoading } = useProject();

  const [integrations, setIntegrations] = useState<SafeIntegration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [connecting, setConnecting] = useState<ProviderMeta | null>(null);

  const workspaceId = activeWorkspace?.id ?? null;

  const refresh = useCallback(async () => {
    if (!workspaceId) {
      setIntegrations([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { integrations: rows } = await listIntegrations(workspaceId);
      setIntegrations(rows);
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : "Failed to load integrations"
      );
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Index connected integrations by provider for quick lookup.
  const connectedByProvider = useMemo(() => {
    const map = new Map<string, SafeIntegration>();
    for (const it of integrations) {
      // Keep the first connected integration per provider for the catalog card.
      if (!map.has(it.provider)) map.set(it.provider, it);
    }
    return map;
  }, [integrations]);

  const matchesFilter = useCallback(
    (name: string, description: string, category: string) => {
      const q = search.toLowerCase();
      const matchSearch =
        name.toLowerCase().includes(q) ||
        description.toLowerCase().includes(q);
      const matchCategory = !activeCategory || category === activeCategory;
      return matchSearch && matchCategory;
    },
    [search, activeCategory]
  );

  const visibleCatalog = PROVIDER_CATALOG.filter((p) =>
    matchesFilter(p.name, p.description, p.category)
  );
  const visibleComingSoon = COMING_SOON_PROVIDERS.filter((p) =>
    matchesFilter(p.name, p.description, p.category)
  );

  const totalCount = PROVIDER_CATALOG.length + COMING_SOON_PROVIDERS.length;

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-[22px] font-semibold text-foreground">
            Integrations
          </h1>
          <p className="mt-1 text-[14px] text-text-muted">
            Connect tools and services to extend Teskel&apos;s capabilities.
            Secrets are encrypted at rest.
          </p>
          {activeWorkspace ? (
            <p className="mt-2 text-[12px] text-text-muted">
              Workspace:{" "}
              <span className="font-medium text-text-secondary">
                {activeWorkspace.name}
              </span>
            </p>
          ) : null}
        </div>

        {/* Search */}
        <div className="mb-6 flex items-center gap-4">
          <div className="relative flex-1">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search integrations..."
              className="w-full rounded-lg border border-border bg-surface py-2.5 pl-10 pr-4 text-[13px] text-foreground placeholder:text-text-muted outline-none focus:border-accent focus:ring-2 focus:ring-accent"
            />
          </div>
        </div>

        {/* Category tabs */}
        <div className="mb-6 flex flex-wrap gap-2">
          <button
            onClick={() => setActiveCategory(null)}
            className={`rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors ${
              !activeCategory
                ? "bg-foreground text-white"
                : "bg-surface-soft text-text-secondary hover:bg-surface-soft"
            }`}
          >
            All ({totalCount})
          </button>
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors ${
                activeCategory === cat
                  ? "bg-foreground text-white"
                  : "bg-surface-soft text-text-secondary hover:bg-surface-soft"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* States */}
        {!activeWorkspace && !projectLoading ? (
          <div className="rounded-xl border border-dashed border-border bg-surface-soft p-10 text-center">
            <p className="text-[14px] font-medium text-text-secondary">
              No active workspace
            </p>
            <p className="mt-1 text-[13px] text-text-muted">
              Select or create a workspace to manage integrations.
            </p>
          </div>
        ) : loading || projectLoading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-[13px] text-text-muted">
            <Loader2 size={16} className="animate-spin" />
            Loading integrations...
          </div>
        ) : error ? (
          <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-[13px] text-red-700">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <div>
              <p className="font-medium">Couldn&apos;t load integrations</p>
              <p className="mt-0.5">{error}</p>
              <button
                onClick={() => void refresh()}
                className="mt-2 rounded-md bg-red-600 px-3 py-1 text-[12px] font-medium text-white hover:bg-red-700"
              >
                Retry
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Available + connected providers */}
            <div className="grid gap-4 md:grid-cols-2">
              {visibleCatalog.map((meta) => {
                const existing = connectedByProvider.get(meta.id);
                if (existing) {
                  return (
                    <ConnectedCard
                      key={meta.id}
                      meta={meta}
                      integration={existing}
                      onChanged={() => void refresh()}
                    />
                  );
                }
                return (
                  <div
                    key={meta.id}
                    className="rounded-xl border border-border bg-surface p-5 transition-shadow hover:shadow-md"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-soft text-[12px] font-bold text-text-secondary">
                          {meta.icon}
                        </div>
                        <div>
                          <h3 className="text-[14px] font-semibold text-foreground">
                            {meta.name}
                          </h3>
                          <p className="text-[11px] text-text-muted">
                            {meta.category}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => setConnecting(meta)}
                        disabled={!activeWorkspace}
                        className="flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[11px] font-medium text-text-secondary hover:bg-surface-soft disabled:opacity-50"
                      >
                        <Plus size={12} />
                        Connect
                      </button>
                    </div>
                    <p className="mt-3 text-[13px] leading-relaxed text-text-muted">
                      {meta.description}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Coming soon */}
            {visibleComingSoon.length > 0 ? (
              <div>
                <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-text-muted">
                  Coming soon
                </h2>
                <div className="grid gap-4 md:grid-cols-2">
                  {visibleComingSoon.map((p) => (
                    <div
                      key={p.id}
                      className="rounded-xl border border-border bg-surface/60 p-5 opacity-70"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-soft text-[12px] font-bold text-text-muted">
                            {p.icon}
                          </div>
                          <div>
                            <h3 className="text-[14px] font-semibold text-text-secondary">
                              {p.name}
                            </h3>
                            <p className="text-[11px] text-text-muted">
                              {p.category}
                            </p>
                          </div>
                        </div>
                        <span className="rounded-full bg-surface-soft px-2.5 py-1 text-[11px] font-medium text-text-muted">
                          Soon
                        </span>
                      </div>
                      <p className="mt-3 text-[13px] leading-relaxed text-text-muted">
                        {p.description}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {visibleCatalog.length === 0 && visibleComingSoon.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-surface-soft p-10 text-center text-[13px] text-text-muted">
                No integrations match your search.
              </div>
            ) : null}
          </div>
        )}
      </div>

      {connecting ? (
        <ProviderForm
          meta={connecting}
          existing={null}
          onClose={() => setConnecting(null)}
          onSaved={() => void refresh()}
        />
      ) : null}
    </div>
  );
}