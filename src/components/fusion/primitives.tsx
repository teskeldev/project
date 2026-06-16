"use client";

import React from "react";
import { Loader2 } from "lucide-react";

/** Page header with optional right-aligned action. */
export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function StatCard({
  label,
  value,
  icon,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200/70 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-slate-400">{label}</span>
        {icon && <span className="text-slate-400">{icon}</span>}
      </div>
      <div className="mt-2 text-2xl font-bold tabular-nums">{value}</div>
      {hint && <div className="mt-0.5 text-xs text-slate-400">{hint}</div>}
    </div>
  );
}

export function StatusDot({ status }: { status?: string | null }) {
  const map: Record<string, string> = {
    connected: "bg-emerald-500",
    error: "bg-rose-500",
    disconnected: "bg-slate-400",
  };
  const color = (status && map[status]) || "bg-slate-300 dark:bg-slate-700";
  const label = status ?? "untested";
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
      <span className={`h-2 w-2 rounded-full ${color}`} />
      {label}
    </span>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white/50 px-6 py-16 text-center dark:border-slate-800 dark:bg-slate-900/30">
      {icon && <div className="mb-3 text-slate-300 dark:text-slate-600">{icon}</div>}
      <h3 className="text-base font-semibold">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function LoadingState() {
  return (
    <div className="flex h-64 items-center justify-center">
      <Loader2 size={32} className="animate-spin text-accent" />
    </div>
  );
}

export function Banner({ kind, children }: { kind: "error" | "success"; children: React.ReactNode }) {
  const cls =
    kind === "error"
      ? "border-rose-500/30 bg-rose-50/70 text-rose-600 dark:bg-rose-950/30 dark:text-rose-400"
      : "border-emerald-500/30 bg-emerald-50/70 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400";
  return <div className={`mb-4 rounded-xl border p-3 text-sm font-medium ${cls}`}>{children}</div>;
}

/** Primary button styling reused across hub pages. */
export function PrimaryButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { className = "", ...rest } = props;
  return (
    <button
      {...rest}
      className={`inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-accent-hover active:scale-[0.98] disabled:opacity-50 ${className}`}
    />
  );
}

export function GhostButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { className = "", ...rest } = props;
  return (
    <button
      {...rest}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-slate-100 disabled:opacity-50 dark:border-slate-800 dark:hover:bg-slate-800/50 ${className}`}
    />
  );
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-slate-200/70 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/60 ${className}`}>
      {children}
    </div>
  );
}
