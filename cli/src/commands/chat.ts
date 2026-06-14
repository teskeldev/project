/**
 * teskel chat
 *
 * Chat with AI from the terminal. Supports:
 * - Single message mode: teskel chat "How do I add auth?"
 * - Interactive mode: teskel chat (starts a REPL)
 *
 * Streams responses from the Teskel AI chat API.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as readline from "node:readline";
import { loadCredentials } from "./login.js";

interface ProjectConfig {
  projectId?: string;
  projectName: string;
  apiUrl: string;
}

interface ThreadResponse {
  thread: { id: string; title: string };
}

export async function chatCommand(
  args: string[],
  flags: Record<string, string | boolean>,
  apiUrl: string
): Promise<void> {
  // Load credentials
  const creds = loadCredentials();
  if (!creds) {
    throw new Error('Not logged in. Run "teskel login" first.');
  }

  const effectiveUrl = creds.apiUrl || apiUrl;

  // Load project config
  const configPath = path.join(process.cwd(), ".teskel", "config.json");
  let projectId: string | undefined;

  if (fs.existsSync(configPath)) {
    const config: ProjectConfig = JSON.parse(
      fs.readFileSync(configPath, "utf-8")
    );
    projectId = config.projectId;
  }

  if (!projectId) {
    if (typeof flags.project === "string") {
      projectId = flags.project;
    } else {
      throw new Error(
        'No project linked. Set projectId in .teskel/config.json or use --project <id>'
      );
    }
  }

  // Create a thread for this session
  const threadId = await createThread(effectiveUrl, creds.apiKey, projectId);

  // Single message mode
  if (args.length > 0) {
    const message = args.join(" ");
    await sendMessage(effectiveUrl, creds.apiKey, threadId, projectId, message);
    return;
  }

  // Interactive mode
  console.log("\n  Teskel AI Chat (type 'exit' or Ctrl+C to quit)\n");

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const askQuestion = (): void => {
    rl.question("  You: ", async (input) => {
      const trimmed = input.trim();
      if (!trimmed || trimmed === "exit" || trimmed === "quit") {
        console.log("\n  Goodbye!\n");
        rl.close();
        return;
      }

      await sendMessage(effectiveUrl, creds!.apiKey, threadId, projectId!, trimmed);
      askQuestion();
    });
  };

  askQuestion();
}

async function createThread(
  apiUrl: string,
  apiKey: string,
  projectId: string
): Promise<string> {
  const res = await fetch(
    `${apiUrl}/api/projects/${encodeURIComponent(projectId)}/chat/threads`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ title: "CLI Chat" }),
    }
  );

  if (!res.ok) {
    if (res.status === 401) {
      throw new Error('Authentication failed. Run "teskel login" to re-authenticate.');
    }
    throw new Error(`Failed to create chat thread (status ${res.status})`);
  }

  const body = (await res.json()) as { success: boolean; data?: ThreadResponse };
  if (!body.success || !body.data) {
    throw new Error("Failed to create chat thread.");
  }

  return body.data.thread.id;
}

async function sendMessage(
  apiUrl: string,
  apiKey: string,
  threadId: string,
  projectId: string,
  message: string
): Promise<void> {
  process.stdout.write("\n  AI: ");

  try {
    const res = await fetch(`${apiUrl}/api/ai/chat/stream`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ threadId, message, projectId }),
    });

    if (!res.ok) {
      const errBody = (await res.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;
      const errMsg = errBody?.error?.message ?? `Status ${res.status}`;
      console.log(`[Error: ${errMsg}]`);
      return;
    }

    if (!res.body) {
      console.log("[No response body]");
      return;
    }

    // Read SSE stream
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6);
          if (data === "[DONE]") continue;

          try {
            const parsed = JSON.parse(data) as {
              type?: string;
              content?: string;
              token?: string;
            };
            const token = parsed.content ?? parsed.token ?? "";
            if (token) {
              process.stdout.write(token);
            }
          } catch {
            // Skip malformed SSE data
          }
        }
      }
    }

    process.stdout.write("\n\n");
  } catch (err) {
    if (err instanceof TypeError && err.message.includes("fetch")) {
      console.log("[Cannot reach API - are you offline?]\n");
    } else {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`[Error: ${msg}]\n`);
    }
  }
}
