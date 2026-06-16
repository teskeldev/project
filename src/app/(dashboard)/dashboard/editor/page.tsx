"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useProject } from "@/lib/store/project";
import { useTheme } from "@/lib/store/theme";
import { useInlineCompletion } from "@/lib/client/useInlineCompletion";
import { getStatus as getGitStatus } from "@/lib/client/git";
import {
  listSessions,
  createSession,
  type TerminalSession,
} from "@/lib/client/terminal";
import {
  getFileTree,
  getFileContent,
  saveFile,
  createFileNode,
  renameFileNode,
  deleteFileNode,
  listChangeSets,
  revertChangeSet,
  ApiClientError,
  type FileNode,
} from "@/lib/client/api";
import {
  ChevronRight,
  ChevronDown,
  File as FileIcon,
  FolderOpen,
  Folder,
  X,
  Search,
  GitBranch,
  Play,
  Terminal,
  Copy,
  Maximize2,
  Split,
  Settings,
  Plus,
  FilePlus,
  FolderPlus,
  Pencil,
  Trash2,
  Loader2,
  Check,
  AlertCircle,
  RefreshCw,
  FolderGit2,
  Globe,
  RotateCcw,
  Sparkles,
  Sun,
  Moon,
  Monitor,
} from "lucide-react";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-sm text-text-muted">
      <Loader2 size={16} className="mr-2 animate-spin" />
      Loading editor...
    </div>
  ),
});

const PreviewPanel = dynamic(
  () => import("@/components/dashboard/PreviewPanel"),
  { ssr: false }
);

const XtermTerminal = dynamic(
  () => import("@/components/dashboard/XtermTerminal"),
  { ssr: false }
);

/** Map a filename extension to a Monaco language id (fallback). */
function languageFromName(name: string): string {
  const ext = name.includes(".")
    ? name.slice(name.lastIndexOf(".") + 1).toLowerCase()
    : "";
  const map: Record<string, string> = {
    ts: "typescript",
    tsx: "typescript",
    js: "javascript",
    jsx: "javascript",
    mjs: "javascript",
    cjs: "javascript",
    json: "json",
    css: "css",
    scss: "scss",
    less: "less",
    html: "html",
    htm: "html",
    xml: "xml",
    svg: "xml",
    md: "markdown",
    py: "python",
    rb: "ruby",
    rs: "rust",
    go: "go",
    java: "java",
    c: "c",
    cpp: "cpp",
    cs: "csharp",
    php: "php",
    sh: "shell",
    yml: "yaml",
    yaml: "yaml",
    sql: "sql",
  };
  return map[ext] ?? "plaintext";
}

/** Monaco only knows a handful of base ids; tsx/jsx map to ts/js. */
function toMonacoLanguage(lang: string | null | undefined, name: string): string {
  const resolved = (lang ?? "").trim() || languageFromName(name);
  return resolved;
}

const fileLangColor: Record<string, string> = {
  typescript: "text-accent",
  javascript: "text-yellow-500",
  css: "text-purple-500",
  scss: "text-purple-500",
  json: "text-yellow-600",
  markdown: "text-text-muted",
  html: "text-orange-500",
};

type OpenTab = {
  path: string;
  name: string;
  language: string;
  content: string;
  savedContent: string;
  loading: boolean;
  error: string | null;
};

type SaveStatus = "idle" | "saving" | "saved" | "error";

/* -------------------------------------------------------------------------- */
/* Debounce helper                                                            */
/* -------------------------------------------------------------------------- */

function useDebouncedCallback<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number
) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fnRef = useRef(fn);
  useEffect(() => { fnRef.current = fn; });

  const debounced = useCallback(
    (...args: Parameters<T>) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        fnRef.current(...args);
      }, delay);
    },
    [delay]
  ) as unknown as T;

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return debounced;
}

/* -------------------------------------------------------------------------- */
/* Toast notification                                                         */
/* -------------------------------------------------------------------------- */

type Toast = { id: number; message: string; type: "error" | "info" | "success" };

let toastId = 0;

function ToastContainer({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  if (toasts.length === 0) return null;
  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm shadow-lg ${
            t.type === "error"
              ? "bg-red-600 text-white"
              : t.type === "success"
              ? "bg-green-600 text-white"
              : "bg-foreground text-white"
          }`}
        >
          <span className="flex-1">{t.message}</span>
          <button onClick={() => onDismiss(t.id)} className="ml-2 opacity-70 hover:opacity-100">
            <X size={12} />
          </button>
        </div>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Inline input for file tree                                                 */
/* -------------------------------------------------------------------------- */

function InlineInput({
  defaultValue,
  onSubmit,
  onCancel,
  placeholder,
}: {
  defaultValue?: string;
  onSubmit: (value: string) => void;
  onCancel: () => void;
  placeholder?: string;
}) {
  const [value, setValue] = useState(defaultValue ?? "");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    if (defaultValue) inputRef.current?.select();
  }, [defaultValue]);

  return (
    <input
      ref={inputRef}
      type="text"
      value={value}
      placeholder={placeholder}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter" && value.trim()) {
          onSubmit(value.trim());
        } else if (e.key === "Escape") {
          onCancel();
        }
      }}
      onBlur={() => onCancel()}
      className="ml-1 w-full rounded border border-accent bg-surface px-1 py-0.5 text-[13px] text-foreground outline-none"
    />
  );
}

/* -------------------------------------------------------------------------- */
/* Confirmation popover                                                       */
/* -------------------------------------------------------------------------- */

function ConfirmPopover({
  message,
  onConfirm,
  onCancel,
  position,
}: {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  position: { x: number; y: number };
}) {
  return (
    <div
      className="fixed z-[60] w-64 rounded-lg border border-border bg-surface p-3 shadow-xl"
      style={{ top: position.y, left: position.x }}
    >
      <p className="text-sm text-text-secondary">{message}</p>
      <div className="mt-3 flex justify-end gap-2">
        <button
          onClick={onCancel}
          className="rounded px-3 py-1 text-xs text-text-secondary hover:bg-surface-soft"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          className="rounded bg-red-600 px-3 py-1 text-xs text-white hover:bg-red-700"
        >
          Delete
        </button>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* File tree                                                                  */
/* -------------------------------------------------------------------------- */

function FileTreeItem({
  node,
  depth,
  onSelect,
  selectedPath,
  onContext,
  inlineInput,
}: {
  node: FileNode;
  depth: number;
  onSelect: (node: FileNode) => void;
  selectedPath: string | null;
  onContext: (e: React.MouseEvent, node: FileNode) => void;
  inlineInput?: {
    parentPath: string;
    type: "rename";
    node: FileNode;
    onSubmit: (value: string) => void;
    onCancel: () => void;
  } | null;
}) {
  const [expanded, setExpanded] = useState(depth === 0);

  const isRenaming =
    inlineInput?.type === "rename" && inlineInput.node.path === node.path;

  if (node.type === "FOLDER") {
    return (
      <div>
        <button
          onClick={() => setExpanded(!expanded)}
          onContextMenu={(e) => onContext(e, node)}
          className="flex w-full items-center gap-1 py-1 pr-2 text-left text-[13px] text-text-secondary hover:bg-surface-soft"
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
        >
          {expanded ? (
            <ChevronDown size={14} className="shrink-0 text-text-muted" />
          ) : (
            <ChevronRight size={14} className="shrink-0 text-text-muted" />
          )}
          {expanded ? (
            <FolderOpen size={14} className="shrink-0 text-amber-500" />
          ) : (
            <Folder size={14} className="shrink-0 text-amber-500" />
          )}
          {isRenaming ? (
            <InlineInput
              defaultValue={node.name}
              onSubmit={inlineInput!.onSubmit}
              onCancel={inlineInput!.onCancel}
            />
          ) : (
            <span className="ml-1 truncate">{node.name}</span>
          )}
        </button>
        {expanded &&
          node.children?.map((child) => (
            <FileTreeItem
              key={child.id}
              node={child}
              depth={depth + 1}
              onSelect={onSelect}
              selectedPath={selectedPath}
              onContext={onContext}
              inlineInput={inlineInput}
            />
          ))}
      </div>
    );
  }

  const lang = node.language ?? languageFromName(node.name);

  return (
    <button
      onClick={() => onSelect(node)}
      onContextMenu={(e) => onContext(e, node)}
      className={`flex w-full items-center gap-1 py-1 pr-2 text-left text-[13px] transition-colors ${
        selectedPath === node.path
          ? "bg-accent-light text-foreground"
          : "text-text-secondary hover:bg-surface-soft"
      }`}
      style={{ paddingLeft: `${depth * 12 + 22}px` }}
    >
      <FileIcon
        size={14}
        className={`shrink-0 ${fileLangColor[lang] || "text-text-muted"}`}
      />
      {isRenaming ? (
        <InlineInput
          defaultValue={node.name}
          onSubmit={inlineInput!.onSubmit}
          onCancel={inlineInput!.onCancel}
        />
      ) : (
        <span className="ml-1 truncate">{node.name}</span>
      )}
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/* Context menu                                                               */
/* -------------------------------------------------------------------------- */

type ContextState = {
  x: number;
  y: number;
  node: FileNode;
} | null;

/* -------------------------------------------------------------------------- */
/* Quick Open (Ctrl+P)                                                        */
/* -------------------------------------------------------------------------- */

function flattenTree(nodes: FileNode[]): FileNode[] {
  const result: FileNode[] = [];
  const walk = (list: FileNode[]) => {
    for (const n of list) {
      if (n.type === "FILE") result.push(n);
      if (n.children) walk(n.children);
    }
  };
  walk(nodes);
  return result;
}

function QuickOpenModal({
  files,
  onSelect,
  onClose,
}: {
  files: FileNode[];
  onSelect: (node: FileNode) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const filtered = useMemo(() => {
    if (!query.trim()) return files.slice(0, 50);
    const q = query.toLowerCase();
    return files
      .filter((f) => f.name.toLowerCase().includes(q) || f.path.toLowerCase().includes(q))
      .slice(0, 50);
  }, [files, query]);

  const [selectedIdx, setSelectedIdx] = useState(0);

  useEffect(() => {
    setSelectedIdx(0);
  }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIdx((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && filtered[selectedIdx]) {
      onSelect(filtered[selectedIdx]);
      onClose();
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center pt-[15%]" onClick={onClose}>
      <div
        className="w-[500px] max-w-[90vw] overflow-hidden rounded-lg border border-border bg-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-border px-3 py-2">
          <Search size={14} className="text-text-muted" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search files by name..."
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-text-muted focus:outline-none"
          />
        </div>
        <div className="max-h-64 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="px-3 py-4 text-center text-xs text-text-muted">No files found</p>
          ) : (
            filtered.map((f, i) => (
              <button
                key={f.path}
                onClick={() => {
                  onSelect(f);
                  onClose();
                }}
                className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm ${
                  i === selectedIdx
                    ? "bg-accent-light text-foreground"
                    : "text-text-secondary hover:bg-surface-soft"
                }`}
              >
                <FileIcon size={12} className="shrink-0 text-text-muted" />
                <span className="truncate">{f.path}</span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Settings dropdown                                                          */
/* -------------------------------------------------------------------------- */

type EditorSettings = {
  fontSize: number;
  wordWrap: "on" | "off";
  minimap: boolean;
};

function SettingsDropdown({
  settings,
  onChange,
  onClose,
  theme,
  onThemeChange,
}: {
  settings: EditorSettings;
  onChange: (s: EditorSettings) => void;
  onClose: () => void;
  theme: "light" | "dark" | "system";
  onThemeChange: (t: "light" | "dark" | "system") => void;
}) {
  return (
    <div
      className="fixed right-3 top-12 z-[70] w-56 rounded-lg border border-border bg-surface p-3 shadow-xl"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="mb-2 text-xs font-semibold uppercase text-text-muted">Editor Settings</div>
      <label className="flex items-center justify-between py-1 text-xs text-text-secondary">
        Font Size
        <input
          type="number"
          min={10}
          max={24}
          value={settings.fontSize}
          onChange={(e) => onChange({ ...settings, fontSize: Number(e.target.value) })}
          className="w-14 rounded border border-border px-1 py-0.5 text-center text-xs"
        />
      </label>
      <label className="flex items-center justify-between py-1 text-xs text-text-secondary">
        Word Wrap
        <input
          type="checkbox"
          checked={settings.wordWrap === "on"}
          onChange={(e) => onChange({ ...settings, wordWrap: e.target.checked ? "on" : "off" })}
          className="h-3.5 w-3.5"
        />
      </label>
      <label className="flex items-center justify-between py-1 text-xs text-text-secondary">
        Minimap
        <input
          type="checkbox"
          checked={settings.minimap}
          onChange={(e) => onChange({ ...settings, minimap: e.target.checked })}
          className="h-3.5 w-3.5"
        />
      </label>
      <div className="my-2 h-px bg-surface-soft" />
      <div className="mb-1 text-xs font-semibold uppercase text-text-muted">Theme</div>
      <div className="flex gap-1">
        <button
          onClick={() => onThemeChange("light")}
          className={`flex items-center gap-1 rounded px-2 py-1 text-xs ${theme === "light" ? "bg-accent-light text-accent" : "text-text-secondary hover:bg-surface-soft"}`}
        >
          <Sun size={11} /> Light
        </button>
        <button
          onClick={() => onThemeChange("dark")}
          className={`flex items-center gap-1 rounded px-2 py-1 text-xs ${theme === "dark" ? "bg-accent-light text-accent" : "text-text-secondary hover:bg-surface-soft"}`}
        >
          <Moon size={11} /> Dark
        </button>
        <button
          onClick={() => onThemeChange("system")}
          className={`flex items-center gap-1 rounded px-2 py-1 text-xs ${theme === "system" ? "bg-accent-light text-accent" : "text-text-secondary hover:bg-surface-soft"}`}
        >
          <Monitor size={11} /> Auto
        </button>
      </div>
      <div className="mt-3 flex justify-end">
        <button onClick={onClose} className="text-xs text-text-muted hover:text-text-secondary">
          Close
        </button>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Editor page                                                                */
/* -------------------------------------------------------------------------- */

export default function EditorPage() {
  const { activeProject, loading: projectLoading } = useProject();
  const projectId = activeProject?.id ?? null;
  const { theme, resolvedTheme, setTheme } = useTheme();

  // Inline AI completion
  const [aiEnabled, setAiEnabled] = useState(true);
  const { registerProvider } = useInlineCompletion(aiEnabled ? projectId : null);
  const providerDisposableRef = useRef<{ dispose: () => void } | null>(null);

  // Editor ref for actions
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const editorRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const monacoRef = useRef<any>(null);

  const [tree, setTree] = useState<FileNode[]>([]);
  const [treeLoading, setTreeLoading] = useState(false);
  const [treeError, setTreeError] = useState<string | null>(null);

  const [tabs, setTabs] = useState<OpenTab[]>([]);
  const [activePath, setActivePath] = useState<string | null>(null);

  const [showTerminal, setShowTerminal] = useState(true);
  const [showPreview, setShowPreview] = useState(false);
  const [showSplit, setShowSplit] = useState(false);
  const [, setSearchOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [context, setContext] = useState<ContextState>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [quickOpenVisible, setQuickOpenVisible] = useState(false);

  // Editor settings
  const [editorSettings, setEditorSettings] = useState<EditorSettings>({
    fontSize: 13,
    wordWrap: "off",
    minimap: true,
  });

  // Git branch
  const [gitBranch, setGitBranch] = useState<string>("main");

  // Terminal session
  const [terminalSession, setTerminalSession] = useState<TerminalSession | null>(null);
  const [terminalLoading, setTerminalLoading] = useState(false);

  // Toasts
  const [toasts, setToasts] = useState<Toast[]>([]);
  const addToast = useCallback((message: string, type: Toast["type"] = "error") => {
    const id = ++toastId;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);
  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Inline input state for file tree operations
  const [inlineInput, setInlineInput] = useState<{
    parentPath: string;
    type: "newFile" | "newFolder" | "rename";
    node?: FileNode;
  } | null>(null);

  // Delete confirmation popover
  const [deleteConfirm, setDeleteConfirm] = useState<{
    node: FileNode;
    position: { x: number; y: number };
  } | null>(null);

  // Undo last AI change state
  const [lastAppliedId, setLastAppliedId] = useState<string | null>(null);
  const [undoBusy, setUndoBusy] = useState(false);

  // Unsaved changes tracking
  const hasDirtyTabs = tabs.some((t) => t.content !== t.savedContent);

  const activeTab = tabs.find((t) => t.path === activePath) ?? null;

  /* ----------------------------- tree loading ---------------------------- */

  const loadTree = useCallback(async () => {
    if (!projectId) return;
    setTreeLoading(true);
    setTreeError(null);
    try {
      const { tree: nodes } = await getFileTree(projectId);
      setTree(nodes);
    } catch (err) {
      setTreeError(
        err instanceof ApiClientError ? err.message : "Failed to load files"
      );
    } finally {
      setTreeLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    // Reset editor state when switching projects.
    setTabs([]);
    setActivePath(null);
    setTree([]);
    setTerminalSession(null);
    if (projectId) void loadTree();
  }, [projectId, loadTree]);

  // Load git branch
  useEffect(() => {
    if (!projectId) return;
    (async () => {
      try {
        const status = await getGitStatus(projectId);
        if ("isRepo" in status && status.isRepo && status.branch) {
          setGitBranch(status.branch);
        }
      } catch {
        // ignore - keep default "main"
      }
    })();
  }, [projectId]);

  // Load or create terminal session
  useEffect(() => {
    if (!projectId || terminalSession) return;
    setTerminalLoading(true);
    (async () => {
      try {
        const { sessions } = await listSessions(projectId);
        const active = sessions.find((s) => s.status === "ACTIVE");
        if (active) {
          setTerminalSession(active);
        } else {
          const { session } = await createSession(projectId, { title: "Terminal" });
          setTerminalSession(session);
        }
      } catch {
        // Terminal not available
      } finally {
        setTerminalLoading(false);
      }
    })();
  }, [projectId, terminalSession]);

  // Load last applied changeset for undo button
  useEffect(() => {
    if (!projectId) {
      setLastAppliedId(null);
      return;
    }
    (async () => {
      try {
        const { changesets } = await listChangeSets(projectId, "APPLIED");
        setLastAppliedId(changesets.length > 0 ? changesets[0].id : null);
      } catch {
        setLastAppliedId(null);
      }
    })();
  }, [projectId]);

  const handleUndoLastChange = useCallback(async () => {
    if (!lastAppliedId) return;
    setUndoBusy(true);
    try {
      await revertChangeSet(lastAppliedId);
      setLastAppliedId(null);
      if (projectId) void loadTree();
    } catch {
      /* ignore */
    } finally {
      setUndoBusy(false);
    }
  }, [lastAppliedId, projectId, loadTree]);

  /* ------------------------------ open file ------------------------------ */

  const openFile = useCallback(
    async (node: FileNode) => {
      if (!projectId || node.type !== "FILE") return;
      setActivePath(node.path);

      // Already open? Just switch.
      if (tabs.some((t) => t.path === node.path)) return;

      const placeholder: OpenTab = {
        path: node.path,
        name: node.name,
        language: toMonacoLanguage(node.language, node.name),
        content: "",
        savedContent: "",
        loading: true,
        error: null,
      };
      setTabs((prev) => [...prev, placeholder]);

      try {
        const file = await getFileContent(projectId, node.path);
        setTabs((prev) =>
          prev.map((t) =>
            t.path === node.path
              ? {
                  ...t,
                  content: file.content,
                  savedContent: file.content,
                  language: toMonacoLanguage(file.language, node.name),
                  loading: false,
                }
              : t
          )
        );
      } catch (err) {
        const message =
          err instanceof ApiClientError ? err.message : "Failed to open file";
        setTabs((prev) =>
          prev.map((t) =>
            t.path === node.path ? { ...t, loading: false, error: message } : t
          )
        );
      }
    },
    [projectId, tabs]
  );

  const closeTab = useCallback(
    (path: string) => {
      const tab = tabs.find((t) => t.path === path);
      if (tab && tab.content !== tab.savedContent) {
        if (!window.confirm(`Close ${tab.path}? Unsaved changes will be lost.`)) {
          return;
        }
      }
      setTabs((prev) => {
        const next = prev.filter((t) => t.path !== path);
        if (activePath === path) {
          setActivePath(next.length ? next[next.length - 1].path : null);
        }
        return next;
      });
    },
    [activePath, tabs]
  );

  /* -------------------------------- save --------------------------------- */

  const saveActive = useCallback(async () => {
    if (!projectId || !activeTab) return;
    if (activeTab.content === activeTab.savedContent) return;

    const path = activeTab.path;
    setSaveStatus("saving");
    setSaveError(null);
    try {
      await saveFile(projectId, path, activeTab.content);
      setTabs((prev) =>
        prev.map((t) =>
          t.path === path ? { ...t, savedContent: t.content } : t
        )
      );
      setSaveStatus("saved");
      window.setTimeout(() => setSaveStatus("idle"), 1500);
    } catch (err) {
      setSaveStatus("error");
      const msg = err instanceof ApiClientError ? err.message : "Failed to save file";
      setSaveError(msg);
      addToast(msg, "error");
    }
  }, [projectId, activeTab, addToast]);

  // Auto-save with 2-second debounce
  const debouncedSave = useDebouncedCallback(() => {
    void saveActive();
  }, 2000);

  // Keep a ref so the global keydown handler always calls the latest save.
  const saveRef = useRef(saveActive);
  useEffect(() => {
    saveRef.current = saveActive;
  }, [saveActive]);

  // beforeunload warning for unsaved changes
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (hasDirtyTabs) {
        e.preventDefault();
        e.returnValue = "You have unsaved changes. Are you sure you want to leave?";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasDirtyTabs]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void saveRef.current();
      }
      // Ctrl+P quick open
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "p") {
        e.preventDefault();
        setQuickOpenVisible((v) => !v);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const onEditorChange = useCallback(
    (value: string | undefined) => {
      if (!activePath) return;
      setTabs((prev) =>
        prev.map((t) =>
          t.path === activePath ? { ...t, content: value ?? "" } : t
        )
      );
      // Trigger auto-save
      debouncedSave();
    },
    [activePath, debouncedSave]
  );

  /* ----------------------- Monaco onMount callback ----------------------- */

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleEditorMount = useCallback((editor: any, monaco: any) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    // Register inline AI completion provider
    if (aiEnabled) {
      providerDisposableRef.current?.dispose();
      const disposable = registerProvider(editor, monaco);
      if (disposable) providerDisposableRef.current = disposable;
    }
  }, [registerProvider, aiEnabled]);

  // Re-register provider when AI toggle changes
  useEffect(() => {
    if (editorRef.current && monacoRef.current) {
      providerDisposableRef.current?.dispose();
      providerDisposableRef.current = null;
      if (aiEnabled) {
        const disposable = registerProvider(editorRef.current, monacoRef.current);
        if (disposable) providerDisposableRef.current = disposable;
      }
    }
  }, [aiEnabled, registerProvider]);

  /* --------------------------- file operations --------------------------- */

  const handleNewFile = useCallback(
    async (parentPath: string, name?: string) => {
      if (!projectId) return;
      if (!name) {
        // Show inline input
        setInlineInput({ parentPath, type: "newFile" });
        return;
      }
      try {
        await createFileNode(projectId, {
          parentPath: parentPath || undefined,
          name,
          type: "FILE",
          content: "",
        });
        await loadTree();
      } catch (err) {
        addToast(
          err instanceof ApiClientError ? err.message : "Failed to create file",
          "error"
        );
      }
    },
    [projectId, loadTree, addToast]
  );

  const handleNewFolder = useCallback(
    async (parentPath: string, name?: string) => {
      if (!projectId) return;
      if (!name) {
        setInlineInput({ parentPath, type: "newFolder" });
        return;
      }
      try {
        await createFileNode(projectId, {
          parentPath: parentPath || undefined,
          name,
          type: "FOLDER",
        });
        await loadTree();
      } catch (err) {
        addToast(
          err instanceof ApiClientError ? err.message : "Failed to create folder",
          "error"
        );
      }
    },
    [projectId, loadTree, addToast]
  );

  const handleRename = useCallback(
    async (node: FileNode, newName?: string) => {
      if (!projectId) return;
      if (!newName) {
        setInlineInput({ parentPath: "", type: "rename", node });
        return;
      }
      if (newName === node.name) {
        setInlineInput(null);
        return;
      }
      const idx = node.path.lastIndexOf("/");
      const parent = idx >= 0 ? node.path.slice(0, idx) : "";
      const newPath = parent ? `${parent}/${newName}` : newName;
      try {
        await renameFileNode(projectId, node.path, newPath);
        setTabs((prev) =>
          prev.map((t) =>
            t.path === node.path ? { ...t, path: newPath, name: newName } : t
          )
        );
        setActivePath((p) => (p === node.path ? newPath : p));
        await loadTree();
      } catch (err) {
        addToast(
          err instanceof ApiClientError ? err.message : "Failed to rename",
          "error"
        );
      }
      setInlineInput(null);
    },
    [projectId, loadTree, addToast]
  );

  const handleDelete = useCallback(
    async (node: FileNode) => {
      if (!projectId) return;
      try {
        await deleteFileNode(projectId, node.path);
        setTabs((prev) =>
          prev.filter(
            (t) => t.path !== node.path && !t.path.startsWith(`${node.path}/`)
          )
        );
        setActivePath((p) =>
          p && (p === node.path || p.startsWith(`${node.path}/`)) ? null : p
        );
        await loadTree();
      } catch (err) {
        addToast(
          err instanceof ApiClientError ? err.message : "Failed to delete",
          "error"
        );
      }
      setDeleteConfirm(null);
    },
    [projectId, loadTree, addToast]
  );

  const openContext = useCallback((e: React.MouseEvent, node: FileNode) => {
    e.preventDefault();
    setContext({ x: e.clientX, y: e.clientY, node });
  }, []);

  useEffect(() => {
    if (!context) return;
    const close = () => setContext(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [context]);

  // Close settings dropdown on outside click
  useEffect(() => {
    if (!settingsOpen) return;
    const close = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-settings-dropdown]")) {
        setSettingsOpen(false);
      }
    };
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [settingsOpen]);

  /* ----------------------------- Play button ----------------------------- */

  const handlePlay = useCallback(() => {
    if (!showTerminal) setShowTerminal(true);
    // Focus terminal and it will be ready for input
    // The terminal handles commands via its own input
    addToast("Terminal opened — type your run command", "info");
  }, [showTerminal, addToast]);

  /* ----------------------------- Search bar ------------------------------ */

  const handleSearchTrigger = useCallback(() => {
    if (editorRef.current) {
      const action = editorRef.current.getAction("actions.find");
      if (action) {
        action.run();
        return;
      }
    }
    setSearchOpen((v) => !v);
  }, []);

  /* ----------------------------- flat files ------------------------------ */

  const flatFiles = useMemo(() => flattenTree(tree), [tree]);

  /* ------------------------------ empty state ---------------------------- */

  if (!projectLoading && !projectId) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 bg-surface text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-light text-accent">
          <FolderGit2 size={26} />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            No project selected
          </h2>
          <p className="mt-1 text-sm text-text-muted">
            Create or select a project to start editing.
          </p>
        </div>
        <Link
          href="/dashboard/projects"
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover"
        >
          Go to projects
        </Link>
      </div>
    );
  }

  const dirty = activeTab
    ? activeTab.content !== activeTab.savedContent
    : false;

  const monacoTheme = resolvedTheme === "dark" ? "vs-dark" : "vs";

  return (
    <div className="flex h-full flex-col bg-surface">
      {/* Top bar */}
      <div className="flex h-10 items-center justify-between border-b border-border bg-surface-soft px-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-sm text-text-muted">
            <GitBranch size={14} />
            <span className="text-xs font-medium">{gitBranch}</span>
          </div>
          <span className="text-xs text-text-muted">
            {activeProject?.name ?? "..."}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* Save indicator */}
          {saveStatus === "saving" && (
            <span className="flex items-center gap-1 text-[11px] text-text-muted">
              <Loader2 size={12} className="animate-spin" /> Saving
            </span>
          )}
          {saveStatus === "saved" && (
            <span className="flex items-center gap-1 text-[11px] text-green-600">
              <Check size={12} /> Saved
            </span>
          )}
          {saveStatus === "error" && (
            <span
              className="flex items-center gap-1 text-[11px] text-red-600"
              title={saveError ?? undefined}
            >
              <AlertCircle size={12} /> Save failed
            </span>
          )}
          <button
            onClick={() => void saveActive()}
            disabled={!dirty}
            className="rounded px-2 py-1 text-xs font-medium text-text-secondary hover:bg-surface-soft disabled:opacity-40"
            title="Save (Ctrl+S)"
          >
            Save
          </button>
          <div className="flex items-center gap-1">
            <button
              onClick={handleSearchTrigger}
              className="rounded p-1.5 text-text-muted hover:bg-surface-soft hover:text-text-secondary"
              title="Find in file"
            >
              <Search size={14} />
            </button>
            <button
              onClick={handlePlay}
              className="rounded p-1.5 text-text-muted hover:bg-surface-soft hover:text-text-secondary"
              title="Open terminal"
            >
              <Play size={14} />
            </button>
            <button
              onClick={() => setShowSplit(!showSplit)}
              className={`rounded p-1.5 ${showSplit ? "bg-surface-soft text-text-secondary" : "text-text-muted hover:bg-surface-soft hover:text-text-secondary"}`}
              title="Toggle split editor"
            >
              <Split size={14} />
            </button>
            <button
              onClick={() => setShowPreview(!showPreview)}
              className={`rounded p-1.5 ${showPreview ? "bg-surface-soft text-text-secondary" : "text-text-muted hover:bg-surface-soft hover:text-text-secondary"}`}
              title="Toggle preview"
            >
              <Globe size={14} />
            </button>
            <button
              onClick={() => setShowTerminal(!showTerminal)}
              className={`rounded p-1.5 ${showTerminal ? "bg-surface-soft text-text-secondary" : "text-text-muted hover:bg-surface-soft hover:text-text-secondary"}`}
              title="Toggle terminal"
            >
              <Terminal size={14} />
            </button>
            <button
              onClick={() => setAiEnabled(!aiEnabled)}
              className={`rounded p-1.5 ${aiEnabled ? "bg-purple-100 text-purple-600" : "text-text-muted hover:bg-surface-soft hover:text-text-secondary"}`}
              title={aiEnabled ? "AI completions enabled" : "AI completions disabled"}
            >
              <Sparkles size={14} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setSettingsOpen(!settingsOpen);
              }}
              className={`rounded p-1.5 ${settingsOpen ? "bg-surface-soft text-text-secondary" : "text-text-muted hover:bg-surface-soft hover:text-text-secondary"}`}
              title="Editor settings"
              data-settings-dropdown
            >
              <Settings size={14} />
            </button>
            {/* Undo last AI change */}
            {lastAppliedId && (
              <button
                onClick={() => void handleUndoLastChange()}
                disabled={undoBusy}
                className="flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-amber-600 hover:bg-amber-50 disabled:opacity-40"
                title="Undo last AI change"
              >
                <RotateCcw size={12} className={undoBusy ? "animate-spin" : ""} />
                Undo
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* File explorer */}
        <div className="flex w-56 flex-col border-r border-border bg-surface">
          <div className="flex h-9 items-center justify-between border-b border-border px-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
              Explorer
            </span>
            <div className="flex items-center gap-0.5">
              <button
                onClick={() => void handleNewFile("")}
                className="rounded p-1 text-text-muted hover:bg-surface-soft hover:text-text-secondary"
                title="New file"
              >
                <FilePlus size={12} />
              </button>
              <button
                onClick={() => void handleNewFolder("")}
                className="rounded p-1 text-text-muted hover:bg-surface-soft hover:text-text-secondary"
                title="New folder"
              >
                <FolderPlus size={12} />
              </button>
              <button
                onClick={() => void loadTree()}
                className="rounded p-1 text-text-muted hover:bg-surface-soft hover:text-text-secondary"
                title="Refresh"
              >
                <RefreshCw size={12} />
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto py-1">
            {treeLoading && tree.length === 0 ? (
              <div className="space-y-1.5 px-3 py-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-4 animate-pulse rounded bg-surface-soft"
                    style={{ width: `${60 + ((i * 13) % 35)}%` }}
                  />
                ))}
              </div>
            ) : treeError ? (
              <div className="px-3 py-4 text-center">
                <p className="text-xs text-red-600">{treeError}</p>
                <button
                  onClick={() => void loadTree()}
                  className="mt-2 rounded border border-border px-2 py-1 text-xs text-text-secondary hover:bg-surface-soft"
                >
                  Retry
                </button>
              </div>
            ) : tree.length === 0 ? (
              <p className="px-3 py-4 text-center text-xs text-text-muted">
                No files yet. Use the + buttons above.
              </p>
            ) : (
              <>
                {tree.map((node) => (
                  <FileTreeItem
                    key={node.id}
                    node={node}
                    depth={0}
                    onSelect={openFile}
                    selectedPath={activePath}
                    onContext={openContext}
                    inlineInput={
                      inlineInput?.type === "rename" && inlineInput.node
                        ? {
                            parentPath: inlineInput.parentPath,
                            type: "rename",
                            node: inlineInput.node,
                            onSubmit: (val) => void handleRename(inlineInput.node!, val),
                            onCancel: () => setInlineInput(null),
                          }
                        : null
                    }
                  />
                ))}
                {/* Inline input for new file/folder at root */}
                {inlineInput && inlineInput.type !== "rename" && inlineInput.parentPath === "" && (
                  <div className="flex items-center gap-1 py-1 pl-[22px] pr-2">
                    {inlineInput.type === "newFile" ? (
                      <FileIcon size={14} className="shrink-0 text-text-muted" />
                    ) : (
                      <Folder size={14} className="shrink-0 text-amber-500" />
                    )}
                    <InlineInput
                      placeholder={inlineInput.type === "newFile" ? "filename" : "folder name"}
                      onSubmit={(val) => {
                        if (inlineInput.type === "newFile") {
                          void handleNewFile(inlineInput.parentPath, val);
                        } else {
                          void handleNewFolder(inlineInput.parentPath, val);
                        }
                        setInlineInput(null);
                      }}
                      onCancel={() => setInlineInput(null)}
                    />
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Editor area */}
        <div className={`flex flex-col overflow-hidden ${showPreview ? "w-1/2" : "flex-1"}`}>
          {/* Tabs */}
          <div className="flex h-9 items-center overflow-x-auto border-b border-border bg-surface-soft">
            {tabs.map((tab) => {
              const tabDirty = tab.content !== tab.savedContent;
              return (
                <div
                  key={tab.path}
                  onClick={() => setActivePath(tab.path)}
                  className={`group flex h-full cursor-pointer items-center gap-2 border-r border-border px-3 text-[13px] ${
                    activePath === tab.path
                      ? "border-b-2 border-b-accent bg-surface text-foreground"
                      : "text-text-muted hover:bg-surface-soft"
                  }`}
                >
                  <FileIcon size={12} className="text-accent" />
                  <span>{tab.name}</span>
                  {tabDirty ? (
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-ink-muted" />
                  ) : null}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (tabDirty) {
                        // Save before closing
                        void saveActive().then(() => closeTab(tab.path));
                      } else {
                        closeTab(tab.path);
                      }
                    }}
                    className={`rounded p-0.5 hover:bg-surface-soft ${
                      tabDirty ? "" : "opacity-0 group-hover:opacity-100"
                    }`}
                  >
                    <X size={10} />
                  </button>
                </div>
              );
            })}
          </div>

          {/* Code area + terminal */}
          <div className="flex flex-1 flex-col overflow-hidden">
            {/* Monaco editor(s) */}
            <div className="relative flex flex-1 overflow-hidden">
              {/* Primary editor */}
              <div className={`flex-1 overflow-hidden ${showSplit ? "border-r border-border" : ""}`}>
                {activeTab ? (
                  activeTab.loading ? (
                    <div className="flex h-full items-center justify-center text-sm text-text-muted">
                      <Loader2 size={16} className="mr-2 animate-spin" />
                      Loading file...
                    </div>
                  ) : activeTab.error ? (
                    <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-red-600">
                      <AlertCircle size={20} />
                      {activeTab.error}
                    </div>
                  ) : (
                    <MonacoEditor
                      height="100%"
                      theme={monacoTheme}
                      path={activeTab.path}
                      language={activeTab.language}
                      value={activeTab.content}
                      onChange={onEditorChange}
                      onMount={handleEditorMount}
                      options={{
                        fontSize: editorSettings.fontSize,
                        minimap: { enabled: editorSettings.minimap },
                        wordWrap: editorSettings.wordWrap,
                        scrollBeyondLastLine: false,
                        automaticLayout: true,
                        tabSize: 2,
                        fontFamily:
                          "ui-monospace, SFMono-Regular, Menlo, Monaco, monospace",
                      }}
                    />
                  )
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-text-muted">
                    Select a file to view
                  </div>
                )}
              </div>

              {/* Split editor (second pane) */}
              {showSplit && (
                <div className="flex-1 overflow-hidden">
                  {activeTab && !activeTab.loading && !activeTab.error ? (
                    <MonacoEditor
                      height="100%"
                      theme={monacoTheme}
                      path={`split-${activeTab.path}`}
                      language={activeTab.language}
                      value={activeTab.content}
                      onChange={onEditorChange}
                      options={{
                        fontSize: editorSettings.fontSize,
                        minimap: { enabled: editorSettings.minimap },
                        wordWrap: editorSettings.wordWrap,
                        scrollBeyondLastLine: false,
                        automaticLayout: true,
                        tabSize: 2,
                        fontFamily:
                          "ui-monospace, SFMono-Regular, Menlo, Monaco, monospace",
                      }}
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-text-muted">
                      Open a file to split
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Terminal panel */}
            {showTerminal && (
              <div className="flex flex-col border-t border-border">
                <div className="flex h-8 items-center justify-between bg-editor-bg px-3">
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] font-medium text-text-muted">
                      TERMINAL
                    </span>
                    <span className="text-[11px] text-text-secondary">PROBLEMS</span>
                    <span className="text-[11px] text-text-secondary">OUTPUT</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button className="rounded p-1 text-text-muted hover:text-text-muted">
                      <Plus size={12} />
                    </button>
                    <button className="rounded p-1 text-text-muted hover:text-text-muted">
                      <Copy size={12} />
                    </button>
                    <button className="rounded p-1 text-text-muted hover:text-text-muted">
                      <Maximize2 size={12} />
                    </button>
                    <button
                      onClick={() => setShowTerminal(false)}
                      className="rounded p-1 text-text-muted hover:text-text-muted"
                    >
                      <X size={12} />
                    </button>
                  </div>
                </div>
                <div className="h-36 overflow-hidden bg-editor-bg">
                  {terminalSession ? (
                    <XtermTerminal
                      sessionId={terminalSession.id}
                      initialCwd={terminalSession.cwd || ""}
                      active={showTerminal}
                      onRegister={() => {}}
                    />
                  ) : terminalLoading ? (
                    <div className="flex h-full items-center justify-center text-sm text-text-muted">
                      <Loader2 size={14} className="mr-2 animate-spin" />
                      Starting terminal...
                    </div>
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-text-muted">
                      Terminal unavailable
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Preview panel */}
        {showPreview && (
          <div className="w-1/2">
            <PreviewPanel
              defaultUrl="http://localhost:3000"
              onClose={() => setShowPreview(false)}
            />
          </div>
        )}
      </div>

      {/* Status bar */}
      <div className="flex h-6 items-center justify-between border-t border-border bg-surface-soft px-3 text-[11px] text-text-muted">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <GitBranch size={11} /> {gitBranch}
          </span>
          <span>{dirty ? "Unsaved changes" : "All changes saved"}</span>
          {aiEnabled && (
            <span className="flex items-center gap-1 text-purple-500">
              <Sparkles size={10} /> AI
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span>{activeTab ? activeTab.language : "-"}</span>
          <span>UTF-8</span>
          <span>Spaces: 2</span>
        </div>
      </div>

      {/* Context menu */}
      {context && (
        <div
          className="fixed z-50 w-44 overflow-hidden rounded-lg border border-border bg-surface py-1 shadow-xl"
          style={{ top: context.y, left: context.x }}
          onClick={(e) => e.stopPropagation()}
        >
          {context.node.type === "FOLDER" && (
            <>
              <button
                onClick={() => {
                  const path = context.node.path;
                  setContext(null);
                  setInlineInput({ parentPath: path, type: "newFile" });
                }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-text-secondary hover:bg-surface-soft"
              >
                <FilePlus size={14} className="text-text-muted" /> New file
              </button>
              <button
                onClick={() => {
                  const path = context.node.path;
                  setContext(null);
                  setInlineInput({ parentPath: path, type: "newFolder" });
                }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-text-secondary hover:bg-surface-soft"
              >
                <FolderPlus size={14} className="text-text-muted" /> New folder
              </button>
              <div className="my-1 h-px bg-surface-soft" />
            </>
          )}
          <button
            onClick={() => {
              const node = context.node;
              setContext(null);
              void handleRename(node);
            }}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-text-secondary hover:bg-surface-soft"
          >
            <Pencil size={14} className="text-text-muted" /> Rename
          </button>
          <button
            onClick={(e) => {
              const node = context.node;
              const pos = { x: e.clientX, y: e.clientY };
              setContext(null);
              setDeleteConfirm({ node, position: pos });
            }}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-red-600 hover:bg-red-50"
          >
            <Trash2 size={14} /> Delete
          </button>
        </div>
      )}

      {/* Delete confirmation popover */}
      {deleteConfirm && (
        <ConfirmPopover
          message={`Delete "${deleteConfirm.node.name}"? This cannot be undone.`}
          onConfirm={() => void handleDelete(deleteConfirm.node)}
          onCancel={() => setDeleteConfirm(null)}
          position={deleteConfirm.position}
        />
      )}

      {/* Settings dropdown */}
      {settingsOpen && (
        <div data-settings-dropdown>
          <SettingsDropdown
            settings={editorSettings}
            onChange={setEditorSettings}
            onClose={() => setSettingsOpen(false)}
            theme={theme}
            onThemeChange={setTheme}
          />
        </div>
      )}

      {/* Quick Open modal (Ctrl+P) */}
      {quickOpenVisible && (
        <QuickOpenModal
          files={flatFiles}
          onSelect={(node) => void openFile(node)}
          onClose={() => setQuickOpenVisible(false)}
        />
      )}

      {/* Toast notifications */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
