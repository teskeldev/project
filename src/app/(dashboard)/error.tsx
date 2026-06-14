"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default function DashboardLayoutError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log to error reporting service
    console.error("Dashboard error:", error);
  }, [error]);

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-8">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-50">
        <AlertTriangle size={28} className="text-red-500" />
      </div>
      <h2 className="text-lg font-semibold text-foreground">Something went wrong</h2>
      <p className="max-w-md text-center text-sm text-text-muted">
        An unexpected error occurred. Please try again.
      </p>
      {error.digest && (
        <p className="text-xs text-text-muted">
          Reference: {error.digest}
        </p>
      )}
      <button
        onClick={reset}
        className="flex items-center gap-2 rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-white hover:bg-foreground"
      >
        <RefreshCw size={14} />
        Try again
      </button>
    </div>
  );
}
