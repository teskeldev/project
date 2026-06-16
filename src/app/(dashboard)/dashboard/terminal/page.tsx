"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Plus, X, Trash2, Square, ShieldAlert, Sparkles, Play, Copy, Loader2 } from "lucide-react";
import { useProject } from "@/lib/store/project";
import {
  listSessions,
  createSession,
  closeSession,
  runCommandStream,
  type TerminalSession,
} from "@/lib/client/terminal";
import { apiFetch } from "@/lib/client/api";
import type { TerminalHandle } from "@/components/dashboard/XtermTerminal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// xterm.js touches the DOM/window, so load it client-side only.
const XtermTerminal = dynamic(
  () => import("@/components/dashboard/XtermTerminal"),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center text-[13px] text-text-secondary">
        Loading terminal...
      </div>
    ),
  }
);

export default function TerminalPage() {
  const { activeProject, loading: projectLoading } = useProject();
  const projectId = activeProject?.id ?? null;

  const [sessions, setSessions] = useState<TerminalSession[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // AI suggestion state
  const [aiInput, setAiInput] = useState("");
  const [aiSuggestion, setAiSuggestion] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const handlesRef = useRef<Map<string, TerminalHandle>>(new Map());

  const registerHandle = useCallback(
    (id: string, handle: TerminalHandle | null) => {
      if (handle) handlesRef.current.set(id, handle);
      else handlesRef.current.delete(id);
    },
    []
  );

  // Load sessions when the active project changes; create one if none exist.
  // Guard with a ref so React 18 StrictMode's double-invocation does not
  // create two terminal sessions on first mount.
  const initProjectRef = useRef<string | null>(null);
  useEffect(() => {
    if (!projectId) {
      setSessions([]);
      setActiveId(null);
      initProjectRef.current = null;
      return;
    }
    if (initProjectRef.current === projectId) return;
    initProjectRef.current = projectId;

    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const { sessions: existing } = await listSessions(projectId);
        if (cancelled) return;
        if (existing.length > 0) {
          setSessions(existing);
          setActiveId(existing[0].id);
        } else {
          const { session } = await createSession(projectId);
          if (cancelled) return;
          setSessions([session]);
          setActiveId(session.id);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load terminals");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      // Reset the guard when the project actually changes (not on StrictMode
      // unmount), so a different project triggers a fresh load+create flow.
    };
  }, [projectId]);

  const addTab = useCallback(async () => {
    if (!projectId) return;
    try {
      const { session } = await createSession(projectId);
      setSessions((prev) => [...prev, session]);
      setActiveId(session.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create terminal");
    }
  }, [projectId]);

  const removeTab = useCallback(
    async (id: string) => {
      setSessions((prev) => {
        const next = prev.filter((s) => s.id !== id);
        setActiveId((cur) => (cur === id ? next[next.length - 1]?.id ?? null : cur));
        return next;
      });
      handlesRef.current.delete(id);
      try {
        await closeSession(id);
      } catch {
        /* session may already be closed */
      }
    },
    []
  );

  const clearActive = useCallback(() => {
    if (activeId) handlesRef.current.get(activeId)?.clear();
  }, [activeId]);

  const stopActive = useCallback(() => {
    if (activeId) handlesRef.current.get(activeId)?.stop();
  }, [activeId]);

  const handleBlocked = useCallback((message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(null), 6000);
  }, []);

  // --- AI Suggestion handlers ---

  const handleAiSuggest = useCallback(async () => {
    if (!aiInput.trim() || !projectId) return;
    setAiLoading(true);
    setAiError(null);
    setAiSuggestion(null);
    try {
      const { command } = await apiFetch<{ command: string }>(
        "/api/ai/terminal-suggest",
        {
          method: "POST",
          body: JSON.stringify({
            description: aiInput.trim(),
            projectId,
          }),
        }
      );
      setAiSuggestion(command);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "Failed to generate command");
    } finally {
      setAiLoading(false);
    }
  }, [aiInput, projectId]);

  const handleAiRun = useCallback(() => {
    if (!aiSuggestion || !activeId) return;
    // Run the suggested command in the active terminal
    runCommandStream(activeId, aiSuggestion, {
      onOutput: () => {},
      onError: (msg) => setError(msg),
    });
    setAiSuggestion(null);
    setAiInput("");
  }, [aiSuggestion, activeId]);

  const handleAiCopy = useCallback(() => {
    if (!aiSuggestion) return;
    void navigator.clipboard.writeText(aiSuggestion);
  }, [aiSuggestion]);

  // ----- Empty / loading states -----
  if (!projectLoading && !projectId) {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-editor-bg text-center">
        <p className="text-sm text-text-muted">No active project</p>
        <p className="mt-1 text-[13px] text-text-muted">
          Select or create a project to open a terminal.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-editor-bg">
      {/* Tab bar */}
      <div className="flex items-center justify-between border-b border-editor-border bg-surface">
        <div className="flex items-center overflow-x-auto">
          {sessions.map((s) => (
            <div
              key={s.id}
              onClick={() => setActiveId(s.id)}
              className={`group flex cursor-pointer items-center gap-2 border-r border-editor-border px-4 py-2 text-[13px] ${
                activeId === s.id
                  ? "bg-editor-bg text-foreground"
                  : "text-text-muted hover:bg-surface-soft hover:text-text-secondary"
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  activeId === s.id ? "bg-success" : "bg-text-muted"
                }`}
              />
              <span>{s.title}</span>
              <span className="text-[10px] text-text-muted">
                {s.cwd ? `~/${s.cwd}` : "~"}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  void removeTab(s.id);
                }}
                className="rounded p-0.5 opacity-0 hover:bg-surface-soft group-hover:opacity-100"
                aria-label="Close terminal"
              >
                <X size={10} className="text-text-muted" />
              </button>
            </div>
          ))}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => void addTab()}
            disabled={!projectId}
            className="h-8 w-8 text-text-muted hover:text-text-secondary"
            aria-label="New terminal"
          >
            <Plus size={14} />
          </Button>
        </div>
        <div className="flex items-center gap-1 px-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={stopActive}
            className="h-7 w-7 text-text-muted hover:text-destructive"
            title="Stop running command"
            aria-label="Stop"
          >
            <Square size={14} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={clearActive}
            className="h-7 w-7 text-text-muted hover:text-text-secondary"
            title="Clear terminal"
            aria-label="Clear"
          >
            <Trash2 size={14} />
          </Button>
        </div>
      </div>

      {/* Safety notice */}
      {notice && (
        <div className="flex items-center gap-2 border-b border-yellow-900/50 bg-yellow-950/40 px-4 py-1.5 text-[12px] text-yellow-300">
          <ShieldAlert size={13} />
          <span>{notice}</span>
        </div>
      )}

      {/* Terminal body */}
      <div className="relative flex-1 overflow-hidden p-2">
        {error && (
          <div className="absolute inset-x-0 top-0 z-10 bg-red-950/60 px-4 py-1.5 text-[12px] text-red-300">
            {error}
          </div>
        )}
        {loading && sessions.length === 0 ? (
          <div className="flex h-full items-center justify-center text-[13px] text-text-muted">
            Loading terminals...
          </div>
        ) : (
          sessions.map((s) => (
            <div
              key={s.id}
              className="h-full w-full"
              style={{ display: activeId === s.id ? "block" : "none" }}
            >
              <XtermTerminal
                sessionId={s.id}
                initialCwd={s.cwd}
                active={activeId === s.id}
                onRegister={registerHandle}
                onBlocked={handleBlocked}
              />
            </div>
          ))
        )}
      </div>

      {/* AI Suggestion bar */}
      <div className="border-t border-editor-border bg-surface px-4 py-2">
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="shrink-0 text-accent" />
          <label htmlFor="ai-suggestion-input" className="sr-only">
            AI suggestion
          </label>
          <Input
            id="ai-suggestion-input"
            type="text"
            value={aiInput}
            onChange={(e) => setAiInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void handleAiSuggest();
              }
            }}
            placeholder="Describe what you want to do..."
            className="flex-1 border-none bg-transparent shadow-none text-[13px] h-auto px-0 py-0 focus-visible:ring-0 focus-visible:ring-offset-0 text-foreground placeholder:text-text-muted"
            disabled={aiLoading}
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void handleAiSuggest()}
            disabled={aiLoading || !aiInput.trim()}
            className="text-[11px] text-accent hover:text-accent-hover"
          >
            {aiLoading ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              "Generate"
            )}
          </Button>
        </div>

        {/* AI suggestion result */}
        {aiSuggestion && (
          <div className="mt-2 flex items-center gap-2 rounded border border-editor-border bg-surface-soft px-3 py-2">
            <code className="flex-1 text-[13px] text-success">{aiSuggestion}</code>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleAiRun}
              disabled={!activeId}
              className="gap-1 text-[11px] text-success hover:text-success"
              title="Run command"
            >
              <Play size={11} /> Run
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleAiCopy}
              className="gap-1 text-[11px] text-text-muted hover:text-text-secondary"
              title="Copy command"
            >
              <Copy size={11} /> Copy
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setAiSuggestion(null)}
              className="h-6 w-6 text-text-muted hover:text-text-secondary"
              title="Dismiss"
            >
              <X size={11} />
            </Button>
          </div>
        )}

        {/* AI error */}
        {aiError && (
          <div className="mt-1 text-[11px] text-destructive">{aiError}</div>
        )}
      </div>

      {/* Status bar */}
      <div className="flex h-6 items-center justify-between border-t border-editor-border bg-surface px-4 text-[11px] text-text-muted">
        <div className="flex items-center gap-3">
          <span>{sessions.length} terminals</span>
          <span>sandboxed</span>
        </div>
        <div className="flex items-center gap-3">
          <span>UTF-8</span>
          <span>safe-mode</span>
        </div>
      </div>
    </div>
  );
}
