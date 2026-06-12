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
  { re: /\b(?:curl|wget)\b[^\n]*(?:-o\b|--output\b|>\s)/i, reason: "downloading files to disk is not allowed" },

  /* --- persistence via scheduling --- */
  { re: /\b(?:crontab|at)\b/i, reason: "scheduling commands (crontab/at) is not allowed" },
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

export function isRunning(sessionId: string): boolean {
  return running.has(sessionId);
}

/** Forcefully terminate the process group for a session. */
function killTree(child: ChildProcess): void {
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
  killTree(child);
  running.delete(sessionId);
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
};

/**
 * Spawn and run a command. Enforces the single-command-per-session rule, the
 * timeout, and the output cap. Streams output via `onOutput` and resolves with
 * the final captured result for persistence.
 */
export function runCommand(opts: RunOptions): Promise<RunResult> {
  const { sessionId, command, cwd, onOutput } = opts;

  if (running.has(sessionId)) {
    throw new ApiError(
      "A command is already running in this session",
      409,
      "SESSION_BUSY"
    );
  }

  const shell = isWin ? process.env.ComSpec || "cmd.exe" : "/bin/sh";
  const args = isWin ? ["/d", "/s", "/c", command] : ["-c", command];

  const child = spawn(shell, args, {
    cwd,
    env: buildSafeEnv() as unknown as NodeJS.ProcessEnv,
    detached: !isWin, // own process group on POSIX for group-kill
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });

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
      killTree(child);
    }
  };

  child.stdout?.on("data", handle);
  child.stderr?.on("data", handle);

  const timer = setTimeout(() => {
    timedOut = true;
    killTree(child);
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
