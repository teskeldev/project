"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log to error reporting service
    console.error("Application error:", error);
  }, [error]);

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-8">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-50 dark:bg-red-950">
        <AlertTriangle size={28} className="text-red-500" />
      </div>
      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Something went wrong</h2>
      <p className="max-w-md text-center text-sm text-gray-500 dark:text-gray-400">
        An unexpected error occurred. Please try again.
      </p>
      {error.digest && (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Reference: {error.digest}
        </p>
      )}
      <button
        onClick={reset}
        className="flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-200"
      >
        <RefreshCw size={14} />
        Try again
      </button>
    </div>
  );
}
