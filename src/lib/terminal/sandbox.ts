/**
 * Containerized command execution policy for the terminal (Phase 7).
 *
 * SECURITY MODEL — isolation is the PRIMARY control; the blocklist in
 * runner.ts is now defense-in-depth only.
 *
 * Every command runs in a throwaway container (`docker`/`podman run --rm`) with:
 *   - NETWORK    : `--network none`           (no egress / SSRF / exfiltration)
 *   - FILESYSTEM : `--read-only` root + a single rw bind mount of the project at
 *                  /workspace; a size-capped tmpfs for /tmp. The host sees only
 *                  the project directory.
 *   - IDENTITY   : `--user` non-root + `--security-opt no-new-privileges` +
 *                  `--cap-drop ALL`            (no privilege escalation)
 *   - MEMORY     : `--memory` + `--memory-swap` equal (swap disabled)
 *   - CPU        : `--cpus`
 *   - PROCESSES  : `--pids-limit`              (fork-bomb containment)
 *   - FDs        : `--ulimit nofile`
 *   - TIME       : outer watchdog `docker kill` after the timeout (runner.ts)
 *
 * This module is PURE/SIDE-EFFECT-FREE on import: it only reads config and
 * builds argv. The spawn/stream/kill orchestration lives in runner.ts so the
 * argv construction here is unit-testable without a container runtime.
 */

export type SandboxConfig = {
  /** Container runtime binary: "docker" or "podman". */
  runtime: string;
  /** Whether sandboxed execution is enabled. */
  enabled: boolean;
  image: string;
  /** Memory cap, e.g. "512m". Applied to both --memory and --memory-swap. */
  memory: string;
  /** CPU cap, e.g. "1" or "1.5". */
  cpus: string;
  /** Max processes (fork-bomb containment). */
  pids: number;
  /** Container user, e.g. "1000:1000" (never root). */
  user: string;
  /** tmpfs size for /tmp, e.g. "64m". */
  tmpfs: string;
  /** Open-file-descriptor ulimit. */
  nofile: number;
  /** Mount point for the project inside the container. */
  workdirBase: string;
};

const WORKDIR_BASE = "/workspace";

/** Read sandbox configuration from the environment (with safe defaults). */
export function getSandboxConfig(): SandboxConfig {
  const mode = (process.env.TERMINAL_SANDBOX ?? "").trim().toLowerCase();
  // "docker" / "podman" pick the runtime; "1"/"true" defaults to docker;
  // "0"/"" disables (falls back to the in-process runner).
  let runtime = "docker";
  let enabled = false;
  if (mode === "docker" || mode === "podman") {
    runtime = mode;
    enabled = true;
  } else if (mode === "1" || mode === "true") {
    enabled = true;
  }

  const pids = Number(process.env.TERMINAL_SANDBOX_PIDS ?? "128");
  const nofile = Number(process.env.TERMINAL_SANDBOX_NOFILE ?? "1024");

  return {
    runtime,
    enabled,
    image: process.env.TERMINAL_SANDBOX_IMAGE ?? "node:20-alpine",
    memory: process.env.TERMINAL_SANDBOX_MEMORY ?? "512m",
    cpus: process.env.TERMINAL_SANDBOX_CPUS ?? "1",
    pids: Number.isFinite(pids) && pids > 0 ? Math.floor(pids) : 128,
    user: process.env.TERMINAL_SANDBOX_USER ?? "1000:1000",
    tmpfs: process.env.TERMINAL_SANDBOX_TMPFS ?? "64m",
    nofile: Number.isFinite(nofile) && nofile > 0 ? Math.floor(nofile) : 1024,
    workdirBase: WORKDIR_BASE,
  };
}

export function isSandboxEnabled(): boolean {
  return getSandboxConfig().enabled;
}

/** Sanitize a string into a safe container name component. */
export function sandboxContainerName(sessionId: string, nonce: number): string {
  const safe = sessionId.replace(/[^a-zA-Z0-9_.-]/g, "").slice(0, 40) || "sess";
  return `teskel-term-${safe}-${nonce}`;
}

export type BuildArgsInput = {
  containerName: string;
  /** Absolute host path to the project root (the rw bind mount source). */
  hostRoot: string;
  /** Project-relative POSIX cwd ("" == project root). */
  relCwd: string;
  /** The (already policy-validated) command line to run inside the container. */
  command: string;
  /** Per-command timeout in seconds (passed as --stop-timeout for clean kills). */
  timeoutSec: number;
};

/**
 * Build the full argv (after the runtime binary) for an isolated run.
 *
 * The command is passed as a SINGLE argv element to `sh -c`, so there is no
 * host-side shell — nothing in `command` can inject into the host. Inside the
 * container the blast radius is bounded by all the isolation flags above.
 */
export function buildSandboxArgs(
  cfg: SandboxConfig,
  input: BuildArgsInput
): string[] {
  if (!input.hostRoot || !input.hostRoot.startsWith("/")) {
    // Containerization requires an absolute host path to bind-mount.
    throw new Error("sandbox requires an absolute host root path");
  }
  const rel = (input.relCwd || "").replace(/^\/+/, "").replace(/\\/g, "/");
  const workdir = rel ? `${cfg.workdirBase}/${rel}` : cfg.workdirBase;

  return [
    "run",
    "--rm",
    "-i",
    "--name",
    input.containerName,
    // --- network isolation ---
    "--network",
    "none",
    // --- identity / privilege ---
    "--user",
    cfg.user,
    "--cap-drop",
    "ALL",
    "--security-opt",
    "no-new-privileges",
    // --- filesystem isolation ---
    "--read-only",
    "--tmpfs",
    `/tmp:rw,nosuid,nodev,size=${cfg.tmpfs}`,
    "-v",
    `${input.hostRoot}:${cfg.workdirBase}`,
    "-w",
    workdir,
    "-e",
    "HOME=/tmp",
    "-e",
    "NODE_ENV=development",
    "-e",
    "CI=1",
    // --- resource quotas ---
    "--memory",
    cfg.memory,
    "--memory-swap",
    cfg.memory, // equal => swap disabled
    "--cpus",
    cfg.cpus,
    "--pids-limit",
    String(cfg.pids),
    "--ulimit",
    `nofile=${cfg.nofile}:${cfg.nofile}`,
    // graceful stop window before SIGKILL on `docker stop`
    "--stop-timeout",
    String(Math.max(1, Math.min(input.timeoutSec, 60))),
    // --- image + command (single arg; no host shell) ---
    cfg.image,
    "/bin/sh",
    "-c",
    input.command,
  ];
}

/** Build the argv to forcibly kill a running sandbox container. */
export function buildKillArgs(containerName: string): string[] {
  return ["kill", containerName];
}

/** Structured, secret-free description for audit logs. */
export function describeSandbox(cfg: SandboxConfig) {
  return {
    runtime: cfg.runtime,
    image: cfg.image,
    memory: cfg.memory,
    cpus: cfg.cpus,
    pids: cfg.pids,
    network: "none",
    user: cfg.user,
    readOnlyRoot: true,
  };
}
