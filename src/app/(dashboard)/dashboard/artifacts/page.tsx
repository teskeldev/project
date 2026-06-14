"use client";

import { useCallback, useEffect, useState } from "react";
import DOMPurify from "isomorphic-dompurify";
import {
  FileText,
  Code,
  BarChart3,
  Globe,
  Image as ImageIcon,
  Plus,
  Loader2,
  Trash2,
  X,
} from "lucide-react";
import { useProject } from "@/lib/store/project";
import {
  listArtifacts,
  getArtifact,
  createArtifact,
  deleteArtifact,
  type Artifact,
  type ArtifactListItem,
  type ArtifactType,
} from "@/lib/client/artifacts";

const artifactTypes = [
  { id: "CODE" as const, icon: Code, label: "Code", color: "text-accent bg-accent-light" },
  { id: "DOCUMENT" as const, icon: FileText, label: "Document", color: "text-purple-600 bg-purple-50" },
  { id: "CHART" as const, icon: BarChart3, label: "Chart", color: "text-green-600 bg-green-50" },
  { id: "WEBAPP" as const, icon: Globe, label: "Web App", color: "text-orange-600 bg-orange-50" },
  { id: "IMAGE" as const, icon: ImageIcon, label: "Image", color: "text-pink-600 bg-pink-50" },
];

function getTypeInfo(type: ArtifactType) {
  return artifactTypes.find((t) => t.id === type) ?? artifactTypes[0];
}

function getFileExtension(type: ArtifactType, language?: string | null): string {
  if (language) {
    const map: Record<string, string> = {
      typescript: "ts", tsx: "tsx", javascript: "js", jsx: "jsx",
      python: "py", rust: "rs", go: "go", html: "html", css: "css",
      json: "json", markdown: "md", yaml: "yml", sql: "sql",
    };
    return map[language.toLowerCase()] ?? language.toLowerCase();
  }
  const typeMap: Record<ArtifactType, string> = {
    CODE: "txt", DOCUMENT: "md", CHART: "json", WEBAPP: "html", IMAGE: "png",
  };
  return typeMap[type];
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDays = Math.floor(diffHr / 24);
  return `${diffDays}d ago`;
}

/**
 * Sanitize HTML content for safe iframe rendering.
 * Uses DOMPurify with an allowlist of safe tags/attributes and an explicit
 * denylist of dangerous elements and event handler attributes.
 * The iframe uses sandbox="allow-scripts" without allow-same-origin,
 * which prevents access to parent origin cookies/storage.
 */
function sanitizeHtmlContent(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ["div", "span", "p", "h1", "h2", "h3", "h4", "h5", "h6", "ul", "ol", "li", "a", "img", "button", "input", "label", "form", "table", "thead", "tbody", "tr", "td", "th", "br", "hr", "strong", "em", "b", "i", "code", "pre", "blockquote", "section", "article", "nav", "header", "footer", "main", "aside"],
    ALLOWED_ATTR: ["class", "id", "href", "src", "alt", "title", "type", "value", "placeholder", "name", "for", "data-*"],
    ALLOW_DATA_ATTR: true,
    FORBID_TAGS: ["script", "style", "iframe", "object", "embed", "svg", "math", "form"],
    FORBID_ATTR: ["onerror", "onload", "onclick", "onmouseover", "onfocus", "onblur", "style"],
  });
}

export default function ArtifactsPage() {
  const { activeProject } = useProject();
  const [artifacts, setArtifacts] = useState<ArtifactListItem[]>([]);
  const [activeArtifact, setActiveArtifact] = useState<Artifact | null>(null);
  const [activeType, setActiveType] = useState<ArtifactType | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const fetchArtifacts = useCallback(async () => {
    if (!activeProject) return;
    setLoading(true);
    setError(null);
    try {
      const { artifacts: items } = await listArtifacts(
        activeProject.id,
        activeType ?? undefined
      );
      setArtifacts(items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load artifacts");
    } finally {
      setLoading(false);
    }
  }, [activeProject, activeType]);

  useEffect(() => {
    void fetchArtifacts();
  }, [fetchArtifacts]);

  const handleSelectArtifact = useCallback(async (item: ArtifactListItem) => {
    setDetailLoading(true);
    try {
      const { artifact } = await getArtifact(item.id);
      setActiveArtifact(artifact);
    } catch {
      setError("Failed to load artifact details");
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const handleCopy = useCallback(() => {
    if (!activeArtifact) return;
    void navigator.clipboard.writeText(activeArtifact.content);
  }, [activeArtifact]);

  const handleDownload = useCallback(() => {
    if (!activeArtifact) return;
    const ext = getFileExtension(activeArtifact.type, activeArtifact.language);
    const filename = `${activeArtifact.title.replace(/[^a-zA-Z0-9_-]/g, "_")}.${ext}`;
    const blob = new Blob([activeArtifact.content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }, [activeArtifact]);

  const handleDelete = useCallback(async () => {
    if (!deleteConfirmId) return;
    try {
      await deleteArtifact(deleteConfirmId);
      setArtifacts((prev) => prev.filter((a) => a.id !== deleteConfirmId));
      if (activeArtifact?.id === deleteConfirmId) {
        setActiveArtifact(null);
      }
      setDeleteConfirmId(null);
    } catch {
      setError("Failed to delete artifact");
    }
  }, [deleteConfirmId, activeArtifact]);

  if (!activeProject) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-[13px] text-text-secondary">Select a project to view artifacts.</p>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* Artifact list */}
      <div className="w-[320px] border-r border-border bg-surface-soft flex flex-col">
        <div className="border-b border-border p-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-[15px] font-semibold text-foreground">Artifacts</h1>
              <p className="mt-1 text-[12px] text-text-secondary">
                AI-generated code, documents, and visualizations
              </p>
            </div>
            <button
              onClick={() => setShowCreateForm(true)}
              className="rounded-md bg-primary p-1.5 text-background hover:bg-primary-hover"
              title="New Artifact"
            >
              <Plus size={14} />
            </button>
          </div>
        </div>

        {/* Type filters */}
        <div className="flex flex-wrap gap-1 border-b border-border p-3">
          <button
            onClick={() => setActiveType(null)}
            className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
              !activeType ? "bg-primary text-background" : "text-text-secondary hover:bg-surface-soft"
            }`}
          >
            All
          </button>
          {artifactTypes.map((type) => (
            <button
              key={type.id}
              onClick={() => setActiveType(type.id)}
              className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
                activeType === type.id ? "bg-primary text-background" : "text-text-secondary hover:bg-surface-soft"
              }`}
            >
              {type.label}
            </button>
          ))}
        </div>

        {/* List */}
        <div className="flex-1 overflow-auto p-2">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={20} className="animate-spin text-text-muted" />
            </div>
          ) : error ? (
            <div className="p-4 text-center text-[12px] text-red-500">{error}</div>
          ) : artifacts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FileText size={32} className="mb-2 text-text-muted" />
              <p className="text-[13px] font-medium text-text-secondary">No artifacts yet</p>
              <p className="mt-1 text-[11px] text-text-muted">
                Create your first artifact to get started.
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {artifacts.map((artifact) => {
                const typeInfo = getTypeInfo(artifact.type);
                const Icon = typeInfo.icon;
                return (
                  <button
                    key={artifact.id}
                    onClick={() => handleSelectArtifact(artifact)}
                    className={`flex w-full items-start gap-3 rounded-lg p-3 text-left transition-colors ${
                      activeArtifact?.id === artifact.id ? "bg-surface shadow-sm" : "hover:bg-surface/60"
                    }`}
                  >
                    <div className={`mt-0.5 rounded-md p-1.5 ${typeInfo.color}`}>
                      <Icon size={14} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium text-foreground">
                        {artifact.title}
                      </p>
                      <p className="mt-0.5 text-[11px] text-text-muted">
                        {formatTime(artifact.createdAt)}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Preview area */}
      <div className="flex flex-1 flex-col">
        {detailLoading ? (
          <div className="flex flex-1 items-center justify-center">
            <Loader2 size={24} className="animate-spin text-text-muted" />
          </div>
        ) : !activeArtifact ? (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-[13px] text-text-muted">Select an artifact to preview</p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border px-6 py-3">
              <div className="flex items-center gap-3">
                <h2 className="text-[14px] font-semibold text-foreground">
                  {activeArtifact.title}
                </h2>
                <span className="rounded bg-surface-soft px-2 py-0.5 text-[11px] font-medium text-text-secondary">
                  {activeArtifact.type}
                </span>
                {activeArtifact.language && (
                  <span className="rounded bg-accent-light px-2 py-0.5 text-[11px] font-medium text-accent">
                    {activeArtifact.language}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopy}
                  className="rounded-md border border-border px-3 py-1.5 text-[12px] font-medium text-text-secondary hover:bg-surface-soft"
                >
                  Copy
                </button>
                <button
                  onClick={handleDownload}
                  className="rounded-md border border-border px-3 py-1.5 text-[12px] font-medium text-text-secondary hover:bg-surface-soft"
                >
                  Download
                </button>
                <button
                  onClick={() => setDeleteConfirmId(activeArtifact.id)}
                  className="rounded-md border border-red-200 px-3 py-1.5 text-[12px] font-medium text-red-600 hover:bg-red-50"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto p-6">
              <ArtifactContent artifact={activeArtifact} />
            </div>
          </>
        )}
      </div>

      {/* Create form modal */}
      {showCreateForm && activeProject && (
        <CreateArtifactModal
          projectId={activeProject.id}
          onClose={() => setShowCreateForm(false)}
          onCreated={(artifact) => {
            setArtifacts((prev) => [artifact, ...prev]);
            setActiveArtifact(artifact);
            setShowCreateForm(false);
          }}
        />
      )}

      {/* Delete confirmation */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-[360px] rounded-xl bg-surface p-6 shadow-xl">
            <h3 className="text-[14px] font-semibold text-foreground">Delete Artifact</h3>
            <p className="mt-2 text-[13px] text-text-secondary">
              Are you sure you want to delete this artifact? This action cannot be undone.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="rounded-md border border-border px-3 py-1.5 text-[12px] font-medium text-text-secondary hover:bg-surface-soft"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="rounded-md bg-red-600 px-3 py-1.5 text-[12px] font-medium text-white hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Artifact Content Renderer                                                  */
/* -------------------------------------------------------------------------- */

function ArtifactContent({ artifact }: { artifact: Artifact }) {
  switch (artifact.type) {
    case "CODE":
      return (
        <div className="overflow-hidden rounded-lg border border-border bg-editor-bg">
          <div className="flex items-center justify-between border-b border-editor-border px-4 py-2">
            <span className="text-[11px] text-text-muted">
              {artifact.language ?? "plaintext"}
            </span>
          </div>
          <pre className="overflow-x-auto p-4 font-mono text-[12px] leading-6 text-text-muted">
            {artifact.content}
          </pre>
        </div>
      );

    case "DOCUMENT":
      return (
        <div className="rounded-lg border border-border bg-surface p-6">
          <pre className="whitespace-pre-wrap font-sans text-[13px] leading-7 text-text-secondary">
            {artifact.content}
          </pre>
        </div>
      );

    case "CHART": {
      const meta = artifact.metadata as Record<string, unknown> | null;
      const chartData = (meta?.data as number[] | undefined) ?? [40, 65, 55, 80, 72, 90, 85, 95, 88, 100, 92, 110];
      const labels = (meta?.labels as string[] | undefined) ?? ["J","F","M","A","M","J","J","A","S","O","N","D"];
      return (
        <div className="rounded-lg border border-border bg-surface p-8">
          <p className="mb-4 text-[14px] font-medium text-foreground">{artifact.title}</p>
          {/* Illustrative bar chart from metadata */}
          <div className="flex h-[300px] items-end gap-3">
            {chartData.map((h, i) => {
              const maxVal = Math.max(...chartData, 1);
              const pct = (h / maxVal) * 100;
              return (
                <div key={i} className="flex flex-1 flex-col items-center gap-1">
                  <div
                    className="w-full rounded-t bg-accent/80"
                    style={{ height: `${pct}%` }}
                  />
                  <span className="text-[10px] text-text-muted">
                    {labels[i] ?? ""}
                  </span>
                </div>
              );
            })}
          </div>
          {artifact.content && (
            <pre className="mt-4 whitespace-pre-wrap text-[11px] text-text-secondary">
              {artifact.content}
            </pre>
          )}
        </div>
      );
    }

    case "WEBAPP":
      return (
        <div className="overflow-hidden rounded-lg border border-border">
          <div className="flex items-center gap-2 border-b border-border bg-surface-soft px-3 py-2">
            <div className="flex gap-1.5">
              <div className="h-2.5 w-2.5 rounded-full bg-red-400" />
              <div className="h-2.5 w-2.5 rounded-full bg-yellow-400" />
              <div className="h-2.5 w-2.5 rounded-full bg-green-400" />
            </div>
            <div className="flex-1 rounded bg-surface px-3 py-1 text-center text-[11px] text-text-muted ring-1 ring-border">
              sandbox preview
            </div>
          </div>
          <iframe
            srcDoc={sanitizeHtmlContent(artifact.content)}
            sandbox="allow-scripts"
            className="h-[500px] w-full border-0 bg-surface"
            title={artifact.title}
          />
        </div>
      );

    case "IMAGE": {
      const isUrl = artifact.content.startsWith("http://") || artifact.content.startsWith("https://");
      if (isUrl) {
        return (
          <div className="flex items-center justify-center rounded-lg border border-border bg-surface p-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={artifact.content}
              alt={artifact.title}
              referrerPolicy="no-referrer"
              className="max-h-[500px] max-w-full rounded object-contain"
            />
          </div>
        );
      }
      return (
        <div className="flex flex-col items-center justify-center rounded-lg border border-border bg-surface p-12">
          <ImageIcon size={48} className="mb-3 text-text-muted" />
          <p className="text-[13px] text-text-secondary">Image content (non-URL)</p>
          <pre className="mt-4 max-h-[200px] overflow-auto whitespace-pre-wrap text-[11px] text-text-muted">
            {artifact.content.slice(0, 500)}
          </pre>
        </div>
      );
    }

    default:
      return (
        <div className="rounded-lg border border-border bg-surface p-6">
          <pre className="whitespace-pre-wrap font-mono text-[13px] leading-7 text-text-secondary">
            {artifact.content}
          </pre>
        </div>
      );
  }
}

/* -------------------------------------------------------------------------- */
/* Create Artifact Modal                                                      */
/* -------------------------------------------------------------------------- */

function CreateArtifactModal({
  projectId,
  onClose,
  onCreated,
}: {
  projectId: string;
  onClose: () => void;
  onCreated: (artifact: Artifact) => void;
}) {
  const [title, setTitle] = useState("");
  const [type, setType] = useState<ArtifactType>("CODE");
  const [content, setContent] = useState("");
  const [language, setLanguage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      setFormError("Title and content are required.");
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      const { artifact } = await createArtifact(projectId, {
        title: title.trim(),
        type,
        content,
        language: language.trim() || undefined,
      });
      onCreated(artifact);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to create artifact");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-[520px] rounded-xl bg-surface p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <h3 className="text-[14px] font-semibold text-foreground">New Artifact</h3>
          <button onClick={onClose} className="text-text-muted hover:text-text-secondary">
            <X size={16} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-[12px] font-medium text-text-secondary">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 w-full rounded-md border border-border px-3 py-2 text-[13px] outline-none focus:border-border-strong"
              placeholder="My Artifact"
            />
          </div>
          <div>
            <label className="block text-[12px] font-medium text-text-secondary">Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as ArtifactType)}
              className="mt-1 w-full rounded-md border border-border px-3 py-2 text-[13px] outline-none focus:border-border-strong"
            >
              {artifactTypes.map((t) => (
                <option key={t.id} value={t.id}>{t.label}</option>
              ))}
            </select>
          </div>
          {type === "CODE" && (
            <div>
              <label className="block text-[12px] font-medium text-text-secondary">Language</label>
              <input
                type="text"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="mt-1 w-full rounded-md border border-border px-3 py-2 text-[13px] outline-none focus:border-border-strong"
                placeholder="typescript"
              />
            </div>
          )}
          <div>
            <label className="block text-[12px] font-medium text-text-secondary">Content</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={8}
              className="mt-1 w-full rounded-md border border-border px-3 py-2 font-mono text-[12px] outline-none focus:border-border-strong"
              placeholder="Paste or type content..."
            />
          </div>
          {formError && (
            <p className="text-[12px] text-red-500">{formError}</p>
          )}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-border px-3 py-1.5 text-[12px] font-medium text-text-secondary hover:bg-surface-soft"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-[12px] font-medium text-background hover:bg-primary-hover disabled:opacity-50"
            >
              {submitting && <Loader2 size={12} className="animate-spin" />}
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
