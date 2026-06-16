"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  FileText,
  Settings,
  FolderOpen,
  MessageSquare,
  Terminal,
  Globe,
  Keyboard,
  PenLine,
  ArrowRight,
  Code,
  GitBranch,
  Puzzle,
  Layers,
  Loader2,
  AlertTriangle,
  Sparkles,
  File as FileIcon,
  ArrowLeft,
} from "lucide-react";
import { useProject } from "@/lib/store/project";
import {
  createThread,
  getFileTree,
  ApiClientError,
  type FileNode,
} from "@/lib/client/api";
import { getActiveExtensionHooks } from "@/lib/client/extensionRuntime";
import type { CommandHook } from "@/lib/extensions/runtime";
import { sanitizeUrl } from "@/lib/sanitize";

interface Command {
  id: string;
  label: string;
  icon: React.ElementType;
  shortcut?: string;
  /** Project-scoped commands are disabled (with a hint) when no project is active. */
  requiresProject?: boolean;
  /**
   * Return value:
   *  - void / undefined: close the palette (default).
   *  - "keep-open": switch into a sub-mode and keep the palette open.
   */
  action: () => void | "keep-open" | Promise<void | "keep-open">;
  category: string;
  /** Optional emoji icon for extension commands */
  emojiIcon?: string;
}

type Mode = "commands" | "open-file";

/** Flatten a nested FileNode tree into a list of files (FOLDERs excluded). */
function flattenFiles(nodes: FileNode[]): FileNode[] {
  const out: FileNode[] = [];
  const walk = (list: FileNode[]) => {
    for (const n of list) {
      if (n.type === "FILE") out.push(n);
      if (n.children?.length) walk(n.children);
    }
  };
  walk(nodes);
  return out;
}

/** Placeholder icon component for extension commands that use emoji */
function EmojiIcon({ emoji, size }: { emoji: string; size: number }) {
  return (
    <span
      className="inline-flex items-center justify-center shrink-0"
      style={{ width: size, height: size, fontSize: size - 2 }}
    >
      {emoji}
    </span>
  );
}

export default function CommandPalette() {
  const router = useRouter();
  const {
    activeProject,
    activeWorkspace,
    createNewProject,
  } = useProject();

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [mode, setMode] = useState<Mode>("commands");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Open-file sub-mode state.
  const [files, setFiles] = useState<FileNode[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);

  // Extension commands
  const [extensionCommands, setExtensionCommands] = useState<CommandHook[]>([]);

  const inputRef = useRef<HTMLInputElement>(null);

  // Mirror fast-changing state into refs so the heavy `commands` memo (and
  // its downstream `filteredCommands`) can stay referentially stable across
  // keystrokes and busy toggles. Without this, typing a single character
  // rebuilds the entire command list and re-runs the filter, which makes
  // the palette noticeably laggy in the dashboard.
  const queryRef = useRef(query);
  const busyRef = useRef(busy);
  useEffect(() => {
    queryRef.current = query;
  }, [query]);
  useEffect(() => {
    busyRef.current = busy;
  }, [busy]);

  const projectId = activeProject?.id ?? null;
  const hasProject = !!projectId;

  // Load extension commands when palette opens or workspace changes
  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    async function load() {
      const hooks = await getActiveExtensionHooks(activeWorkspace?.id);
      if (!cancelled) {
        setExtensionCommands(hooks.commands);
      }
    }

    void load();
    return () => { cancelled = true; };
  }, [open, activeWorkspace?.id]);

  // Auto-dismiss toast after 3 seconds
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => {
      setToast(null);
    }, 3000);
    return () => clearTimeout(timer);
  }, [toast]);

  const reset = useCallback(() => {
    setQuery("");
    setSelectedIndex(0);
    setMode("commands");
    setError(null);
    setBusy(false);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    reset();
  }, [reset]);

  /** Enter the two-step "open file" mode: fetch the tree, then filter as you type. */
  const enterOpenFileMode = useCallback(async (): Promise<"keep-open"> => {
    setMode("open-file");
    setQuery("");
    setSelectedIndex(0);
    setError(null);
    if (!projectId) return "keep-open";
    setFilesLoading(true);
    try {
      const { tree } = await getFileTree(projectId);
      setFiles(flattenFiles(tree));
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.message : "Failed to load files"
      );
    } finally {
      setFilesLoading(false);
    }
    return "keep-open";
  }, [projectId]);

  const newChat = useCallback(async () => {
    if (!projectId) return;
    setBusy(true);
    try {
      const { thread } = await createThread(projectId);
      close();
      router.push(`/dashboard/chat?thread=${thread.id}`);
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.message : "Failed to create chat"
      );
      setBusy(false);
    }
  }, [projectId, router, close]);

  const newProject = useCallback(async () => {
    setBusy(true);
    try {
      const project = await createNewProject({
        name: "Untitled project",
        template: "node",
      });
      close();
      router.push("/dashboard/chat");
      void project;
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.message : "Failed to create project"
      );
      setBusy(false);
    }
  }, [createNewProject, router, close]);

  const askAi = useCallback((): void => {
    const q = queryRef.current.trim();
    const qs = q ? `?prompt=${encodeURIComponent(q)}` : "";
    close();
    router.push(`/dashboard/chat${qs}`);
  }, [router, close]);

  /** Execute an extension command action */
  const executeExtensionAction = useCallback(
    (action: string) => {
      if (action.startsWith("notify:")) {
        const message = action.slice(7);
        // Dispatch custom event for other listeners
        window.dispatchEvent(
          new CustomEvent("extension-notify", { detail: { message } })
        );
        // Show toast via state
        close();
        setToast(message);
      } else if (action.startsWith("/")) {
        // Defense-in-depth: re-sanitize the URL on the client in case a
        // malicious extension bypassed the server-side sanitization. Only
        // same-origin relative paths or otherwise-safe URLs survive.
        const safe = sanitizeUrl(action);
        if (!safe || !safe.startsWith("/")) {
          // Refuse to navigate; just close the palette.
          close();
          return;
        }
        close();
        router.push(safe);
      } else {
        close();
      }
    },
    [close, router]
  );

  const commands: Command[] = useMemo(
    () => [
      { id: "new-chat", label: "New chat", icon: PenLine, shortcut: "Ctrl+N", requiresProject: true, action: newChat, category: "General" },
      { id: "new-project", label: "New project", icon: FolderOpen, action: newProject, category: "General" },
      { id: "open-file", label: "Open file...", icon: FileIcon, requiresProject: true, action: enterOpenFileMode, category: "General" },
      { id: "ask-ai", label: "Ask AI...", icon: Sparkles, requiresProject: true, action: askAi, category: "General" },
      { id: "run-command", label: "Run command...", icon: Terminal, shortcut: "Ctrl+`", requiresProject: true, action: () => router.push("/dashboard/terminal"), category: "General" },
      { id: "editor", label: "Open Editor", icon: Code, action: () => router.push("/dashboard/editor"), category: "Workspace" },
      { id: "composer", label: "Open Composer", icon: Layers, action: () => router.push("/dashboard/composer"), category: "Workspace" },
      { id: "git", label: "Source Control", icon: GitBranch, action: () => router.push("/dashboard/git"), category: "Workspace" },
      { id: "extensions", label: "Extensions", icon: Puzzle, action: () => router.push("/dashboard/extensions"), category: "Workspace" },
      { id: "search", label: "Search in project", icon: Search, shortcut: "Ctrl+Shift+F", requiresProject: true, action: () => router.push("/dashboard/search"), category: "Workspace" },
      { id: "projects", label: "Go to Repositories", icon: FolderOpen, action: () => router.push("/dashboard/projects"), category: "Navigation" },
      { id: "chat", label: "Open Chat", icon: MessageSquare, action: () => router.push("/dashboard/chat"), category: "Navigation" },
      { id: "settings", label: "Go to Settings", icon: Settings, action: () => router.push("/dashboard/settings"), category: "Navigation" },
      { id: "knowledge", label: "Knowledge Base", icon: FileText, action: () => router.push("/dashboard/knowledge"), category: "Navigation" },
      { id: "browser", label: "Toggle Browser", icon: Globe, shortcut: "Ctrl+Shift+B", action: () => router.push("/dashboard/canvas"), category: "View" },
      { id: "shortcuts", label: "Keyboard Shortcuts", icon: Keyboard, shortcut: "Ctrl+/", action: () => router.push("/dashboard/settings"), category: "Help" },
      // Extension-provided commands
      ...extensionCommands.map((ext) => ({
        id: `ext-${ext.extensionId}-${ext.label}`,
        label: ext.label,
        icon: Puzzle, // fallback icon component
        emojiIcon: ext.icon,
        shortcut: ext.keybinding,
        action: () => executeExtensionAction(ext.action),
        category: `Extension: ${ext.extensionName}`,
      })),
    ],
    [newChat, newProject, enterOpenFileMode, askAi, router, extensionCommands, executeExtensionAction]
  );

  const filteredCommands = useMemo(() => {
    const q = query.toLowerCase();
    // eslint-disable-next-line react-hooks/refs -- `commands` is a useMemo array, not a ref
    return commands.filter((c) => c.label.toLowerCase().includes(q));
  }, [commands, query]);

  const filteredFiles = useMemo(() => {
    if (mode !== "open-file") return [];
    const q = query.toLowerCase();
    return files
      .filter((f) => f.path.toLowerCase().includes(q))
      .slice(0, 50);
  }, [mode, files, query]);

  // Clamp selection when the result set changes.
  const resultCount =
    mode === "open-file" ? filteredFiles.length : filteredCommands.length;
  useEffect(() => {
    setSelectedIndex((i) => Math.min(i, Math.max(resultCount - 1, 0)));
  }, [resultCount]);

  // Global Ctrl/Cmd+K toggle + Escape close.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((prev) => {
          if (prev) {
            reset();
            return false;
          }
          reset();
          return true;
        });
      }
      if (e.key === "Escape") {
        setOpen((prev) => {
          if (prev) reset();
          return false;
        });
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [reset]);

  useEffect(() => {
    if (open) {
      const t = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [open, mode]);

  const runCommand = useCallback(
    async (cmd: Command) => {
      if (cmd.requiresProject && !hasProject) return; // disabled
      setError(null);
      const result = await cmd.action();
      if (result !== "keep-open") {
        // Most actions navigate/close themselves; ensure palette closes for
        // synchronous router pushes that don't call close().
        if (!busyRef.current) close();
      }
    },
    [hasProject, close]
  );

  const openFile = useCallback(
    (file: FileNode) => {
      close();
      router.push(`/dashboard/editor?file=${encodeURIComponent(file.path)}`);
    },
    [router, close]
  );

  const onInputKeyDown = (e: React.KeyboardEvent) => {
    // Backspace on empty query in open-file mode -> back to commands.
    if (
      mode === "open-file" &&
      e.key === "Backspace" &&
      query.length === 0
    ) {
      e.preventDefault();
      setMode("commands");
      setSelectedIndex(0);
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((p) => Math.min(p + 1, resultCount - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((p) => Math.max(p - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (mode === "open-file") {
        const file = filteredFiles[selectedIndex];
        if (file) openFile(file);
      } else {
        const cmd = filteredCommands[selectedIndex];
        if (cmd) void runCommand(cmd);
      }
    }
  };

  const categories =
    mode === "commands"
      ? [...new Set(filteredCommands.map((c) => c.category))]
      : [];

  return (
    <>
      {/* Toast notification rendered via state */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="fixed bottom-10 left-1/2 z-[100] -translate-x-1/2 rounded-full border border-slate-200/50 bg-slate-900/90 px-6 py-2.5 text-[13px] font-medium text-white shadow-[0_8px_30px_rgba(17,24,39,0.2)] backdrop-blur-md dark:border-white/10 dark:bg-white dark:text-slate-900"
            role="status"
            aria-live="polite"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {open && (
          <div
            className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]"
            role="dialog"
            aria-modal="true"
            aria-label="Command palette"
          >
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="absolute inset-0 bg-slate-900/10 backdrop-blur-sm dark:bg-black/40"
              onClick={close}
              aria-hidden="true"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: "spring", stiffness: 350, damping: 30 }}
              className="relative w-full max-w-2xl overflow-hidden rounded-[24px] border border-white/60 bg-white/70 shadow-[0_0_0_1px_rgba(255,255,255,0.7)_inset,0_16px_40px_rgba(17,24,39,0.1)] backdrop-blur-3xl dark:border-white/10 dark:bg-[#0A0A0A]/80 dark:shadow-[0_0_0_1px_rgba(255,255,255,0.05)_inset,0_16px_40px_rgba(0,0,0,0.5)]"
            >
            <div className="flex items-center gap-3 border-b border-slate-200/50 px-4 py-3.5 dark:border-white/10">
              {mode === "open-file" ? (
                <button
                  onClick={() => {
                    setMode("commands");
                    setQuery("");
                    setSelectedIndex(0);
                    inputRef.current?.focus();
                  }}
                  className="text-slate-400 hover:text-slate-600 transition-colors dark:hover:text-slate-200"
                  title="Back to commands"
                >
                  <ArrowLeft size={18} />
                </button>
              ) : (
                <Search size={18} className="text-slate-400" />
              )}
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSelectedIndex(0);
                }}
                onKeyDown={onInputKeyDown}
                placeholder={
                  mode === "open-file"
                    ? "Search files by path..."
                    : "Type a command or search..."
                }
                className="flex-1 bg-transparent text-[15px] text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-white"
              />
              <kbd className="rounded-md border border-slate-200/50 bg-slate-100/50 px-2 py-0.5 text-[11px] font-semibold text-slate-400 dark:border-white/10 dark:bg-white/5">ESC</kbd>
            </div>

            {error && (
              <div className="flex items-center gap-2 border-b border-red-100 bg-red-50 px-4 py-2">
                <AlertTriangle size={12} className="text-red-500" />
                <span className="text-xs text-red-600">{error}</span>
              </div>
            )}

            {!hasProject && mode === "commands" && (
              <div className="border-b border-border bg-surface-soft px-4 py-2">
                <span className="text-[11px] text-text-muted">
                  No active project &mdash; project-scoped commands are disabled.
                </span>
              </div>
            )}

            <div className="max-h-72 overflow-y-auto p-2">
              {mode === "open-file" ? (
                filesLoading ? (
                  <div className="flex items-center justify-center gap-2 py-6 text-sm text-text-muted">
                    <Loader2 size={14} className="animate-spin" /> Loading files...
                  </div>
                ) : filteredFiles.length === 0 ? (
                  <p className="px-3 py-4 text-center text-sm text-text-muted">
                    No files found
                  </p>
                ) : (
                  filteredFiles.map((file, i) => (
                    <button
                      key={file.id}
                      onClick={() => openFile(file)}
                      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-all duration-150 ${
                        i === selectedIndex
                          ? "bg-accent-light/70 text-foreground"
                          : "text-text-secondary hover:bg-surface-soft"
                      }`}
                    >
                      <FileIcon size={16} className="shrink-0 text-text-muted" />
                      <span className="flex-1 truncate">{file.name}</span>
                      <span className="truncate text-[10px] text-text-muted">
                        {file.path}
                      </span>
                    </button>
                  ))
                )
              ) : (
                <>
                  {categories.map((cat) => (
                    <div key={cat}>
                      <p className="mb-1 mt-2 px-3 text-[10px] font-medium uppercase tracking-wider text-text-muted first:mt-0">
                        {cat}
                      </p>
                      {filteredCommands
                        .filter((c) => c.category === cat)
                        .map((cmd) => {
                          const globalIndex = filteredCommands.indexOf(cmd);
                          const disabled = cmd.requiresProject && !hasProject;
                          return (
                            <button
                              key={cmd.id}
                              onClick={() => void runCommand(cmd)}
                              disabled={disabled || busy}
                              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-all duration-150 ${
                                disabled
                                  ? "cursor-not-allowed text-text-muted"
                                  : globalIndex === selectedIndex
                                    ? "bg-accent-light/70 text-foreground"
                                    : "text-text-secondary hover:bg-surface-soft"
                              }`}
                            >
                              {cmd.emojiIcon ? (
                                <EmojiIcon emoji={cmd.emojiIcon} size={16} />
                              ) : (
                                <cmd.icon size={16} className="shrink-0 text-text-muted" />
                              )}
                              <span className="flex-1">{cmd.label}</span>
                              {disabled && (
                                <span className="text-[10px] text-text-muted">
                                  needs project
                                </span>
                              )}
                              {!disabled && cmd.shortcut && (
                                <kbd className="rounded border border-border bg-surface-soft px-1.5 py-0.5 text-[10px] text-text-muted">
                                  {cmd.shortcut}
                                </kbd>
                              )}
                              {!disabled && globalIndex === selectedIndex && (
                                <ArrowRight size={12} className="text-text-muted" />
                              )}
                            </button>
                          );
                        })}
                    </div>
                  ))}
                  {filteredCommands.length === 0 && (
                    <p className="px-3 py-4 text-center text-sm text-text-muted">
                      No commands found
                    </p>
                  )}
                </>
              )}
            </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
