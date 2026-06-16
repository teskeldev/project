import { describe, it, expect } from "vitest";
import {
  getSandboxConfig,
  isSandboxEnabled,
  buildSandboxArgs,
  buildKillArgs,
  sandboxContainerName,
  type SandboxConfig,
} from "@/lib/terminal/sandbox";

const cfg: SandboxConfig = {
  runtime: "docker",
  enabled: true,
  image: "node:20-alpine",
  memory: "512m",
  cpus: "1",
  pids: 128,
  user: "1000:1000",
  tmpfs: "64m",
  nofile: 1024,
  workdirBase: "/workspace",
};

function build(command: string, relCwd = "") {
  return buildSandboxArgs(cfg, {
    containerName: "teskel-term-abc-1",
    hostRoot: "/srv/projects/p1",
    relCwd,
    command,
    timeoutSec: 30,
  });
}

describe("sandbox config", () => {
  const prev = process.env.TERMINAL_SANDBOX;
  const restore = () => {
    if (prev === undefined) delete process.env.TERMINAL_SANDBOX;
    else process.env.TERMINAL_SANDBOX = prev;
  };

  it("is disabled by default (in-process fallback)", () => {
    delete process.env.TERMINAL_SANDBOX;
    expect(isSandboxEnabled()).toBe(false);
    restore();
  });

  it("enables docker/podman by name", () => {
    process.env.TERMINAL_SANDBOX = "podman";
    const c = getSandboxConfig();
    expect(c.enabled).toBe(true);
    expect(c.runtime).toBe("podman");
    restore();
  });

  it("clamps invalid numeric envs to safe defaults", () => {
    process.env.TERMINAL_SANDBOX = "1";
    process.env.TERMINAL_SANDBOX_PIDS = "-5";
    const c = getSandboxConfig();
    expect(c.pids).toBe(128);
    delete process.env.TERMINAL_SANDBOX_PIDS;
    restore();
  });
});

describe("buildSandboxArgs — isolation flags", () => {
  const args = build("ls -la");
  const joined = args.join(" ");

  it("disables networking", () => {
    expect(args).toContain("--network");
    expect(args[args.indexOf("--network") + 1]).toBe("none");
  });

  it("drops all capabilities and forbids privilege escalation", () => {
    expect(joined).toContain("--cap-drop ALL");
    expect(joined).toContain("--security-opt no-new-privileges");
  });

  it("runs as a non-root user", () => {
    const u = args[args.indexOf("--user") + 1];
    expect(u).toBe("1000:1000");
    expect(u.startsWith("0")).toBe(false);
  });

  it("makes the root filesystem read-only with a capped tmpfs", () => {
    expect(args).toContain("--read-only");
    expect(joined).toContain("/tmp:rw,nosuid,nodev,size=64m");
  });

  it("bind-mounts only the project root", () => {
    expect(joined).toContain("-v /srv/projects/p1:/workspace");
    // exactly one bind mount
    expect(args.filter((a) => a === "-v")).toHaveLength(1);
  });

  it("applies memory, swap-off, cpu, pids and fd limits", () => {
    expect(joined).toContain("--memory 512m");
    expect(joined).toContain("--memory-swap 512m"); // == memory => swap disabled
    expect(joined).toContain("--cpus 1");
    expect(joined).toContain("--pids-limit 128");
    expect(joined).toContain("--ulimit nofile=1024:1024");
  });

  it("is ephemeral", () => {
    expect(args).toContain("--rm");
  });
});

describe("buildSandboxArgs — injection safety & workdir", () => {
  it("passes the command as a SINGLE argv element to sh -c (no host shell)", () => {
    const evil = 'foo"; rm -rf / #';
    const args = build(evil);
    // The whole command is one element, immediately after `sh -c`.
    const i = args.indexOf("-c");
    expect(args[i - 1]).toBe("/bin/sh");
    expect(args[i + 1]).toBe(evil);
    // It must not be split across multiple argv entries.
    expect(args.filter((a) => a === evil)).toHaveLength(1);
  });

  it("translates a relative cwd into a container workdir under /workspace", () => {
    const args = build("pwd", "src/app");
    expect(args[args.indexOf("-w") + 1]).toBe("/workspace/src/app");
  });

  it("defaults workdir to the mount root", () => {
    expect(build("pwd")[build("pwd").indexOf("-w") + 1]).toBe("/workspace");
  });

  it("never lets relCwd escape the mount base", () => {
    const args = build("pwd", "../../etc");
    const w = args[args.indexOf("-w") + 1];
    // path is still rooted under /workspace (traversal is also blocked upstream
    // by validateCommand, this is defense-in-depth on the workdir string).
    expect(w.startsWith("/workspace")).toBe(true);
  });

  it("rejects a non-absolute host root", () => {
    expect(() =>
      buildSandboxArgs(cfg, {
        containerName: "x",
        hostRoot: "relative/path",
        relCwd: "",
        command: "ls",
        timeoutSec: 30,
      })
    ).toThrow();
  });
});

describe("container naming & kill", () => {
  it("sanitizes session ids into safe container names", () => {
    const name = sandboxContainerName("../evil id;rm", 123);
    expect(name).toMatch(/^teskel-term-[a-zA-Z0-9_.-]+-123$/);
    expect(name).not.toContain("/");
    expect(name).not.toContain(";");
  });

  it("builds a kill argv", () => {
    expect(buildKillArgs("teskel-term-abc-1")).toEqual([
      "kill",
      "teskel-term-abc-1",
    ]);
  });
});
