"use client";

import { useState } from "react";
import Link from "next/link";
import { useProject } from "@/lib/store/project";
import { fusionApi, type Fusion } from "@/lib/client/fusion";
import { useFusion } from "@/components/fusion/useFusion";
import { PageHeader, LoadingState, Banner, EmptyState, PrimaryButton, GhostButton, Card } from "@/components/fusion/primitives";
import { FusionTopTabs } from "@/components/fusion/FusionTopTabs";
import { Plus, Copy, Pencil, Archive, Trash2, Loader2, Boxes, Play } from "lucide-react";

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === "active"
      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
      : status === "archived"
        ? "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400"
        : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400";
  return <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${cls}`}>{status}</span>;
}

export default function LibraryPage() {
  const { activeWorkspace } = useProject();
  const ws = activeWorkspace?.id ?? "";
  const [showArchived, setShowArchived] = useState(false);
  const { data, loading, error, reload } = useFusion(() => fusionApi.listFusions(ws, showArchived), [ws, showArchived]);
  const [busy, setBusy] = useState<string | null>(null);

  if (!ws) return <Banner kind="error">Select a workspace.</Banner>;
  const fusions: Fusion[] = data?.fusions ?? [];

  const act = async (id: string, fn: () => Promise<unknown>) => {
    setBusy(id);
    try { await fn(); reload(); } finally { setBusy(null); }
  };

  return (
    <div>
      <FusionTopTabs active="library" />
      <PageHeader
        title="Library"
        description="Your reusable AI Teams. Create once, use everywhere."
        action={
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 text-xs text-slate-500">
              <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} className="accent-accent" />
              Show archived
            </label>
            <Link href="/dashboard/fusion/builder">
              <PrimaryButton><Plus size={16} /> Create Fusion</PrimaryButton>
            </Link>
          </div>
        }
      />

      {loading ? <LoadingState /> : error ? <Banner kind="error">{error}</Banner> : fusions.length === 0 ? (
        <EmptyState
          icon={<Boxes size={32} />}
          title="No Fusions yet"
          description="Build an AI Team from your connected models + skills + rules + knowledge — or start from a template."
          action={<Link href="/dashboard/fusion/templates"><PrimaryButton>Browse Templates</PrimaryButton></Link>}
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {fusions.map((f) => (
            <Card key={f.id}>
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 font-semibold">
                    {f.name}
                    <StatusBadge status={f.status} />
                  </div>
                  {f.description && <div className="mt-0.5 line-clamp-1 text-xs text-slate-400">{f.description}</div>}
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-400">
                <span>{f.modelIds.length} models</span>
                <span>{f.skillIds.length} skills</span>
                <span>{f.strategy}</span>
                {f.strategy !== "single" && <span>judge: {f.judge}</span>}
                <span>updated {new Date(f.updatedAt).toLocaleDateString()}</span>
              </div>
              <div className="mt-3 flex items-center gap-1.5">
                <Link href={`/dashboard/fusion/builder?id=${f.id}`}>
                  <GhostButton><Pencil size={13} /> Edit</GhostButton>
                </Link>
                <Link href={`/dashboard/fusion/builder?id=${f.id}&tab=test`}>
                  <GhostButton><Play size={13} /> Test</GhostButton>
                </Link>
                <GhostButton onClick={() => void act(f.id, () => fusionApi.duplicateFusion(ws, f.id))} disabled={busy === f.id}>
                  {busy === f.id ? <Loader2 size={13} className="animate-spin" /> : <Copy size={13} />} Duplicate
                </GhostButton>
                {f.status !== "archived" ? (
                  <GhostButton onClick={() => void act(f.id, () => fusionApi.updateFusion(ws, f.id, { status: "archived" }))} disabled={busy === f.id}>
                    <Archive size={13} /> Archive
                  </GhostButton>
                ) : (
                  <GhostButton onClick={() => void act(f.id, () => fusionApi.updateFusion(ws, f.id, { status: "active" }))} disabled={busy === f.id}>
                    <Archive size={13} /> Restore
                  </GhostButton>
                )}
                <button onClick={() => void act(f.id, () => fusionApi.deleteFusion(ws, f.id))} className="ml-auto rounded p-1 text-slate-400 hover:text-rose-500" title="Delete">
                  <Trash2 size={15} />
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
