"use client";

import { Sun, Moon, Monitor } from "lucide-react";
import { useTheme, type Theme } from "@/lib/store/theme";

/**
 * Light-first theme switch. Cycles light → dark → system.
 * Dark mode is token-level (see [data-theme="dark"] in globals.css).
 */
const ORDER: Theme[] = ["light", "dark", "system"];

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  const next = () => {
    const i = ORDER.indexOf(theme);
    setTheme(ORDER[(i + 1) % ORDER.length]);
  };

  const Icon = theme === "dark" ? Moon : theme === "system" ? Monitor : Sun;

  return (
    <button
      onClick={next}
      title={`Theme: ${theme} (click to change)`}
      aria-label={`Theme: ${theme}. Click to change.`}
      className="flex h-7 w-7 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-surface-soft hover:text-foreground"
    >
      <Icon size={15} />
    </button>
  );
}
