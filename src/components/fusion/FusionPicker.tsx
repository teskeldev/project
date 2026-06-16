"use client";

import { useEffect, useState } from "react";
import { fusionApi, type Fusion } from "@/lib/client/fusion";

/**
 * Reusable Fusion selector used across surfaces (Agents, Composer, Design).
 * "None" = use the default model/behavior; selecting a Fusion sets its id.
 */
export function FusionPicker({
  workspaceId,
  value,
  onChange,
  className,
}: {
  workspaceId: string | null | undefined;
  value: string | null;
  onChange: (fusionId: string | null) => void;
  className?: string;
}) {
  const [fusions, setFusions] = useState<Fusion[]>([]);

  useEffect(() => {
    if (!workspaceId) return;
    let cancelled = false;
    (async () => {
      try {
        const { fusions: f } = await fusionApi.listFusions(workspaceId);
        if (!cancelled) setFusions(f);
      } catch {
        /* non-fatal: picker stays empty (only "None") */
      }
    })();
    return () => { cancelled = true; };
  }, [workspaceId]);

  if (fusions.length === 0) return null;

  return (
    <select
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value || null)}
      title="Run with a Fusion (AI Team)"
      className={
        className ??
        "rounded-lg border border-slate-200 bg-transparent px-3 py-2 text-sm focus:border-accent focus:outline-none dark:border-slate-800"
      }
    >
      <option value="">No Fusion (default model)</option>
      {fusions.map((f) => (
        <option key={f.id} value={f.id}>
          🧩 {f.name}
        </option>
      ))}
    </select>
  );
}
