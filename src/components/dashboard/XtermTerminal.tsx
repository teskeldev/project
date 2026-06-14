"use client";

import { useEffect, useRef } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import {
  runCommandStream,
  listCommands,
  killCommand,
} from "@/lib/client/terminal";

export type TerminalHandle = {
  clear: () => void;
  stop: () => void;
  focus: () => void;
};

type Props = {
  sessionId: string;
  initialCwd: string;
  active: boolean;
  /** Register/unregister this terminal's imperative handle with the parent. */
  onRegister: (id: string, handle: TerminalHandle | null) => void;
  /** Called when a command is blocked by the safety policy. */
  onBlocked?: (message: string) => void;
};

const PROMPT_RESET = "\x1b[0m";
const BLUE = "\x1b[34m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const DIM = "\x1b[90m";

/** Convert lone \n to \r\n so output renders correctly without a PTY. */
function normalizeOutput(s: string): string {
  return s.replace(/\r?\n/g, "\r\n");
}

export default function XtermTerminal({
  sessionId,
  initialCwd,
  active,
  onRegister,
  onBlocked,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);

  // Mutable terminal state held in refs (not React state) for the line editor.
  const cwdRef = useRef<string>(initialCwd);
  const inputRef = useRef<string>("");
  const runningRef = useRef<boolean>(false);
  const streamRef = useRef<{ abort: () => void } | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const term = new Terminal({
      cursorBlink: true,
      fontFamily:
        'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
      fontSize: 13,
      theme: {
        background: "#030712", // gray-950
        foreground: "#d1d5db", // gray-300
        cursor: "#d1d5db",
        selectionBackground: "#374151",
      },
      convertEol: false,
      scrollback: 5000,
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    const tryFit = () => {
      if (!containerRef.current || containerRef.current.clientWidth === 0) return;
      try {
        fit.fit();
      } catch {
        /* container may not be measured yet */
      }
    };

    term.open(containerRef.current);
    tryFit();

    termRef.current = term;
    fitRef.current = fit;

    const label = () => (cwdRef.current ? `~/${cwdRef.current}` : "~");
    const writePrompt = () =>
      term.write(`${BLUE}${label()}${PROMPT_RESET} $ `);


    const submit = () => {
      const cmd = inputRef.current;
      inputRef.current = "";
      term.write("\r\n");
      if (!cmd.trim()) {
        writePrompt();
        return;
      }
      runningRef.current = true;
      const guard = { current: false };
      const localFinish = () => {
        if (guard.current) return;
        guard.current = true;
        runningRef.current = false;
        streamRef.current = null;
        term.write("\r\n");
        writePrompt();
      };

      const stream = runCommandStream(sessionId, cmd, {
        onOutput: (chunk) => term.write(normalizeOutput(chunk)),
        onCwd: (c) => {
          cwdRef.current = c;
        },
        onWarning: (m) => term.write(`${YELLOW}${m}${PROMPT_RESET}\r\n`),
        onExit: (code) => {
          if (code !== null && code !== 0) {
            term.write(`${DIM}[exit ${code}]${PROMPT_RESET}`);
          }
          localFinish();
        },
        onError: (m) => {
          if (m.includes("blocked by safety policy") || m.startsWith("[blocked")) {
            onBlocked?.(m);
          }
          term.write(`${RED}${m}${PROMPT_RESET}`);
          localFinish();
        },
      });
      streamRef.current = stream;
    };

    const stop = () => {
      if (!runningRef.current) return;
      streamRef.current?.abort();
      void killCommand(sessionId).catch(() => undefined);
      runningRef.current = false;
      streamRef.current = null;
      term.write(`\r\n${DIM}^C${PROMPT_RESET}\r\n`);
      writePrompt();
    };

    const onData = (data: string) => {
      // While a command runs, only Ctrl+C is honored.
      if (runningRef.current) {
        if (data === "\x03") stop();
        return;
      }

      switch (data) {
        case "\r": // Enter
          submit();
          return;
        case "\x7f": // Backspace (DEL)
        case "\b":
          if (inputRef.current.length > 0) {
            inputRef.current = inputRef.current.slice(0, -1);
            term.write("\b \b");
          }
          return;
        case "\x03": // Ctrl+C -> cancel current line
          inputRef.current = "";
          term.write(`${DIM}^C${PROMPT_RESET}\r\n`);
          writePrompt();
          return;
        case "\x0c": // Ctrl+L -> clear screen
          term.clear();
          return;
        default: {
          // Accept printable input (including pasted text); drop other control
          // sequences (arrow keys, etc.) for this simple line editor.
          let printable = "";
          for (const ch of data) {
            const code = ch.codePointAt(0) ?? 0;
            if (code >= 0x20 && code !== 0x7f) printable += ch;
          }
          if (printable) {
            inputRef.current += printable;
            term.write(printable);
          }
        }
      }
    };

    const dataDisposable = term.onData(onData);

    // Restore prior history, then draw the first prompt.
    void (async () => {
      try {
        const { commands } = await listCommands(sessionId);
        for (const c of commands) {
          term.write(`${BLUE}${label()}${PROMPT_RESET} $ ${c.command}\r\n`);
          if (c.output) term.write(normalizeOutput(c.output));
          if (c.output && !c.output.endsWith("\n")) term.write("\r\n");
        }
      } catch (err) {
        console.warn("[XtermTerminal] Failed to load command history:", err);
      }
      term.write(
        `${DIM}Teskel terminal — commands run safely inside the project sandbox.${PROMPT_RESET}\r\n`
      );
      writePrompt();
    })();

    const handle: TerminalHandle = {
      clear: () => {
        term.clear();
      },
      stop,
      focus: () => term.focus(),
    };
    onRegister(sessionId, handle);

    const ro = new ResizeObserver(() => {
      // Use requestAnimationFrame to let browser finish layout before fitting
      requestAnimationFrame(() => {
        tryFit();
      });
    });
    ro.observe(containerRef.current);

    return () => {
      onRegister(sessionId, null);
      dataDisposable.dispose();
      ro.disconnect();
      streamRef.current?.abort();
      term.dispose();
      termRef.current = null;
      fitRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  // Refit + focus when this tab becomes active.
  useEffect(() => {
    if (!active) return;
    const id = window.setTimeout(() => {
      if (containerRef.current && containerRef.current.clientWidth > 0) {
        try {
          fitRef.current?.fit();
        } catch {
          /* ignore */
        }
      }
      termRef.current?.focus();
    }, 50);
    return () => window.clearTimeout(id);
  }, [active]);

  return (
    <div
      ref={containerRef}
      className="h-full w-full"
      role="application"
      aria-label="Terminal"
    />
  );
}
