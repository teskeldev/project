"use client";

import { useProject } from "@/lib/store/project";
import { fusionApi } from "@/lib/client/fusion";
import { useFusion } from "@/components/fusion/useFusion";
import { PageHeader, StatCard, LoadingState, Banner, Card } from "@/components/fusion/primitives";
import {
  Plug,
  Boxes,
  Users,
  UserCog,
  Workflow,
  Server,
  Sparkles,
  DollarSign,
  Activity,
  Zap,
  CheckCircle2,
} from "lucide-react";

export default function OverviewPage() {
  const { activeWorkspace } = useProject();
  const ws = activeWorkspace?.id ?? "";
  const { data, loading, error } = useFusion(() => fusionApi.overview(ws), [ws]);

  if (!ws) return <Banner kind="error">Select a workspace to view the hub.</Banner>;
  if (loading) return <LoadingState />;
  if (error || !data) return <Banner kind="error">{error ?? "Failed to load overview"}</Banner>;

  const s = data.stats;
  return (
    <div>
      <PageHeader title="Overview" description="Your orchestration layer at a glance." />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        <StatCard label="Providers" value={s.providers} icon={<Plug size={16} />} hint={`${s.activeProviders} connected`} />
        <StatCard label="Models" value={s.models} icon={<Boxes size={16} />} hint={`${s.activeModels} enabled`} />
        <StatCard label="Teams" value={s.teams} icon={<Users size={16} />} />
        <StatCard label="Profiles" value={s.profiles} icon={<UserCog size={16} />} />
        <StatCard label="Workflows" value={s.workflows} icon={<Workflow size={16} />} />
        <StatCard label="MCP Servers" value={s.mcpServers} icon={<Server size={16} />} hint={`${s.activeMcp} enabled`} />
        <StatCard label="Skills" value={s.skills} icon={<Sparkles size={16} />} />
        <StatCard label="Daily Requests" value={s.dailyRequests} icon={<Activity size={16} />} />
        <StatCard label="Monthly Cost" value={`$${s.monthlyCost.toFixed(2)}`} icon={<DollarSign size={16} />} />
        <StatCard label="Token Usage (24h)" value={s.tokenUsage.toLocaleString()} icon={<Zap size={16} />} />
        <StatCard label="Avg Latency" value={`${s.avgLatencyMs}ms`} icon={<Activity size={16} />} />
        <StatCard label="Success Rate" value={`${Math.round(s.successRate * 100)}%`} icon={<CheckCircle2 size={16} />} />
      </div>

      <h2 className="mb-3 mt-8 text-sm font-bold uppercase tracking-wider text-slate-400">Recent Activity</h2>
      <Card className="!p-0">
        {data.recent.length === 0 ? (
          <div className="p-6 text-sm text-slate-500">No requests recorded yet.</div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {data.recent.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${r.success ? "bg-emerald-500" : "bg-rose-500"}`} />
                  <span className="font-medium">{r.modelId ?? r.provider}</span>
                  <span className="text-xs text-slate-400">{r.provider}</span>
                </div>
                <div className="flex items-center gap-4 text-xs text-slate-400">
                  <span>{r.latencyMs}ms</span>
                  <span>${r.costUsd.toFixed(4)}</span>
                  <span>{new Date(r.createdAt).toLocaleTimeString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
