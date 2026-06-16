"use client";

import { use, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Plus,
  Check,
  Power,
  Trash2,
  Loader2,
  AlertCircle,
  Zap,
  ExternalLink,
  Shield,
  ChevronDown,
  RefreshCw,
  Copy,
  CheckCheck,
  Star,
} from "lucide-react";
import { useProject } from "@/lib/store/project";
import { ApiClientError, apiFetch } from "@/lib/client/api";
import {
  listIntegrations,
  updateIntegration,
  deleteIntegration,
  testIntegration,
  type SafeIntegration,
  type IntegrationTestResult,
} from "@/lib/client/integrations";
import { PROVIDER_CATALOG, type ProviderMeta } from "@/lib/integrations/providers";
import { OAUTH_PROVIDER_CONFIGS } from "@/lib/integrations/oauth-configs";
import { AI_PROVIDER_REGISTRY } from "@/lib/ai/provider-registry";
import { ProviderForm } from "@/components/dashboard/ProviderForm";
import { OAuthModal } from "@/components/dashboard/OAuthModal";

/* -------------------------------------------------------------------------- */
/* Provider badge (shared util)                                                */
/* -------------------------------------------------------------------------- */

function ProviderBadge({
  icon,
  color,
  size = 12,
}: {
  icon: string;
  color?: string;
  size?: number;
}) {
  return (
    <div
      className="flex items-center justify-center rounded-xl font-bold text-white shrink-0"
      style={{
        backgroundColor: color ?? "#64748b",
        width: size * 4,
        height: size * 4,
        fontSize: Math.max(11, size * 1.3),
        minWidth: size * 4,
      }}
    >
      {icon}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Connection row                                                               */
/* -------------------------------------------------------------------------- */

function ConnectionRow({
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
  const [testResult, setTestResult] = useState<IntegrationTestResult | null>(null);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
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
        message: err instanceof ApiClientError ? err.message : "Test failed",
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
      setBusy(false);
    }
  }, [integration.id, onChanged]);

  return (
    <div className="rounded-xl border border-border bg-surface p-4 space-y-3">
      {/* Row header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex flex-col min-w-0">
            <span className="text-[13px] font-semibold text-foreground truncate">
              {integration.name}
            </span>
            <span className="text-[11px] text-text-muted">
              Priority {integration.priority}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span
            className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
              integration.enabled
                ? "bg-green-50 text-green-700"
                : "bg-surface-soft text-text-muted"
            }`}
          >
            {integration.enabled ? <Check size={9} /> : null}
            {integration.enabled ? "Active" : "Disabled"}
          </span>
        </div>
      </div>

      {/* Credential hint */}
      {Object.keys(integration.maskedSecrets).length > 0 ||
      Object.keys(integration.configHints).length > 0 ? (
        <div className="rounded-md bg-surface-soft px-3 py-2 text-[11px] font-mono text-text-muted space-y-0.5">
          {Object.entries(integration.maskedSecrets).map(([k, v]) => (
            <div key={k}>
              <span className="text-text-secondary">{k}:</span> {v}
            </div>
          ))}
          {Object.entries(integration.configHints)
            .filter(([k]) => k !== "model")
            .map(([k, v]) => (
              <div key={k}>
                <span className="text-text-secondary">{k}:</span>{" "}
                <span className="truncate">{v}</span>
              </div>
            ))}
        </div>
      ) : null}

      {/* Test result */}
      {testResult ? (
        <div
          className={`flex items-start gap-2 rounded-md px-3 py-2 text-[12px] ${
            testResult.ok
              ? "bg-green-50 text-green-700"
              : "bg-red-50 text-red-700"
          }`}
        >
          {testResult.ok ? (
            <Check size={13} className="mt-0.5 shrink-0" />
          ) : (
            <AlertCircle size={13} className="mt-0.5 shrink-0" />
          )}
          <span>{testResult.message}</span>
        </div>
      ) : null}

      {error ? (
        <div className="flex items-start gap-2 rounded-md bg-red-50 px-3 py-2 text-[12px] text-red-700">
          <AlertCircle size={13} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          onClick={handleTest}
          disabled={testing || busy}
          className="flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-[11px] font-medium text-text-secondary hover:bg-surface-soft disabled:opacity-50 transition-colors"
        >
          {testing ? (
            <Loader2 size={11} className="animate-spin" />
          ) : (
            <Zap size={11} />
          )}
          Test
        </button>
        {meta.fields.length > 0 ? (
          <button
            onClick={() => setEditing(true)}
            disabled={busy}
            className="rounded-md border border-border px-2.5 py-1 text-[11px] font-medium text-text-secondary hover:bg-surface-soft disabled:opacity-50 transition-colors"
          >
            Edit
          </button>
        ) : null}
        <button
          onClick={toggleEnabled}
          disabled={busy}
          className="flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-[11px] font-medium text-text-secondary hover:bg-surface-soft disabled:opacity-50 transition-colors"
        >
          <Power size={11} />
          {integration.enabled ? "Disable" : "Enable"}
        </button>

        {confirmDelete ? (
          <div className="ml-auto flex items-center gap-1.5">
            <span className="text-[11px] text-text-muted">Remove this connection?</span>
            <button
              onClick={handleDelete}
              disabled={busy}
              className="rounded-md bg-red-600 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {busy ? <Loader2 size={10} className="animate-spin" /> : "Yes, remove"}
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="rounded-md border border-border px-2.5 py-1 text-[11px] font-medium text-text-secondary hover:bg-surface-soft"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmDelete(true)}
            disabled={busy}
            className="ml-auto flex items-center gap-1 rounded-md border border-red-200 px-2.5 py-1 text-[11px] font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors"
          >
            <Trash2 size={11} />
            Remove
          </button>
        )}
      </div>

      {editing ? (
        <ProviderForm
          meta={meta}
          existing={integration}
          onClose={() => setEditing(false)}
          onSaved={() => { setEditing(false); onChanged(); }}
        />
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Model item                                                                   */
/* -------------------------------------------------------------------------- */

function ModelChip({ modelId }: { modelId: string }) {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(modelId);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  }, [modelId]);

  return (
    <button
      onClick={copy}
      className="group flex items-center gap-1.5 rounded-lg border border-border bg-surface-soft px-2.5 py-1.5 text-left text-[12px] text-text-secondary hover:border-accent/40 hover:bg-surface hover:text-foreground transition-colors"
      title={`Click to copy: ${modelId}`}
    >
      <span className="truncate font-mono">{modelId}</span>
      {copied ? (
        <CheckCheck size={11} className="shrink-0 text-green-500" />
      ) : (
        <Copy size={10} className="shrink-0 opacity-0 group-hover:opacity-60 transition-opacity" />
      )}
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/* Models section                                                               */
/* -------------------------------------------------------------------------- */

function ModelsSection({
  providerId,
  workspaceId,
  hasConnection,
}: {
  providerId: string;
  workspaceId: string;
  hasConnection: boolean;
}) {
  const [models, setModels] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const PREVIEW_COUNT = 24;

  const fetchModels = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<{ models: string[]; count: number }>(
        `/api/integrations/provider/${encodeURIComponent(providerId)}/models?workspaceId=${encodeURIComponent(workspaceId)}`
      );
      setModels(data.models);
      setLoaded(true);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to fetch models");
    } finally {
      setLoading(false);
    }
  }, [providerId, workspaceId]);

  const visible = showAll ? models : models.slice(0, PREVIEW_COUNT);
  const hidden = models.length - PREVIEW_COUNT;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-[13px] font-bold uppercase tracking-widest text-text-muted">
            Available Models
          </h2>
          <div className="h-px flex-1 bg-border w-20" />
          {loaded ? (
            <span className="rounded-full bg-surface-soft px-2 py-0.5 text-[11px] font-medium text-text-muted">
              {models.length}
            </span>
          ) : null}
        </div>
        {hasConnection ? (
          <button
            onClick={fetchModels}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[12px] font-medium text-text-secondary hover:bg-surface-soft disabled:opacity-50 transition-colors"
          >
            {loading ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <RefreshCw size={12} />
            )}
            {loaded ? "Refresh" : "Fetch models"}
          </button>
        ) : null}
      </div>

      {!hasConnection ? (
        <p className="text-[12px] text-text-muted">
          Add a connection above to load available models from this provider.
        </p>
      ) : !loaded && !loading ? (
        <p className="text-[12px] text-text-muted">
          Click &ldquo;Fetch models&rdquo; to load the available model list from the provider.
        </p>
      ) : loading ? (
        <div className="flex items-center gap-2 py-4 text-[12px] text-text-muted">
          <Loader2 size={13} className="animate-spin" />
          Fetching models&hellip;
        </div>
      ) : error ? (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-[12px] text-red-700">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      ) : models.length === 0 ? (
        <p className="text-[12px] text-text-muted">No models returned by this provider.</p>
      ) : (
        <div className="space-y-2">
          <div className="grid gap-1.5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((id) => (
              <ModelChip key={id} modelId={id} />
            ))}
          </div>

          {hidden > 0 && !showAll ? (
            <button
              onClick={() => setShowAll(true)}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border py-2 text-[12px] font-medium text-text-muted hover:text-text-secondary transition-colors"
            >
              <ChevronDown size={13} />
              Show {hidden} more models
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Page                                                                         */
/* -------------------------------------------------------------------------- */

export default function ProviderDetailPage({
  params,
}: {
  params: Promise<{ provider: string }>;
}) {
  const { provider: providerId } = use(params);
  const router = useRouter();
  const { activeWorkspace, loading: projectLoading } = useProject();

  const [integrations, setIntegrations] = useState<SafeIntegration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addingKey, setAddingKey] = useState(false);
  const [addingOAuth, setAddingOAuth] = useState(false);

  // Look up provider metadata — check both API catalog and OAuth configs
  const meta = useMemo<ProviderMeta | null>(() => {
    return PROVIDER_CATALOG.find((p) => p.id === providerId) ?? null;
  }, [providerId]);

  const oauthCfg = useMemo(
    () => OAUTH_PROVIDER_CONFIGS[providerId] ?? null,
    [providerId]
  );

  const registryEntry = useMemo(
    () => AI_PROVIDER_REGISTRY.find((p) => p.id === providerId) ?? null,
    [providerId]
  );

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
      setIntegrations(rows.filter((r) => r.provider === providerId));
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to load connections");
    } finally {
      setLoading(false);
    }
  }, [workspaceId, providerId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Redirect to integrations list if provider is unknown
  useEffect(() => {
    if (!projectLoading && meta === null && oauthCfg === null) {
      router.replace("/dashboard/integrations");
    }
  }, [meta, oauthCfg, projectLoading, router]);

  const isOAuthProvider = meta?.authType === "oauth";
  const isApiKeyProvider = !isOAuthProvider && meta !== null;
  const canFetchModels = !!registryEntry && !registryEntry.local;

  // Display metadata — prefer catalog meta, fall back to oauth config
  const displayIcon = meta?.icon ?? oauthCfg?.icon ?? "?";
  const displayColor = meta?.color ?? oauthCfg?.color ?? "#64748b";
  const displayName = meta?.name ?? oauthCfg?.name ?? providerId;
  const displayCategory = meta?.category ?? (oauthCfg ? "OAuth AI" : "Unknown");
  const displayDesc = meta?.description ?? oauthCfg?.description ?? "";
  const displayWebsite =
    meta?.website ??
    registryEntry?.display.website ??
    undefined;
  const displayApiKeyUrl = meta?.apiKeyUrl ?? registryEntry?.display.apiKeyUrl ?? undefined;

  const connectionCount = integrations.length;
  const activeCount = integrations.filter((i) => i.enabled).length;

  return (
    <div className="flex-1 overflow-auto">
      <div className="mx-auto max-w-3xl space-y-8 p-6">

        {/* ── Back ────────────────────────────────────────────── */}
        <Link
          href="/dashboard/integrations"
          className="inline-flex items-center gap-1.5 text-[12px] font-medium text-text-muted hover:text-text-secondary transition-colors"
        >
          <ArrowLeft size={13} />
          All integrations
        </Link>

        {/* ── Provider header ─────────────────────────────────── */}
        <div className="flex items-start gap-5">
          <ProviderBadge icon={displayIcon} color={displayColor} size={14} />

          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-[22px] font-semibold text-foreground">{displayName}</h1>
              {isOAuthProvider ? (
                <span className="flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
                  <Shield size={10} />
                  OAuth
                </span>
              ) : registryEntry?.local ? (
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                  Local
                </span>
              ) : null}
            </div>

            <p className="mt-1 text-[12px] text-text-muted">{displayCategory}</p>

            {displayDesc ? (
              <p className="mt-2 text-[13px] leading-relaxed text-text-secondary">
                {displayDesc}
              </p>
            ) : null}

            <div className="mt-3 flex flex-wrap items-center gap-3">
              {displayWebsite ? (
                <a
                  href={displayWebsite}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[12px] text-text-muted hover:text-accent transition-colors"
                >
                  <ExternalLink size={11} />
                  {displayWebsite.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                </a>
              ) : null}
              {displayApiKeyUrl ? (
                <a
                  href={displayApiKeyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-[12px] font-medium text-accent hover:underline"
                >
                  <Star size={11} />
                  Get API key ↗
                </a>
              ) : null}
            </div>
          </div>

          {/* Connection summary pill */}
          {connectionCount > 0 ? (
            <div className="shrink-0 text-right">
              <span className="flex items-center gap-1.5 rounded-full bg-green-50 px-3 py-1.5 text-[12px] font-semibold text-green-700">
                <Check size={12} />
                {activeCount}/{connectionCount} active
              </span>
            </div>
          ) : null}
        </div>

        {/* ── Guard: no workspace ─────────────────────────────── */}
        {!activeWorkspace && !projectLoading ? (
          <div className="rounded-xl border border-dashed border-border bg-surface-soft p-10 text-center">
            <p className="text-[14px] font-medium text-text-secondary">No active workspace</p>
            <p className="mt-1 text-[13px] text-text-muted">
              Select or create a workspace to manage connections.
            </p>
          </div>
        ) : loading || projectLoading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-[13px] text-text-muted">
            <Loader2 size={16} className="animate-spin" />
            Loading connections…
          </div>
        ) : error ? (
          <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-[13px] text-red-700">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <div>
              <p className="font-medium">Could not load connections</p>
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
          <div className="space-y-10">

            {/* ── Connections ───────────────────────────────────── */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <h2 className="text-[13px] font-bold uppercase tracking-widest text-text-muted">
                    Connections
                  </h2>
                  <div className="h-px bg-border w-16" />
                  <span className="rounded-full bg-surface-soft px-2 py-0.5 text-[11px] font-medium text-text-muted">
                    {connectionCount}
                  </span>
                </div>

                {/* Add connection button */}
                {isApiKeyProvider && meta && meta.fields.length > 0 ? (
                  <button
                    onClick={() => setAddingKey(true)}
                    className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-[12px] font-medium text-text-secondary hover:bg-surface-soft hover:border-accent/40 hover:text-accent transition-colors"
                  >
                    <Plus size={13} />
                    Add connection
                  </button>
                ) : isOAuthProvider ? (
                  <button
                    onClick={() => setAddingOAuth(true)}
                    className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-[12px] font-medium text-text-secondary hover:bg-surface-soft hover:border-accent/40 hover:text-accent transition-colors"
                  >
                    <Shield size={13} />
                    {connectionCount > 0 ? "Re-connect OAuth" : "Connect via OAuth"}
                  </button>
                ) : null}
              </div>

              {/* Empty state */}
              {connectionCount === 0 ? (
                <div className="rounded-xl border border-dashed border-border bg-surface-soft p-10 text-center">
                  <p className="text-[14px] font-medium text-text-secondary">
                    No connections yet
                  </p>
                  <p className="mt-1 text-[13px] text-text-muted">
                    {isOAuthProvider
                      ? "Click “Connect via OAuth” to authenticate with your account."
                      : "Click “Add connection” to add an API key for this provider."}
                  </p>

                  {isApiKeyProvider && meta && meta.fields.length > 0 ? (
                    <button
                      onClick={() => setAddingKey(true)}
                      className="mt-4 inline-flex items-center gap-2 rounded-lg bg-foreground px-4 py-2 text-[13px] font-medium text-white hover:opacity-90 transition-opacity"
                    >
                      <Plus size={14} />
                      Add first connection
                    </button>
                  ) : isOAuthProvider ? (
                    <button
                      onClick={() => setAddingOAuth(true)}
                      className="mt-4 inline-flex items-center gap-2 rounded-lg bg-foreground px-4 py-2 text-[13px] font-medium text-white hover:opacity-90 transition-opacity"
                    >
                      <Shield size={14} />
                      Connect via OAuth
                    </button>
                  ) : null}
                </div>
              ) : (
                <div className="space-y-3">
                  {integrations
                    .slice()
                    .sort((a, b) => a.priority - b.priority)
                    .map((integration) => (
                      <ConnectionRow
                        key={integration.id}
                        meta={meta ?? {
                          id: providerId,
                          name: displayName,
                          description: displayDesc,
                          category: displayCategory,
                          icon: displayIcon,
                          color: displayColor,
                          fields: [],
                        }}
                        integration={integration}
                        onChanged={() => void refresh()}
                      />
                    ))}
                </div>
              )}

              {/* Multiple connections note (for API key providers with >0 connections) */}
              {isApiKeyProvider && connectionCount > 0 ? (
                <p className="text-[11px] text-text-muted">
                  Multiple connections are supported — requests use the lowest-priority active key as primary with automatic failover.
                </p>
              ) : null}
            </div>

            {/* ── Models ────────────────────────────────────────── */}
            {canFetchModels ? (
              <ModelsSection
                providerId={providerId}
                workspaceId={workspaceId!}
                hasConnection={activeCount > 0}
              />
            ) : null}

          </div>
        )}
      </div>

      {/* ── Modals ──────────────────────────────────────────────── */}
      {addingKey && meta && meta.fields.length > 0 ? (
        <ProviderForm
          meta={meta}
          existing={null}
          workspaceId={workspaceId ?? undefined}
          onClose={() => setAddingKey(false)}
          onSaved={() => { setAddingKey(false); void refresh(); }}
        />
      ) : null}

      {addingOAuth && workspaceId ? (
        <OAuthModal
          provider={providerId}
          workspaceId={workspaceId}
          onClose={() => setAddingOAuth(false)}
          onConnected={() => { setAddingOAuth(false); void refresh(); }}
        />
      ) : null}
    </div>
  );
}
