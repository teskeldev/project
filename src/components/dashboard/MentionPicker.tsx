"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import {
  File,
  Folder,
  Globe,
  Database,
  X,
  Search,
  ChevronRight,
} from "lucide-react";
import { getFileTree, type FileNode } from "@/lib/client/api";

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

export type MentionType = "file" | "folder" | "web" | "codebase";

export type MentionChip = {
  id: string;
  type: MentionType;
  label: string;
  path: string; // file/folder path, URL, or "@codebase"
};

type MentionPickerProps = {
  projectId: string;
  visible: boolean;
  filter: string;
  onSelect: (chip: MentionChip) => void;
  onClose: () => void;
};

/* -------------------------------------------------------------------------- */
/* Mention options                                                            */
/* -------------------------------------------------------------------------- */

const MENTION_OPTIONS: { type: MentionType; label: string; icon: typeof File }[] = [
  { type: "file", label: "@file — Pick a file", icon: File },
  { type: "folder", label: "@folder — Pick a folder", icon: Folder },
  { type: "web", label: "@web — Fetch a URL", icon: Globe },
  { type: "codebase", label: "@codebase — Full project context", icon: Database },
];

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function flattenTree(nodes: FileNode[], type: "FILE" | "FOLDER"): { path: string; name: string }[] {
  const result: { path: string; name: string }[] = [];
  function walk(node: FileNode) {
    if (node.type === type) {
      result.push({ path: node.path, name: node.name });
    }
    if (node.children) {
      for (const child of node.children) walk(child);
    }
  }
  for (const n of nodes) walk(n);
  return result;
}

/* -------------------------------------------------------------------------- */
/* Component                                                                  */
/* -------------------------------------------------------------------------- */

export function MentionPicker({ projectId, visible, filter, onSelect, onClose }: MentionPickerProps) {
  const [stage, setStage] = useState<"menu" | "file" | "folder" | "web">("menu");
  const pickerId = useId();
  const [tree, setTree] = useState<FileNode[]>([]);
  const [treeLoading, setTreeLoading] = useState(false);
  const [fileFilter, setFileFilter] = useState("");
  const [urlInput, setUrlInput] = useState("");
  const treeLoadedRef = useRef(false);

  // Load file tree when needed
  const loadTree = useCallback(async () => {
    if (treeLoadedRef.current || treeLoading) return;
    setTreeLoading(true);
    try {
      const { tree: t } = await getFileTree(projectId);
      setTree(t);
      treeLoadedRef.current = true;
    } catch {
      // Non-fatal
    } finally {
      setTreeLoading(false);
    }
  }, [projectId, treeLoading]);

  // Reset stage when picker becomes visible
  useEffect(() => {
    if (visible) {
      setStage("menu");
      setFileFilter("");
      setUrlInput("");
      treeLoadedRef.current = false;
    }
  }, [visible]);

  // Filter the top-level menu options
  const filteredOptions = useMemo(() => {
    const f = filter.toLowerCase().replace("@", "");
    return MENTION_OPTIONS.filter((o) => o.type.includes(f) || o.label.toLowerCase().includes(f));
  }, [filter]);

  const files = useMemo(() => flattenTree(tree, "FILE"), [tree]);
  const folders = useMemo(() => flattenTree(tree, "FOLDER"), [tree]);

  const filteredFiles = useMemo(() => {
    if (!fileFilter) return files.slice(0, 20);
    const f = fileFilter.toLowerCase();
    return files.filter((n) => n.path.toLowerCase().includes(f)).slice(0, 20);
  }, [files, fileFilter]);

  const filteredFolders = useMemo(() => {
    if (!fileFilter) return folders.slice(0, 20);
    const f = fileFilter.toLowerCase();
    return folders.filter((n) => n.path.toLowerCase().includes(f)).slice(0, 20);
  }, [folders, fileFilter]);

  if (!visible) return null;

  const handleOptionClick = (type: MentionType) => {
    if (type === "codebase") {
      onSelect({
        id: `mention-codebase-${pickerId}`,
        type: "codebase",
        label: "@codebase",
        path: "@codebase",
      });
      onClose();
      return;
    }
    if (type === "web") {
      setStage("web");
      return;
    }
    if (type === "file") {
      setStage("file");
      void loadTree();
      return;
    }
    if (type === "folder") {
      setStage("folder");
      void loadTree();
      return;
    }
  };

  const handleFileSelect = (path: string) => {
    onSelect({
      id: `mention-file-${pickerId}-${path}`,
      type: "file",
      label: path.split("/").pop() || path,
      path,
    });
    onClose();
  };

  const handleFolderSelect = (path: string) => {
    onSelect({
      id: `mention-folder-${pickerId}-${path}`,
      type: "folder",
      label: path,
      path,
    });
    onClose();
  };

  const handleWebSubmit = () => {
    const url = urlInput.trim();
    if (!url) return;
    onSelect({
      id: `mention-web-${Date.now()}`,
      type: "web",
      label: url.length > 30 ? url.slice(0, 30) + "..." : url,
      path: url,
    });
    setUrlInput("");
    onClose();
  };

  return (
    <div className="absolute bottom-full left-0 mb-2 w-full max-h-64 overflow-y-auto rounded-lg border border-border bg-surface py-1 shadow-lg z-50">
      {stage === "menu" && (
        <>
          <div className="px-3 py-1.5 text-[10px] font-medium uppercase tracking-wider text-text-muted">
            Mention context
          </div>
          <div role="listbox" aria-label="Mention type options">
            {filteredOptions.map((opt) => {
              const Icon = opt.icon;
              return (
                <button
                  key={opt.type}
                  type="button"
                  role="option"
                  aria-selected={false}
                  aria-label={`Select ${opt.type} mention`}
                  onClick={() => handleOptionClick(opt.type)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-surface-soft"
                >
                  <Icon size={14} className="text-text-muted" />
                  <span className="text-xs text-text-secondary">{opt.label}</span>
                  {(opt.type === "file" || opt.type === "folder") && (
                    <ChevronRight size={12} className="ml-auto text-text-muted" />
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}

      {(stage === "file" || stage === "folder") && (
        <>
          <div className="flex items-center gap-2 border-b border-border px-3 py-2">
            <Search size={12} className="text-text-muted" />
            <input
              type="text"
              value={fileFilter}
              onChange={(e) => setFileFilter(e.target.value)}
              placeholder={`Search ${stage}s...`}
              aria-label={`Search ${stage}s`}
              className="flex-1 bg-transparent text-xs text-text-secondary placeholder:text-text-muted focus:outline-none"
              autoFocus
            />
            <button
              type="button"
              onClick={onClose}
              aria-label="Close picker"
              className="text-text-muted hover:text-text-secondary"
            >
              <X size={12} />
            </button>
          </div>
          {treeLoading ? (
            <div className="px-3 py-3 text-xs text-text-muted">Loading...</div>
          ) : (
            <div className="max-h-48 overflow-y-auto" role="listbox" aria-label={`${stage} list`}>
              {(stage === "file" ? filteredFiles : filteredFolders).map((item) => (
                <button
                  key={item.path}
                  type="button"
                  role="option"
                  aria-selected={false}
                  aria-label={`Select ${stage}: ${item.path}`}
                  onClick={() =>
                    stage === "file"
                      ? handleFileSelect(item.path)
                      : handleFolderSelect(item.path)
                  }
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-surface-soft"
                >
                  {stage === "file" ? (
                    <File size={12} className="text-text-muted" />
                  ) : (
                    <Folder size={12} className="text-amber-400" />
                  )}
                  <span className="truncate text-text-secondary">{item.path}</span>
                </button>
              ))}
              {(stage === "file" ? filteredFiles : filteredFolders).length === 0 && (
                <p className="px-3 py-2 text-xs text-text-muted">No results</p>
              )}
            </div>
          )}
        </>
      )}

      {stage === "web" && (
        <div className="px-3 py-2">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium text-text-secondary">Enter URL</span>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close picker"
              className="text-text-muted hover:text-text-secondary"
            >
              <X size={12} />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <Globe size={12} className="text-text-muted" />
            <input
              type="url"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleWebSubmit();
                }
              }}
              placeholder="https://..."
              aria-label="URL input"
              className="flex-1 rounded border border-border bg-surface px-2 py-1 text-xs text-text-secondary placeholder:text-text-muted focus:border-accent focus:outline-none"
              autoFocus
            />
            <button
              type="button"
              onClick={handleWebSubmit}
              disabled={!urlInput.trim()}
              aria-label="Add URL mention"
              className="rounded bg-accent px-2 py-1 text-xs font-medium text-white hover:bg-accent-hover disabled:opacity-40"
            >
              Add
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Chips display                                                              */
/* -------------------------------------------------------------------------- */

export function MentionChips({
  chips,
  onRemove,
}: {
  chips: MentionChip[];
  onRemove: (id: string) => void;
}) {
  if (chips.length === 0) return null;

  const iconForType = (type: MentionType) => {
    switch (type) {
      case "file":
        return <File size={10} className="text-accent" />;
      case "folder":
        return <Folder size={10} className="text-amber-500" />;
      case "web":
        return <Globe size={10} className="text-green-500" />;
      case "codebase":
        return <Database size={10} className="text-purple-500" />;
    }
  };

  return (
    <div className="mb-2 flex flex-wrap gap-1.5">
      {chips.map((chip) => (
        <span
          key={chip.id}
          className="inline-flex items-center gap-1 rounded-full border border-border bg-surface-soft px-2 py-0.5 text-[11px] text-text-secondary"
        >
          {iconForType(chip.type)}
          <span className="max-w-[120px] truncate">{chip.label}</span>
          <button
            type="button"
            onClick={() => onRemove(chip.id)}
            aria-label={`Remove ${chip.label} mention`}
            className="ml-0.5 text-text-muted hover:text-text-secondary"
          >
            <X size={10} />
          </button>
        </span>
      ))}
    </div>
  );
}
