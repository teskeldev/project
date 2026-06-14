"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
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
    const q = query.trim();
    const qs = q ? `?prompt=${encodeURIComponent(q)}` : "";
    close();
    router.push(`/dashboard/chat${qs}`);
  }, [query, router, close]);

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
        if (!busy) close();
      }
    },
    [hasProject, busy, close]
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
      {toast && (
        <div
          className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[100] rounded-lg bg-gray-900 px-4 py-2 text-sm text-white shadow-lg animate-fade-in"
          role="status"
          aria-live="polite"
        >
          {toast}
        </div>
      )}

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh] animate-fade-in"
          role="dialog"
          aria-modal="true"
          aria-label="Command palette"
        >
          <div
            className="absolute inset-0 bg-black/20 backdrop-blur-md"
            onClick={close}
            aria-hidden="true"
          />
          <div className="animate-scale-in relative w-full max-w-lg overflow-hidden rounded-2xl border border-gray-200/80 bg-white/95 shadow-2xl backdrop-blur-xl">
            <div className="flex items-center gap-3 border-b border-gray-200 px-4 py-3">
              {mode === "open-file" ? (
                <button
                  onClick={() => {
                    setMode("commands");
                    setQuery("");
                    setSelectedIndex(0);
                    inputRef.current?.focus();
                  }}
                  className="text-gray-400 hover:text-gray-600"
                  title="Back to commands"
                >
                  <ArrowLeft size={16} />
                </button>
              ) : (
                <Search size={16} className="text-gray-400" />
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
                className="flex-1 bg-transparent text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none"
              />
              <kbd className="rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-[10px] text-gray-400">ESC</kbd>
            </div>

            {error && (
              <div className="flex items-center gap-2 border-b border-red-100 bg-red-50 px-4 py-2">
                <AlertTriangle size={12} className="text-red-500" />
                <span className="text-xs text-red-600">{error}</span>
              </div>
            )}

            {!hasProject && mode === "commands" && (
              <div className="border-b border-gray-100 bg-gray-50 px-4 py-2">
                <span className="text-[11px] text-gray-400">
                  No active project &mdash; project-scoped commands are disabled.
                </span>
              </div>
            )}

            <div className="max-h-72 overflow-y-auto p-2">
              {mode === "open-file" ? (
                filesLoading ? (
                  <div className="flex items-center justify-center gap-2 py-6 text-sm text-gray-400">
                    <Loader2 size={14} className="animate-spin" /> Loading files...
                  </div>
                ) : filteredFiles.length === 0 ? (
                  <p className="px-3 py-4 text-center text-sm text-gray-400">
                    No files found
                  </p>
                ) : (
                  filteredFiles.map((file, i) => (
                    <button
                      key={file.id}
                      onClick={() => openFile(file)}
                      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-all duration-150 ${
                        i === selectedIndex
                          ? "bg-blue-50/70 text-gray-900"
                          : "text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      <FileIcon size={16} className="shrink-0 text-gray-400" />
                      <span className="flex-1 truncate">{file.name}</span>
                      <span className="truncate text-[10px] text-gray-400">
                        {file.path}
                      </span>
                    </button>
                  ))
                )
              ) : (
                <>
                  {categories.map((cat) => (
                    <div key={cat}>
                      <p className="mb-1 mt-2 px-3 text-[10px] font-medium uppercase tracking-wider text-gray-400 first:mt-0">
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
                                  ? "cursor-not-allowed text-gray-300"
                                  : globalIndex === selectedIndex
                                    ? "bg-blue-50/70 text-gray-900"
                                    : "text-gray-600 hover:bg-gray-50"
                              }`}
                            >
                              {cmd.emojiIcon ? (
                                <EmojiIcon emoji={cmd.emojiIcon} size={16} />
                              ) : (
                                <cmd.icon size={16} className="shrink-0 text-gray-400" />
                              )}
                              <span className="flex-1">{cmd.label}</span>
                              {disabled && (
                                <span className="text-[10px] text-gray-300">
                                  needs project
                                </span>
                              )}
                              {!disabled && cmd.shortcut && (
                                <kbd className="rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-[10px] text-gray-400">
                                  {cmd.shortcut}
                                </kbd>
                              )}
                              {!disabled && globalIndex === selectedIndex && (
                                <ArrowRight size={12} className="text-gray-400" />
                              )}
                            </button>
                          );
                        })}
                    </div>
                  ))}
                  {filteredCommands.length === 0 && (
                    <p className="px-3 py-4 text-center text-sm text-gray-400">
                      No commands found
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
