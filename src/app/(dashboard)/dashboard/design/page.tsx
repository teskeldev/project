"use client";

import { useState, useEffect, useRef, useCallback } from "react";
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

function buildSrcdoc(code: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <script src="https://cdn.tailwindcss.com"><\/script>
  <style>body { margin: 0; font-family: system-ui, -apple-system, sans-serif; }</style>
</head>
<body>
  <div id="root">${code}</div>
  <script>
    // Simple JSX-like rendering: if the code looks like a component, try to render it
    // For now we just display the HTML/JSX directly
  <\/script>
</body>
</html>`;
}

export default function DesignPage() {
  const { activeProject } = useProject();

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
    if (!activeProject) return;

    let cancelled = false;

    async function loadSessions() {
      try {
        const { sessions: list } = await listDesignSessions(activeProject!.id);
        if (cancelled) return;
        setSessions(list);

        // Auto-select first session or create one
        if (list.length > 0) {
          setActiveSessionId(list[0].id);
        } else {
          const { session } = await createDesignSession(activeProject!.id, "Design Session");
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
  }, [activeProject]);

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
      { sessionId: activeSessionId, prompt, signal: controller.signal },
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
  }, [input, activeSessionId, isGenerating]);

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

  const displayCode = isGenerating ? streamingCode : currentCode;
  const deviceWidth = device === "mobile" ? "max-w-[375px]" : device === "tablet" ? "max-w-[768px]" : "max-w-full";

  // No project selected
  if (!activeProject) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <Sparkles size={48} className="mx-auto mb-4 text-gray-300" />
          <h2 className="text-lg font-semibold text-gray-900">No Project Selected</h2>
          <p className="mt-2 text-sm text-gray-500">
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
          <AlertCircle size={48} className="mx-auto mb-4 text-amber-400" />
          <h2 className="text-lg font-semibold text-gray-900">AI Not Configured</h2>
          <p className="mt-2 text-sm text-gray-500">
            To use Teskel Design, you need to configure an AI provider with an API key.
          </p>
          <a
            href="/dashboard/integrations"
            className="mt-4 inline-block rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Go to Integrations
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* Left panel - Chat */}
      <div className="flex w-[380px] flex-col border-r border-gray-100">
        {/* Chat header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-blue-600" />
            <h2 className="text-[14px] font-semibold text-gray-900">Teskel Design</h2>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowTemplates(!showTemplates)}
              className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              title="Templates"
            >
              <Layout size={14} />
            </button>
            <button
              onClick={() => setShowVersions(!showVersions)}
              className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              title="Version history"
            >
              <History size={14} />
            </button>
            {/* Session selector */}
            {sessions.length > 1 && (
              <select
                value={activeSessionId ?? ""}
                onChange={(e) => setActiveSessionId(e.target.value)}
                className="ml-2 rounded-md border border-gray-200 px-2 py-1 text-[11px] text-gray-600"
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
          <div className="border-b border-gray-100 bg-gray-50 p-3">
            <p className="mb-2 text-[11px] font-medium text-gray-500">Quick Start Templates</p>
            <div className="grid grid-cols-3 gap-2">
              {templates.map((t) => (
                <button
                  key={t.id}
                  className="flex flex-col items-center gap-1 rounded-lg border border-gray-200 bg-white p-2 text-center transition-all hover:border-blue-200 hover:shadow-sm"
                  onClick={() => {
                    setInput(t.prompt);
                    setShowTemplates(false);
                  }}
                >
                  <t.icon size={16} className="text-gray-500" />
                  <span className="text-[10px] text-gray-600">{t.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Version history panel */}
        {showVersions && (
          <div className="border-b border-gray-100 bg-gray-50 p-3">
            <p className="mb-2 text-[11px] font-medium text-gray-500">Version History</p>
            {versions.length === 0 ? (
              <p className="text-[11px] text-gray-400">No versions yet. Generate a design to get started.</p>
            ) : (
              <div className="max-h-[200px] space-y-1 overflow-auto">
                {versions.map((v, idx) => (
                  <button
                    key={v.id}
                    onClick={() => handleVersionClick(v)}
                    className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left transition-colors ${
                      activeVersionId === v.id ? "bg-blue-50 ring-1 ring-blue-200" : "hover:bg-white"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={`h-2 w-2 shrink-0 rounded-full ${activeVersionId === v.id ? "bg-blue-500" : "bg-gray-300"}`} />
                      <span className="truncate text-[12px] text-gray-700">
                        {v.prompt.length > 40 ? v.prompt.slice(0, 40) + "..." : v.prompt}
                      </span>
                    </div>
                    <span className="ml-2 shrink-0 text-[10px] text-gray-400">
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
              <Loader2 size={20} className="animate-spin text-gray-400" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Sparkles size={32} className="mb-3 text-gray-300" />
              <p className="text-[13px] font-medium text-gray-600">Start designing</p>
              <p className="mt-1 text-[12px] text-gray-400">
                Describe a UI component and Teskel will generate it for you.
              </p>
            </div>
          ) : (
            messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-xl px-4 py-2.5 ${
                    msg.role === "user"
                      ? "bg-gray-900 text-[13px] text-white"
                      : "border border-gray-100 bg-white text-[13px] text-gray-700"
                  }`}
                >
                  {msg.role === "user" ? (
                    <p className="leading-relaxed">{msg.content}</p>
                  ) : (
                    <div>
                      {msg.isStreaming && !msg.content && (
                        <div className="flex items-center gap-2">
                          <Loader2 size={12} className="animate-spin" />
                          <span className="text-[12px] text-gray-400">Generating...</span>
                        </div>
                      )}
                      {msg.content && (
                        <div className="flex items-center gap-1.5 rounded-md bg-blue-50 px-2 py-1">
                          {msg.isStreaming ? (
                            <Loader2 size={12} className="animate-spin text-blue-600" />
                          ) : (
                            <Eye size={12} className="text-blue-600" />
                          )}
                          <span className="text-[11px] font-medium text-blue-700">
                            {msg.isStreaming ? "Generating design..." : "Design generated"}
                          </span>
                          {!msg.isStreaming && <ChevronRight size={12} className="ml-auto text-blue-400" />}
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
          <div className="mx-3 mb-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
            <p className="text-[12px] text-red-700">{error}</p>
          </div>
        )}

        {/* Input */}
        <div className="border-t border-gray-100 p-3">
          <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Describe your design..."
              className="flex-1 text-[13px] text-gray-900 outline-none placeholder:text-gray-400"
              disabled={isGenerating}
            />
            {isGenerating ? (
              <button
                onClick={handleStop}
                className="rounded-md bg-red-600 p-1.5 text-white transition-colors hover:bg-red-700"
                title="Stop generation"
              >
                <Square size={14} />
              </button>
            ) : (
              <button
                onClick={handleSend}
                disabled={!input.trim()}
                className="rounded-md bg-gray-900 p-1.5 text-white transition-colors hover:bg-gray-800 disabled:opacity-40"
              >
                <Send size={14} />
              </button>
            )}
          </div>
          <p className="mt-1.5 text-center text-[10px] text-gray-400">
            Tip: Be specific about colors, layout, and interactions
          </p>
        </div>
      </div>

      {/* Right panel - Preview */}
      <div className="flex flex-1 flex-col">
        {/* Preview toolbar */}
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setViewMode("preview")}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12px] font-medium transition-colors ${
                viewMode === "preview" ? "bg-gray-900 text-white" : "text-gray-500 hover:bg-gray-100"
              }`}
            >
              <Eye size={13} />
              Preview
            </button>
            <button
              onClick={() => setViewMode("code")}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12px] font-medium transition-colors ${
                viewMode === "code" ? "bg-gray-900 text-white" : "text-gray-500 hover:bg-gray-100"
              }`}
            >
              <Code size={13} />
              Code
            </button>
            <button
              onClick={() => setViewMode("split")}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12px] font-medium transition-colors ${
                viewMode === "split" ? "bg-gray-900 text-white" : "text-gray-500 hover:bg-gray-100"
              }`}
            >
              <Layout size={13} />
              Split
            </button>
          </div>

          {/* Device size */}
          <div className="flex items-center gap-1 rounded-lg border border-gray-200 p-1">
            <button
              onClick={() => setDevice("mobile")}
              className={`rounded-md p-1.5 transition-colors ${device === "mobile" ? "bg-gray-100 text-gray-900" : "text-gray-400 hover:text-gray-600"}`}
              title="Mobile (375px)"
            >
              <Smartphone size={14} />
            </button>
            <button
              onClick={() => setDevice("tablet")}
              className={`rounded-md p-1.5 transition-colors ${device === "tablet" ? "bg-gray-100 text-gray-900" : "text-gray-400 hover:text-gray-600"}`}
              title="Tablet (768px)"
            >
              <Tablet size={14} />
            </button>
            <button
              onClick={() => setDevice("desktop")}
              className={`rounded-md p-1.5 transition-colors ${device === "desktop" ? "bg-gray-100 text-gray-900" : "text-gray-400 hover:text-gray-600"}`}
              title="Desktop (full)"
            >
              <Monitor size={14} />
            </button>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1">
            <button
              onClick={handleReset}
              className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              title="New session"
            >
              <RotateCcw size={14} />
            </button>
            <button
              onClick={handleCopy}
              className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              title="Copy code"
              disabled={!displayCode}
            >
              {copied ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
            </button>
            <button
              onClick={handleDownload}
              className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              title="Download as .tsx"
              disabled={!currentCode}
            >
              <Download size={14} />
            </button>
          </div>
        </div>

        {/* Content area */}
        <div className="flex flex-1 overflow-hidden">
          {/* Preview */}
          {(viewMode === "preview" || viewMode === "split") && (
            <div className={`flex flex-1 items-start justify-center overflow-auto bg-[#F7F7F5] p-6 ${viewMode === "split" ? "border-r border-gray-100" : ""}`}>
              {displayCode ? (
                <div className={`${deviceWidth} w-full mx-auto overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm transition-all duration-300`}>
                  <iframe
                    srcDoc={buildSrcdoc(displayCode)}
                    className="h-[600px] w-full border-0"
                    sandbox="allow-scripts"
                    title="Design Preview"
                  />
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <Eye size={32} className="mb-3 text-gray-300" />
                  <p className="text-[13px] text-gray-500">
                    Your design preview will appear here
                  </p>
                  <p className="mt-1 text-[11px] text-gray-400">
                    Describe a component in the chat to generate it
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Code view */}
          {(viewMode === "code" || viewMode === "split") && (
            <div className="flex flex-1 flex-col overflow-hidden bg-[#0B0F19]">
              <div className="flex items-center justify-between border-b border-gray-800 px-4 py-2">
                <span className="text-[11px] text-gray-400">Component.tsx</span>
                <button
                  onClick={handleCopy}
                  className="rounded p-1 text-gray-500 hover:bg-gray-800 hover:text-gray-300"
                  disabled={!displayCode}
                >
                  {copied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
                </button>
              </div>
              <div className="flex-1 overflow-auto">
                {displayCode ? (
                  <pre className="p-4 font-mono text-[11px] leading-5 text-gray-300 whitespace-pre-wrap">
                    {displayCode}
                  </pre>
                ) : (
                  <div className="flex items-center justify-center py-20">
                    <p className="text-[12px] text-gray-500">No code generated yet</p>
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
