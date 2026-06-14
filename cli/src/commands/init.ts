/**
 * teskel init
 *
 * Initialize a Teskel project in the current directory.
 * Creates a `.teskel/config.json` file with project metadata.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as readline from "node:readline";

const CONFIG_DIR = ".teskel";
const CONFIG_FILE = "config.json";

interface TeskelConfig {
  projectId?: string;
  projectName: string;
  apiUrl: string;
  createdAt: string;
}

function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

export async function initCommand(
  _args: string[],
  flags: Record<string, string | boolean>
): Promise<void> {
  const cwd = process.cwd();
  const configDir = path.join(cwd, CONFIG_DIR);
  const configPath = path.join(configDir, CONFIG_FILE);

  // Check if already initialized
  if (fs.existsSync(configPath)) {
    console.log("\n  Project already initialized.");
    console.log(`  Config: ${configPath}\n`);
    return;
  }

  console.log("\n  Initializing Teskel project...\n");

  // Get project name
  const dirName = path.basename(cwd);
  let projectName: string;

  if (typeof flags.name === "string") {
    projectName = flags.name;
  } else {
    projectName = await prompt(`  Project name (${dirName}): `);
    if (!projectName) projectName = dirName;
  }

  // Create config directory
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  // Write config
  const config: TeskelConfig = {
    projectName,
    apiUrl: "https://app.teskel.dev",
    createdAt: new Date().toISOString(),
  };

  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n");

  // Add .teskel to .gitignore if it exists
  const gitignorePath = path.join(cwd, ".gitignore");
  if (fs.existsSync(gitignorePath)) {
    const content = fs.readFileSync(gitignorePath, "utf-8");
    if (!content.includes(".teskel")) {
      fs.appendFileSync(gitignorePath, "\n# Teskel\n.teskel/\n");
      console.log("  Added .teskel/ to .gitignore");
    }
  }

  console.log(`\n  ✓ Project initialized: ${projectName}`);
  console.log(`  Config saved to: ${configPath}`);
  console.log(`\n  Next steps:`);
  console.log(`    teskel login    - Authenticate with your API key`);
  console.log(`    teskel status   - Check project status\n`);
}
