"use client";

/**
 * Teskel theme store — "Living Canvas".
 *
 * Light-first by design: `light` is the default and the brand-primary
 * experience. `dark` is a secondary, opt-in surface implemented purely at the
 * token level (see the `[data-theme="dark"]` block in globals.css), so every
 * component built on design tokens inherits dark mode for free.
 *
 * The resolved theme is written to `document.documentElement[data-theme]`.
 * A small blocking script in the root layout applies the persisted value
 * before first paint to avoid a flash.
 */

import React from "react";

export type Theme = "light" | "dark" | "system";

const STORAGE_KEY = "teskel.theme";

function systemPrefersDark(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function resolve(theme: Theme): "light" | "dark" {
  return theme === "system" ? (systemPrefersDark() ? "dark" : "light") : theme;
}

function readStored(): Theme {
  if (typeof window === "undefined") return "light";
  const v = window.localStorage.getItem(STORAGE_KEY);
  return v === "dark" || v === "light" || v === "system" ? v : "light";
}

function apply(resolved: "light" | "dark") {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", resolved);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Keep the DOM in sync with the OS preference while the user is on "system".
  React.useEffect(() => {
    if (readStored() !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => apply(mq.matches ? "dark" : "light");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return React.createElement(React.Fragment, null, children);
}

export function useTheme(): {
  theme: Theme;
  resolvedTheme: "light" | "dark";
  setTheme: (theme: Theme) => void;
} {
  const [theme, setThemeState] = React.useState<Theme>("light");
  const [resolved, setResolved] = React.useState<"light" | "dark">("light");

  // Hydrate from storage on mount.
  React.useEffect(() => {
    const t = readStored();
    setThemeState(t);
    setResolved(resolve(t));
  }, []);

  const setTheme = React.useCallback((next: Theme) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // storage unavailable — still apply for this session
    }
    const r = resolve(next);
    setThemeState(next);
    setResolved(r);
    apply(r);
  }, []);

  return { theme, resolvedTheme: resolved, setTheme };
}

/**
 * Inline, render-blocking script applied in the root layout to set the correct
 * theme before first paint (no FOUC). Kept as a plain string so it runs before
 * React hydrates.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem('${STORAGE_KEY}')||'light';var d=t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.setAttribute('data-theme',d?'dark':'light');}catch(e){document.documentElement.setAttribute('data-theme','light');}})();`;
