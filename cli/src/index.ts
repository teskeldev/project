#!/usr/bin/env node

/**
 * Teskel CLI
 *
 * Commands:
 *   init     - Initialize a Teskel project in the current directory
 *   login    - Authenticate with your API key
 *   status   - Show project status
 *   chat     - Chat with AI from the terminal
 *   help     - Show help information
 *
 * Zero-dependency CLI using manual argument parsing.
 */

import { initCommand } from "./commands/init.js";
import { loginCommand } from "./commands/login.js";
import { statusCommand } from "./commands/status.js";
import { chatCommand } from "./commands/chat.js";

/* -------------------------------------------------------------------------- */
/* Argument parsing                                                           */
/* -------------------------------------------------------------------------- */

interface ParsedArgs {
  command: string;
  args: string[];
  flags: Record<string, string | boolean>;
}

function parseArgs(argv: string[]): ParsedArgs {
  const raw = argv.slice(2); // skip node + script path
  const command = raw[0] ?? "help";
  const args: string[] = [];
  const flags: Record<string, string | boolean> = {};

  for (let i = 1; i < raw.length; i++) {
    const arg = raw[i];
    if (arg.startsWith("--")) {
      const eqIdx = arg.indexOf("=");
      if (eqIdx !== -1) {
        flags[arg.slice(2, eqIdx)] = arg.slice(eqIdx + 1);
      } else {
        const next = raw[i + 1];
        if (next && !next.startsWith("-")) {
          flags[arg.slice(2)] = next;
          i++;
        } else {
          flags[arg.slice(2)] = true;
        }
      }
    } else if (arg.startsWith("-") && arg.length === 2) {
      const next = raw[i + 1];
      if (next && !next.startsWith("-")) {
        flags[arg.slice(1)] = next;
        i++;
      } else {
        flags[arg.slice(1)] = true;
      }
    } else {
      args.push(arg);
    }
  }

  return { command, args, flags };
}

/* -------------------------------------------------------------------------- */
/* Help                                                                       */
/* -------------------------------------------------------------------------- */

function printHelp(): void {
  const help = `
  ╔══════════════════════════════════════╗
  ║          Teskel CLI v0.1.0          ║
  ╚══════════════════════════════════════╝

  Usage: teskel <command> [options]

  Commands:
    init              Initialize a Teskel project in the current directory
    login             Authenticate with your API key
    status            Show project status (files, git, agents)
    chat <message>    Chat with AI from the terminal

  Options:
    --help, -h        Show help for a command
    --version, -v     Show version number
    --api-url         Override the API base URL

  Examples:
    teskel init
    teskel login --key tsk_live_abc123
    teskel status
    teskel chat "How do I add authentication?"

  Documentation: https://teskel.dev/docs/cli
`;
  console.log(help);
}

function printVersion(): void {
  console.log("@teskel/cli v0.1.0");
}

/* -------------------------------------------------------------------------- */
/* Main                                                                       */
/* -------------------------------------------------------------------------- */

async function main(): Promise<void> {
  const { command, args, flags } = parseArgs(process.argv);

  // Global flags
  if (flags.version || flags.v) {
    printVersion();
    return;
  }

  if (flags.help || flags.h || command === "help") {
    printHelp();
    return;
  }

  const apiUrl = (typeof flags["api-url"] === "string"
    ? flags["api-url"]
    : undefined) ?? "https://app.teskel.dev";

  try {
    switch (command) {
      case "init":
        await initCommand(args, flags);
        break;
      case "login":
        await loginCommand(args, flags, apiUrl);
        break;
      case "status":
        await statusCommand(args, flags, apiUrl);
        break;
      case "chat":
        await chatCommand(args, flags, apiUrl);
        break;
      default:
        console.error(`Unknown command: ${command}`);
        console.error('Run "teskel help" for usage information.');
        process.exit(1);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`\n  Error: ${message}\n`);
    process.exit(1);
  }
}

main();
