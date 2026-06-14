/**
 * Autonomy modes for Teskel AI agent.
 *
 * Three modes control how the AI operates:
 * - Suggest: AI proposes changes for user review (default)
 * - Auto-Edit: AI applies file changes automatically (skip review)
 * - Full-Auto: AI edits files and runs commands autonomously
 */

export type AutonomyMode = "suggest" | "auto-edit" | "full-auto";

export type AutonomyModeConfig = {
  label: string;
  description: string;
  icon: string;
  canAutoEdit: boolean;
  canAutoRun: boolean;
};

export const AUTONOMY_MODES: Record<AutonomyMode, AutonomyModeConfig> = {
  suggest: {
    label: "Suggest",
    description: "AI proposes changes for your review",
    icon: "MessageSquare",
    canAutoEdit: false,
    canAutoRun: false,
  },
  "auto-edit": {
    label: "Auto-Edit",
    description: "AI applies file changes automatically",
    icon: "Zap",
    canAutoEdit: true,
    canAutoRun: false,
  },
  "full-auto": {
    label: "Full Auto",
    description: "AI edits files and runs commands autonomously",
    icon: "Rocket",
    canAutoEdit: true,
    canAutoRun: true,
  },
};

export const DEFAULT_AUTONOMY_MODE: AutonomyMode = "suggest";

/** Persist autonomy mode preference to localStorage. */
export function saveAutonomyMode(mode: AutonomyMode): void {
  if (typeof window !== "undefined") {
    localStorage.setItem("teskel.autonomyMode", mode);
  }
}

/** Load autonomy mode preference from localStorage. */
export function loadAutonomyMode(): AutonomyMode {
  if (typeof window === "undefined") return DEFAULT_AUTONOMY_MODE;
  const stored = localStorage.getItem("teskel.autonomyMode");
  if (stored && stored in AUTONOMY_MODES) return stored as AutonomyMode;
  return DEFAULT_AUTONOMY_MODE;
}
