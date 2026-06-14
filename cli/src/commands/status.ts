/**
 * teskel status
 *
 * Show the current project status including:
 * - Project info (name, ID)
 * - Git status (branch, changes)
 * - Recent agent runs
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { loadCredentials } from "./login.js";

interface ProjectConfig {
  projectId?: string;
  projectName: string;
  apiUrl: string;
  createdAt: string;
}

interface StatusResponse {
  project: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
  };
  git?: {
    branch: string | null;
    clean: boolean;
    staged: number;
    unstaged: number;
    untracked: number;
    ahead: number;
    behind: number;
  };
}

export async function statusCommand(
  _args: string[],
  _flags: Record<string, string | boolean>,
  apiUrl: string
): Promise<void> {
  // Load project config
  const configPath = path.join(process.cwd(), ".teskel", "config.json");
  if (!fs.existsSync(configPath)) {
    throw new Error(
      'No Teskel project found. Run "teskel init" to initialize.'
    );
  }

  const config: ProjectConfig = JSON.parse(
    fs.readFileSync(configPath, "utf-8")
  );

  // Load credentials
  const creds = loadCredentials();
  if (!creds) {
    throw new Error('Not logged in. Run "teskel login" first.');
  }

  const effectiveUrl = creds.apiUrl || apiUrl;

  console.log("\n  ┌─────────────────────────────────────┐");
  console.log("  │         Teskel Project Status        │");
  console.log("  └─────────────────────────────────────┘\n");

  // Local info
  console.log(`  Project:  ${config.projectName}`);
  console.log(`  API URL:  ${effectiveUrl}`);

  if (!config.projectId) {
    console.log(`\n  ⚠ Project not linked to a remote Teskel project.`);
    console.log(`    Link it in the Teskel dashboard or set projectId in .teskel/config.json\n`);
    return;
  }

  console.log(`  ID:       ${config.projectId}`);

  // Fetch remote status
  try {
    const res = await fetch(
      `${effectiveUrl}/api/projects/${encodeURIComponent(config.projectId)}`,
      {
        headers: {
          Authorization: `Bearer ${creds.apiKey}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!res.ok) {
      if (res.status === 401) {
        console.log(`\n  ⚠ Authentication failed. Run "teskel login" to re-authenticate.\n`);
        return;
      }
      if (res.status === 404) {
        console.log(`\n  ⚠ Project not found on remote. It may have been deleted.\n`);
        return;
      }
      console.log(`\n  ⚠ API returned status ${res.status}\n`);
      return;
    }

    const body = (await res.json()) as { success: boolean; data?: StatusResponse };
    if (!body.success || !body.data) {
      console.log(`\n  ⚠ Unexpected API response.\n`);
      return;
    }

    const { project } = body.data;
    console.log(`  Name:     ${project.name}`);
    if (project.description) {
      console.log(`  Desc:     ${project.description}`);
    }

    // Fetch git status
    const gitRes = await fetch(
      `${effectiveUrl}/api/projects/${encodeURIComponent(config.projectId)}/git/status`,
      {
        headers: {
          Authorization: `Bearer ${creds.apiKey}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (gitRes.ok) {
      const gitBody = (await gitRes.json()) as {
        success: boolean;
        data?: {
          isRepo: boolean;
          branch?: string;
          clean?: boolean;
          staged?: unknown[];
          unstaged?: unknown[];
          untracked?: unknown[];
          ahead?: number;
          behind?: number;
        };
      };

      if (gitBody.success && gitBody.data?.isRepo) {
        const g = gitBody.data;
        console.log(`\n  Git:`);
        console.log(`    Branch:    ${g.branch ?? "(detached)"}`);
        console.log(`    Clean:     ${g.clean ? "✓" : "✗"}`);
        if (!g.clean) {
          console.log(`    Staged:    ${g.staged?.length ?? 0} files`);
          console.log(`    Unstaged:  ${g.unstaged?.length ?? 0} files`);
          console.log(`    Untracked: ${g.untracked?.length ?? 0} files`);
        }
        if (g.ahead && g.ahead > 0) console.log(`    Ahead:     ${g.ahead} commits`);
        if (g.behind && g.behind > 0) console.log(`    Behind:    ${g.behind} commits`);
      } else if (gitBody.success && !gitBody.data?.isRepo) {
        console.log(`\n  Git: Not initialized`);
      }
    }
  } catch (err) {
    if (err instanceof TypeError && err.message.includes("fetch")) {
      console.log(`\n  ⚠ Cannot reach API (offline?)`);
    } else {
      throw err;
    }
  }

  console.log("");
}
