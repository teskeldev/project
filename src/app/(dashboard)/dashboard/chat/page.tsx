"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import {
  Sparkles,
  ArrowLeft,
  ArrowRight,
  Globe,
  Code,
  Terminal,
  FileText,
  Copy,
  RotateCcw,
  ThumbsUp,
  ThumbsDown,
  ChevronDown,
  Mic,
  Plus,
  Maximize2,
  MoreHorizontal,
  X,
  Loader2,
  Send,
  Square,
  Wand2,
  AlertTriangle,
  Minimize2,
  GitBranch,
  MessageSquare,
  Zap,
  Rocket,
  Brain,
  ChevronRight,
} from "lucide-react";
import { useProject } from "@/lib/store/project";
import { MentionPicker, MentionChips, type MentionChip } from "@/components/dashboard/MentionPicker";
import {
  type AutonomyMode,
  AUTONOMY_MODES,
  loadAutonomyMode,
  saveAutonomyMode,
} from "@/lib/ai/autonomy";

const PreviewPanel = dynamic(() => import("@/components/dashboard/PreviewPanel"), {
  ssr: false,
});
import {
  ApiClientError,
  createThread,
  generateChangeSet,
  listMessages,
  listThreads,
  type ChatMessage,
  forkThread,
} from "@/lib/client/api";
import { streamChatCompletion } from "@/lib/client/chatStream";
import { listProviders, type AIProviderInfo } from "@/lib/client/providers";
import { listCommands as listSlashCommands, resolveCommandTemplate, type SlashCommand } from "@/lib/client/commands";

/* -------------------------------------------------------------------------- */
/* Local view model                                                           */
/*                                                                            */
/* We render real persisted messages plus transient (optimistic / streaming)  */
/* ones. Streaming assistant messages get a synthetic id until persisted.     */
/* -------------------------------------------------------------------------- */

type ViewRole = "user" | "assistant" | "system";

interface ViewMessage {
  id: string;
  role: ViewRole;
  content: string;
  // streaming state for the live assistant bubble
  streaming?: boolean;
  // inline error bubble (e.g. AI not configured)
  error?: boolean;
  errorCode?: string;
  timestamp?: string;
  // compaction metadata
  isCompaction?: boolean;
  compactedCount?: number;
  // extended thinking content
  thinking?: string;
  thinkingStreaming?: boolean;
}

function toViewMessage(m: ChatMessage): ViewMessage | null {
  // Render USER + ASSISTANT + compaction SYSTEM messages
  if (m.role === "USER" || m.role === "ASSISTANT") {
    const meta = m.metadata as Record<string, unknown> | null;
    return {
      id: m.id,
      role: m.role === "USER" ? "user" : "assistant",
      content: m.content,
      timestamp: formatTime(m.createdAt),
      thinking: meta?.thinking as string | undefined,
    };
  }
  // Show compaction system messages
  if (m.role === "SYSTEM" && m.metadata && typeof m.metadata === "object") {
    const meta = m.metadata as Record<string, unknown>;
    if (meta.type === "compaction") {
      return {
        id: m.id,
        role: "system",
        content: m.content,
        timestamp: formatTime(m.createdAt),
        isCompaction: true,
        compactedCount: typeof meta.compactedCount === "number" ? meta.compactedCount : 0,
      };
    }
  }
  return null;
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

/* -------------------------------------------------------------------------- */
/* Tiny fenced-code splitter                                                  */
/*                                                                            */
/* Avoids a heavy markdown dependency. Splits assistant content into plain    */
/* text segments and ```lang\n...``` fenced code blocks, preserving the       */
/* existing dark code-block UI.                                               */
/* -------------------------------------------------------------------------- */

type Segment =
  | { kind: "text"; text: string }
  | { kind: "code"; language: string; code: string };

function splitFencedContent(content: string): Segment[] {
  const segments: Segment[] = [];
  const fence = /```([^\n`]*)\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = fence.exec(content)) !== null) {
    if (match.index > lastIndex) {
      segments.push({
        kind: "text",
        text: content.slice(lastIndex, match.index),
      });
    }
    segments.push({
      kind: "code",
      language: match[1].trim() || "text",
      code: match[2].replace(/\n$/, ""),
    });
    lastIndex = fence.lastIndex;
  }

  if (lastIndex < content.length) {
    segments.push({ kind: "text", text: content.slice(lastIndex) });
  }

  return segments;
}

function CodeBlock({ language, code }: { language: string; code: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // clipboard unavailable
    }
  };

  return (
    <div className="my-3 overflow-hidden rounded-xl border border-border">
      <div className="flex items-center justify-between border-b border-border bg-surface-soft px-4 py-2">
        <span className="text-xs font-medium text-text-secondary">{language}</span>
        <button
          onClick={copy}
          className="text-text-muted hover:text-text-secondary"
          title="Copy code"
        >
          <Copy size={12} />
        </button>
      </div>
      <pre className="overflow-x-auto bg-primary p-4 text-[13px] leading-relaxed text-text-muted">
        <code>{code}</code>
      </pre>
      {copied && (
        <span className="block bg-primary px-4 pb-2 text-[10px] text-green-400">
          Copied
        </span>
      )}
    </div>
  );
}

function AssistantContent({ content }: { content: string }) {
  const segments = splitFencedContent(content);
  return (
    <>
      {segments.map((seg, i) =>
        seg.kind === "code" ? (
          <CodeBlock key={i} language={seg.language} code={seg.code} />
        ) : seg.text.trim() ? (
          <p
            key={i}
            className="whitespace-pre-wrap text-sm leading-relaxed text-text-secondary"
          >
            {seg.text.trim()}
          </p>
        ) : null
      )}
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Extended Thinking display                                                  */
/* -------------------------------------------------------------------------- */

function ThinkingBlock({ content, streaming }: { content: string; streaming?: boolean }) {
  const [expanded, setExpanded] = useState(false);

  if (!content && !streaming) return null;

  return (
    <div className="mb-3">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-text-secondary hover:bg-surface-soft transition-colors"
      >
        <Brain size={12} className={streaming ? "animate-pulse text-purple-500" : "text-text-muted"} />
        <span className="font-medium">
          {streaming ? "Thinking..." : "Thought process"}
        </span>
        <ChevronRight
          size={12}
          className={`transition-transform ${expanded ? "rotate-90" : ""}`}
        />
      </button>
      {(expanded || streaming) && (
        <div className="mt-1 ml-2 border-l-2 border-purple-100 pl-3 animate-in fade-in slide-in-from-top-1 duration-200">
          <p className="whitespace-pre-wrap text-xs italic leading-relaxed text-text-secondary">
            {content}
            {streaming && (
              <span className="ml-0.5 inline-block h-3 w-1 animate-pulse bg-purple-300 align-middle" />
            )}
          </p>
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Autonomy Mode Selector                                                     */
/* -------------------------------------------------------------------------- */

const AUTONOMY_ICONS = {
  suggest: MessageSquare,
  "auto-edit": Zap,
  "full-auto": Rocket,
} as const;

function AutonomySelector({
  mode,
  onChange,
}: {
  mode: AutonomyMode;
  onChange: (mode: AutonomyMode) => void;
}) {
  return (
    <div className="flex items-center rounded-lg border border-border bg-surface-soft p-0.5">
      {(Object.keys(AUTONOMY_MODES) as AutonomyMode[]).map((m) => {
        const Icon = AUTONOMY_ICONS[m];
        const config = AUTONOMY_MODES[m];
        const active = mode === m;
        return (
          <button
            key={m}
            type="button"
            onClick={() => onChange(m)}
            title={config.description}
            className={`flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
              active
                ? "bg-surface text-foreground shadow-sm"
                : "text-text-secondary hover:text-foreground"
            }`}
          >
            <Icon size={12} />
            <span className="hidden sm:inline">{config.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Compaction message component                                               */
/* -------------------------------------------------------------------------- */

function CompactionMessage({ compactedCount }: { compactedCount: number }) {
  return (
    <div className="my-4 flex items-center justify-center">
      <div className="flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-4 py-2">
        <Minimize2 size={14} className="text-amber-600" />
        <span className="text-xs font-medium text-amber-700">
          {compactedCount} messages summarized to save context
        </span>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Empty / loading states                                                     */
/* -------------------------------------------------------------------------- */

function NoProjectState() {
  return (
    <div className="flex h-full flex-col items-center justify-center px-6 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-accent-light">
        <Sparkles size={22} className="text-accent" />
      </div>
      <h2 className="text-base font-semibold text-foreground">
        Select or create a project to chat
      </h2>
      <p className="mt-1 max-w-sm text-sm text-text-secondary">
        Teskel chat works in the context of a project. Pick one from the
        sidebar, or create a new project to get started.
      </p>
    </div>
  );
}

function MessageSkeleton() {
  return (
    <div className="mx-auto max-w-3xl animate-pulse px-6 py-6">
      <div className="mb-6 flex justify-end">
        <div className="h-12 w-2/3 rounded-2xl bg-surface-soft" />
      </div>
      <div className="mb-2 flex items-center gap-2">
        <div className="h-6 w-6 rounded-full bg-border" />
        <div className="h-3 w-24 rounded bg-surface-soft" />
      </div>
      <div className="space-y-2 pl-8">
        <div className="h-3 w-full rounded bg-surface-soft" />
        <div className="h-3 w-5/6 rounded bg-surface-soft" />
        <div className="h-3 w-2/3 rounded bg-surface-soft" />
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Chat surface (depends on search params -> wrapped in <Suspense>)           */
/* -------------------------------------------------------------------------- */

function ChatSurface() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const threadParam = searchParams.get("thread");

  const { activeProject } = useProject();
  const projectId = activeProject?.id ?? null;

  const [threadId, setThreadId] = useState<string | null>(threadParam);
  const [messages, setMessages] = useState<ViewMessage[]>([]);
  const messagesRef = useRef<ViewMessage[]>([]);

  // Keep messagesRef in sync with latest messages state
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [inputValue, setInputValue] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [creatingThread, setCreatingThread] = useState(false);
  const [forking, setForking] = useState(false);
  const [compacting, setCompacting] = useState(false);

  const [changesetState, setChangesetState] = useState<
    | { status: "idle" }
    | { status: "loading" }
    | { status: "ready"; id: string }
    | { status: "error"; message: string }
  >({ status: "idle" });

  // Auto-edit confirmation state
  const [autoEditPending, setAutoEditPending] = useState<{
    changeSetId: string;
    projectId: string;
    instruction: string;
    selectedPaths?: string[];
    assistantId: string;
  } | null>(null);
  const [autoEditNotification, setAutoEditNotification] = useState<string | null>(null);

  const [rightPanel, setRightPanel] = useState<"none" | "browser" | "terminal">(
    "none"
  );
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [providers, setProviders] = useState<AIProviderInfo[]>([]);
  const [showModelDropdown, setShowModelDropdown] = useState(false);

  // Slash commands state
  const [slashCommands, setSlashCommands] = useState<SlashCommand[]>([]);
  const [showCommandDropdown, setShowCommandDropdown] = useState(false);
  const [commandFilter, setCommandFilter] = useState("");
  const [selectedCommand, setSelectedCommand] = useState<SlashCommand | null>(null);
  const [commandValues, setCommandValues] = useState<Record<string, string>>({});
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  // Feature A: @-Mentions state
  const [mentionChips, setMentionChips] = useState<MentionChip[]>([]);
  const [showMentionPicker, setShowMentionPicker] = useState(false);
  const [mentionFilter, setMentionFilter] = useState("");

  // Feature B: Autonomy mode state
  const [autonomyMode, setAutonomyMode] = useState<AutonomyMode>("suggest");

  // Load autonomy mode from localStorage on mount
  useEffect(() => {
    setAutonomyMode(loadAutonomyMode());
  }, []);

  const handleAutonomyChange = useCallback((mode: AutonomyMode) => {
    setAutonomyMode(mode);
    saveAutonomyMode(mode);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { providers: p } = await listProviders();
        if (!cancelled) setProviders(p);
      } catch {
        // Non-fatal: model selector will just show "Auto"
      }
    })();
    return () => { cancelled = true; };
  }, []);


  // Load slash commands
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { commands } = await listSlashCommands();
        if (!cancelled) setSlashCommands(commands);
      } catch {
        // Non-fatal: command dropdown will be empty
      }
    })();
    return () => { cancelled = true; };
  }, []);
  const modelLabel = selectedModel
    ? providers.flatMap((p) => p.models).find((m) => m.id === selectedModel)?.name ?? selectedModel
    : "Auto";

  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Keep thread state in sync with the URL search param.
  useEffect(() => {
    setThreadId(threadParam);
  }, [threadParam]);

  // When no thread is specified, default to the project's most-recent thread.
  useEffect(() => {
    if (!projectId || threadParam) return;
    let cancelled = false;
    (async () => {
      try {
        const { threads } = await listThreads(projectId);
        if (cancelled) return;
        if (threads.length > 0) {
          router.replace(`/dashboard/chat?thread=${threads[0].id}`);
        } else {
          setThreadId(null);
          setMessages([]);
        }
      } catch {
        // Non-fatal: user can still start a new chat.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId, threadParam, router]);

  // Load messages for the active thread.
  useEffect(() => {
    if (!threadId) {
      setMessages([]);
      return;
    }
    let cancelled = false;
    setLoadingMessages(true);
    setLoadError(null);
    (async () => {
      try {
        const { messages: raw } = await listMessages(threadId);
        if (cancelled) return;
        setMessages(
          raw
            .map(toViewMessage)
            .filter((m): m is ViewMessage => m !== null)
        );
      } catch (err) {
        if (cancelled) return;
        setLoadError(
          err instanceof ApiClientError
            ? err.message
            : "Failed to load messages"
        );
      } finally {
        if (!cancelled) setLoadingMessages(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [threadId]);

  // Auto-scroll to the newest content.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  // Abort any in-flight stream on unmount.
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const ensureThread = useCallback(async (): Promise<string> => {
    if (threadId) return threadId;
    if (!projectId) throw new ApiClientError("No active project", 400);
    setCreatingThread(true);
    try {
      const { thread } = await createThread(projectId);
      setThreadId(thread.id);
      // Reflect the new thread in the URL without a full navigation.
      router.replace(`/dashboard/chat?thread=${thread.id}`);
      return thread.id;
    } finally {
      setCreatingThread(false);
    }
  }, [threadId, projectId, router]);

  const handleCompactNow = useCallback(async () => {
    if (!threadId || compacting) return;
    setCompacting(true);
    try {
      const res = await fetch(`/api/chat/threads/${threadId}/compact`, {
        method: "POST",
      });
      const body = await res.json();
      if (body.success && body.data.compacted) {
        // Reload messages to reflect compaction
        const { messages: raw } = await listMessages(threadId);
        setMessages(
          raw.map(toViewMessage).filter((m): m is ViewMessage => m !== null)
        );
      }
    } catch {
      // Non-fatal
    } finally {
      setCompacting(false);
    }
  }, [threadId, compacting]);

  // Feature A: Handle mention chip addition
  const handleMentionSelect = useCallback((chip: MentionChip) => {
    setMentionChips((prev) => [...prev, chip]);
    setShowMentionPicker(false);
    setMentionFilter("");
  }, []);

  const handleMentionRemove = useCallback((id: string) => {
    setMentionChips((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const send = useCallback(async () => {
    const content = inputValue.trim();
    if (!content || streaming || !projectId) return;

    setChangesetState({ status: "idle" });

    let activeThreadId: string;
    try {
      activeThreadId = await ensureThread();
    } catch (err) {
      setLoadError(
        err instanceof ApiClientError ? err.message : "Failed to start chat"
      );
      return;
    }

    setInputValue("");

    // Collect selectedPaths from mention chips
    const selectedPaths = mentionChips
      .filter((c) => c.type === "file" || c.type === "folder")
      .map((c) => c.path);

    // Clear chips after sending
    setMentionChips([]);

    const userMsg: ViewMessage = {
      id: `local-user-${Date.now()}`,
      role: "user",
      content,
      timestamp: formatTime(new Date().toISOString()),
    };
    const assistantId = `local-assistant-${Date.now()}`;
    const assistantMsg: ViewMessage = {
      id: assistantId,
      role: "assistant",
      content: "",
      streaming: true,
      thinking: "",
      thinkingStreaming: true,
    };
    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    const patchAssistant = (patch: Partial<ViewMessage>) =>
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantId ? { ...m, ...patch } : m))
      );

    await streamChatCompletion(
      {
        threadId: activeThreadId,
        content,
        selectedPaths: selectedPaths.length > 0 ? selectedPaths : undefined,
        signal: controller.signal,
        model: selectedModel ?? undefined,
      },
      {
        onThinking: (delta) =>
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, thinking: (m.thinking ?? "") + delta }
                : m
            )
          ),
        onDelta: (delta) =>
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, content: m.content + delta, thinkingStreaming: false }
                : m
            )
          ),
        onDone: () => {
          patchAssistant({ streaming: false, thinkingStreaming: false });
        },
        onError: (message, code) => {
          patchAssistant({
            streaming: false,
            thinkingStreaming: false,
            error: true,
            errorCode: code,
            content: message,
          });
        },
        onCompaction: async () => {
          // Reload messages from the server to reflect compaction accurately,
          // preserving any in-flight streaming assistant message.
          try {
            const { messages: raw } = await listMessages(activeThreadId);
            const reloaded = raw
              .map(toViewMessage)
              .filter((m): m is ViewMessage => m !== null);
            setMessages((prev) => {
              // Preserve the current streaming assistant message if still active
              const streamingMsg = prev.find(
                (m) => m.id === assistantId && m.streaming
              );
              if (streamingMsg) {
                return [...reloaded, streamingMsg];
              }
              return reloaded;
            });
          } catch {
            // Non-fatal: messages will be stale until next reload
          }
        },
      }
    );

    setStreaming(false);
    abortRef.current = null;

    // Feature B: Auto-edit mode — generate changeset and prompt for confirmation
    if (autonomyMode === "auto-edit" || autonomyMode === "full-auto") {
      // Trigger changeset generation from the user's instruction
      try {
        setChangesetState({ status: "loading" });
        const { changeSet } = await generateChangeSet({
          projectId,
          instruction: content,
          selectedPaths: selectedPaths.length > 0 ? selectedPaths : undefined,
        });
        if (AUTONOMY_MODES[autonomyMode].canAutoEdit) {
          // Instead of silently auto-applying, show a confirmation prompt
          setAutoEditPending({
            changeSetId: changeSet.id,
            projectId,
            instruction: content,
            selectedPaths: selectedPaths.length > 0 ? selectedPaths : undefined,
            assistantId,
          });
          setChangesetState({ status: "ready", id: changeSet.id });
        } else {
          setChangesetState({ status: "ready", id: changeSet.id });
        }
      } catch {
        // Non-fatal: auto-edit failed, user can still manually review
        setChangesetState({ status: "idle" });
      }
    }
  }, [inputValue, streaming, projectId, ensureThread, selectedModel, mentionChips, autonomyMode]);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStreaming(false);
    setMessages((prev) =>
      prev.map((m) => (m.streaming ? { ...m, streaming: false, thinkingStreaming: false } : m))
    );
  }, []);

  const startNewThread = useCallback(async () => {
    if (!projectId || creatingThread) return;
    try {
      const { thread } = await createThread(projectId);
      setMessages([]);
      router.replace(`/dashboard/chat?thread=${thread.id}`);
    } catch (err) {
      setLoadError(
        err instanceof ApiClientError ? err.message : "Failed to create chat"
      );
    }
  }, [projectId, creatingThread, router]);
  const handleFork = useCallback(async (messageId?: string) => {
    if (!threadId || forking) return;
    setForking(true);
    try {
      const { thread } = await forkThread(threadId, messageId);
      setActionMsg("Conversation forked");
      router.replace(`/dashboard/chat?thread=${thread.id}`);
    } catch (err) {
      setLoadError(
        err instanceof ApiClientError ? err.message : "Failed to fork conversation"
      );
    } finally {
      setForking(false);
    }
  }, [threadId, forking, router]);



  // Auto-edit confirmation: apply pending changeset
  const handleAutoEditConfirm = useCallback(async () => {
    if (!autoEditPending) return;
    const { changeSetId, projectId: pid, assistantId: aId } = autoEditPending;
    try {
      await fetch(`/api/projects/${pid}/changesets/${changeSetId}/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applyAll: true }),
      });
      setChangesetState({ status: "idle" });
      // Use messagesRef to get latest content (avoids stale closure)
      const currentContent =
        messagesRef.current.find((m) => m.id === aId)?.content ?? "";
      setMessages((prev) =>
        prev.map((m) =>
          m.id === aId
            ? { ...m, content: currentContent + "\n\n✅ Changes applied." }
            : m
        )
      );
      setAutoEditNotification("Changes have been applied successfully.");
      setTimeout(() => setAutoEditNotification(null), 4000);
    } catch {
      setChangesetState({ status: "error", message: "Failed to apply changes" });
    } finally {
      setAutoEditPending(null);
    }
  }, [autoEditPending]);

  // Auto-edit rejection: dismiss pending changeset
  const handleAutoEditReject = useCallback(() => {
    setAutoEditPending(null);
    setChangesetState({ status: "idle" });
    setAutoEditNotification("Auto-edit cancelled. Changes were not applied.");
    setTimeout(() => setAutoEditNotification(null), 4000);
  }, []);

  const proposeChanges = useCallback(async () => {
    const instruction = inputValue.trim();
    if (!instruction || !projectId) return;
    setChangesetState({ status: "loading" });
    try {
      const { changeSet } = await generateChangeSet({
        projectId,
        instruction,
      });
      setChangesetState({ status: "ready", id: changeSet.id });
    } catch (err) {
      setChangesetState({
        status: "error",
        message:
          err instanceof ApiClientError
            ? err.message
            : "Failed to generate changes",
      });
    }
  }, [inputValue, projectId]);

  // Handle input changes — detect @ mentions and / commands
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputValue(val);

    // Detect @ mention trigger
    const lastAtIndex = val.lastIndexOf("@");
    if (lastAtIndex >= 0 && (lastAtIndex === 0 || val[lastAtIndex - 1] === " ")) {
      const afterAt = val.slice(lastAtIndex);
      if (!afterAt.includes(" ") || afterAt.length <= 12) {
        setShowMentionPicker(true);
        setMentionFilter(afterAt);
        setShowCommandDropdown(false);
        return;
      }
    }
    setShowMentionPicker(false);

    // Detect / command trigger
    if (val.startsWith("/") && !val.includes(" ")) {
      setShowCommandDropdown(true);
      setCommandFilter(val.slice(1));
    } else {
      setShowCommandDropdown(false);
    }
  }, []);

  if (!activeProject) {
    return <NoProjectState />;
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
    if (e.key === "Escape") {
      setShowMentionPicker(false);
      setShowCommandDropdown(false);
    }
  };

  const hasMessages = messages.length > 0;

  return (
    <div className="flex h-full flex-col">
      {/* Top bar */}
      <div className="flex h-11 items-center justify-between border-b border-border bg-surface px-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">
            {activeProject.name}
          </span>
          {streaming && (
            <span className="flex items-center gap-1 rounded bg-green-50 px-1.5 py-0.5 text-[10px] font-medium text-green-600">
              <Loader2 size={10} className="animate-spin" />
              Streaming
            </span>
          )}
          {actionMsg && (
            <span className="flex items-center gap-1 rounded bg-accent-light px-1.5 py-0.5 text-[10px] font-medium text-accent">
              <GitBranch size={10} />
              {actionMsg}
              <button onClick={() => setActionMsg(null)} className="ml-1 text-accent hover:text-accent"><X size={8} /></button>
            </span>
          )}
          {/* Feature B: Autonomy Mode Selector */}
          <AutonomySelector mode={autonomyMode} onChange={handleAutonomyChange} />
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleCompactNow}
            disabled={!threadId || compacting || streaming}
            className="flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs text-text-secondary hover:bg-surface-soft hover:text-foreground disabled:opacity-50"
            title="Compact conversation to save context"
          >
            {compacting ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Minimize2 size={12} />
            )}
            Compact
          </button>
          <button
            onClick={startNewThread}
            disabled={creatingThread}
            className="flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs text-text-secondary hover:bg-surface-soft hover:text-foreground disabled:opacity-50"
            title="New chat"
          >
            <Plus size={12} /> New chat
          </button>
          <button
            onClick={() => void handleFork()}
            disabled={forking || !threadId || messages.length === 0}
            className="flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs text-text-secondary hover:bg-surface-soft hover:text-foreground disabled:opacity-50"
            title="Fork conversation"
          >
            {forking ? <Loader2 size={12} className="animate-spin" /> : <GitBranch size={12} />} Fork
          </button>
          <div className="ml-2 flex items-center rounded-lg border border-border">
            <button className="rounded-l-lg p-1.5 text-text-muted hover:bg-surface-soft hover:text-text-secondary">
              <Code size={14} />
            </button>
            <button
              onClick={() =>
                setRightPanel(rightPanel === "browser" ? "none" : "browser")
              }
              className={`p-1.5 ${
                rightPanel === "browser"
                  ? "bg-surface-soft text-foreground"
                  : "text-text-muted hover:bg-surface-soft hover:text-text-secondary"
              }`}
            >
              <Globe size={14} />
            </button>
            <button
              onClick={() =>
                setRightPanel(rightPanel === "terminal" ? "none" : "terminal")
              }
              className={`rounded-r-lg p-1.5 ${
                rightPanel === "terminal"
                  ? "bg-surface-soft text-foreground"
                  : "text-text-muted hover:bg-surface-soft hover:text-text-secondary"
              }`}
            >
              <Terminal size={14} />
            </button>
          </div>
          <button className="ml-1 rounded p-1.5 text-text-muted hover:bg-surface-soft hover:text-text-secondary">
            <MoreHorizontal size={14} />
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Main chat */}
        <div className="flex flex-1 flex-col">
          <div ref={scrollRef} className="flex-1 overflow-y-auto">
            {loadingMessages && !hasMessages ? (
              <MessageSkeleton />
            ) : loadError ? (
              <div className="mx-auto max-w-3xl px-6 py-6">
                <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                  <AlertTriangle size={16} className="mt-0.5 text-red-500" />
                  <div>
                    <p className="text-sm font-medium text-red-700">
                      Couldn&apos;t load this conversation
                    </p>
                    <p className="text-xs text-red-600">{loadError}</p>
                  </div>
                </div>
              </div>
            ) : !hasMessages ? (
              <div className="flex h-full flex-col items-center justify-center px-6 text-center">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary">
                  <Sparkles size={20} className="text-white" />
                </div>
                <h2 className="text-base font-semibold text-foreground">
                  Start a new chat
                </h2>
                <p className="mt-1 max-w-sm text-sm text-text-secondary">
                  Ask Teskel to build a feature, fix a bug, or explain code in{" "}
                  <span className="font-medium">{activeProject.name}</span>.
                </p>
                <p className="mt-2 text-xs text-text-muted">
                  Tip: Type <span className="font-mono text-text-secondary">@</span> to mention files or folders as context
                </p>
              </div>
            ) : (
              <div className="mx-auto max-w-3xl px-6 py-6">
                {messages.map((msg) => (
                  <div key={msg.id} className="mb-6">
                    {msg.role === "system" && msg.isCompaction ? (
                      <CompactionMessage compactedCount={msg.compactedCount ?? 0} />
                    ) : msg.role === "user" ? (
                      <div className="group/user flex justify-end">
                        <div className="max-w-[80%]">
                          <div className="rounded-2xl bg-surface-soft px-4 py-3">
                            <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                              {msg.content}
                            </p>
                          </div>
                          {msg.timestamp && (
                            <p className="mt-1 text-right text-[10px] text-text-muted">
                              {msg.timestamp}
                            </p>
                          )}
                          <div className="mt-1 flex justify-end opacity-0 group-hover/user:opacity-100 transition-opacity">
                            <button
                              onClick={() => void handleFork(msg.id)}
                              className="rounded p-1 text-text-muted hover:bg-surface-soft hover:text-text-secondary"
                              title="Fork conversation from here"
                            >
                              <GitBranch size={14} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="mb-2 flex items-center gap-2">
                          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary">
                            <Sparkles size={12} className="text-white" />
                          </div>
                          <span className="text-xs font-medium text-text-secondary">
                            Teskel Agent
                          </span>
                          {msg.timestamp && (
                            <span className="text-[10px] text-text-muted">
                              {msg.timestamp}
                            </span>
                          )}
                        </div>
                        <div className="pl-8">
                          {/* Feature C: Extended Thinking Display */}
                          {(msg.thinking || msg.thinkingStreaming) && (
                            <ThinkingBlock
                              content={msg.thinking ?? ""}
                              streaming={msg.thinkingStreaming}
                            />
                          )}
                          {msg.error ? (
                            <AssistantError
                              message={msg.content}
                              code={msg.errorCode}
                            />
                          ) : msg.streaming && msg.content.length === 0 && !msg.thinkingStreaming ? (
                            <div className="flex items-center gap-2 text-sm text-text-muted">
                              <Loader2 size={14} className="animate-spin" />
                              Generating response...
                            </div>
                          ) : (
                            <>
                              <AssistantContent content={msg.content} />
                              {msg.streaming && (
                                <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-text-muted align-middle" />
                              )}
                              {!msg.streaming && msg.content.length > 0 && (
                                <div className="mt-2 flex items-center gap-1">
                                  <button className="rounded p-1 text-text-muted hover:bg-surface-soft hover:text-text-secondary">
                                    <Copy size={14} />
                                  </button>
                                  <button className="rounded p-1 text-text-muted hover:bg-surface-soft hover:text-text-secondary">
                                    <RotateCcw size={14} />
                                  </button>
                                  <button className="rounded p-1 text-text-muted hover:bg-surface-soft hover:text-text-secondary">
                                    <ThumbsUp size={14} />
                                  </button>
                                  <button className="rounded p-1 text-text-muted hover:bg-surface-soft hover:text-text-secondary">
                                    <ThumbsDown size={14} />
                                  </button>
                                  <button
                                    onClick={() => void handleFork(msg.id)}
                                    className="rounded p-1 text-text-muted hover:bg-surface-soft hover:text-text-secondary"
                                    title="Fork conversation from here"
                                  >
                                    <GitBranch size={14} />
                                  </button>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Input */}
          <div className="border-t border-border bg-surface px-6 py-4">
            <div className="mx-auto max-w-3xl">
              {/* Changeset confirmation / error */}
              {changesetState.status === "ready" && (
                <div className="mb-2 flex items-center justify-between rounded-lg border border-accent bg-accent-light px-3 py-2">
                  <span className="text-xs text-accent">
                    Proposed changes ready
                  </span>
                  <Link
                    href="/dashboard/composer"
                    className="text-xs font-medium text-accent underline hover:text-accent"
                  >
                    Review in Composer
                  </Link>
                </div>
              )}
              {changesetState.status === "error" && (
                <div className="mb-2 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
                  <AlertTriangle size={12} className="text-red-500" />
                  <span className="text-xs text-red-600">
                    {changesetState.message}
                  </span>
                </div>
              )}

              {/* Auto-edit confirmation banner */}
              {autoEditPending && (
                <div className="mb-2 flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <Zap size={12} className="text-amber-600" />
                    <span className="text-xs text-amber-700">
                      Auto-edit generated changes ready to apply
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link
                      href="/dashboard/composer"
                      className="text-xs font-medium text-amber-600 underline hover:text-amber-800"
                    >
                      Review
                    </Link>
                    <button
                      onClick={() => void handleAutoEditConfirm()}
                      className="rounded bg-amber-600 px-2 py-0.5 text-xs font-medium text-white hover:bg-amber-700"
                    >
                      Apply
                    </button>
                    <button
                      onClick={handleAutoEditReject}
                      className="rounded border border-amber-300 px-2 py-0.5 text-xs font-medium text-amber-700 hover:bg-amber-100"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              )}

              {/* Auto-edit notification */}
              {autoEditNotification && (
                <div className="mb-2 flex items-center justify-between rounded-lg border border-green-200 bg-green-50 px-3 py-2">
                  <span className="text-xs text-green-700">{autoEditNotification}</span>
                  <button
                    onClick={() => setAutoEditNotification(null)}
                    className="text-green-400 hover:text-green-600"
                  >
                    <X size={12} />
                  </button>
                </div>
              )}

              {/* Feature A: Mention chips display */}
              <MentionChips chips={mentionChips} onRemove={handleMentionRemove} />

              <div className="relative flex items-center gap-2 rounded-2xl border border-border bg-surface px-4 py-3 shadow-sm focus-within:border-border focus-within:shadow-md">
                <Plus size={18} className="shrink-0 text-text-muted" />
                <label htmlFor="chat-input" className="sr-only">
                  Message
                </label>
                <input
                  id="chat-input"
                  type="text"
                  value={inputValue}
                  onChange={handleInputChange}
                  onKeyDown={onKeyDown}
                  placeholder={
                    hasMessages ? "Send a follow-up... (@ to mention)" : "Ask Teskel anything... (@ to mention files)"
                  }
                  className="flex-1 bg-transparent text-sm text-foreground placeholder:text-text-muted focus:outline-none"
                />
                {/* Feature A: Mention picker dropdown */}
                {showMentionPicker && projectId && (
                  <MentionPicker
                    projectId={projectId}
                    visible={showMentionPicker}
                    filter={mentionFilter}
                    onSelect={(chip) => {
                      handleMentionSelect(chip);
                      // Remove the @... text from input
                      const lastAt = inputValue.lastIndexOf("@");
                      if (lastAt >= 0) {
                        setInputValue(inputValue.slice(0, lastAt));
                      }
                    }}
                    onClose={() => setShowMentionPicker(false)}
                  />
                )}
                {/* Slash command dropdown */}
                {showCommandDropdown && slashCommands.length > 0 && (
                  <div className="absolute bottom-full left-0 mb-2 w-full max-h-48 overflow-y-auto rounded-lg border border-border bg-surface py-1 shadow-lg z-50">
                    {slashCommands
                      .filter((c) => c.name.includes(commandFilter))
                      .slice(0, 8)
                      .map((cmd) => (
                        <button
                          key={cmd.id}
                          type="button"
                          onClick={() => { setSelectedCommand(cmd); setShowCommandDropdown(false); setInputValue(""); const defaults: Record<string, string> = {}; for (const v of cmd.variables) { defaults[v.name] = v.defaultValue ?? ""; } setCommandValues(defaults); }}
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-surface-soft"
                        >
                          <span className="font-mono text-xs text-accent">/{cmd.name}</span>
                          <span className="text-xs text-text-secondary">{cmd.description}</span>
                        </button>
                      ))}
                    {slashCommands.filter((c) => c.name.includes(commandFilter)).length === 0 && (
                      <p className="px-3 py-2 text-xs text-text-muted">No matching commands</p>
                    )}
                  </div>
                )}
                {/* Selected command variable form */}
                {selectedCommand && (
                  <div className="absolute bottom-full left-0 mb-2 w-full rounded-lg border border-border bg-surface p-3 shadow-lg z-50">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-xs font-medium text-text-secondary">/{selectedCommand.name}</span>
                      <button type="button" onClick={() => setSelectedCommand(null)} className="text-text-muted hover:text-text-secondary"><X size={12} /></button>
                    </div>
                    {selectedCommand.variables.map((v) => (
                      <div key={v.name} className="mb-2">
                        <label className="mb-0.5 block text-[10px] text-text-secondary">{v.name}{v.required && <span className="text-red-400">*</span>}: {v.description}</label>
                        <input value={commandValues[v.name] ?? ""} onChange={(e) => setCommandValues((prev) => ({ ...prev, [v.name]: e.target.value }))} className="w-full rounded border border-border px-2 py-1 text-xs focus:border-accent focus:outline-none" placeholder={v.defaultValue ?? v.description} />
                      </div>
                    ))}
                    <button type="button" onClick={() => { const resolved = resolveCommandTemplate(selectedCommand.template, commandValues); setInputValue(resolved); setSelectedCommand(null); }} className="mt-1 rounded bg-accent px-2 py-1 text-xs font-medium text-white hover:bg-accent-hover">Fill Template</button>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <button
                    onClick={proposeChanges}
                    disabled={
                      !inputValue.trim() ||
                      changesetState.status === "loading" ||
                      streaming
                    }
                    className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-text-secondary hover:bg-surface-soft disabled:opacity-40"
                    title="Generate proposed code changes from this instruction"
                  >
                    {changesetState.status === "loading" ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <Wand2 size={12} />
                    )}
                    Generate changes
                  </button>
                  <div className="relative">
                    <button
                      onClick={() => setShowModelDropdown(!showModelDropdown)}
                      className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-text-secondary hover:bg-surface-soft"
                    >
                      {modelLabel}
                      <ChevronDown size={12} />
                    </button>
                    {showModelDropdown && (
                      <div className="absolute bottom-full right-0 mb-1 w-56 rounded-lg border border-border bg-surface py-1 shadow-lg z-50 max-h-64 overflow-y-auto">
                        <button
                          onClick={() => { setSelectedModel(null); setShowModelDropdown(false); }}
                          className={`flex w-full items-center px-3 py-1.5 text-left text-xs hover:bg-surface-soft ${!selectedModel ? "text-accent font-medium" : "text-text-secondary"}`}
                        >
                          Auto (default)
                        </button>
                        {providers.map((provider) => (
                          <div key={provider.id}>
                            <div className="px-3 py-1 text-[10px] font-medium uppercase tracking-wider text-text-muted mt-1">
                              {provider.name}
                            </div>
                            {provider.models.map((m) => (
                              <button
                                key={m.id}
                                onClick={() => { setSelectedModel(m.id); setShowModelDropdown(false); }}
                                className={`flex w-full items-center justify-between px-3 py-1.5 text-left text-xs hover:bg-surface-soft ${selectedModel === m.id ? "text-accent font-medium" : "text-text-secondary"}`}
                              >
                                <span>{m.name}</span>
                                {m.pricing && (
                                  <span className="text-[10px] text-text-muted">${m.pricing.input}/{m.pricing.output}</span>
                                )}
                              </button>
                            ))}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <button className="text-text-muted hover:text-text-secondary">
                    <Mic size={16} />
                  </button>
                  {streaming ? (
                    <button
                      onClick={stop}
                      className="flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1.5 text-xs font-medium text-white hover:bg-primary/80"
                      title="Stop generating"
                    >
                      <Square size={12} /> Stop
                    </button>
                  ) : (
                    <button
                      onClick={() => void send()}
                      disabled={!inputValue.trim() || creatingThread}
                      className="flex items-center gap-1 rounded-lg bg-accent px-2.5 py-1.5 text-xs font-medium text-white hover:bg-accent-hover disabled:opacity-40"
                      title="Send"
                    >
                      {creatingThread ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <Send size={12} />
                      )}
                      Send
                    </button>
                  )}
                </div>
              </div>
              <div className="mt-2 flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <button className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-text-muted hover:bg-surface-soft hover:text-text-secondary">
                    <Globe size={12} /> Web
                  </button>
                  <button className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-text-muted hover:bg-surface-soft hover:text-text-secondary">
                    <Code size={12} /> Code
                  </button>
                  <button className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-text-muted hover:bg-surface-soft hover:text-text-secondary">
                    <Terminal size={12} /> Terminal
                  </button>
                  <button className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-text-muted hover:bg-surface-soft hover:text-text-secondary">
                    <FileText size={12} /> Docs
                  </button>
                </div>
                <span className="text-[11px] text-text-muted">
                  {autonomyMode !== "suggest" && (
                    <span className="mr-2 text-amber-500">
                      {AUTONOMY_MODES[autonomyMode].label} mode
                    </span>
                  )}
                  Local
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right panel (visual placeholder). TODO(Phase 4+): live preview/terminal. */}
        {rightPanel !== "none" && (
          <div className="flex w-[45%] flex-col border-l border-border bg-surface">
            <div className="flex h-11 items-center justify-between border-b border-border px-3">
              <div className="flex items-center gap-2">
                {rightPanel === "browser" && (
                  <>
                    <button className="rounded p-1 text-text-muted hover:text-text-secondary">
                      <ArrowLeft size={14} />
                    </button>
                    <button className="rounded p-1 text-text-muted hover:text-text-secondary">
                      <ArrowRight size={14} />
                    </button>
                    <div className="ml-2 flex items-center gap-2 rounded-lg border border-border bg-surface-soft px-3 py-1">
                      <Globe size={12} className="text-text-muted" />
                      <span className="text-xs text-text-secondary">
                        localhost:3000
                      </span>
                    </div>
                  </>
                )}
                {rightPanel === "terminal" && (
                  <span className="text-xs font-medium text-text-secondary">
                    Terminal
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                <button className="rounded p-1 text-text-muted hover:text-text-secondary">
                  <Maximize2 size={14} />
                </button>
                <button
                  onClick={() => setRightPanel("none")}
                  className="rounded p-1 text-text-muted hover:text-text-secondary"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
            {rightPanel === "browser" ? (
              <PreviewPanel defaultUrl="http://localhost:3000" onClose={() => setRightPanel("none")} />
            ) : (
              <div className="flex flex-1 items-center justify-center bg-surface">
                <div className="text-center">
                  <Terminal size={48} className="mx-auto mb-3 text-text-muted" />
                  <p className="text-sm font-medium text-text-muted">Terminal</p>
                  <p className="mt-1 text-xs text-text-muted">Coming soon</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function AssistantError({
  message,
  code,
}: {
  message: string;
  code?: string;
}) {
  const notConfigured = code === "AI_NOT_CONFIGURED";
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
      <div className="flex items-start gap-2">
        <AlertTriangle size={16} className="mt-0.5 text-red-500" />
        <div>
          <p className="text-sm font-medium text-red-700">{message}</p>
          {notConfigured && (
            <Link
              href="/dashboard/integrations"
              className="mt-1 inline-block text-xs font-medium text-accent underline hover:text-accent"
            >
              Add an OpenAI API key in Integrations
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-full items-center justify-center">
          <Loader2 size={20} className="animate-spin text-text-muted" />
        </div>
      }
    >
      <ChatSurface />
    </Suspense>
  );
}
