/**
 * Docker Sandbox for Verification — safe code execution environment.
 * Runs generated code in an isolated container for testing/verification.
 *
 * Falls back to direct execution with safety guards if Docker is unavailable.
 *
 * Phase 4.9 of the quality amplification system.
 */

import { exec, spawn, type ChildProcess } from "child_process";
import { promisify } from "util";
import { existsSync } from "fs";
import { resolve as resolvePath } from "path";

const execAsync = promisify(exec);

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type SandboxOptions = {
  command: string;
  cwd?: string;
  timeout?: number; // Default 30000ms
  memoryLimit?: string; // Default '512m'
  networkEnabled?: boolean; // Default false
  env?: Record<string, string>;
};

export type SandboxResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  durationMs: number;
  sandboxed: boolean; // Was Docker actually used?
};

export type SandboxStatus = {
  available: boolean;
  dockerVersion?: string;
  error?: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MEMORY_LIMIT = "512m";
const DEFAULT_CPU_LIMIT = "1";
const DOCKER_IMAGE = "node:20-slim";

/** Maximum output size to capture (prevent OOM from runaway output) */
const MAX_OUTPUT_BYTES = 1024 * 1024; // 1MB

/** Commands that are always blocked in fallback mode */
const BLOCKED_PATTERNS: RegExp[] = [
  /rm\s+(-[a-zA-Z]*f[a-zA-Z]*\s+)?(-[a-zA-Z]*r[a-zA-Z]*\s+)?\/(?!\w)/,  // rm -rf /
  /rm\s+(-[a-zA-Z]*r[a-zA-Z]*\s+)?(-[a-zA-Z]*f[a-zA-Z]*\s+)?\/(?!\w)/,  // rm -fr /
  /\bsudo\b/,
  /chmod\s+777\s+\//,
  /\bcurl\b.*\|\s*\bsh\b/,
  /\bwget\b.*\|\s*\bsh\b/,
  /\bcurl\b.*\|\s*\bbash\b/,
  /\bwget\b.*\|\s*\bbash\b/,
  /\bmkfs\b/,
  /\bdd\b.*\bof=\/dev\//,
  /:(){ :\|:& };:/,  // Fork bomb
  />\s*\/dev\/sd[a-z]/,
  /\bshutdown\b/,
  /\breboot\b/,
  /\binit\s+0\b/,
];

/**
 * Patterns that are ALWAYS rejected when the Docker sandbox is unavailable.
 * When the container is up, `executeInDocker` constrains the blast radius
 * (read-only fs, no network, memory/cpu limits, no-new-privileges), so we
 * allow the broader command set. Without a container, the same command
 * would run on the host with the user's privileges, so we refuse anything
 * that looks like it could wipe a disk, take the box down, or write to a
 * raw block device.
 */
const DANGEROUS_WHEN_UNSANDBOXED: RegExp[] = [
  /\brm\s+(?:-\S+\s+)*-\S*(?:rf|fr)\S*\b/i,            // rm -rf / rm -fr
  /\brm\s+(?:-\S+\s+)*(?:-r\S*\s+-f|-f\S*\s+-r)/i,    // rm -r -f / rm -f -r
  /\brm\b[^\n]*--recursive\b[^\n]*--force\b/i,         // rm --recursive --force
  /\bmkfs(?:\.\w+)?\b/i,                               // mkfs, mkfs.ext4, ...
  /\bdd\s+[^\n]*\b(?:if|of)=/i,                        // dd if=/dev/... of=...
  /\b(?:shutdown|reboot|halt|poweroff)\b/i,            // power control
  />\s*\/dev\/sd[a-z]/i,                               // > /dev/sda
  /\bdiskpart\b/i,                                     // Windows diskpart
  /\bformat\s+[a-zA-Z]:/i,                              // Windows format C:
];

/** Commands that are explicitly allowed in fallback mode */
const ALLOWED_PATTERNS: RegExp[] = [
  /^npm\s+test/,
  /^npm\s+run\s+test/,
  /^npx\s+vitest/,
  /^npx\s+jest/,
  /^npx\s+eslint/,
  /^npx\s+tsc/,
  /^npx\s+prettier/,
  /^npx\s+mocha/,
  /^pytest/,
  /^python\s+-m\s+pytest/,
  /^go\s+test/,
  /^cargo\s+test/,
  /^cargo\s+clippy/,
  /^make\s+test/,
  /^yarn\s+test/,
  /^pnpm\s+test/,
  /^bun\s+test/,
  /^node\s+/,
  /^deno\s+test/,
];

// ─────────────────────────────────────────────────────────────────────────────
// Cached Docker availability
// ─────────────────────────────────────────────────────────────────────────────

let cachedStatus: SandboxStatus | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 60_000; // Re-check every 60 seconds

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/** Check if Docker sandbox is available */
export async function checkSandboxAvailability(): Promise<SandboxStatus> {
  // Return cached result if fresh
  if (cachedStatus && Date.now() - cacheTimestamp < CACHE_TTL_MS) {
    return cachedStatus;
  }

  try {
    const { stdout } = await execAsync("docker --version", { timeout: 5000 });
    const version = stdout.trim();

    // Verify Docker daemon is actually running
    await execAsync("docker info", { timeout: 10000 });

    cachedStatus = { available: true, dockerVersion: version };
    cacheTimestamp = Date.now();
    return cachedStatus;
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);

    cachedStatus = {
      available: false,
      error: errorMessage.includes("not found")
        ? "Docker is not installed"
        : errorMessage.includes("daemon")
          ? "Docker daemon is not running"
          : `Docker unavailable: ${errorMessage}`,
    };
    cacheTimestamp = Date.now();
    return cachedStatus;
  }
}

/** Execute a command in a sandboxed environment */
export async function executeSandboxed(
  options: SandboxOptions
): Promise<SandboxResult> {
  const {
    command,
    cwd,
    timeout = DEFAULT_TIMEOUT_MS,
    memoryLimit = DEFAULT_MEMORY_LIMIT,
    networkEnabled = false,
    env,
  } = options;

  const startTime = Date.now();
  const status = await checkSandboxAvailability();

  if (status.available) {
    return executeInDocker({
      command,
      cwd,
      timeout,
      memoryLimit,
      networkEnabled,
      env,
      startTime,
    });
  }

  // Fallback path: Docker is NOT available. Before even attempting the
  // much weaker direct-execution path, reject any command that matches
  // obviously destructive patterns. This avoids ever spawning a shell with
  // `rm -rf /`, `mkfs`, raw `dd` to a disk, `shutdown`, etc. when we have
  // no container to constrain the blast radius.
  const dangerMatch = DANGEROUS_WHEN_UNSANDBOXED.find((re) => re.test(command));
  if (dangerMatch) {
    return {
      exitCode: 1,
      stdout: "",
      stderr: `Command blocked: Docker sandbox is unavailable and command matches destructive pattern (${dangerMatch.source}). Run inside a sandboxed environment.`,
      timedOut: false,
      durationMs: Date.now() - startTime,
      sandboxed: false,
    };
  }

  // Fallback to direct execution with safety guards
  return executeDirectly({
    command,
    cwd,
    timeout,
    env,
    startTime,
  });
}

/** Run tests in sandbox */
export async function runTestsInSandbox(
  testCommand: string,
  cwd: string,
  options?: { timeout?: number; env?: Record<string, string> }
): Promise<SandboxResult> {
  return executeSandboxed({
    command: testCommand,
    cwd,
    timeout: options?.timeout ?? 60_000, // Tests get longer timeout
    memoryLimit: "1g", // Tests may need more memory
    networkEnabled: false,
    env: {
      NODE_ENV: "test",
      CI: "true",
      ...options?.env,
    },
  });
}

/** Run lint/typecheck in sandbox */
export async function runLintInSandbox(
  command: string,
  cwd: string
): Promise<SandboxResult> {
  return executeSandboxed({
    command,
    cwd,
    timeout: 60_000, // Lint/typecheck can be slow on large projects
    memoryLimit: "1g",
    networkEnabled: false,
    env: {
      NODE_ENV: "production",
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Docker Execution
// ─────────────────────────────────────────────────────────────────────────────

type DockerExecOptions = {
  command: string;
  cwd?: string;
  timeout: number;
  memoryLimit: string;
  networkEnabled: boolean;
  env?: Record<string, string>;
  startTime: number;
};

async function executeInDocker(options: DockerExecOptions): Promise<SandboxResult> {
  const {
    command,
    cwd,
    timeout,
    memoryLimit,
    networkEnabled,
    env,
    startTime,
  } = options;

  const workDir = cwd ? resolvePath(cwd) : process.cwd();

  // Build docker run arguments
  const args: string[] = [
    "run",
    "--rm",
    // Resource limits
    `--memory=${memoryLimit}`,
    `--cpus=${DEFAULT_CPU_LIMIT}`,
    // Security
    "--read-only",
    "--no-new-privileges",
    "--security-opt=no-new-privileges:true",
    // Tmpfs for writable directories
    "--tmpfs=/tmp:rw,noexec,nosuid,size=256m",
    "--tmpfs=/root:rw,noexec,nosuid,size=64m",
    // Network
    ...(networkEnabled ? [] : ["--network=none"]),
    // Mount workspace
    `-v=${workDir}:/workspace:rw`,
    "-w=/workspace",
    // Environment variables
    ...buildEnvArgs(env),
    // Prevent container from running as root in some cases
    // (keeping as root for node_modules access compatibility)
    // Image
    DOCKER_IMAGE,
    // Command
    "sh",
    "-c",
    command,
  ];

  return new Promise<SandboxResult>((resolve) => {
    let stdout = "";
    let stderr = "";
    let timedOut = false;

    const child: ChildProcess = spawn("docker", args, {
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 0, // We handle timeout ourselves
    });

    // Timeout handler
    const timer = setTimeout(() => {
      timedOut = true;
      // Kill the docker container
      child.kill("SIGKILL");
      // Also try to stop the container by name if kill doesn't work
      tryKillContainer(child.pid);
    }, timeout);

    // Capture stdout
    child.stdout?.on("data", (data: Buffer) => {
      if (stdout.length < MAX_OUTPUT_BYTES) {
        stdout += data.toString();
      }
    });

    // Capture stderr
    child.stderr?.on("data", (data: Buffer) => {
      if (stderr.length < MAX_OUTPUT_BYTES) {
        stderr += data.toString();
      }
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({
        exitCode: code ?? (timedOut ? 124 : 1),
        stdout: truncateOutput(stdout),
        stderr: truncateOutput(stderr),
        timedOut,
        durationMs: Date.now() - startTime,
        sandboxed: true,
      });
    });

    child.on("error", (error) => {
      clearTimeout(timer);
      resolve({
        exitCode: 1,
        stdout: "",
        stderr: error.message,
        timedOut: false,
        durationMs: Date.now() - startTime,
        sandboxed: true,
      });
    });
  });
}

/** Build -e flags for environment variables */
function buildEnvArgs(env?: Record<string, string>): string[] {
  if (!env) return [];

  const args: string[] = [];
  for (const [key, value] of Object.entries(env)) {
    // Sanitize env var names (only allow alphanumeric + underscore)
    if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
      args.push("-e", `${key}=${value}`);
    }
  }
  return args;
}

/** Attempt to kill a docker container by process ID */
function tryKillContainer(pid: number | undefined): void {
  if (!pid) return;

  // Docker containers spawned via `docker run` can be killed via the process
  // If that fails, we rely on the --rm flag to clean up
  try {
    process.kill(pid, "SIGKILL");
  } catch {
    // Process may already be dead
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Direct Execution (Fallback)
// ─────────────────────────────────────────────────────────────────────────────

type DirectExecOptions = {
  command: string;
  cwd?: string;
  timeout: number;
  env?: Record<string, string>;
  startTime: number;
};

async function executeDirectly(options: DirectExecOptions): Promise<SandboxResult> {
  const { command, cwd, timeout, env, startTime } = options;

  // Safety check: validate command against blocklist
  const safetyResult = validateCommand(command);
  if (!safetyResult.safe) {
    return {
      exitCode: 1,
      stdout: "",
      stderr: `Command blocked by safety check: ${safetyResult.reason}`,
      timedOut: false,
      durationMs: Date.now() - startTime,
      sandboxed: false,
    };
  }

  const workDir = cwd ? resolvePath(cwd) : process.cwd();

  // Verify working directory exists
  if (!existsSync(workDir)) {
    return {
      exitCode: 1,
      stdout: "",
      stderr: `Working directory does not exist: ${workDir}`,
      timedOut: false,
      durationMs: Date.now() - startTime,
      sandboxed: false,
    };
  }

  return new Promise<SandboxResult>((resolve) => {
    let timedOut = false;

    const child = spawn("sh", ["-c", command], {
      cwd: workDir,
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        ...env,
        // Safety: restrict PATH to common locations
        PATH: getSafePath(),
      },
      // Don't inherit the parent's group for clean kill
      detached: false,
    });

    let stdout = "";
    let stderr = "";

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, timeout);

    child.stdout?.on("data", (data: Buffer) => {
      if (stdout.length < MAX_OUTPUT_BYTES) {
        stdout += data.toString();
      }
    });

    child.stderr?.on("data", (data: Buffer) => {
      if (stderr.length < MAX_OUTPUT_BYTES) {
        stderr += data.toString();
      }
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({
        exitCode: code ?? (timedOut ? 124 : 1),
        stdout: truncateOutput(stdout),
        stderr: truncateOutput(stderr),
        timedOut,
        durationMs: Date.now() - startTime,
        sandboxed: false,
      });
    });

    child.on("error", (error) => {
      clearTimeout(timer);
      resolve({
        exitCode: 1,
        stdout: "",
        stderr: error.message,
        timedOut: false,
        durationMs: Date.now() - startTime,
        sandboxed: false,
      });
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Safety Validation
// ─────────────────────────────────────────────────────────────────────────────

type ValidationResult = {
  safe: boolean;
  reason?: string;
};

/** Validate a command against the blocklist and allowlist */
function validateCommand(command: string): ValidationResult {
  const trimmed = command.trim();

  // Check blocklist first
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(trimmed)) {
      return {
        safe: false,
        reason: `Matches blocked pattern: ${pattern.source}`,
      };
    }
  }

  // Check if command starts with an allowed pattern
  const isExplicitlyAllowed = ALLOWED_PATTERNS.some((pattern) =>
    pattern.test(trimmed)
  );

  if (isExplicitlyAllowed) {
    return { safe: true };
  }

  // For commands that aren't explicitly allowed or blocked,
  // apply additional heuristic checks
  return validateUnknownCommand(trimmed);
}

/** Additional validation for commands not in allow/block lists */
function validateUnknownCommand(command: string): ValidationResult {
  // Block commands that write to system directories
  if (/>\s*\/(etc|usr|bin|sbin|boot|sys|proc)\//.test(command)) {
    return {
      safe: false,
      reason: "Writes to system directory",
    };
  }

  // Block commands that modify system files
  if (/\b(passwd|shadow|sudoers|crontab)\b/.test(command)) {
    return {
      safe: false,
      reason: "Modifies system configuration files",
    };
  }

  // Block network exfiltration attempts
  if (/\b(nc|netcat|ncat)\b.*-[a-z]*l/.test(command)) {
    return {
      safe: false,
      reason: "Network listener detected",
    };
  }

  // Block package installation (could be malicious)
  if (/\b(pip|pip3)\s+install\b/.test(command) && /--index-url/.test(command)) {
    return {
      safe: false,
      reason: "Package installation from custom index",
    };
  }

  // Allow the command if it passes all checks
  // In fallback mode, we're more permissive since the user has no Docker
  return { safe: true };
}

/** Get a restricted PATH for fallback execution */
function getSafePath(): string {
  const paths = [
    "/usr/local/bin",
    "/usr/bin",
    "/bin",
    "/usr/local/sbin",
    "/usr/sbin",
    "/sbin",
  ];

  // Include node_modules/.bin if it exists in cwd
  const localBin = resolvePath("node_modules/.bin");
  if (existsSync(localBin)) {
    paths.unshift(localBin);
  }

  return paths.join(":");
}

// ─────────────────────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────────────────────

/** Truncate output to prevent memory issues */
function truncateOutput(output: string): string {
  if (output.length <= MAX_OUTPUT_BYTES) {
    return output;
  }

  const truncated = output.slice(0, MAX_OUTPUT_BYTES);
  const lineBreak = truncated.lastIndexOf("\n");

  // Try to truncate at a line boundary
  if (lineBreak > MAX_OUTPUT_BYTES * 0.8) {
    return truncated.slice(0, lineBreak) + "\n... [output truncated]";
  }

  return truncated + "\n... [output truncated]";
}

/** Reset the cached Docker status (useful for testing) */
export function resetSandboxCache(): void {
  cachedStatus = null;
  cacheTimestamp = 0;
}

/**
 * Validate that a command is safe to run, exposed for testing.
 * Returns true if the command passes safety checks.
 */
export function isCommandSafe(command: string): boolean {
  return validateCommand(command).safe;
}
