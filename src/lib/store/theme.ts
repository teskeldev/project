"use client";

/**
 * Theme store is disabled in the default Teskel build (light-only).
 *
 * This file is kept as a no-op shim so existing imports
 * (`import { useTheme, type Theme } from "@/lib/store/theme"`) continue to
 * compile. The `setTheme` action is intentionally a no-op.
 *
 * If you decide to re-introduce a dark mode later, replace the mock
 * implementations below with a real client-side store.
 */

import React from "react";

export type Theme = "light" | "dark" | "system";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return React.createElement(React.Fragment, null, children);
}

export function useTheme(): {
  theme: Theme;
  resolvedTheme: "light" | "dark";
  setTheme: (theme: Theme) => void;
} {
  return {
    theme: "light",
    resolvedTheme: "light",
    setTheme: () => {
      // intentionally disabled
    },
  };
}
