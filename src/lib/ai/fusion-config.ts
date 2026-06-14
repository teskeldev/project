import { promises as fs } from "node:fs";
import path from "node:path";

export type PanelistConfig = {
  model: string;
  provider: string;
  temperature?: number;
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

const CONFIG_PATH = path.resolve(process.cwd(), ".teskel-storage/fusion-config.json");

const DEFAULT_CONFIG: FusionConfig = {
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

export async function getFusionConfig(): Promise<FusionConfig> {
  try {
    const data = await fs.readFile(CONFIG_PATH, "utf-8");
    return { ...DEFAULT_CONFIG, ...JSON.parse(data) };
  } catch {
    return DEFAULT_CONFIG;
  }
}

export async function saveFusionConfig(config: FusionConfig): Promise<void> {
  await fs.mkdir(path.dirname(CONFIG_PATH), { recursive: true });
  await fs.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2), "utf-8");
}
