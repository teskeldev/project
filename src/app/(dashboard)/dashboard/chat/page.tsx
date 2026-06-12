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
} from "lucide-react";
import { useProject } from "@/lib/store/project";
import {
  ApiClientError,
  createThread,
  generateChangeSet,
  listMessages,
  listThreads,
  type ChatMessage,
} from "@/lib/client/api";
import { streamChatCompletion } from "@/lib/client/chatStream";

/* -------------------------------------------------------------------------- */
/* Local view model                                                           */
/*                                                                            */
/* We render real persisted messages plus transient (optimistic / streaming)  */
/* ones. Streaming assistant messages get a synthetic id until persisted.     */
/* -------------------------------------------------------------------------- */

type ViewRole = "user" | "assistant";

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
}

function toViewMessage(m: ChatMessage): ViewMessage | null {
  // We only render USER + ASSISTANT in the conversation surface. SYSTEM/TOOL
  // messages are internal and not shown here.
  // TODO(Phase 6): render structured agent actions from TOOL message metadata.
  if (m.role !== "USER" && m.role !== "ASSISTANT") return null;
  return {
    id: m.id,
    role: m.role === "USER" ? "user" : "assistant",
    content: m.content,
    timestamp: formatTime(m.createdAt),
  };
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
    <div className="my-3 overflow-hidden rounded-xl border border-gray-200">
      <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-4 py-2">
        <span className="text-xs font-medium text-gray-500">{language}</span>
        <button
          onClick={copy}
          className="text-gray-400 hover:text-gray-600"
          title="Copy code"
        >
          <Copy size={12} />
        </button>
      </div>
      <pre className="overflow-x-auto bg-gray-900 p-4 text-[13px] leading-relaxed text-gray-300">
        <code>{code}</code>
      </pre>
      {copied && (
        <span className="block bg-gray-900 px-4 pb-2 text-[10px] text-green-400">
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
            className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700"
          >
            {seg.text.trim()}
          </p>
        ) : null
      )}
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Empty / loading states                                                     */
/* -------------------------------------------------------------------------- */

function NoProjectState() {
  return (
    <div className="flex h-full flex-col items-center justify-center px-6 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-50">
        <Sparkles size={22} className="text-blue-500" />
      </div>
      <h2 className="text-base font-semibold text-gray-900">
        Select or create a project to chat
      </h2>
      <p className="mt-1 max-w-sm text-sm text-gray-500">
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
        <div className="h-12 w-2/3 rounded-2xl bg-gray-100" />
      </div>
      <div className="mb-2 flex items-center gap-2">
        <div className="h-6 w-6 rounded-full bg-gray-200" />
        <div className="h-3 w-24 rounded bg-gray-100" />
      </div>
      <div className="space-y-2 pl-8">
        <div className="h-3 w-full rounded bg-gray-100" />
        <div className="h-3 w-5/6 rounded bg-gray-100" />
        <div className="h-3 w-2/3 rounded bg-gray-100" />
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
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [inputValue, setInputValue] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [creatingThread, setCreatingThread] = useState(false);

  const [changesetState, setChangesetState] = useState<
    | { status: "idle" }
    | { status: "loading" }
    | { status: "ready"; id: string }
    | { status: "error"; message: string }
  >({ status: "idle" });

  const [rightPanel, setRightPanel] = useState<"none" | "browser" | "terminal">(
    "none"
  );
  const model = "Auto";

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
      { threadId: activeThreadId, content, signal: controller.signal },
      {
        onDelta: (delta) =>
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, content: m.content + delta }
                : m
            )
          ),
        onDone: () => {
          patchAssistant({ streaming: false });
        },
        onError: (message, code) => {
          patchAssistant({
            streaming: false,
            error: true,
            errorCode: code,
            content: message,
          });
        },
      }
    );

    setStreaming(false);
    abortRef.current = null;
  }, [inputValue, streaming, projectId, ensureThread]);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStreaming(false);
    setMessages((prev) =>
      prev.map((m) => (m.streaming ? { ...m, streaming: false } : m))
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

  if (!activeProject) {
    return <NoProjectState />;
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  };

  const hasMessages = messages.length > 0;

  return (
    <div className="flex h-full flex-col">
      {/* Top bar */}
      <div className="flex h-11 items-center justify-between border-b border-gray-200 bg-white px-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-900">
            {activeProject.name}
          </span>
          {streaming && (
            <span className="flex items-center gap-1 rounded bg-green-50 px-1.5 py-0.5 text-[10px] font-medium text-green-600">
              <Loader2 size={10} className="animate-spin" />
              Streaming
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={startNewThread}
            disabled={creatingThread}
            className="flex items-center gap-1 rounded-lg border border-gray-200 px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50"
            title="New chat"
          >
            <Plus size={12} /> New chat
          </button>
          <div className="ml-2 flex items-center rounded-lg border border-gray-200">
            <button className="rounded-l-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
              <Code size={14} />
            </button>
            <button
              onClick={() =>
                setRightPanel(rightPanel === "browser" ? "none" : "browser")
              }
              className={`p-1.5 ${
                rightPanel === "browser"
                  ? "bg-gray-100 text-gray-900"
                  : "text-gray-400 hover:bg-gray-100 hover:text-gray-600"
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
                  ? "bg-gray-100 text-gray-900"
                  : "text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              }`}
            >
              <Terminal size={14} />
            </button>
          </div>
          <button className="ml-1 rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
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
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-gray-900">
                  <Sparkles size={20} className="text-white" />
                </div>
                <h2 className="text-base font-semibold text-gray-900">
                  Start a new chat
                </h2>
                <p className="mt-1 max-w-sm text-sm text-gray-500">
                  Ask Teskel to build a feature, fix a bug, or explain code in{" "}
                  <span className="font-medium">{activeProject.name}</span>.
                </p>
              </div>
            ) : (
              <div className="mx-auto max-w-3xl px-6 py-6">
                {messages.map((msg) => (
                  <div key={msg.id} className="mb-6">
                    {msg.role === "user" ? (
                      <div className="flex justify-end">
                        <div className="max-w-[80%]">
                          <div className="rounded-2xl bg-gray-100 px-4 py-3">
                            <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-900">
                              {msg.content}
                            </p>
                          </div>
                          {msg.timestamp && (
                            <p className="mt-1 text-right text-[10px] text-gray-400">
                              {msg.timestamp}
                            </p>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="mb-2 flex items-center gap-2">
                          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-900">
                            <Sparkles size={12} className="text-white" />
                          </div>
                          <span className="text-xs font-medium text-gray-500">
                            Teskel Agent
                          </span>
                          {msg.timestamp && (
                            <span className="text-[10px] text-gray-400">
                              {msg.timestamp}
                            </span>
                          )}
                        </div>
                        <div className="pl-8">
                          {msg.error ? (
                            <AssistantError
                              message={msg.content}
                              code={msg.errorCode}
                            />
                          ) : msg.streaming && msg.content.length === 0 ? (
                            <div className="flex items-center gap-2 text-sm text-gray-400">
                              <Loader2 size={14} className="animate-spin" />
                              Thinking...
                            </div>
                          ) : (
                            <>
                              <AssistantContent content={msg.content} />
                              {msg.streaming && (
                                <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-gray-400 align-middle" />
                              )}
                              {!msg.streaming && (
                                <div className="mt-2 flex items-center gap-1">
                                  <button className="rounded p-1 text-gray-300 hover:bg-gray-100 hover:text-gray-500">
                                    <Copy size={14} />
                                  </button>
                                  <button className="rounded p-1 text-gray-300 hover:bg-gray-100 hover:text-gray-500">
                                    <RotateCcw size={14} />
                                  </button>
                                  <button className="rounded p-1 text-gray-300 hover:bg-gray-100 hover:text-gray-500">
                                    <ThumbsUp size={14} />
                                  </button>
                                  <button className="rounded p-1 text-gray-300 hover:bg-gray-100 hover:text-gray-500">
                                    <ThumbsDown size={14} />
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
          <div className="border-t border-gray-100 bg-white px-6 py-4">
            <div className="mx-auto max-w-3xl">
              {/* Changeset confirmation / error */}
              {changesetState.status === "ready" && (
                <div className="mb-2 flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50 px-3 py-2">
                  <span className="text-xs text-blue-700">
                    Proposed changes ready
                  </span>
                  <Link
                    href="/dashboard/composer"
                    className="text-xs font-medium text-blue-600 underline hover:text-blue-800"
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

              <div className="flex items-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-sm focus-within:border-gray-300 focus-within:shadow-md">
                <Plus size={18} className="shrink-0 text-gray-400" />
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={onKeyDown}
                  placeholder={
                    hasMessages ? "Send a follow-up..." : "Ask Teskel anything..."
                  }
                  className="flex-1 bg-transparent text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none"
                />
                <div className="flex items-center gap-2">
                  <button
                    onClick={proposeChanges}
                    disabled={
                      !inputValue.trim() ||
                      changesetState.status === "loading" ||
                      streaming
                    }
                    className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 disabled:opacity-40"
                    title="Generate proposed code changes from this instruction"
                  >
                    {changesetState.status === "loading" ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <Wand2 size={12} />
                    )}
                    Generate changes
                  </button>
                  <button className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-gray-500 hover:bg-gray-100">
                    {model}
                    <ChevronDown size={12} />
                  </button>
                  <button className="text-gray-400 hover:text-gray-600">
                    <Mic size={16} />
                  </button>
                  {streaming ? (
                    <button
                      onClick={stop}
                      className="flex items-center gap-1 rounded-lg bg-gray-900 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-gray-700"
                      title="Stop generating"
                    >
                      <Square size={12} /> Stop
                    </button>
                  ) : (
                    <button
                      onClick={() => void send()}
                      disabled={!inputValue.trim() || creatingThread}
                      className="flex items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-40"
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
                {/* TODO: Web/Code/Terminal/Docs context chips are visual no-ops for now. */}
                <div className="flex items-center gap-2">
                  <button className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-gray-400 hover:bg-gray-100 hover:text-gray-600">
                    <Globe size={12} /> Web
                  </button>
                  <button className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-gray-400 hover:bg-gray-100 hover:text-gray-600">
                    <Code size={12} /> Code
                  </button>
                  <button className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-gray-400 hover:bg-gray-100 hover:text-gray-600">
                    <Terminal size={12} /> Terminal
                  </button>
                  <button className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-gray-400 hover:bg-gray-100 hover:text-gray-600">
                    <FileText size={12} /> Docs
                  </button>
                </div>
                <span className="text-[11px] text-gray-400">Local</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right panel (visual placeholder). TODO(Phase 4+): live preview/terminal. */}
        {rightPanel !== "none" && (
          <div className="flex w-[45%] flex-col border-l border-gray-200 bg-white">
            <div className="flex h-11 items-center justify-between border-b border-gray-200 px-3">
              <div className="flex items-center gap-2">
                {rightPanel === "browser" && (
                  <>
                    <button className="rounded p-1 text-gray-400 hover:text-gray-600">
                      <ArrowLeft size={14} />
                    </button>
                    <button className="rounded p-1 text-gray-400 hover:text-gray-600">
                      <ArrowRight size={14} />
                    </button>
                    <div className="ml-2 flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-1">
                      <Globe size={12} className="text-gray-400" />
                      <span className="text-xs text-gray-500">
                        localhost:3000
                      </span>
                    </div>
                  </>
                )}
                {rightPanel === "terminal" && (
                  <span className="text-xs font-medium text-gray-700">
                    Terminal
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                <button className="rounded p-1 text-gray-400 hover:text-gray-600">
                  <Maximize2 size={14} />
                </button>
                <button
                  onClick={() => setRightPanel("none")}
                  className="rounded p-1 text-gray-400 hover:text-gray-600"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
            <div className="flex flex-1 items-center justify-center bg-white">
              <div className="text-center">
                {rightPanel === "browser" ? (
                  <Globe size={48} className="mx-auto mb-3 text-gray-200" />
                ) : (
                  <Terminal size={48} className="mx-auto mb-3 text-gray-200" />
                )}
                <p className="text-sm font-medium text-gray-400">
                  {rightPanel === "browser" ? "Preview" : "Terminal"}
                </p>
                <p className="mt-1 text-xs text-gray-300">Coming soon</p>
              </div>
            </div>
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
              className="mt-1 inline-block text-xs font-medium text-blue-600 underline hover:text-blue-800"
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
          <Loader2 size={20} className="animate-spin text-gray-400" />
        </div>
      }
    >
      <ChatSurface />
    </Suspense>
  );
}
