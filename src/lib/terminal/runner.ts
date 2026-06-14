/**
 * SAFE terminal command runner for Teskel (Phase 5a).
 *
 * ??  SECURITY: this module executes REAL operating-system commands. Every
 * command MUST pass `validateCommand()` BEFORE it is spawned. Even with the
 * blocklist, executing arbitrary OS commands is inherently risky - the
 * recommended production hardening is to run each command inside a disposable
 * Docker container (see README). This runner provides defense-in-depth:
 *
 *   1. BLOCKLIST  - reject obviously destructive / exfiltration commands.
 *   2. CWD JAIL   - commands run with cwd pinned inside the project's storage
 *                   root; `cd` is validated via resolveSafe and can never
 *                   escape the root.
 *   3. ENV SCRUB  - a minimal ALLOWLISTED environment is passed to the child;
 *                   secrets (OPENAI_API_KEY, AUTH_SECRET, DATABASE_URL,
 *                   ENCRYPTION_KEY, .) are NEVER forwarded.
 *   4. TIMEOUT    - the process (group) is killed after
 *                   MAX_TERMINAL_TIMEOUT_SECONDS.
 *   5. OUTPUT CAP - captured output is truncated at MAX_OUTPUT_BYTES.
 *   6. ONE-AT-A-TIME - only a single command may run per session.
 */
import { spawn, type ChildProcess } from "node:child_process";
import { realpathSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { ApiError } from "@/lib/api";
import { getProjectRoot, resolveSafe } from "@/lib/storage";
import { logger } from "@/lib/logger";
import {
  getSandboxConfig,
  isSandboxEnabled,
  buildSandboxArgs,
  buildKillArgs,
  sandboxContainerName,
  describeSandbox,
} from "@/lib/terminal/sandbox";

/** Audit log for every command execution (sandboxed or fallback). */
const audit = logger.child({ component: "terminal" });

const isWin = process.platform === "win32";

/** Hard cap on captured output (per command). Excess is truncated. */
export const MAX_OUTPUT_BYTES = 256 * 1024; // 256 KB

/** Per-command timeout, from env (default 30s), clamped to a sane range. */
export function getMaxTimeoutSeconds(): number {
  const raw = Number(process.env.MAX_TERMINAL_TIMEOUT_SECONDS ?? "30");
  if (!Number.isFinite(raw) || raw <= 0) return 30;
  return Math.min(Math.max(Math.floor(raw), 1), 300);
}

/* -------------------------------------------------------------------------- */
/* Command validation (BLOCKLIST)                                             */
/* -------------------------------------------------------------------------- */

export type CommandValidation = {
  ok: boolean;
  /** Present when ok === false: why the command was blocked. */
  reason?: string;
  /** Present when ok === true but the command is risky (e.g. force push). */
  warning?: string;
};

/**
 * Informative ALLOW-sense: common, generally-safe dev commands. Validation is
 * blocklist-based (anything not blocked is allowed), but this documents the
 * everyday commands we expect to pass: ls, dir, pwd, echo, cat <file>, node,
 * npm, npx, pnpm, yarn, git (non-destructive), cd, mkdir, touch, etc.
 */
export const COMMON_DEV_COMMANDS = [
  "ls", "dir", "pwd", "cd", "echo", "cat", "type", "node", "npm", "npx",
  "pnpm", "yarn", "git", "mkdir", "touch", "cp", "copy", "mv", "move",
  "head", "tail", "grep", "find", "where", "which", "tsc", "jest", "vitest",
] as const;

/**
 * Patterns that are ALWAYS blocked (case-insensitive). Kept pragmatic but
 * genuinely protective; covers both POSIX and Windows shells.
 */
const BLOCKLIST: { re: RegExp; reason: string }[] = [
  /* --- privilege escalation --- */
  { re: /\bsudo\b/i, reason: "sudo (privilege escalation) is not allowed" },
  { re: /(?:^|[;&|]\s*)su\b/i, reason: "su (switch user) is not allowed" },
  { re: /\bdoas\b/i, reason: "doas (privilege escalation) is not allowed" },

  /* --- permission changes --- */
  {
    re: /\bchmod\s+(?:-\S+\s+)*0?777\b/i,
    reason: "chmod 777 (world-writable) is not allowed",
  },
  {
    re: /\bchmod\s+-R\b[^\n]*\/(?:\s|$)/i,
    reason: "recursive chmod of a root path is not allowed",
  },
  { re: /\bchown\s+-R\b[^\n]*\s\/(?:\s|$)/i, reason: "recursive chown of root is not allowed" },

  /* --- filesystem / disk destruction --- */
  { re: /\bmkfs(?:\.\w+)?\b/i, reason: "mkfs (format filesystem) is not allowed" },
  { re: /\bdd\s+[^\n]*\b(?:if|of)=/i, reason: "dd (raw disk I/O) is not allowed" },
  { re: /\bdiskpart\b/i, reason: "diskpart is not allowed" },
  { re: /\bformat\s+[a-zA-Z]:/i, reason: "format <drive> is not allowed" },
  { re: /\bcipher\s+\/w/i, reason: "cipher /w (secure wipe) is not allowed" },

  /* --- writing to devices / system paths --- */
  {
    re: /(?:>>?|:>)\s*\/dev\/(?!null\b|stdout\b|stderr\b)/i,
    reason: "writing to a /dev/ device is not allowed",
  },
  {
    re: /(?:>>?|:>)\s*\/(?:etc|bin|sbin|usr|boot|sys|proc|lib|var|root|dev)\b/i,
    reason: "overwriting a system path is not allowed",
  },

  /* --- power / system control --- */
  {
    re: /\b(?:shutdown|reboot|halt|poweroff)\b/i,
    reason: "system power/control commands are not allowed",
  },
  { re: /\binit\s+[06]\b/i, reason: "init 0/6 (halt/reboot) is not allowed" },

  /* --- fork bombs --- */
  {
    re: /:\s*\(\s*\)\s*\{|\(\)\s*\{\s*[:.\w]+\s*\|\s*[:.\w]+\s*&\s*\}/,
    reason: "fork bomb pattern detected",
  },

  /* --- piping a remote download straight into a shell (curl|sh, wget|sh) --- */
  {
    re: /\|\s*(?:sudo\s+)?(?:sh|bash|zsh|dash|ksh|csh|fish|powershell|pwsh|cmd)\b/i,
    reason: "piping output directly into a shell is not allowed",
  },

  /* --- environment / secret exfiltration --- */
  {
    re: /\b(?:cat|less|more|head|tail|type|bat|nano|vi|vim|emacs|strings|xxd|od|get-content)\b[^\n]*(?:^|[\\/\s])\.env\b/i,
    reason: "reading .env files is not allowed",
  },
  { re: /\bprintenv\b/i, reason: "printenv (dump environment) is not allowed" },
  {
    re: /(?:^|[;&|]\s*)env(?:\s|$)/i,
    reason: "bare `env` (dump environment) is not allowed",
  },
  { re: /\bgci\s+env:/i, reason: "dumping the environment is not allowed" },
  { re: /\bget-childitem\s+env:/i, reason: "dumping the environment is not allowed" },
  {
    re: /(?:\$\{?|%)(?:OPENAI_API_KEY|AUTH_SECRET|NEXTAUTH_SECRET|DATABASE_URL|ENCRYPTION_KEY|AWS_SECRET_ACCESS_KEY|GITHUB_TOKEN)\b/i,
    reason: "referencing a secret environment variable is not allowed",
  },

  /* --- arbitrary code evaluation --- */
  { re: /(?:^|[;&|`(\s])eval\b/i, reason: "eval is not allowed" },

  /* --- parent-directory traversal in args --- */
  {
    re: /(?:^|[\s="'(])\.\.(?:[\\/]|$)/,
    reason: "parent-directory traversal (..) is not allowed",
  },

  /* --- persistent background daemons --- */
  { re: /(?:^|\s)nohup\b/i, reason: "nohup (detached daemon) is not allowed" },
  /* A bare & (not part of &&) backgrounds a process or acts as a command
     separator. Both are blocked to prevent persistent background processes
     and command chaining. */
  { re: /(?<!&)&(?!&)/, reason: "backgrounding a persistent process (&) is not allowed" },

  /* --- Windows recursive delete switches --- */
  {
    re: /\b(?:del|erase)\b[^\n]*\s\/[sS]\b/i,
    reason: "recursive del (/s) is not allowed",
  },
  {
    re: /\b(?:rmdir|rd)\b[^\n]*\s\/[sS]\b/i,
    reason: "recursive rmdir (/s) is not allowed",
  },

  /* --- symlink creation --- */
  { re: /\bln\s+(?:-\S+\s+)*-\S*s/i, reason: "creating symlinks is not allowed" },
  { re: /\bln\b[^\n]*--symbolic\b/i, reason: "creating symlinks is not allowed" },
  { re: /\bmklink\b/i, reason: "creating symlinks (mklink) is not allowed" },

  /* --- shell invocation with -c flag --- */
  { re: /\b(?:bash|sh|zsh|dash|ksh|csh|fish)\s+-c\b/i, reason: "invoking a shell with -c is not allowed" },
  { re: /\bcmd\s+\/c\b/i, reason: "invoking cmd /c is not allowed" },

  /* --- interpreter -e/-c execution --- */
  { re: /\b(?:python[23]?|ruby|perl|php)\s+(?:-\S+\s+)*-[ec]\b/i, reason: "inline code execution via interpreter is not allowed" },
  { re: /\bnode\s+(?:-\S+\s+)*(?:-e|--eval)\b/i, reason: "node --eval is not allowed" },

  /* --- network exfiltration tools --- */
  { re: /\b(?:nc|ncat|netcat|socat)\b/i, reason: "network tools (nc/netcat/socat) are not allowed" },
  { re: /\b(?:nc|ncat|netcat)\.exe\b/i, reason: "network tools (nc.exe/netcat) are not allowed" },
  { re: /\b(?:curl|wget)\b[^\n]*(?:-o\b|--output\b|>\s)/i, reason: "downloading files to disk is not allowed" },

  /* --- persistence via scheduling --- */
  { re: /\b(?:crontab|at)\b/i, reason: "scheduling commands (crontab/at) is not allowed" },

  /* --- PowerShell .NET env access --- */
  { re: /\[System\.Environment\]::GetEnvironmentVariable/i, reason: "PowerShell .NET environment access is not allowed" },

  /* --- PowerShell variable inspection --- */
  { re: /\bGet-Variable\b/i, reason: "Get-Variable is not allowed" },

  /* --- PowerShell env: provider (alternate forms) --- */
  { re: /Get-ChildItem\s+env:/i, reason: "dumping the environment is not allowed" },

  /* --- bash here-string (<<<) --- */
  { re: /<<<\s*['"]/, reason: "bash here-strings are not allowed" },

  /* --- bash heredoc (<<EOF) --- */
  { re: /<<\s*['"]?EOF/i, reason: "bash heredocs are not allowed" },

  /* --- backtick command substitution reading sensitive env --- */
  { re: /`\$\{?(?:HOME|USER|PATH|SECRET|KEY|TOKEN|PASSWORD)/i, reason: "backtick command substitution reading sensitive env is not allowed" },
];

/** Commands that are allowed but worth warning the user about. */
const WARNLIST: { re: RegExp; warning: string }[] = [
  {
    re: /\bgit\s+push\b[^\n]*(?:--force\b|--force-with-lease\b|\s-f\b)/i,
    warning: "git push --force can overwrite remote history",
  },
];

/**
 * Detect a destructive recursive+force delete aimed at a root/home/wildcard
 * target. Handles POSIX `rm -rf /` and PowerShell `Remove-Item -Recurse
 * -Force C:\`. Deleting a *relative* subpath (e.g. node_modules) is allowed.
 */
function checkDestructiveDelete(cmd: string): string | null {
  // POSIX: rm with both recursive and force flags.
  const rmRecursiveForce =
    /\brm\s+(?:-\S+\s+)*-\S*(?:rf|fr)\S*\b/i.test(cmd) ||
    /\brm\s+(?:-\S+\s+)*(?:-r\S*\s+-f|-f\S*\s+-r)/i.test(cmd) ||
    (/\brm\b/i.test(cmd) &&
      /--recursive\b/i.test(cmd) &&
      /--force\b/i.test(cmd));

  // PowerShell: Remove-Item / ri / rm-alias with -Recurse and -Force.
  const psRecursiveForce =
    /\b(?:remove-item|ri)\b/i.test(cmd) &&
    /-recurse\b/i.test(cmd) &&
    /-force\b/i.test(cmd);

  if (!rmRecursiveForce && !psRecursiveForce) return null;

  // Dangerous targets: filesystem root, home (~), a drive root (C:\), or a
  // bare wildcard (*). These wipe far more than the project.
  const dangerousTarget =
    /(?:^|\s)(?:\/|~|\*|\.\.?)(?:\s|$)/.test(cmd) || // / ~ * . ..
    /(?:^|\s)\/\*/.test(cmd) || // /*
    /(?:^|\s)[a-zA-Z]:\\?(?:\*|\s|$)/.test(cmd); // C:\  C:\*

  if (dangerousTarget) {
    return "recursive force delete of a root/home/wildcard path is blocked";
  }
  return null;
}

/**
 * Validate a command line against the safety policy. Returns
 * `{ ok:false, reason }` to block, or `{ ok:true, warning? }` to allow.
 */
export function validateCommand(command: string): CommandValidation {
  const cmd = (command ?? "").trim();
  if (!cmd) return { ok: false, reason: "Empty command" };
  if (cmd.length > 4000) {
    return { ok: false, reason: "Command is too long" };
  }
  if (/\0/.test(cmd)) {
    return { ok: false, reason: "Command contains a null byte" };
  }

  const destructive = checkDestructiveDelete(cmd);
  if (destructive) return { ok: false, reason: destructive };

  for (const { re, reason } of BLOCKLIST) {
    if (re.test(cmd)) return { ok: false, reason };
  }

  for (const { re, warning } of WARNLIST) {
    if (re.test(cmd)) return { ok: true, warning };
  }

  return { ok: true };
}

/* -------------------------------------------------------------------------- */
/* CWD containment helpers                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Resolve a project-relative cwd to an absolute path inside the project root.
 * THROWS ApiError(400) via resolveSafe if it would escape the root.
 * Additionally verifies the real filesystem path (following symlinks) is still
 * inside the project root.
 */
export function resolveProjectCwd(storageKey: string, relCwd: string): string {
  const resolved = resolveSafe(storageKey, relCwd || "");
  // Verify the real filesystem path (following symlinks) is still inside the project root
  try {
    const real = realpathSync(resolved);
    const root = getProjectRoot(storageKey);
    const realRoot = realpathSync(root);
    const rootWithSep = realRoot.endsWith(path.sep) ? realRoot : realRoot + path.sep;
    if (real !== realRoot && !real.startsWith(rootWithSep)) {
      throw new ApiError("CWD escapes project root via symlink", 400, "INVALID_PATH");
    }
  } catch (err) {
    if (err instanceof ApiError) throw err;
    // If realpath fails (dir doesn't exist yet), the logical check from resolveSafe is sufficient
  }
  return resolved;
}

/**
 * Compute a new project-relative cwd from a `cd <target>` argument. Validates
 * containment via resolveSafe (THROWS ApiError on escape). Returns the new
 * project-relative POSIX path ("" == project root).
 */
export function changeDir(
  storageKey: string,
  currentRel: string,
  target: string
): string {
  const cleaned = (target ?? "").trim().replace(/^["']|["']$/g, "");

  let joined: string;
  if (!cleaned || cleaned === "~") {
    joined = "";
  } else if (path.isAbsolute(cleaned) || /^[a-zA-Z]:/.test(cleaned)) {
    // Absolute paths are re-rooted at the project root by normalizeRelPath.
    joined = cleaned;
  } else {
    joined = path.posix.join(currentRel || "", cleaned.replace(/\\/g, "/"));
  }

  const root = getProjectRoot(storageKey);
  const abs = resolveSafe(storageKey, joined); // throws on escape
  const rel = path.relative(root, abs).replace(/\\/g, "/");
  return rel === "" || rel === "." ? "" : rel;
}

/* -------------------------------------------------------------------------- */
/* Environment scrubbing                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Build a MINIMAL environment for the child process. Only an allowlist of
 * non-sensitive variables is forwarded from process.env. Secrets are never
 * included.
 */
function buildSafeEnv(): Record<string, string> {
  // Variables required for tools to function (PATH, shell, locale, temp dirs).
  const allow = [
    "PATH", "Path", "PATHEXT",
    "HOME", "USERPROFILE", "HOMEDRIVE", "HOMEPATH",
    "SYSTEMROOT", "SystemRoot", "WINDIR", "COMSPEC", "ComSpec",
    "TEMP", "TMP", "TMPDIR",
    "LANG", "LC_ALL", "LC_CTYPE", "TZ", "TERM",
    "PROCESSOR_ARCHITECTURE", "NUMBER_OF_PROCESSORS",
  ];

  const env: Record<string, string> = {};
  for (const key of allow) {
    const v = process.env[key];
    if (v !== undefined) env[key] = v;
  }

  // Sensible, non-secret defaults for tooling.
  env.NODE_ENV = "development";
  env.CI = "1";
  env.NO_COLOR = env.NO_COLOR ?? ""; // leave color to the tool; xterm renders ANSI

  return env;
}

/* -------------------------------------------------------------------------- */
/* Process execution                                                          */
/* -------------------------------------------------------------------------- */

/** Currently-running child processes, keyed by terminal session id. */
const running = new Map<string, ChildProcess>();

/** Container name for sandboxed runs, keyed by session id (for `docker kill`). */
const containerNames = new Map<string, string>();

export function isRunning(sessionId: string): boolean {
  return running.has(sessionId);
}

/**
 * Try to mark a session as running. Returns true if the slot was acquired
 * (caller may proceed to spawn the child process and SHOULD later call
 * `release` in its cleanup path), false if a command is already running
 * for that session. This is the atomic primitive used by the run route to
 * close the check-then-set race that existed when both the route and
 * `runCommand` separately tested `running.has(...)`.
 */
export function tryAcquire(sessionId: string): boolean {
  if (running.has(sessionId)) return false;
  // Use a sentinel placeholder so the slot is "held" between tryAcquire and
  // the actual spawn. The real child replaces this value.
  running.set(sessionId, null as unknown as ChildProcess);
  return true;
}

/**
 * Release the running slot for a session. Safe to call even if no command
 * is running. After release, `isRunning(sessionId)` returns false and
 * another command can be started.
 */
export function release(sessionId: string): void {
  running.delete(sessionId);
}

/** Forcefully terminate the process group for a session. */
function killTree(child: ChildProcess, sessionId?: string): void {
  // Sandboxed run: kill the container directly (killing the `docker run` client
  // alone does NOT stop the container).
  if (sessionId) {
    const name = containerNames.get(sessionId);
    if (name) {
      const cfg = getSandboxConfig();
      try {
        spawn(cfg.runtime, buildKillArgs(name), { stdio: "ignore" });
      } catch {
        /* fall through to killing the client process */
      }
    }
  }
  if (!child.pid) return;
  if (isWin) {
    try {
      spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
        windowsHide: true,
        stdio: "ignore",
      });
    } catch {
      try {
        child.kill("SIGKILL");
      } catch {
        /* ignore */
      }
    }
  } else {
    // Negative pid -> kill the whole process group (child spawned detached).
    try {
      process.kill(-child.pid, "SIGKILL");
    } catch {
      try {
        child.kill("SIGKILL");
      } catch {
        /* ignore */
      }
    }
  }
}

/** Kill the command currently running for `sessionId`. Returns true if killed. */
export function killSession(sessionId: string): boolean {
  const child = running.get(sessionId);
  if (!child) return false;
  killTree(child, sessionId);
  running.delete(sessionId);
  containerNames.delete(sessionId);
  return true;
}

export type RunResult = {
  /** Full captured output (already truncated to MAX_OUTPUT_BYTES). */
  output: string;
  /** Process exit code, or null if killed by signal. */
  exitCode: number | null;
  truncated: boolean;
  timedOut: boolean;
};

export type RunOptions = {
  sessionId: string;
  /** Validated command line (caller MUST have run validateCommand first). */
  command: string;
  /** Absolute cwd inside the project root (use resolveProjectCwd). */
  cwd: string;
  /** Streaming callback for stdout/stderr chunks (already utf-8 decoded). */
  onOutput?: (chunk: string) => void;
  /** Project storage key — required for the containerized (sandboxed) path. */
  storageKey?: string;
  /** Project-relative cwd ("" == root) — used to set the container workdir. */
  relCwd?: string;
  /** Audit context (user/project) recorded with every execution. */
  audit?: { userId?: string; projectId?: string };
};

/**
 * Spawn and run a command. Enforces the single-command-per-session rule, the
 * timeout, and the output cap. Streams output via `onOutput` and resolves with
 * the final captured result for persistence.
 *
 * The caller MUST have already called `tryAcquire(sessionId)` and received
 * `true`. If the slot wasn't acquired we throw `SESSION_BUSY` so a misuse is
 * loud rather than silent.
 */
export function runCommand(opts: RunOptions): Promise<RunResult> {
  const { sessionId } = opts;

  if (!running.has(sessionId)) {
    throw new ApiError(
      "Internal: runCommand called without an acquired session slot",
      500,
      "INTERNAL_ERROR"
    );
  }

  // Containerized execution is the PRIMARY path in production. The in-process
  // path is an explicit fallback (dev / when no container runtime is present).
  if (isSandboxEnabled() && opts.storageKey !== undefined) {
    return runInSandbox(opts);
  }

  // FAIL-SAFE: never fall back to unsandboxed execution in production unless an
  // operator has explicitly accepted the risk. This makes container isolation —
  // not the blocklist — the security boundary that GA depends on.
  if (
    process.env.NODE_ENV === "production" &&
    process.env.TERMINAL_ALLOW_UNSANDBOXED !== "1"
  ) {
    audit.error("terminal execution blocked: sandbox required in production", {
      sessionId,
      userId: opts.audit?.userId,
      projectId: opts.audit?.projectId,
    });
    throw new ApiError(
      "Terminal execution is unavailable: the server is not configured with a command sandbox. Set TERMINAL_SANDBOX=docker.",
      503,
      "SANDBOX_REQUIRED"
    );
  }

  return runInProcess(opts);
}

/**
 * In-process execution — NO container isolation. Used only when
 * TERMINAL_SANDBOX is disabled. Protected by the blocklist + cwd jail + env
 * scrub + timeout + output cap, but a determined command can still touch the
 * host. Do NOT enable this in multi-tenant production; set TERMINAL_SANDBOX.
 */
function runInProcess(opts: RunOptions): Promise<RunResult> {
  const { sessionId, command, cwd, onOutput } = opts;

  audit.info("terminal command (in-process fallback)", {
    sessionId,
    userId: opts.audit?.userId,
    projectId: opts.audit?.projectId,
    mode: "in-process",
    bytes: command.length,
  });

  const shell = isWin ? process.env.ComSpec || "cmd.exe" : "/bin/sh";
  const args = isWin ? ["/d", "/s", "/c", command] : ["-c", command];

  const child = spawn(shell, args, {
    cwd,
    env: buildSafeEnv() as unknown as NodeJS.ProcessEnv,
    detached: !isWin, // own process group on POSIX for group-kill
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });

  // Replace the placeholder from tryAcquire with the real child.
  running.set(sessionId, child);

  const timeoutSec = getMaxTimeoutSeconds();
  let captured = "";
  let totalBytes = 0;
  let truncated = false;
  let timedOut = false;

  const emit = (chunk: string) => {
    captured += chunk;
    try {
      onOutput?.(chunk);
    } catch {
      /* consumer errors must not crash the runner */
    }
  };

  const handle = (buf: Buffer) => {
    if (truncated) return;
    let s = buf.toString("utf8");
    const len = Buffer.byteLength(s, "utf8");
    if (totalBytes + len > MAX_OUTPUT_BYTES) {
      const remaining = Math.max(0, MAX_OUTPUT_BYTES - totalBytes);
      s = s.slice(0, remaining);
      truncated = true;
    }
    totalBytes += Buffer.byteLength(s, "utf8");
    if (s) emit(s);
    if (truncated) {
      emit(`\r\n[output truncated at ${MAX_OUTPUT_BYTES} bytes]\r\n`);
      killTree(child, sessionId);
    }
  };

  child.stdout?.on("data", handle);
  child.stderr?.on("data", handle);

  const timer = setTimeout(() => {
    timedOut = true;
    killTree(child, sessionId);
  }, timeoutSec * 1000);

  return new Promise<RunResult>((resolve) => {
    child.on("close", (code) => {
      clearTimeout(timer);
      running.delete(sessionId);
      if (timedOut) {
        emit(
          `\r\n[command timed out after ${timeoutSec}s and was terminated]\r\n`
        );
      }
      resolve({ output: captured, exitCode: code, truncated, timedOut });
    });

    child.on("error", (err) => {
      clearTimeout(timer);
      running.delete(sessionId);
      emit(`\r\n[failed to start command: ${err.message}]\r\n`);
      resolve({ output: captured, exitCode: 127, truncated, timedOut });
    });
  });
}

/**
 * Containerized execution — the PRIMARY production path. Runs the command in a
 * throwaway, network-less, resource-capped, non-root container whose only host
 * access is a bind mount of the project directory. The command is passed as a
 * single argv element to `sh -c`, so there is no host-side shell.
 */
function runInSandbox(opts: RunOptions): Promise<RunResult> {
  const { sessionId, command, onOutput } = opts;
  const cfg = getSandboxConfig();
  const timeoutSec = getMaxTimeoutSeconds();

  // Host directory to bind-mount (the project root on the container host).
  const hostRoot = realpathSafe(getProjectRoot(opts.storageKey ?? ""));
  const containerName = sandboxContainerName(sessionId, Date.now());
  containerNames.set(sessionId, containerName);

  const args = buildSandboxArgs(cfg, {
    containerName,
    hostRoot,
    relCwd: opts.relCwd ?? "",
    command,
    timeoutSec,
  });

  audit.info("terminal command (sandboxed)", {
    sessionId,
    userId: opts.audit?.userId,
    projectId: opts.audit?.projectId,
    mode: "sandbox",
    container: containerName,
    bytes: command.length,
    sandbox: describeSandbox(cfg),
  });

  const child = spawn(cfg.runtime, args, {
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  running.set(sessionId, child);

  let captured = "";
  let totalBytes = 0;
  let truncated = false;
  let timedOut = false;

  const emit = (chunk: string) => {
    captured += chunk;
    try {
      onOutput?.(chunk);
    } catch {
      /* consumer errors must not crash the runner */
    }
  };

  const handle = (buf: Buffer) => {
    if (truncated) return;
    let s = buf.toString("utf8");
    if (totalBytes + Buffer.byteLength(s, "utf8") > MAX_OUTPUT_BYTES) {
      s = s.slice(0, Math.max(0, MAX_OUTPUT_BYTES - totalBytes));
      truncated = true;
    }
    totalBytes += Buffer.byteLength(s, "utf8");
    if (s) emit(s);
    if (truncated) {
      emit(`\r\n[output truncated at ${MAX_OUTPUT_BYTES} bytes]\r\n`);
      killTree(child, sessionId);
    }
  };

  child.stdout?.on("data", handle);
  child.stderr?.on("data", handle);

  const timer = setTimeout(() => {
    timedOut = true;
    killTree(child, sessionId); // docker kill <container>
  }, timeoutSec * 1000);

  const cleanup = () => {
    clearTimeout(timer);
    running.delete(sessionId);
    containerNames.delete(sessionId);
  };

  return new Promise<RunResult>((resolve) => {
    child.on("close", (code) => {
      cleanup();
      if (timedOut) {
        emit(`\r\n[command timed out after ${timeoutSec}s and was terminated]\r\n`);
      }
      audit.info("terminal command finished", {
        sessionId,
        mode: "sandbox",
        exitCode: code,
        timedOut,
        truncated,
        bytes: totalBytes,
      });
      resolve({ output: captured, exitCode: code, truncated, timedOut });
    });

    child.on("error", (err) => {
      cleanup();
      emit(
        `\r\n[failed to start sandbox (${cfg.runtime}): ${err.message}]\r\n`
      );
      audit.error("terminal sandbox spawn failed", {
        sessionId,
        runtime: cfg.runtime,
        error: err.message,
      });
      resolve({ output: captured, exitCode: 127, truncated, timedOut });
    });
  });
}

/** realpath with a graceful fallback when the path doesn't exist yet. */
function realpathSafe(p: string): string {
  try {
    return realpathSync(p);
  } catch {
    return p;
  }
}
