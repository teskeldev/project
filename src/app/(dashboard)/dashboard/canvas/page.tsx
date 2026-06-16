"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Bold,
  Italic,
  Code,
  Download,
  Sparkles,
  Plus,
  Trash2,
  FileText,
  Loader2,
  Check,
} from "lucide-react";
import { useProject } from "@/lib/store/project";
import {
  listDocuments,
  getDocument,
  createDocument,
  updateDocument,
  deleteDocument,
  type DocumentListItem,
  type Document,
} from "@/lib/client/canvas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type SaveStatus = "idle" | "saving" | "saved" | "error";

export default function CanvasPage() {
  const { activeProject } = useProject();
  const projectId = activeProject?.id ?? null;
  const [documents, setDocuments] = useState<DocumentListItem[]>([]);
  const [activeDoc, setActiveDoc] = useState<Document | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [content, setContent] = useState("");
  const [title, setTitle] = useState("");

  const dirtyRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Fetch document list
  const fetchDocuments = useCallback(async () => {
    if (!projectId) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const { documents: docs } = await listDocuments(projectId);
      setDocuments(docs);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load documents");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void fetchDocuments();
  }, [fetchDocuments]);

  // Load a document
  const loadDocument = useCallback(async (docId: string) => {
    try {
      const { document } = await getDocument(docId);
      setActiveDoc(document);
      setTitle(document.title);
      setContent(document.content);
      dirtyRef.current = false;
      setSaveStatus("idle");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load document");
    }
  }, []);

  // Auto-load first document
  useEffect(() => {
    if (documents.length > 0 && !activeDoc) {
      void loadDocument(documents[0].id);
    }
  }, [documents, activeDoc, loadDocument]);

  // Auto-save content on debounce (3 seconds)
  const scheduleSave = useCallback(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }
    saveTimerRef.current = setTimeout(async () => {
      if (!activeDoc || !dirtyRef.current) return;
      setSaveStatus("saving");
      try {
        await updateDocument(activeDoc.id, { content });
        dirtyRef.current = false;
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 2000);
      } catch {
        setSaveStatus("error");
      }
    }, 3000);
  }, [activeDoc, content]);

  // Content change handler
  const handleContentChange = useCallback(
    (newContent: string) => {
      setContent(newContent);
      dirtyRef.current = true;
      setSaveStatus("idle");
      scheduleSave();
    },
    [scheduleSave]
  );

  // Save title on blur
  const handleTitleBlur = useCallback(async () => {
    if (!activeDoc || title === activeDoc.title) return;
    setSaveStatus("saving");
    try {
      const { document } = await updateDocument(activeDoc.id, { title });
      setActiveDoc(document);
      setDocuments((prev) =>
        prev.map((d) => (d.id === document.id ? { ...d, title: document.title, updatedAt: document.updatedAt } : d))
      );
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2000);
    } catch {
      setSaveStatus("error");
    }
  }, [activeDoc, title]);

  // Create new document
  const handleNewDocument = useCallback(async () => {
    if (!projectId) return;
    try {
      const { document } = await createDocument({
        projectId,
        title: "Untitled Document",
      });
      setDocuments((prev) => [
        { id: document.id, projectId: document.projectId, userId: document.userId, title: document.title, createdAt: document.createdAt, updatedAt: document.updatedAt },
        ...prev,
      ]);
      setActiveDoc(document);
      setTitle(document.title);
      setContent(document.content);
      dirtyRef.current = false;
      setSaveStatus("idle");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create document");
    }
  }, [projectId]);

  // Delete document
  const handleDelete = useCallback(async () => {
    if (!activeDoc) return;
    if (!window.confirm(`Delete "${activeDoc.title}"? This cannot be undone.`)) return;
    try {
      await deleteDocument(activeDoc.id);
      setDocuments((prev) => prev.filter((d) => d.id !== activeDoc.id));
      setActiveDoc(null);
      setTitle("");
      setContent("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete document");
    }
  }, [activeDoc]);

  // Export as .md
  const handleExport = useCallback(() => {
    if (!activeDoc) return;
    const blob = new Blob([content], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title || "document"}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }, [activeDoc, content, title]);

  // Insert markdown syntax at cursor
  const insertMarkdown = useCallback(
    (before: string, after: string) => {
      const textarea = textareaRef.current;
      if (!textarea) return;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const selected = content.slice(start, end);
      const newContent =
        content.slice(0, start) + before + selected + after + content.slice(end);
      handleContentChange(newContent);
      // Restore cursor position after React re-render
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(
          start + before.length,
          end + before.length
        );
      }, 0);
    },
    [content, handleContentChange]
  );

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  // No project selected
  if (!activeProject) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <FileText size={48} className="mx-auto mb-4 text-text-muted" />
          <p className="text-text-secondary">Select a project to start writing</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* Sidebar - Document list */}
      <div className="flex w-64 flex-col border-r border-border bg-surface-soft/50">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <span className="text-sm font-medium text-text-secondary">Documents</span>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleNewDocument}
            className="h-7 w-7"
            title="New Document"
          >
            <Plus size={16} />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {loading && documents.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={20} className="animate-spin text-text-muted" />
            </div>
          ) : documents.length === 0 ? (
            <div className="px-3 py-8 text-center text-xs text-text-muted">
              No documents yet. Create one to get started.
            </div>
          ) : (
            documents.map((doc) => (
              <button
                key={doc.id}
                onClick={() => loadDocument(doc.id)}
                className={`mb-1 w-full rounded-lg px-3 py-2 text-left transition-colors ${
                  activeDoc?.id === doc.id
                    ? "bg-surface text-foreground shadow-sm"
                    : "text-text-secondary hover:bg-surface/60"
                }`}
              >
                <div className="truncate text-sm font-medium">{doc.title}</div>
                <div className="mt-0.5 text-[11px] text-text-muted">
                  {new Date(doc.updatedAt).toLocaleDateString()}
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Main editor */}
      <div className="flex flex-1 flex-col">
        {/* Toolbar */}
        <div className="flex items-center justify-between border-b border-border px-6 py-2">
          <div className="flex items-center gap-1">
            <ToolbarButton
              icon={Bold}
              label="Bold"
              onClick={() => insertMarkdown("**", "**")}
            />
            <ToolbarButton
              icon={Italic}
              label="Italic"
              onClick={() => insertMarkdown("*", "*")}
            />
            <ToolbarButton
              icon={Code}
              label="Code"
              onClick={() => insertMarkdown("`", "`")}
            />
          </div>
          <div className="flex items-center gap-2">
            {/* Save status indicator */}
            <span className="text-[11px] text-text-muted">
              {saveStatus === "saving" && (
                <span className="flex items-center gap-1">
                  <Loader2 size={10} className="animate-spin" /> Saving...
                </span>
              )}
              {saveStatus === "saved" && (
                <span className="flex items-center gap-1 text-success">
                  <Check size={10} /> Saved
                </span>
              )}
              {saveStatus === "error" && (
                <span className="text-destructive">Save failed</span>
              )}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              disabled={!activeDoc}
              className="gap-1.5 text-[12px]"
            >
              <Download size={12} />
              Export
            </Button>
            {/* TODO: AI Assist - integrate with /api/ai/chat/stream for text improvement */}
            <Button
              variant="outline"
              size="sm"
              disabled
              className="gap-1.5 text-[12px] cursor-not-allowed"
              title="AI Assist (coming soon)"
            >
              <Sparkles size={12} />
              AI Assist
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDelete}
              disabled={!activeDoc}
              className="gap-1.5 border-red-200 text-[12px] text-red-600 hover:bg-red-50"
            >
              <Trash2 size={12} />
              Delete
            </Button>
          </div>
        </div>

        {/* Document editor */}
        {activeDoc ? (
          <div className="flex-1 overflow-auto px-16 py-10">
          <div className="mx-auto max-w-2xl">
            <label htmlFor="canvas-title" className="sr-only">
              Document title
            </label>
            <Input
              id="canvas-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={handleTitleBlur}
              className="w-full border-none text-[28px] font-semibold text-foreground shadow-none outline-none placeholder:text-text-muted h-auto px-0 py-0 focus-visible:ring-0 focus-visible:ring-offset-0"
              placeholder="Untitled Document"
            />
            <label htmlFor="canvas-content" className="sr-only">
              Document content
            </label>
            <textarea
              id="canvas-content"
              ref={textareaRef}
                value={content}
                onChange={(e) => handleContentChange(e.target.value)}
                className="mt-6 min-h-[60vh] w-full resize-none border-none bg-transparent text-[15px] leading-7 text-foreground outline-none placeholder:text-text-muted"
                placeholder="Start writing..."
              />
            </div>
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center">
            <div className="text-center">
              <FileText size={48} className="mx-auto mb-4 text-text-muted" />
              <p className="text-sm text-text-secondary">
                {documents.length === 0
                  ? "Create your first document to get started"
                  : "Select a document from the sidebar"}
              </p>
              {documents.length === 0 && (
                <Button
                  onClick={handleNewDocument}
                  className="mt-4"
                >
                  New Document
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Error display */}
        {error && (
          <div className="border-t border-red-200 bg-red-50 px-6 py-3">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function ToolbarButton({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof Bold;
  label: string;
  onClick?: () => void;
}) {
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={onClick}
      className="h-8 w-8 text-text-secondary hover:text-foreground"
      title={label}
    >
      <Icon size={16} />
    </Button>
  );
}
