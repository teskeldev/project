"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useProject } from "@/lib/store/project";
import { fusionApi, type FusionTemplate } from "@/lib/client/fusion";
import { useFusion } from "@/components/fusion/useFusion";
import { PageHeader, LoadingState, Banner, PrimaryButton, Card } from "@/components/fusion/primitives";
import { FusionTopTabs } from "@/components/fusion/FusionTopTabs";
import { LayoutTemplate, Loader2, Wand2 } from "lucide-react";

export default function TemplatesPage() {
  const router = useRouter();
  const { activeWorkspace } = useProject();
  const ws = activeWorkspace?.id ?? "";
  const { data, loading, error } = useFusion(() => fusionApi.listTemplates(), []);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  if (!ws) return <Banner kind="error">Select a workspace.</Banner>;
  const templates: FusionTemplate[] = data?.templates ?? [];

  const use = async (t: FusionTemplate) => {
    setBusy(t.id); setErr(null);
    try {
      const res = await fusionApi.useTemplate(ws, t.id);
      if (res.warnings?.length) {
        // Non-blocking: proceed to edit the new copy so the user can fix gaps.
        setErr(res.warnings.join(" "));
      }
      router.push(`/dashboard/fusion/builder?id=${res.fusion.id}`);
    } catch (e) { setErr(e instanceof Error ? e.message : "Failed"); setBusy(null); }
  };

  return (
    <div>
      <FusionTopTabs active="templates" />
      <PageHeader title="Templates" description="Start from a ready-made AI Team. Using a template creates an editable copy in your workspace." />
      {err && <Banner kind="error">{err}</Banner>}

      {loading ? <LoadingState /> : error ? <Banner kind="error">{error}</Banner> : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {templates.map((t) => (
            <Card key={t.id}>
              <div className="flex items-center gap-2 font-semibold"><LayoutTemplate size={15} className="text-accent" /> {t.name}</div>
              <p className="mt-1 text-xs text-slate-400">{t.description}</p>
              <div className="mt-3 flex flex-wrap gap-1.5 text-[11px]">
                {t.providers.map((p) => <span key={p} className="rounded bg-slate-100 px-1.5 py-0.5 dark:bg-slate-800">{p}</span>)}
                {t.skillSlugs.map((s) => <span key={s} className="rounded bg-accent/10 px-1.5 py-0.5 text-accent">{s}</span>)}
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-xs text-slate-400">{t.strategy} · judge {t.judge}</span>
                <PrimaryButton onClick={() => void use(t)} disabled={busy === t.id}>
                  {busy === t.id ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />} Use Template
                </PrimaryButton>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
