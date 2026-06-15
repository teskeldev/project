/**
 * Fusion section shell. Intentionally has NO inner sidebar — navigation is
 * horizontal tabs (Library / Templates) on the home and a breadcrumb + tabs on
 * the Fusion detail (Builder). The only persistent nav is the global dashboard
 * sidebar, so Fusion no longer looks like "a dashboard inside a dashboard".
 */
export default function FusionLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-full bg-slate-50/50 dark:bg-slate-950">
      <div className="mx-auto max-w-5xl p-4 text-slate-950 md:p-6 dark:text-slate-100">{children}</div>
    </div>
  );
}
