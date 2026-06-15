"use client";

import { useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { useProject } from "@/lib/store/project";
import { fusionApi } from "@/lib/client/fusion";
import { useFusion } from "@/components/fusion/useFusion";
import { PageHeader, LoadingState, Banner, StatCard, Card } from "@/components/fusion/primitives";

const RANGES = ["24h", "7d", "30d", "90d"] as const;

export default function AnalyticsPage() {
  const { activeWorkspace } = useProject();
  const ws = activeWorkspace?.id ?? "";
  const [range, setRange] = useState<(typeof RANGES)[number]>("7d");
  const { data, loading, error } = useFusion(() => fusionApi.analytics(ws, range), [ws, range]);

  if (!ws) return <Banner kind="error">Select a workspace.</Banner>;

  return (
    <div>
      <PageHeader
        title="Analytics"
        description="Requests, cost, latency and errors over time."
        action={
          <div className="inline-flex rounded-lg border border-slate-200 p-0.5 dark:border-slate-800">
            {RANGES.map((r) => (
              <button key={r} onClick={() => setRange(r)}
                className={`rounded-md px-3 py-1 text-xs font-semibold ${range === r ? "bg-accent text-white" : "text-slate-500"}`}>
                {r.toUpperCase()}
              </button>
            ))}
          </div>
        }
      />

      {loading ? <LoadingState /> : error || !data ? <Banner kind="error">{error ?? "Failed"}</Banner> : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard label="Requests" value={data.totals.requests} />
            <StatCard label="Cost" value={`$${data.totals.cost.toFixed(2)}`} />
            <StatCard label="Avg Latency" value={`${data.totals.avgLatency}ms`} />
            <StatCard label="Error Rate" value={`${Math.round(data.totals.errorRate * 100)}%`} />
          </div>

          {data.timeline.length === 0 ? (
            <Card><p className="py-8 text-center text-sm text-slate-400">No request data in this range yet.</p></Card>
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <ChartCard title="Requests">
                <LineChart data={data.timeline}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="bucket" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="requests" stroke="#6366f1" strokeWidth={2} dot={false} />
                </LineChart>
              </ChartCard>
              <ChartCard title="Cost ($)">
                <AreaChart data={data.timeline}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="bucket" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Area type="monotone" dataKey="cost" stroke="#10b981" fill="#10b98133" strokeWidth={2} />
                </AreaChart>
              </ChartCard>
              <ChartCard title="Avg Latency (ms)">
                <LineChart data={data.timeline}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="bucket" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="avgLatency" stroke="#f59e0b" strokeWidth={2} dot={false} />
                </LineChart>
              </ChartCard>
              <ChartCard title="Requests by Provider">
                <BarChart data={data.byProvider}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ChartCard>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactElement }) {
  return (
    <Card>
      <div className="mb-3 text-sm font-semibold">{title}</div>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer>
      </div>
    </Card>
  );
}
