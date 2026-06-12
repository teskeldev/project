"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Plus, X, Trash2, Square, ShieldAlert } from "lucide-react";
import { useProject } from "@/lib/store/project";
import {
  listSessions,
  createSession,
  closeSession,
  type TerminalSession,
} from "@/lib/client/terminal";
import type { TerminalHandle } from "@/components/dashboard/XtermTerminal";

// xterm.js touches the DOM/window, so load it client-side only.
const XtermTerminal = dynamic(
  () => import("@/components/dashboard/XtermTerminal"),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center text-[13px] text-gray-600">
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

  const handlesRef = useRef<Map<string, TerminalHandle>>(new Map());

  const registerHandle = useCallback(
    (id: string, handle: TerminalHandle | null) => {
      if (handle) handlesRef.current.set(id, handle);
      else handlesRef.current.delete(id);
    },
    []
  );

  // Load sessions when the active project changes; create one if none exist.
  useEffect(() => {
    if (!projectId) {
      setSessions([]);
      setActiveId(null);
      return;
    }
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

  // ----- Empty / loading states -----
  if (!projectLoading && !projectId) {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-gray-950 text-center">
        <p className="text-sm text-gray-400">No active project</p>
        <p className="mt-1 text-[13px] text-gray-600">
          Select or create a project to open a terminal.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-gray-950">
      {/* Tab bar */}
      <div className="flex items-center justify-between border-b border-gray-800 bg-gray-900">
        <div className="flex items-center overflow-x-auto">
          {sessions.map((s) => (
            <div
              key={s.id}
              onClick={() => setActiveId(s.id)}
              className={`group flex cursor-pointer items-center gap-2 border-r border-gray-800 px-4 py-2 text-[13px] ${
                activeId === s.id
                  ? "bg-gray-950 text-gray-200"
                  : "text-gray-500 hover:bg-gray-800 hover:text-gray-400"
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  activeId === s.id ? "bg-green-500" : "bg-gray-600"
                }`}
              />
              <span>{s.title}</span>
              <span className="text-[10px] text-gray-600">
                {s.cwd ? `~/${s.cwd}` : "~"}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  void removeTab(s.id);
                }}
                className="rounded p-0.5 opacity-0 hover:bg-gray-700 group-hover:opacity-100"
                aria-label="Close terminal"
              >
                <X size={10} className="text-gray-500" />
              </button>
            </div>
          ))}
          <button
            onClick={() => void addTab()}
            disabled={!projectId}
            className="px-3 py-2 text-gray-600 hover:bg-gray-800 hover:text-gray-400 disabled:opacity-40"
            aria-label="New terminal"
          >
            <Plus size={14} />
          </button>
        </div>
        <div className="flex items-center gap-1 px-3">
          <button
            onClick={stopActive}
            className="rounded p-1.5 text-gray-600 hover:bg-gray-800 hover:text-red-400"
            title="Stop running command"
            aria-label="Stop"
          >
            <Square size={14} />
          </button>
          <button
            onClick={clearActive}
            className="rounded p-1.5 text-gray-600 hover:bg-gray-800 hover:text-gray-400"
            title="Clear terminal"
            aria-label="Clear"
          >
            <Trash2 size={14} />
          </button>
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
          <div className="flex h-full items-center justify-center text-[13px] text-gray-600">
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

      {/* Status bar */}
      <div className="flex h-6 items-center justify-between border-t border-gray-800 bg-gray-900 px-4 text-[11px] text-gray-600">
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
