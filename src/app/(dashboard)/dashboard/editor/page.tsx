"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useProject } from "@/lib/store/project";
import {
  getFileTree,
  getFileContent,
  saveFile,
  createFileNode,
  renameFileNode,
  deleteFileNode,
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
} from "lucide-react";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-sm text-gray-400">
      <Loader2 size={16} className="mr-2 animate-spin" />
      Loading editor...
    </div>
  ),
});

/** Map a filename extension to a Monaco language id (fallback). */
function languageFromName(name: string): string {
  const ext = name.includes(".") ? name.slice(name.lastIndexOf(".") + 1).toLowerCase() : "";
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
  typescript: "text-blue-500",
  javascript: "text-yellow-500",
  css: "text-purple-500",
  scss: "text-purple-500",
  json: "text-yellow-600",
  markdown: "text-gray-500",
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
/* File tree                                                                  */
/* -------------------------------------------------------------------------- */

function FileTreeItem({
  node,
  depth,
  onSelect,
  selectedPath,
  onContext,
}: {
  node: FileNode;
  depth: number;
  onSelect: (node: FileNode) => void;
  selectedPath: string | null;
  onContext: (
    e: React.MouseEvent,
    node: FileNode
  ) => void;
}) {
  const [expanded, setExpanded] = useState(depth === 0);

  if (node.type === "FOLDER") {
    return (
      <div>
        <button
          onClick={() => setExpanded(!expanded)}
          onContextMenu={(e) => onContext(e, node)}
          className="flex w-full items-center gap-1 py-1 pr-2 text-left text-[13px] text-gray-600 hover:bg-gray-100"
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
        >
          {expanded ? (
            <ChevronDown size={14} className="shrink-0 text-gray-400" />
          ) : (
            <ChevronRight size={14} className="shrink-0 text-gray-400" />
          )}
          {expanded ? (
            <FolderOpen size={14} className="shrink-0 text-amber-500" />
          ) : (
            <Folder size={14} className="shrink-0 text-amber-500" />
          )}
          <span className="ml-1 truncate">{node.name}</span>
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
          ? "bg-blue-50 text-gray-900"
          : "text-gray-600 hover:bg-gray-100"
      }`}
      style={{ paddingLeft: `${depth * 12 + 22}px` }}
    >
      <FileIcon
        size={14}
        className={`shrink-0 ${fileLangColor[lang] || "text-gray-400"}`}
      />
      <span className="ml-1 truncate">{node.name}</span>
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
/* Editor page                                                                */
/* -------------------------------------------------------------------------- */

export default function EditorPage() {
  const { activeProject, loading: projectLoading } = useProject();
  const projectId = activeProject?.id ?? null;

  const [tree, setTree] = useState<FileNode[]>([]);
  const [treeLoading, setTreeLoading] = useState(false);
  const [treeError, setTreeError] = useState<string | null>(null);

  const [tabs, setTabs] = useState<OpenTab[]>([]);
  const [activePath, setActivePath] = useState<string | null>(null);

  const [showTerminal, setShowTerminal] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [context, setContext] = useState<ContextState>(null);

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
    if (projectId) void loadTree();
  }, [projectId, loadTree]);

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
      setTabs((prev) => {
        const next = prev.filter((t) => t.path !== path);
        if (activePath === path) {
          setActivePath(next.length ? next[next.length - 1].path : null);
        }
        return next;
      });
    },
    [activePath]
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
      setSaveError(
        err instanceof ApiClientError ? err.message : "Failed to save file"
      );
    }
  }, [projectId, activeTab]);

  // Keep a ref so the global keydown handler always calls the latest save.
  const saveRef = useRef(saveActive);
  useEffect(() => {
    saveRef.current = saveActive;
  }, [saveActive]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void saveRef.current();
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
    },
    [activePath]
  );

  /* --------------------------- file operations --------------------------- */

  const handleNewFile = useCallback(
    async (parentPath: string) => {
      if (!projectId) return;
      const name = window.prompt("New file name");
      if (!name) return;
      try {
        await createFileNode(projectId, {
          parentPath: parentPath || undefined,
          name,
          type: "FILE",
          content: "",
        });
        await loadTree();
      } catch (err) {
        window.alert(
          err instanceof ApiClientError ? err.message : "Failed to create file"
        );
      }
    },
    [projectId, loadTree]
  );

  const handleNewFolder = useCallback(
    async (parentPath: string) => {
      if (!projectId) return;
      const name = window.prompt("New folder name");
      if (!name) return;
      try {
        await createFileNode(projectId, {
          parentPath: parentPath || undefined,
          name,
          type: "FOLDER",
        });
        await loadTree();
      } catch (err) {
        window.alert(
          err instanceof ApiClientError
            ? err.message
            : "Failed to create folder"
        );
      }
    },
    [projectId, loadTree]
  );

  const handleRename = useCallback(
    async (node: FileNode) => {
      if (!projectId) return;
      const newName = window.prompt("Rename to", node.name);
      if (!newName || newName === node.name) return;
      const idx = node.path.lastIndexOf("/");
      const parent = idx >= 0 ? node.path.slice(0, idx) : "";
      const newPath = parent ? `${parent}/${newName}` : newName;
      try {
        await renameFileNode(projectId, node.path, newPath);
        // Update any open tab pointing at the old path.
        setTabs((prev) =>
          prev.map((t) =>
            t.path === node.path
              ? { ...t, path: newPath, name: newName }
              : t
          )
        );
        setActivePath((p) => (p === node.path ? newPath : p));
        await loadTree();
      } catch (err) {
        window.alert(
          err instanceof ApiClientError ? err.message : "Failed to rename"
        );
      }
    },
    [projectId, loadTree]
  );

  const handleDelete = useCallback(
    async (node: FileNode) => {
      if (!projectId) return;
      const ok = window.confirm(
        `Delete "${node.name}"? This cannot be undone.`
      );
      if (!ok) return;
      try {
        await deleteFileNode(projectId, node.path);
        // Close any tabs under the deleted path.
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
        window.alert(
          err instanceof ApiClientError ? err.message : "Failed to delete"
        );
      }
    },
    [projectId, loadTree]
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

  /* ------------------------------ empty state ---------------------------- */

  if (!projectLoading && !projectId) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 bg-white text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
          <FolderGit2 size={26} />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            No project selected
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Create or select a project to start editing.
          </p>
        </div>
        <Link
          href="/dashboard/projects"
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
        >
          Go to projects
        </Link>
      </div>
    );
  }

  const dirty = activeTab
    ? activeTab.content !== activeTab.savedContent
    : false;

  return (
    <div className="flex h-full flex-col bg-white">
      {/* Top bar */}
      <div className="flex h-10 items-center justify-between border-b border-gray-200 bg-gray-50 px-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-sm text-gray-500">
            <GitBranch size={14} />
            <span className="text-xs font-medium">main</span>
          </div>
          <span className="text-xs text-gray-400">
            {activeProject?.name ?? "..."}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* Save indicator */}
          {saveStatus === "saving" && (
            <span className="flex items-center gap-1 text-[11px] text-gray-400">
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
            className="rounded px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-200 disabled:opacity-40"
            title="Save (Ctrl+S)"
          >
            Save
          </button>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setSearchOpen(!searchOpen)}
              className="rounded p-1.5 text-gray-400 hover:bg-gray-200 hover:text-gray-600"
            >
              <Search size={14} />
            </button>
            <button className="rounded p-1.5 text-gray-400 hover:bg-gray-200 hover:text-gray-600">
              <Play size={14} />
            </button>
            <button className="rounded p-1.5 text-gray-400 hover:bg-gray-200 hover:text-gray-600">
              <Split size={14} />
            </button>
            <button
              onClick={() => setShowTerminal(!showTerminal)}
              className={`rounded p-1.5 ${showTerminal ? "bg-gray-200 text-gray-700" : "text-gray-400 hover:bg-gray-200 hover:text-gray-600"}`}
            >
              <Terminal size={14} />
            </button>
            <button className="rounded p-1.5 text-gray-400 hover:bg-gray-200 hover:text-gray-600">
              <Settings size={14} />
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* File explorer */}
        <div className="flex w-56 flex-col border-r border-gray-200 bg-white">
          <div className="flex h-9 items-center justify-between border-b border-gray-100 px-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Explorer
            </span>
            <div className="flex items-center gap-0.5">
              <button
                onClick={() => void handleNewFile("")}
                className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                title="New file"
              >
                <FilePlus size={12} />
              </button>
              <button
                onClick={() => void handleNewFolder("")}
                className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                title="New folder"
              >
                <FolderPlus size={12} />
              </button>
              <button
                onClick={() => void loadTree()}
                className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
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
                    className="h-4 animate-pulse rounded bg-gray-100"
                    style={{ width: `${60 + ((i * 13) % 35)}%` }}
                  />
                ))}
              </div>
            ) : treeError ? (
              <div className="px-3 py-4 text-center">
                <p className="text-xs text-red-600">{treeError}</p>
                <button
                  onClick={() => void loadTree()}
                  className="mt-2 rounded border border-gray-200 px-2 py-1 text-xs text-gray-600 hover:bg-gray-100"
                >
                  Retry
                </button>
              </div>
            ) : tree.length === 0 ? (
              <p className="px-3 py-4 text-center text-xs text-gray-400">
                No files yet. Use the + buttons above.
              </p>
            ) : (
              tree.map((node) => (
                <FileTreeItem
                  key={node.id}
                  node={node}
                  depth={0}
                  onSelect={openFile}
                  selectedPath={activePath}
                  onContext={openContext}
                />
              ))
            )}
          </div>
        </div>

        {/* Editor area */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Tabs */}
          <div className="flex h-9 items-center overflow-x-auto border-b border-gray-200 bg-gray-50">
            {tabs.map((tab) => {
              const tabDirty = tab.content !== tab.savedContent;
              return (
                <div
                  key={tab.path}
                  onClick={() => setActivePath(tab.path)}
                  className={`group flex h-full cursor-pointer items-center gap-2 border-r border-gray-200 px-3 text-[13px] ${
                    activePath === tab.path
                      ? "border-b-2 border-b-blue-500 bg-white text-gray-900"
                      : "text-gray-500 hover:bg-gray-100"
                  }`}
                >
                  <FileIcon size={12} className="text-blue-500" />
                  <span>{tab.name}</span>
                  {tabDirty ? (
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-gray-400" />
                  ) : null}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      closeTab(tab.path);
                    }}
                    className={`rounded p-0.5 hover:bg-gray-200 ${
                      tabDirty ? "" : "opacity-0 group-hover:opacity-100"
                    }`}
                  >
                    <X size={10} />
                  </button>
                </div>
              );
            })}
          </div>

          {/* Search bar */}
          {searchOpen && (
            <div className="flex items-center gap-2 border-b border-gray-200 bg-gray-50 px-3 py-2">
              <Search size={14} className="text-gray-400" />
              <input
                type="text"
                placeholder="Search in file..."
                className="flex-1 bg-transparent text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none"
                autoFocus
              />
              <button
                onClick={() => setSearchOpen(false)}
                className="rounded p-1 text-gray-400 hover:bg-gray-200"
              >
                <X size={12} />
              </button>
            </div>
          )}

          {/* Code area + terminal */}
          <div className="flex flex-1 flex-col overflow-hidden">
            {/* Monaco editor */}
            <div className="relative flex-1 overflow-hidden">
              {activeTab ? (
                activeTab.loading ? (
                  <div className="flex h-full items-center justify-center text-sm text-gray-400">
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
                    theme="vs"
                    path={activeTab.path}
                    language={activeTab.language}
                    value={activeTab.content}
                    onChange={onEditorChange}
                    options={{
                      fontSize: 13,
                      minimap: { enabled: true },
                      scrollBeyondLastLine: false,
                      automaticLayout: true,
                      tabSize: 2,
                      fontFamily:
                        "ui-monospace, SFMono-Regular, Menlo, Monaco, monospace",
                    }}
                  />
                )
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-gray-400">
                  Select a file to view
                </div>
              )}
            </div>

            {/* Terminal (placeholder) */}
            {showTerminal && (
              <div className="flex flex-col border-t border-gray-200">
                <div className="flex h-8 items-center justify-between bg-gray-950 px-3">
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] font-medium text-gray-400">
                      TERMINAL
                    </span>
                    <span className="text-[11px] text-gray-600">PROBLEMS</span>
                    <span className="text-[11px] text-gray-600">OUTPUT</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button className="rounded p-1 text-gray-500 hover:text-gray-300">
                      <Plus size={12} />
                    </button>
                    <button className="rounded p-1 text-gray-500 hover:text-gray-300">
                      <Copy size={12} />
                    </button>
                    <button className="rounded p-1 text-gray-500 hover:text-gray-300">
                      <Maximize2 size={12} />
                    </button>
                    <button
                      onClick={() => setShowTerminal(false)}
                      className="rounded p-1 text-gray-500 hover:text-gray-300"
                    >
                      <X size={12} />
                    </button>
                  </div>
                </div>
                {/* TODO: real terminal (Phase 5) */}
                <div className="h-36 overflow-auto bg-gray-950 p-3 font-mono text-[13px] text-gray-300">
                  <div className="text-gray-500">
                    Terminal integration coming in a later phase.
                  </div>
                  <div className="mt-2 flex items-center">
                    <span className="text-blue-400">~/{activeProject?.slug ?? "project"} $</span>
                    <span className="ml-1 inline-block h-4 w-1.5 animate-pulse bg-gray-500" />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Status bar */}
      <div className="flex h-6 items-center justify-between border-t border-gray-200 bg-gray-50 px-3 text-[11px] text-gray-500">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <GitBranch size={11} /> main
          </span>
          <span>{dirty ? "Unsaved changes" : "All changes saved"}</span>
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
          className="fixed z-50 w-44 overflow-hidden rounded-lg border border-gray-200 bg-white py-1 shadow-xl"
          style={{ top: context.y, left: context.x }}
          onClick={(e) => e.stopPropagation()}
        >
          {context.node.type === "FOLDER" && (
            <>
              <button
                onClick={() => {
                  setContext(null);
                  void handleNewFile(context.node.path);
                }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-100"
              >
                <FilePlus size={14} className="text-gray-400" /> New file
              </button>
              <button
                onClick={() => {
                  setContext(null);
                  void handleNewFolder(context.node.path);
                }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-100"
              >
                <FolderPlus size={14} className="text-gray-400" /> New folder
              </button>
              <div className="my-1 h-px bg-gray-100" />
            </>
          )}
          <button
            onClick={() => {
              const node = context.node;
              setContext(null);
              void handleRename(node);
            }}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-100"
          >
            <Pencil size={14} className="text-gray-400" /> Rename
          </button>
          <button
            onClick={() => {
              const node = context.node;
              setContext(null);
              void handleDelete(node);
            }}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-red-600 hover:bg-red-50"
          >
            <Trash2 size={14} /> Delete
          </button>
        </div>
      )}
    </div>
  );
}
