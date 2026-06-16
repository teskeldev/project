/**
 * teskel login
 *
 * Authenticate with the Teskel API using an API key.
 * Stores the key in ~/.teskel/credentials.json.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import * as readline from "node:readline";

const CREDENTIALS_DIR = path.join(os.homedir(), ".teskel");
const CREDENTIALS_FILE = path.join(CREDENTIALS_DIR, "credentials.json");

interface Credentials {
  apiKey: string;
  apiUrl: string;
  authenticatedAt: string;
}

function prompt(question: string, hidden = false): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    if (hidden && process.stdin.isTTY) {
      // For hidden input, we still show the question but mask input
      process.stdout.write(question);
      let input = "";
      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.setEncoding("utf8");

      const onData = (char: string) => {
        if (char === "\n" || char === "\r" || char === "\u0004") {
          process.stdin.setRawMode(false);
          process.stdin.pause();
          process.stdin.removeListener("data", onData);
          process.stdout.write("\n");
          rl.close();
          resolve(input);
        } else if (char === "\u0003") {
          // Ctrl+C
          process.exit(0);
        } else if (char === "\u007F" || char === "\b") {
          // Backspace
          if (input.length > 0) {
            input = input.slice(0, -1);
            process.stdout.write("\b \b");
          }
        } else {
          input += char;
          process.stdout.write("*");
        }
      };

      process.stdin.on("data", onData);
    } else {
      rl.question(question, (answer) => {
        rl.close();
        resolve(answer.trim());
      });
    }
  });
}

export async function loginCommand(
  _args: string[],
  flags: Record<string, string | boolean>,
  apiUrl: string
): Promise<void> {
  console.log("\n  Teskel Login\n");

  // Get API key from flag or prompt
  let apiKey: string;
  if (typeof flags.key === "string") {
    apiKey = flags.key;
  } else if (typeof flags.token === "string") {
    apiKey = flags.token;
  } else {
    apiKey = await prompt("  API Key: ", true);
  }

  if (!apiKey) {
    throw new Error("API key is required. Get one from your workspace settings.");
  }

  // Validate key format
  if (!apiKey.startsWith("tsk_")) {
    console.log("  Warning: API key doesn't match expected format (tsk_...)");
  }

  // Verify the key by making a test request
  console.log("  Verifying credentials...");

  try {
    const res = await fetch(`${apiUrl}/api/user/profile`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      if (res.status === 401) {
        throw new Error("Invalid API key. Please check your key and try again.");
      }
      throw new Error(`API returned status ${res.status}`);
    }

    const body = (await res.json()) as {
      success: boolean;
      data?: { name?: string; email?: string };
    };

    if (!body.success) {
      throw new Error("Failed to verify credentials.");
    }

    const userName = body.data?.name || body.data?.email || "User";
    console.log(`  ✓ Authenticated as: ${userName}`);
  } catch (err) {
    if (err instanceof TypeError && err.message.includes("fetch")) {
      console.log("  Warning: Could not reach API to verify key (offline?)");
      console.log("  Saving credentials anyway...");
    } else {
      throw err;
    }
  }

  // Save credentials
  if (!fs.existsSync(CREDENTIALS_DIR)) {
    fs.mkdirSync(CREDENTIALS_DIR, { recursive: true });
  }

  const credentials: Credentials = {
    apiKey,
    apiUrl,
    authenticatedAt: new Date().toISOString(),
  };

  fs.writeFileSync(CREDENTIALS_FILE, JSON.stringify(credentials, null, 2) + "\n", {
    mode: 0o600, // Owner read/write only
  });

  console.log(`\n  ✓ Credentials saved to: ${CREDENTIALS_FILE}`);
  console.log(`\n  You can now use Teskel CLI commands.\n`);
}

/**
 * Load stored credentials. Returns null if not logged in.
 */
export function loadCredentials(): Credentials | null {
  if (!fs.existsSync(CREDENTIALS_FILE)) return null;
  try {
    const raw = fs.readFileSync(CREDENTIALS_FILE, "utf-8");
    return JSON.parse(raw) as Credentials;
  } catch {
    return null;
  }
}
