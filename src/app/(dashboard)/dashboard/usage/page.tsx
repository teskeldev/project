"use client";

import { useState, useEffect, useCallback } from "react";
import {
  BarChart3,
  TrendingUp,
  DollarSign,
  Zap,
  Loader2,
  RefreshCw,
  Filter,
  ChevronLeft,
  ChevronRight,
  Gauge,
  AlertCircle,
  CheckCircle,
  Info,
} from "lucide-react";
import Link from "next/link";
import { useProject } from "@/lib/store/project";

type UsageTab = "analytics" | "limits";

interface DailyStat {
  date: string;
  requests: number;
  costUsd: number;
  tokens: number;
}

interface ProviderStat {
  provider: string;
  requests: number;
  costUsd: number;
  tokens: number;
  errors: number;
}

interface Totals {
  requests: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  durationMs: number;
  errors: number;
}

interface StatsData {
  totals: Totals;
  daily: DailyStat[];
  byProvider: ProviderStat[];
  days: number;
}

interface LogEntry {
  id: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  durationMs: number;
  status: string;
  errorType: string | null;
  errorMessage: string | null;
  source: string | null;
  createdAt: string;
}

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  color,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-zinc-500">{label}</p>
          <p className="mt-1 text-2xl font-bold text-white">{value}</p>
          {sub && <p className="mt-0.5 text-xs text-zinc-500">{sub}</p>}
        </div>
        <div className={`rounded-lg p-2 ${color}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
}

function MiniBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="h-1.5 w-full rounded-full bg-zinc-800">
      <div
        className="h-1.5 rounded-full bg-violet-500"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function DailyChart({ daily }: { daily: DailyStat[] }) {
  const maxRequests = Math.max(...daily.map((d) => d.requests), 1);
  const recent = daily.slice(-14);

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
      <h3 className="mb-4 text-sm font-semibold text-zinc-200">
        Daily Requests (last 14 days)
      </h3>
      <div className="flex h-24 items-end gap-1">
        {recent.map((d) => {
          const pct = maxRequests > 0 ? (d.requests / maxRequests) * 100 : 0;
          return (
            <div
              key={d.date}
              className="group relative flex flex-1 flex-col items-center justify-end"
            >
              <div
                className="w-full rounded-t bg-violet-600 transition-all group-hover:bg-violet-500"
                style={{ height: `${Math.max(pct, 2)}%` }}
              />
              <span className="absolute -top-5 hidden rounded bg-zinc-800 px-1.5 py-0.5 text-xs text-zinc-300 group-hover:block">
                {d.requests}
              </span>
            </div>
          );
        })}
      </div>
      <div className="mt-1 flex justify-between text-xs text-zinc-600">
        <span>{recent[0]?.date?.slice(5) ?? ""}</span>
        <span>{recent[recent.length - 1]?.date?.slice(5) ?? ""}</span>
      </div>
    </div>
  );
}

/* ========================================================================== */
/* Provider Limits tab (quota per integration)                                 */
/* ========================================================================== */

interface QuotaIntegration { id: string; name: string; provider: string; enabled: boolean; }
interface QuotaResult {
  integrationId: string; name: string; provider: string; loading: boolean;
  supported?: boolean; used?: number | null; limit?: number | null;
  remaining?: number | null; costUsd?: number; unit?: string; note?: string; error?: string;
}

function QuotaBar({ used, limit }: { used: number | null | undefined; limit: number | null | undefined }) {
  if (!used || !limit) return null;
  const pct = Math.min(100, (used / limit) * 100);
  const color = pct > 90 ? "bg-red-500" : pct > 70 ? "bg-amber-500" : "bg-violet-500";
  return (
    <div className="mt-2">
      <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-800">
        <div className={`h-2 rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-1 flex justify-between text-xs text-zinc-500">
        <span>{used.toLocaleString()} / {limit.toLocaleString()}</span>
        <span>{pct.toFixed(1)}%</span>
      </div>
    </div>
  );
}

function ProviderLimitsTab() {
  const { activeWorkspace } = useProject();
  const workspaceId = activeWorkspace?.id;
  const [quotas, setQuotas] = useState<QuotaResult[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    if (!workspaceId) { setLoading(false); return; }
    setLoading(true);
    let integrations: QuotaIntegration[] = [];
    try {
      const res = await fetch(`/api/integrations?workspaceId=${workspaceId}`);
      const json = await res.json();
      integrations = (json.data?.integrations ?? []).filter((i: QuotaIntegration) => i.enabled);
    } catch { setLoading(false); return; }

    setQuotas(integrations.map((i) => ({ integrationId: i.id, name: i.name, provider: i.provider, loading: true })));
    setLoading(false);

    await Promise.all(
      integrations.map(async (integration) => {
        try {
          const res = await fetch(`/api/integrations/${integration.id}/quota`);
          const json = await res.json();
          setQuotas((prev) => prev.map((q) => q.integrationId === integration.id ? { ...q, loading: false, ...(json.data ?? {}) } : q));
        } catch {
          setQuotas((prev) => prev.map((q) => q.integrationId === integration.id ? { ...q, loading: false, supported: false, error: "Failed to fetch" } : q));
        }
      })
    );
  }, [workspaceId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  if (loading) return <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-zinc-600" /></div>;

  if (quotas.length === 0) return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-zinc-800 py-16 text-center">
      <Gauge className="mb-3 h-10 w-10 text-zinc-700" />
      <p className="font-medium text-zinc-400">No active integrations</p>
      <p className="mt-1 text-sm text-zinc-600">
        Connect providers in{" "}
        <Link href="/dashboard/integrations" className="text-violet-400 hover:underline">Integrations</Link>{" "}
        to track provider limits.
      </p>
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-400">Live quota data fetched from provider APIs.</p>
        <button onClick={fetchAll} className="rounded-lg border border-zinc-700 bg-zinc-900 p-1.5 text-zinc-400 hover:text-white"><RefreshCw className="h-4 w-4" /></button>
      </div>
      {quotas.map((q) => (
        <div key={q.integrationId} className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <span className="font-medium text-zinc-100">{q.name}</span>
              <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs font-mono text-zinc-400">{q.provider}</span>
            </div>
            <div>
              {q.loading ? <Loader2 className="h-4 w-4 animate-spin text-zinc-600" />
                : q.supported === false ? <span className="text-xs text-zinc-600">Not supported</span>
                : q.error ? <AlertCircle className="h-4 w-4 text-red-400" />
                : <CheckCircle className="h-4 w-4 text-green-400" />}
            </div>
          </div>
          {!q.loading && q.supported !== false && !q.error && (
            <div className="mt-3">
              {q.used != null && (
                <div className="text-sm text-zinc-300">
                  Used: <span className="font-mono font-medium">{q.used.toLocaleString()} {q.unit ?? ""}</span>
                  {q.costUsd != null && q.costUsd > 0 && <span className="ml-2 text-xs text-zinc-500">(≈ ${q.costUsd.toFixed(4)} USD)</span>}
                </div>
              )}
              <QuotaBar used={q.used} limit={q.limit} />
              {q.note && (
                <div className="mt-2 flex items-start gap-1.5 text-xs text-zinc-600">
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />{q.note}
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/* ========================================================================== */
/* Main page                                                                   */
/* ========================================================================== */

export default function UsagePage() {
  const { activeWorkspace: currentWorkspace } = useProject();
  const workspaceId = currentWorkspace?.id;

  const [activeTab, setActiveTab] = useState<UsageTab>("analytics");
  const [days, setDays] = useState(30);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [logTotal, setLogTotal] = useState(0);
  const [logPage, setLogPage] = useState(1);
  const [logPages, setLogPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [providerFilter, setProviderFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [slowLoad, setSlowLoad] = useState(false);
  const [logsLoading, setLogsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    if (!workspaceId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setSlowLoad(false);
    setError(null);
    const slowTimer = setTimeout(() => setSlowLoad(true), 8000);
    try {
      const res = await fetch(
        `/api/usage/stats?workspaceId=${workspaceId}&days=${days}`
      );
      const json = await res.json();
      if (json.data) setStats(json.data);
    } catch {
      setError("Failed to load usage stats. Please try refreshing.");
    } finally {
      clearTimeout(slowTimer);
      setSlowLoad(false);
      setLoading(false);
    }
  }, [workspaceId, days]);

  const fetchLogs = useCallback(async () => {
    if (!workspaceId) return;
    setLogsLoading(true);
    try {
      const params = new URLSearchParams({
        workspaceId,
        page: String(logPage),
        ...(statusFilter && { status: statusFilter }),
        ...(providerFilter && { provider: providerFilter }),
      });
      const res = await fetch(`/api/usage/logs?${params}`);
      const json = await res.json();
      if (json.data) {
        setLogs(json.data.logs ?? []);
        setLogTotal(json.data.total ?? 0);
        setLogPages(json.data.pages ?? 1);
      }
    } catch {
      // silent
    } finally {
      setLogsLoading(false);
    }
  }, [workspaceId, logPage, statusFilter, providerFilter]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  function fmtNum(n: number) {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return String(n);
  }

  function fmtMs(ms: number) {
    if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
    return `${ms}ms`;
  }

  const maxProviderRequests = Math.max(
    ...(stats?.byProvider.map((p) => p.requests) ?? [1]),
    1
  );

  return (
    <div className="min-h-screen bg-zinc-950 p-6 text-white">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold">
              <BarChart3 className="h-6 w-6 text-violet-400" />
              Usage
            </h1>
            <p className="mt-1 text-sm text-zinc-400">
              Request logs, token consumption, costs, and provider limits.
            </p>
          </div>
          {activeTab === "analytics" && (
            <div className="flex items-center gap-2">
              <select
                value={days}
                onChange={(e) => setDays(Number(e.target.value))}
                className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-white focus:border-violet-500 focus:outline-none"
              >
                <option value={7}>Last 7 days</option>
                <option value={30}>Last 30 days</option>
                <option value={90}>Last 90 days</option>
              </select>
              <button onClick={fetchStats} className="rounded-lg border border-zinc-700 bg-zinc-900 p-1.5 text-zinc-400 hover:text-white">
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="mb-6 flex gap-0 border-b border-zinc-800">
          {([
            { id: "analytics", label: "Analytics" },
            { id: "limits",    label: "Provider Limits" },
          ] as const).map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                activeTab === t.id
                  ? "border-violet-500 text-white"
                  : "border-transparent text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {activeTab === "limits" && <ProviderLimitsTab />}

        {activeTab === "analytics" && (<>
        {error && (
          <div className="mb-4 rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-zinc-600" />
            {slowLoad && (
              <p className="text-xs text-zinc-500 text-center max-w-xs">
                Compiling for the first time — this takes up to a minute.
                <br />Subsequent loads will be instant.
              </p>
            )}
          </div>
        ) : !stats ? null : (
          <>
            {/* Stat cards */}
            <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                label="Total Requests"
                value={fmtNum(stats.totals.requests)}
                sub={`${stats.totals.errors} errors`}
                icon={TrendingUp}
                color="bg-violet-500/10 text-violet-400"
              />
              <StatCard
                label="Input Tokens"
                value={fmtNum(stats.totals.inputTokens)}
                icon={Zap}
                color="bg-blue-500/10 text-blue-400"
              />
              <StatCard
                label="Output Tokens"
                value={fmtNum(stats.totals.outputTokens)}
                icon={Zap}
                color="bg-cyan-500/10 text-cyan-400"
              />
              <StatCard
                label="Estimated Cost"
                value={`$${stats.totals.costUsd.toFixed(4)}`}
                sub={`avg ${fmtMs(
                  stats.totals.requests
                    ? Math.round(
                        stats.totals.durationMs / stats.totals.requests
                      )
                    : 0
                )} / req`}
                icon={DollarSign}
                color="bg-green-500/10 text-green-400"
              />
            </div>

            {/* Chart + provider breakdown */}
            <div className="mb-6 grid gap-6 lg:grid-cols-2">
              <DailyChart daily={stats.daily} />

              <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
                <h3 className="mb-4 text-sm font-semibold text-zinc-200">
                  By Provider
                </h3>
                {stats.byProvider.length === 0 ? (
                  <p className="text-sm text-zinc-600">No data yet.</p>
                ) : (
                  <div className="space-y-3">
                    {stats.byProvider.map((p) => (
                      <div key={p.provider}>
                        <div className="mb-1 flex items-center justify-between text-xs">
                          <span className="font-mono text-zinc-300">
                            {p.provider}
                          </span>
                          <span className="text-zinc-500">
                            {fmtNum(p.requests)} req ·{" "}
                            {fmtNum(p.tokens)} tok · $
                            {p.costUsd.toFixed(4)}
                          </span>
                        </div>
                        <MiniBar
                          value={p.requests}
                          max={maxProviderRequests}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Request log table */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900">
              <div className="flex flex-wrap items-center gap-2 border-b border-zinc-800 p-4">
                <h3 className="mr-auto text-sm font-semibold text-zinc-200">
                  Request History
                  <span className="ml-2 text-xs font-normal text-zinc-500">
                    {logTotal} total
                  </span>
                </h3>
                <div className="flex items-center gap-1 text-xs text-zinc-500">
                  <Filter className="h-3.5 w-3.5" />
                </div>
                <input
                  value={providerFilter}
                  onChange={(e) => {
                    setProviderFilter(e.target.value);
                    setLogPage(1);
                  }}
                  placeholder="Filter by provider"
                  className="rounded-lg border border-zinc-700 bg-zinc-800 px-2.5 py-1 text-xs text-white placeholder:text-zinc-600 focus:border-violet-500 focus:outline-none"
                />
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setLogPage(1);
                  }}
                  className="rounded-lg border border-zinc-700 bg-zinc-800 px-2.5 py-1 text-xs text-white focus:border-violet-500 focus:outline-none"
                >
                  <option value="">All statuses</option>
                  <option value="success">Success</option>
                  <option value="error">Error</option>
                  <option value="timeout">Timeout</option>
                  <option value="rate_limited">Rate limited</option>
                </select>
              </div>

              {logsLoading ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="h-5 w-5 animate-spin text-zinc-600" />
                </div>
              ) : logs.length === 0 ? (
                <div className="py-10 text-center text-sm text-zinc-600">
                  No request logs found.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-zinc-800 text-left text-zinc-500">
                        <th className="px-4 py-2.5">Provider / Model</th>
                        <th className="px-4 py-2.5">Tokens</th>
                        <th className="px-4 py-2.5">Cost</th>
                        <th className="px-4 py-2.5">Duration</th>
                        <th className="px-4 py-2.5">Status</th>
                        <th className="px-4 py-2.5">Time</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/50">
                      {logs.map((log) => (
                        <tr key={log.id} className="hover:bg-zinc-800/30">
                          <td className="px-4 py-2.5">
                            <div className="font-mono text-zinc-300">
                              {log.provider}
                            </div>
                            <div className="text-zinc-600">{log.model}</div>
                          </td>
                          <td className="px-4 py-2.5 font-mono text-zinc-400">
                            {fmtNum(log.inputTokens + log.outputTokens)}
                          </td>
                          <td className="px-4 py-2.5 font-mono text-zinc-400">
                            ${log.costUsd.toFixed(5)}
                          </td>
                          <td className="px-4 py-2.5 font-mono text-zinc-400">
                            {fmtMs(log.durationMs)}
                          </td>
                          <td className="px-4 py-2.5">
                            <span
                              className={`rounded-full px-2 py-0.5 font-medium ${
                                log.status === "success"
                                  ? "bg-green-500/10 text-green-400"
                                  : log.status === "rate_limited"
                                  ? "bg-amber-500/10 text-amber-400"
                                  : "bg-red-500/10 text-red-400"
                              }`}
                            >
                              {log.status}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-zinc-600">
                            {new Date(log.createdAt).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {logPages > 1 && (
                <div className="flex items-center justify-between border-t border-zinc-800 px-4 py-3">
                  <span className="text-xs text-zinc-600">
                    Page {logPage} of {logPages}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setLogPage((p) => Math.max(1, p - 1))}
                      disabled={logPage === 1}
                      className="rounded p-1 text-zinc-500 hover:text-zinc-200 disabled:opacity-30"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() =>
                        setLogPage((p) => Math.min(logPages, p + 1))
                      }
                      disabled={logPage === logPages}
                      className="rounded p-1 text-zinc-500 hover:text-zinc-200 disabled:opacity-30"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
        </>)}
      </div>
    </div>
  );
}
