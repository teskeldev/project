"use client";

import { useProject } from "@/lib/store/project";
import { fusionApi, type AvailableModel } from "@/lib/client/fusion";
import { useFusion } from "@/components/fusion/useFusion";
import { PageHeader, LoadingState, Banner, EmptyState, Card } from "@/components/fusion/primitives";
import { Boxes, Plug } from "lucide-react";
import Link from "next/link";

export default function ModelsPage() {
  const { activeWorkspace } = useProject();
  const ws = activeWorkspace?.id ?? "";
  const { data, loading, error } = useFusion(() => fusionApi.listModels(ws), [ws]);

  if (!ws) return <Banner kind="error">Select a workspace.</Banner>;
  if (loading) return <LoadingState />;
  if (error) return <Banner kind="error">{error}</Banner>;

  const models: AvailableModel[] = data?.models ?? [];
  const groups = new Map<string, AvailableModel[]>();
  for (const m of models) {
    const list = groups.get(m.providerLabel) ?? [];
    list.push(m);
    groups.set(m.providerLabel, list);
  }

  return (
    <div>
      <PageHeader
        title="Models"
        description="Read-only registry of models from your connected providers. Manage providers & keys in Integrations."
      />

      {models.length === 0 ? (
        <EmptyState
          icon={<Plug size={32} />}
          title="No connected models"
          description="Connect a provider in Integrations to make its models available to Fusion."
          action={
            <Link href="/dashboard/integrations" className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white">
              Open Integrations
            </Link>
          }
        />
      ) : (
        <div className="space-y-5">
          {Array.from(groups.entries()).map(([provider, list]) => (
            <div key={provider}>
              <h3 className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-400">
                <Boxes size={13} /> {provider}
              </h3>
              <Card className="!p-0">
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {list.map((m) => (
                    <div key={m.ref} className="flex items-center justify-between px-4 py-2.5 text-sm">
                      <span className="font-medium">{m.name}</span>
                      <span className="text-xs text-slate-400">{m.modelId} · {m.contextWindow.toLocaleString()} ctx</span>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
