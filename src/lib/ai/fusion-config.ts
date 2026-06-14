/**
 * Fusion config shape + defaults.
 *
 * Persistence moved to per-workspace DB Fusion Profiles (see fusion-profile.ts).
 * This module now only exposes the shared type and the DEFAULT_CONFIG used to
 * seed a workspace's first profile.
 */
export type PanelistConfig = {
  model: string;
  provider: string;
  temperature?: number;
  skillSlugs?: string[];
};

export type FusionConfig = {
  defaultPanelSlug: string;
  panelists: PanelistConfig[];
  judge: {
    model: string;
    provider: string;
  };
  trackAVerification: {
    validateSyntax: boolean;
    runLint: boolean;
    runTests: boolean;
  };
};

export const DEFAULT_CONFIG: FusionConfig = {
  defaultPanelSlug: "auto",
  panelists: [
    { model: "claude-opus-4-8", provider: "anthropic", temperature: 0.2 },
    { model: "gpt-4o", provider: "openai", temperature: 0.4 },
  ],
  judge: {
    model: "claude-opus-4-8",
    provider: "anthropic",
  },
  trackAVerification: {
    validateSyntax: true,
    runLint: false,
    runTests: false,
  },
};
