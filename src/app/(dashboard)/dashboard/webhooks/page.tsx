"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Plus,
  X,
  Trash2,
  Pencil,
  Loader2,
  AlertCircle,
  Check,
  Zap,
  Power,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { useProject } from "@/lib/store/project";
import { ApiClientError } from "@/lib/client/api";
import {
  listWebhooks,
  getWebhook,
  createWebhook,
  updateWebhook,
  deleteWebhook,
  testWebhook,
  type Webhook,
  type WebhookDelivery,
  type WebhookTestResult,
} from "@/lib/client/webhooks";

/* -------------------------------------------------------------------------- */
/* Constants                                                                  */
/* -------------------------------------------------------------------------- */

const AVAILABLE_EVENTS = [
  "project.created",
  "project.updated",
  "project.deleted",
  "changeset.created",
  "changeset.applied",
  "changeset.rejected",
  "chat.message",
  "agent.started",
  "agent.completed",
  "agent.failed",
  "member.added",
  "member.removed",
];

/* -------------------------------------------------------------------------- */
/* Webhook form modal                                                         */
/* -------------------------------------------------------------------------- */

function WebhookFormModal({
  existing,
  workspaceId,
  onClose,
  onSaved,
}: {
  existing: Webhook | null;
  workspaceId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [url, setUrl] = useState(existing?.url ?? "");
  const [events, setEvents] = useState<string[]>(existing?.events ?? []);
  const [enabled, setEnabled] = useState(existing?.enabled ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEdit = existing !== null;

  const toggleEvent = (event: string) => {
    setEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event]
    );
  };

  const selectAll = () => setEvents([...AVAILABLE_EVENTS]);
  const selectNone = () => setEvents([]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim() || events.length === 0 || saving) return;

    setError(null);
    setSaving(true);
    try {
      if (isEdit && existing) {
        await updateWebhook(existing.id, { url: url.trim(), events, enabled });
      } else {
        await createWebhook({
          workspaceId,
          url: url.trim(),
          events,
          enabled,
        });
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.message : "Failed to save webhook"
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-lg rounded-xl border border-gray-200 bg-white shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h2 className="text-[15px] font-semibold text-gray-900">
            {isEdit ? "Edit webhook" : "Create webhook"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 px-5 py-5">
          {/* URL */}
          <div>
            <label className="mb-1 block text-[12px] font-medium text-gray-700">
              Payload URL <span className="text-red-500">*</span>
            </label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/webhook"
              required
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-[13px] text-gray-900 placeholder-gray-400 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-50"
            />
          </div>

          {/* Events */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-[12px] font-medium text-gray-700">
                Events <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={selectAll}
                  className="text-[11px] text-blue-600 hover:underline"
                >
                  Select all
                </button>
                <button
                  type="button"
                  onClick={selectNone}
                  className="text-[11px] text-gray-500 hover:underline"
                >
                  Clear
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {AVAILABLE_EVENTS.map((event) => (
                <label
                  key={event}
                  className="flex cursor-pointer items-center gap-2 rounded-lg border border-gray-100 px-2.5 py-1.5 text-[12px] text-gray-700 hover:bg-gray-50"
                >
                  <input
                    type="checkbox"
                    checked={events.includes(event)}
                    onChange={() => toggleEvent(event)}
                    className="h-3.5 w-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="font-mono">{event}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Enabled toggle */}
          <label className="flex cursor-pointer items-center gap-3">
            <div
              className={`relative h-5 w-9 rounded-full transition-colors ${
                enabled ? "bg-blue-600" : "bg-gray-300"
              }`}
              onClick={() => setEnabled(!enabled)}
            >
              <div
                className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                  enabled ? "translate-x-4" : "translate-x-0.5"
                }`}
              />
            </div>
            <span className="text-[13px] text-gray-700">
              {enabled ? "Active" : "Inactive"}
            </span>
          </label>

          {error && (
            <div className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-[12px] text-red-700">
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-gray-100 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg px-4 py-2 text-[13px] font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!url.trim() || events.length === 0 || saving}
            className="flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-[13px] font-medium text-white hover:bg-gray-800 disabled:opacity-50"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            {isEdit ? "Save changes" : "Create webhook"}
          </button>
        </div>
      </form>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Delivery history panel                                                     */
/* -------------------------------------------------------------------------- */

function DeliveryRow({ delivery }: { delivery: WebhookDelivery }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border-b border-gray-50 last:border-0">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-gray-50"
      >
        {delivery.success ? (
          <CheckCircle2 size={14} className="shrink-0 text-green-500" />
        ) : (
          <XCircle size={14} className="shrink-0 text-red-500" />
        )}
        <span className="flex-1 truncate font-mono text-[11px] text-gray-700">
          {delivery.event}
        </span>
        <span className="text-[11px] text-gray-400">
          {delivery.statusCode ?? "—"}
        </span>
        <span className="text-[10px] text-gray-400">
          {new Date(delivery.createdAt).toLocaleString()}
        </span>
        {expanded ? (
          <ChevronDown size={12} className="text-gray-400" />
        ) : (
          <ChevronRight size={12} className="text-gray-400" />
        )}
      </button>
      {expanded && (
        <div className="space-y-2 bg-gray-50 px-3 py-2 text-[11px]">
          {delivery.error && (
            <div className="rounded bg-red-50 px-2 py-1 text-red-600">
              {delivery.error}
            </div>
          )}
          {delivery.requestBody && (
            <div>
              <p className="mb-0.5 font-medium text-gray-500">Request</p>
              <pre className="max-h-32 overflow-auto rounded bg-gray-900 p-2 text-[10px] text-gray-300">
                {delivery.requestBody}
              </pre>
            </div>
          )}
          {delivery.responseBody && (
            <div>
              <p className="mb-0.5 font-medium text-gray-500">Response</p>
              <pre className="max-h-32 overflow-auto rounded bg-gray-900 p-2 text-[10px] text-gray-300">
                {delivery.responseBody}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Webhook card                                                               */
/* -------------------------------------------------------------------------- */

function WebhookCard({
  webhook,
  onChanged,
}: {
  webhook: Webhook;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<WebhookTestResult | null>(null);
  const [showDeliveries, setShowDeliveries] = useState(false);
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([]);
  const [deliveriesLoading, setDeliveriesLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleToggle = async () => {
    setBusy(true);
    setError(null);
    try {
      await updateWebhook(webhook.id, { enabled: !webhook.enabled });
      onChanged();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Update failed");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Delete this webhook? This cannot be undone.")) return;
    setBusy(true);
    setError(null);
    try {
      await deleteWebhook(webhook.id);
      onChanged();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await testWebhook(webhook.id);
      setTestResult(result);
    } catch (err) {
      setTestResult({
        success: false,
        error:
          err instanceof ApiClientError ? err.message : "Test request failed",
      });
    } finally {
      setTesting(false);
    }
  };

  const loadDeliveries = async () => {
    if (showDeliveries) {
      setShowDeliveries(false);
      return;
    }
    setDeliveriesLoading(true);
    try {
      const data = await getWebhook(webhook.id);
      setDeliveries(data.deliveries ?? []);
      setShowDeliveries(true);
    } catch {
      setDeliveries([]);
      setShowDeliveries(true);
    } finally {
      setDeliveriesLoading(false);
    }
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white transition-shadow hover:shadow-md">
      <div className="p-5">
        <div className="flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <ExternalLink size={14} className="shrink-0 text-gray-400" />
              <span className="truncate font-mono text-[13px] text-gray-900">
                {webhook.url}
              </span>
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {webhook.events.map((event) => (
                <span
                  key={event}
                  className="rounded-full bg-gray-100 px-2 py-0.5 font-mono text-[10px] text-gray-600"
                >
                  {event}
                </span>
              ))}
            </div>
          </div>
          <div className="ml-3 shrink-0">
            {webhook.enabled ? (
              <span className="flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-1 text-[11px] font-medium text-green-700">
                <Check size={12} />
                Active
              </span>
            ) : (
              <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-medium text-gray-500">
                Inactive
              </span>
            )}
          </div>
        </div>

        {testResult && (
          <div
            className={`mt-3 flex items-start gap-2 rounded-lg px-3 py-2 text-[12px] ${
              testResult.success
                ? "bg-green-50 text-green-700"
                : "bg-red-50 text-red-700"
            }`}
          >
            {testResult.success ? (
              <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
            ) : (
              <XCircle size={14} className="mt-0.5 shrink-0" />
            )}
            <span>
              {testResult.success
                ? `Test delivered (${testResult.statusCode ?? "OK"})`
                : testResult.error ?? "Test failed"}
            </span>
          </div>
        )}

        {error && (
          <div className="mt-3 flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-[12px] text-red-700">
            <AlertCircle size={14} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            onClick={handleTest}
            disabled={testing || busy}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-[12px] font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {testing ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <Zap size={13} />
            )}
            Test
          </button>
          <button
            onClick={() => setEditing(true)}
            disabled={busy}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-[12px] font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            <Pencil size={13} />
            Edit
          </button>
          <button
            onClick={handleToggle}
            disabled={busy}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-[12px] font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            <Power size={13} />
            {webhook.enabled ? "Disable" : "Enable"}
          </button>
          <button
            onClick={loadDeliveries}
            disabled={deliveriesLoading}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-[12px] font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {deliveriesLoading ? (
              <Loader2 size={13} className="animate-spin" />
            ) : showDeliveries ? (
              <ChevronDown size={13} />
            ) : (
              <ChevronRight size={13} />
            )}
            Deliveries
            {webhook._count?.deliveries != null && (
              <span className="text-gray-400">
                ({webhook._count.deliveries})
              </span>
            )}
          </button>
          <button
            onClick={handleDelete}
            disabled={busy}
            className="ml-auto flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-[12px] font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            <Trash2 size={13} />
            Delete
          </button>
        </div>
      </div>

      {/* Delivery history */}
      {showDeliveries && (
        <div className="border-t border-gray-100">
          <div className="px-5 py-2">
            <p className="text-[11px] font-medium uppercase tracking-wider text-gray-400">
              Recent deliveries
            </p>
          </div>
          {deliveries.length === 0 ? (
            <div className="px-5 pb-4 text-[12px] text-gray-400">
              No deliveries yet.
            </div>
          ) : (
            <div className="px-2 pb-2">
              {deliveries.map((d) => (
                <DeliveryRow key={d.id} delivery={d} />
              ))}
            </div>
          )}
        </div>
      )}

      {editing && (
        <WebhookFormModal
          existing={webhook}
          workspaceId={webhook.workspaceId}
          onClose={() => setEditing(false)}
          onSaved={onChanged}
        />
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Page                                                                       */
/* -------------------------------------------------------------------------- */

export default function WebhooksPage() {
  const { activeWorkspace, loading: projectLoading } = useProject();

  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const workspaceId = activeWorkspace?.id ?? null;

  const refresh = useCallback(async () => {
    if (!workspaceId) {
      setWebhooks([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { webhooks: rows } = await listWebhooks(workspaceId);
      setWebhooks(rows);
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : "Failed to load webhooks"
      );
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-[22px] font-semibold text-gray-900">
              Webhooks
            </h1>
            <p className="mt-1 text-[14px] text-gray-500">
              Receive HTTP callbacks when events happen in your workspace.
            </p>
            {activeWorkspace && (
              <p className="mt-2 text-[12px] text-gray-400">
                Workspace:{" "}
                <span className="font-medium text-gray-600">
                  {activeWorkspace.name}
                </span>
              </p>
            )}
          </div>
          {activeWorkspace && (
            <button
              onClick={() => setCreating(true)}
              className="flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-[13px] font-medium text-white hover:bg-gray-800"
            >
              <Plus size={14} />
              Add webhook
            </button>
          )}
        </div>

        {/* States */}
        {!activeWorkspace && !projectLoading ? (
          <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-10 text-center">
            <p className="text-[14px] font-medium text-gray-700">
              No active workspace
            </p>
            <p className="mt-1 text-[13px] text-gray-500">
              Select or create a workspace to manage webhooks.
            </p>
          </div>
        ) : loading || projectLoading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-[13px] text-gray-500">
            <Loader2 size={16} className="animate-spin" />
            Loading webhooks...
          </div>
        ) : error ? (
          <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-[13px] text-red-700">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <div>
              <p className="font-medium">Couldn&apos;t load webhooks</p>
              <p className="mt-0.5">{error}</p>
              <button
                onClick={() => void refresh()}
                className="mt-2 rounded-md bg-red-600 px-3 py-1 text-[12px] font-medium text-white hover:bg-red-700"
              >
                Retry
              </button>
            </div>
          </div>
        ) : webhooks.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-10 text-center">
            <Zap size={32} className="mx-auto mb-3 text-gray-300" />
            <p className="text-[14px] font-medium text-gray-700">
              No webhooks configured
            </p>
            <p className="mt-1 text-[13px] text-gray-500">
              Create a webhook to receive event notifications via HTTP.
            </p>
            <button
              onClick={() => setCreating(true)}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-[13px] font-medium text-white hover:bg-gray-800"
            >
              <Plus size={14} />
              Create your first webhook
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {webhooks.map((wh) => (
              <WebhookCard
                key={wh.id}
                webhook={wh}
                onChanged={() => void refresh()}
              />
            ))}
          </div>
        )}
      </div>

      {creating && workspaceId && (
        <WebhookFormModal
          existing={null}
          workspaceId={workspaceId}
          onClose={() => setCreating(false)}
          onSaved={() => void refresh()}
        />
      )}
    </div>
  );
}
