"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import DOMPurify from "isomorphic-dompurify";
import {
  Send,
  Smartphone,
  Tablet,
  Monitor,
  Code,
  Eye,
  RotateCcw,
  Download,
  Copy,
  History,
  Sparkles,
  Layout,
  Type,
  Image,
  Square,
  ChevronRight,
  Palette,
  Loader2,
  AlertCircle,
  Save,
  Check,
} from "lucide-react";
import { useProject } from "@/lib/store/project";
import {
  listDesignSessions,
  createDesignSession,
  getDesignSession,
  streamDesignGeneration,
  type DesignSession,
  type DesignVersion,
} from "@/lib/client/design";
import { createArtifact } from "@/lib/client/artifacts";
import { FusionPicker } from "@/components/fusion/FusionPicker";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type ViewMode = "preview" | "code" | "split";
type DeviceSize = "mobile" | "tablet" | "desktop";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
}

const templates = [
  { id: "landing", label: "Landing Page", icon: Layout, prompt: "Create a modern landing page hero section with a headline, subtitle, CTA button, and a decorative gradient background" },
  { id: "card", label: "Card Component", icon: Square, prompt: "Create a product card component with an image placeholder, title, description, price, and add-to-cart button" },
  { id: "form", label: "Form UI", icon: Type, prompt: "Create a sign-up form with email, password, confirm password fields, validation styling, and a submit button" },
  { id: "dashboard", label: "Dashboard", icon: Monitor, prompt: "Create a dashboard stats section with 4 metric cards showing numbers, labels, and trend indicators" },
  { id: "gallery", label: "Image Gallery", icon: Image, prompt: "Create a responsive image gallery grid with 6 placeholder images, hover effects, and a lightbox-style overlay" },
  { id: "pricing", label: "Pricing Table", icon: Palette, prompt: "Create a pricing table with 3 tiers (Free, Pro, Enterprise) with features list, prices, and CTA buttons. Highlight the Pro tier." },
];

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
    FORBID_TAGS: ["script", "style", "iframe", "object", "embed", "svg", "math"],
    FORBID_ATTR: ["onerror", "onload", "onclick", "onmouseover", "onfocus", "onblur", "style"],
  });
}

function buildSrcdoc(code: string): string {
  const sanitizedCode = sanitizeHtmlContent(code);
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <script src="https://cdn.tailwindcss.com"><\/script>
  <style>body { margin: 0; font-family: system-ui, -apple-system, sans-serif; }</style>
</head>
<body>
  <div id="root">${sanitizedCode}</div>
  <script>
    // Simple JSX-like rendering: if the code looks like a component, try to render it
    // For now we just display the HTML/JSX directly
  <\/script>
</body>
</html>`;
}

export default function DesignPage() {
  const { activeProject, activeWorkspace } = useProject();
  const projectId = activeProject?.id ?? null;
  const [designFusionId, setDesignFusionId] = useState<string | null>(null);

  const [viewMode, setViewMode] = useState<ViewMode>("preview");
  const [device, setDevice] = useState<DeviceSize>("desktop");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [showVersions, setShowVersions] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);

  // Session state
  const [sessions, setSessions] = useState<DesignSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [versions, setVersions] = useState<DesignVersion[]>([]);
  const [activeVersionId, setActiveVersionId] = useState<string | null>(null);

  // Generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [streamingCode, setStreamingCode] = useState("");
  const [currentCode, setCurrentCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Error state
  const [aiNotConfigured, setAiNotConfigured] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingSession, setLoadingSession] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Load sessions when project changes
  useEffect(() => {
    if (!projectId) return;

    let cancelled = false;

    async function loadSessions() {
      try {
        const { sessions: list } = await listDesignSessions(projectId!);
        if (cancelled) return;
        setSessions(list);

        // Auto-select first session or create one
        if (list.length > 0) {
          setActiveSessionId(list[0].id);
        } else {
          const { session } = await createDesignSession(projectId!, "Design Session");
          if (cancelled) return;
          setSessions([session as DesignSession & { _count: { versions: number } }]);
          setActiveSessionId(session.id);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load sessions");
        }
      }
    }

    loadSessions();
    return () => { cancelled = true; };
  }, [projectId]);

  // Load session detail when active session changes
  useEffect(() => {
    if (!activeSessionId) return;

    let cancelled = false;

    async function loadSessionDetail() {
      setLoadingSession(true);
      try {
        const { session } = await getDesignSession(activeSessionId!);
        if (cancelled) return;

        setVersions(session.versions);

        // Build messages from versions (versions are newest-first from API)
        const sortedVersions = [...session.versions].reverse();
        const msgs: ChatMessage[] = [];
        for (const v of sortedVersions) {
          msgs.push({ id: `user-${v.id}`, role: "user", content: v.prompt });
          msgs.push({ id: `ai-${v.id}`, role: "assistant", content: v.code });
        }
        setMessages(msgs);

        // Set current code to latest version
        if (session.versions.length > 0) {
          setCurrentCode(session.versions[0].code);
          setActiveVersionId(session.versions[0].id);
        } else {
          setCurrentCode("");
          setActiveVersionId(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load session");
        }
      } finally {
        if (!cancelled) setLoadingSession(false);
      }
    }

    loadSessionDetail();
    return () => { cancelled = true; };
  }, [activeSessionId]);

  const handleSend = useCallback(async () => {
    if (!input.trim() || !activeSessionId || isGenerating) return;

    const prompt = input.trim();
    setInput("");
    setError(null);
    setIsGenerating(true);
    setStreamingCode("");

    // Add user message
    const userMsgId = `user-${Date.now()}`;
    const aiMsgId = `ai-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      { id: userMsgId, role: "user", content: prompt },
      { id: aiMsgId, role: "assistant", content: "", isStreaming: true },
    ]);

    const controller = new AbortController();
    abortRef.current = controller;

    let accumulated = "";

    await streamDesignGeneration(
      { sessionId: activeSessionId, prompt, fusionId: designFusionId ?? undefined, signal: controller.signal },
      {
        onDelta(content) {
          accumulated += content;
          setStreamingCode(accumulated);
          setMessages((prev) =>
            prev.map((m) =>
              m.id === aiMsgId ? { ...m, content: accumulated } : m
            )
          );
        },
        onDone(versionId) {
          setCurrentCode(accumulated);
          setStreamingCode("");
          setIsGenerating(false);
          setMessages((prev) =>
            prev.map((m) =>
              m.id === aiMsgId ? { ...m, isStreaming: false } : m
            )
          );
          // Add to versions list
          const newVersion: DesignVersion = {
            id: versionId,
            sessionId: activeSessionId,
            code: accumulated,
            prompt,
            createdAt: new Date().toISOString(),
          };
          setVersions((prev) => [newVersion, ...prev]);
          setActiveVersionId(versionId);
        },
        onError(message, code) {
          setIsGenerating(false);
          setStreamingCode("");
          if (code === "AI_NOT_CONFIGURED") {
            setAiNotConfigured(true);
          } else {
            setError(message);
          }
          // Remove the streaming message
          setMessages((prev) => prev.filter((m) => m.id !== aiMsgId));
        },
      }
    );

    abortRef.current = null;
  }, [input, activeSessionId, isGenerating, designFusionId]);

  const handleStop = () => {
    abortRef.current?.abort();
    setIsGenerating(false);
    setStreamingCode("");
  };

  const handleVersionClick = (version: DesignVersion) => {
    setCurrentCode(version.code);
    setActiveVersionId(version.id);
  };

  const handleCopy = async () => {
    if (!currentCode) return;
    await navigator.clipboard.writeText(currentCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!currentCode) return;
    const blob = new Blob([currentCode], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "Component.tsx";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleReset = async () => {
    if (!activeProject) return;
    const { session } = await createDesignSession(activeProject.id);
    setSessions((prev) => [session as DesignSession & { _count: { versions: number } }, ...prev]);
    setActiveSessionId(session.id);
    setMessages([]);
    setVersions([]);
    setCurrentCode("");
    setActiveVersionId(null);
  };

  const handleSaveArtifact = async () => {
    if (!activeProject || !currentCode || saving) return;
    setSaving(true);
    setSaved(false);
    try {
      const activeVersion = versions.find((v) => v.id === activeVersionId);
      const title = activeVersion
        ? activeVersion.prompt.slice(0, 60)
        : "Design Component";
      await createArtifact(activeProject.id, {
        title,
        type: "WEBAPP",
        content: currentCode,
        language: "tsx",
        metadata: {
          source: "design",
          sessionId: activeSessionId,
          versionId: activeVersionId,
        },
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setError("Failed to save artifact");
    } finally {
      setSaving(false);
    }
  };

  const displayCode = isGenerating ? streamingCode : currentCode;
  const deviceWidth = device === "mobile" ? "max-w-[375px]" : device === "tablet" ? "max-w-[768px]" : "max-w-full";

  // No project selected
  if (!activeProject) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <Sparkles size={48} className="mx-auto mb-4 text-text-muted" />
          <h2 className="text-lg font-semibold text-foreground">No Project Selected</h2>
          <p className="mt-2 text-sm text-text-secondary">
            Select a project to start designing with AI.
          </p>
        </div>
      </div>
    );
  }

  // AI not configured
  if (aiNotConfigured) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center max-w-md">
          <AlertCircle size={48} className="mx-auto mb-4 text-warning" />
          <h2 className="text-lg font-semibold text-foreground">AI Not Configured</h2>
          <p className="mt-2 text-sm text-text-secondary">
            To use Teskel Design, you need to configure an AI provider with an API key.
          </p>
          <Button asChild className="mt-4 bg-accent hover:bg-accent-hover text-white">
            <Link href="/dashboard/integrations">Go to Integrations</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* Left panel - Chat */}
      <div className="flex w-[380px] flex-col border-r border-border">
        {/* Chat header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-accent" />
            <h2 className="text-[14px] font-semibold text-foreground">Teskel Design</h2>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowTemplates(!showTemplates)}
              className="h-7 w-7 text-text-muted hover:text-text-secondary"
              title="Templates"
            >
              <Layout size={14} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowVersions(!showVersions)}
              className="h-7 w-7 text-text-muted hover:text-text-secondary"
              title="Version history"
            >
              <History size={14} />
            </Button>
            {/* Session selector */}
            {sessions.length > 1 && (
              <select
                value={activeSessionId ?? ""}
                onChange={(e) => setActiveSessionId(e.target.value)}
                className="ml-2 rounded-md border border-border bg-surface px-2 py-1 text-[11px] text-text-secondary"
              >
                {sessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Templates panel */}
        {showTemplates && (
          <div className="border-b border-border bg-surface-soft p-3">
            <p className="mb-2 text-[11px] font-medium text-text-secondary">Quick Start Templates</p>
            <div className="grid grid-cols-3 gap-2">
              {templates.map((t) => (
                <button
                  key={t.id}
                  className="flex flex-col items-center gap-1 rounded-lg border border-border bg-surface p-2 text-center transition-all hover:border-accent hover:shadow-sm"
                  onClick={() => {
                    setInput(t.prompt);
                    setShowTemplates(false);
                  }}
                >
                  <t.icon size={16} className="text-text-secondary" />
                  <span className="text-[10px] text-text-secondary">{t.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Version history panel */}
        {showVersions && (
          <div className="border-b border-border bg-surface-soft p-3">
            <p className="mb-2 text-[11px] font-medium text-text-secondary">Version History</p>
            {versions.length === 0 ? (
              <p className="text-[11px] text-text-muted">No versions yet. Generate a design to get started.</p>
            ) : (
              <div className="max-h-[200px] space-y-1 overflow-auto">
                {versions.map((v, idx) => (
                  <button
                    key={v.id}
                    onClick={() => handleVersionClick(v)}
                    className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left transition-colors ${
                      activeVersionId === v.id ? "bg-accent-light ring-1 ring-accent" : "hover:bg-surface"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={`h-2 w-2 shrink-0 rounded-full ${activeVersionId === v.id ? "bg-accent" : "bg-text-muted"}`} />
                      <span className="truncate text-[12px] text-foreground">
                        {v.prompt.length > 40 ? v.prompt.slice(0, 40) + "..." : v.prompt}
                      </span>
                    </div>
                    <span className="ml-2 shrink-0 text-[10px] text-text-muted">
                      v{versions.length - idx}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 space-y-4 overflow-auto p-4">
          {loadingSession ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={20} className="animate-spin text-text-muted" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Sparkles size={32} className="mb-3 text-text-muted" />
              <p className="text-[13px] font-medium text-text-secondary">Start designing</p>
              <p className="mt-1 text-[12px] text-text-muted">
                Describe a UI component and Teskel will generate it for you.
              </p>
            </div>
          ) : (
            messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-xl px-4 py-2.5 ${
                    msg.role === "user"
                      ? "bg-primary text-[13px] text-background"
                      : "border border-border bg-surface text-[13px] text-foreground"
                  }`}
                >
                  {msg.role === "user" ? (
                    <p className="leading-relaxed">{msg.content}</p>
                  ) : (
                    <div>
                      {msg.isStreaming && !msg.content && (
                        <div className="flex items-center gap-2">
                          <Loader2 size={12} className="animate-spin" />
                          <span className="text-[12px] text-text-muted">Generating...</span>
                        </div>
                      )}
                      {msg.content && (
                        <div className="flex items-center gap-1.5 rounded-md bg-accent-light px-2 py-1">
                          {msg.isStreaming ? (
                            <Loader2 size={12} className="animate-spin text-accent" />
                          ) : (
                            <Eye size={12} className="text-accent" />
                          )}
                          <span className="text-[11px] font-medium text-accent">
                            {msg.isStreaming ? "Generating design..." : "Design generated"}
                          </span>
                          {!msg.isStreaming && <ChevronRight size={12} className="ml-auto text-accent/60" />}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Error display */}
        {error && (
          <Card className="mx-3 mb-2 border-red-200 bg-red-50">
            <CardContent className="px-3 py-2">
              <p className="text-[12px] text-red-700">{error}</p>
            </CardContent>
          </Card>
        )}

        {/* Input */}
        <div className="border-t border-border p-3">
          <div className="mb-1.5">
            <FusionPicker
              workspaceId={activeWorkspace?.id}
              value={designFusionId}
              onChange={setDesignFusionId}
              className="w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-[12px] focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2">
            <label htmlFor="design-prompt-input" className="sr-only">
              Design prompt
            </label>
            <Input
              id="design-prompt-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Describe your design..."
              className="flex-1 border-none shadow-none text-[13px] h-auto px-0 py-0 focus-visible:ring-0 focus-visible:ring-offset-0"
              disabled={isGenerating}
            />
            {isGenerating ? (
              <Button
                variant="destructive"
                size="icon"
                onClick={handleStop}
                className="h-7 w-7"
                title="Stop generation"
              >
                <Square size={14} />
              </Button>
            ) : (
              <Button
                size="icon"
                onClick={handleSend}
                disabled={!input.trim()}
                className="h-7 w-7"
              >
                <Send size={14} />
              </Button>
            )}
          </div>
          <p className="mt-1.5 text-center text-[10px] text-text-muted">
            Tip: Be specific about colors, layout, and interactions
          </p>
        </div>
      </div>

      {/* Right panel - Preview */}
      <div className="flex flex-1 flex-col">
        {/* Preview toolbar */}
        <div className="flex items-center justify-between border-b border-border px-4 py-2">
          <div className="flex items-center gap-1">
            <Button
              variant={viewMode === "preview" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("preview")}
              className="gap-1.5 text-[12px]"
            >
              <Eye size={13} />
              Preview
            </Button>
            <Button
              variant={viewMode === "code" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("code")}
              className="gap-1.5 text-[12px]"
            >
              <Code size={13} />
              Code
            </Button>
            <Button
              variant={viewMode === "split" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("split")}
              className="gap-1.5 text-[12px]"
            >
              <Layout size={13} />
              Split
            </Button>
          </div>

          {/* Device size */}
          <div className="flex items-center gap-1 rounded-lg border border-border p-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setDevice("mobile")}
              className={`h-7 w-7 ${device === "mobile" ? "bg-surface-soft text-foreground" : "text-text-muted hover:text-text-secondary"}`}
              title="Mobile (375px)"
            >
              <Smartphone size={14} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setDevice("tablet")}
              className={`h-7 w-7 ${device === "tablet" ? "bg-surface-soft text-foreground" : "text-text-muted hover:text-text-secondary"}`}
              title="Tablet (768px)"
            >
              <Tablet size={14} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setDevice("desktop")}
              className={`h-7 w-7 ${device === "desktop" ? "bg-surface-soft text-foreground" : "text-text-muted hover:text-text-secondary"}`}
              title="Desktop (full)"
            >
              <Monitor size={14} />
            </Button>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleReset}
              className="h-7 w-7 text-text-muted hover:text-text-secondary"
              title="New session"
            >
              <RotateCcw size={14} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleCopy}
              className="h-7 w-7 text-text-muted hover:text-text-secondary"
              title="Copy code"
              disabled={!displayCode}
            >
              {copied ? <Check size={14} className="text-success" /> : <Copy size={14} />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleDownload}
              className="h-7 w-7 text-text-muted hover:text-text-secondary"
              title="Download as .tsx"
              disabled={!currentCode}
            >
              <Download size={14} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSaveArtifact}
              className="gap-1 text-[12px] text-text-muted hover:text-text-secondary"
              title="Save as Artifact"
              disabled={!currentCode || saving}
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : saved ? <Check size={14} className="text-success" /> : <Save size={14} />}
              <span className="hidden sm:inline">{saved ? "Saved" : "Save Artifact"}</span>
            </Button>
          </div>
        </div>

        {/* Content area */}
        <div className="flex flex-1 overflow-hidden">
          {/* Preview */}
          {(viewMode === "preview" || viewMode === "split") && (
            <div className={`flex flex-1 items-start justify-center overflow-auto bg-background p-6 ${viewMode === "split" ? "border-r border-border" : ""}`}>
              {displayCode ? (
                <Card className={`${deviceWidth} w-full mx-auto overflow-hidden transition-all duration-300`}>
                  <iframe
                    srcDoc={buildSrcdoc(displayCode)}
                    className="h-[600px] w-full border-0"
                    sandbox="allow-scripts"
                    title="Design Preview"
                  />
                </Card>
              ) : (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <Eye size={32} className="mb-3 text-text-muted" />
                  <p className="text-[13px] text-text-secondary">
                    Your design preview will appear here
                  </p>
                  <p className="mt-1 text-[11px] text-text-muted">
                    Describe a component in the chat to generate it
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Code view */}
          {(viewMode === "code" || viewMode === "split") && (
            <div className="flex flex-1 flex-col overflow-hidden bg-editor-bg">
              <div className="flex items-center justify-between border-b border-editor-border px-4 py-2">
                <span className="text-[11px] text-text-muted">Component.tsx</span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleCopy}
                  className="h-6 w-6 text-text-muted hover:text-text-secondary hover:bg-editor-border"
                  disabled={!displayCode}
                >
                  {copied ? <Check size={12} className="text-success" /> : <Copy size={12} />}
                </Button>
              </div>
              <div className="flex-1 overflow-auto">
                {displayCode ? (
                  <pre className="p-4 font-mono text-[11px] leading-5 text-text-secondary whitespace-pre-wrap">
                    {displayCode}
                  </pre>
                ) : (
                  <div className="flex items-center justify-center py-20">
                    <p className="text-[12px] text-text-muted">No code generated yet</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
