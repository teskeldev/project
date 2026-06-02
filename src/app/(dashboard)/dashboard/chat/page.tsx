"use client";

import { useState } from "react";
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
  ChevronUp,
  Mic,
  Plus,
  Maximize2,
  MoreHorizontal,
  X,
  Loader2,
  Search,
  FolderOpen,
  Pencil,
  Eye,
  CheckCircle2,
  Clock,
  Play,
} from "lucide-react";

type ToolAction =
  | { type: "thinking"; content: string }
  | { type: "file_edit"; file: string; description: string }
  | { type: "file_create"; file: string; description: string }
  | { type: "terminal"; command: string; output: string }
  | { type: "web_search"; query: string; results: string[] }
  | { type: "file_read"; file: string }
  | { type: "browser"; url: string };

interface Message {
  id: number;
  role: "user" | "assistant";
  content: string;
  codeBlocks?: { language: string; code: string; file?: string }[];
  actions?: ToolAction[];
  isLoading?: boolean;
  timestamp?: string;
}

const agentConversation: Message[] = [
  {
    id: 1,
    role: "user",
    content:
      "Build a user authentication system with login, signup, and password reset. Use Next.js API routes with JWT tokens.",
    timestamp: "2:34 PM",
  },
  {
    id: 2,
    role: "assistant",
    content:
      "I'll build a complete authentication system for you. Let me start by planning the architecture and then implement each part.",
    timestamp: "2:34 PM",
    actions: [
      {
        type: "thinking",
        content:
          "The user wants a full auth system. I need to:\n1. Create a JWT utility for token generation/verification\n2. Set up API routes for /api/auth/login, /api/auth/signup, /api/auth/reset-password\n3. Create middleware for protected routes\n4. Add password hashing with bcrypt\n5. Set up a user model/schema\n\nI'll use jose for JWT (Edge-compatible), bcryptjs for password hashing, and create a simple in-memory store that can be swapped for a real DB later.",
      },
      {
        type: "file_create",
        file: "src/lib/auth/jwt.ts",
        description: "JWT utility with sign/verify functions using jose",
      },
      {
        type: "file_create",
        file: "src/lib/auth/password.ts",
        description: "Password hashing with bcryptjs",
      },
      {
        type: "file_create",
        file: "src/app/api/auth/signup/route.ts",
        description: "Signup endpoint — validates input, hashes password, creates user, returns JWT",
      },
      {
        type: "file_create",
        file: "src/app/api/auth/login/route.ts",
        description: "Login endpoint — verifies credentials, returns JWT",
      },
      {
        type: "file_create",
        file: "src/app/api/auth/reset-password/route.ts",
        description: "Password reset endpoint — generates reset token, sends email",
      },
      {
        type: "file_create",
        file: "src/middleware.ts",
        description: "Auth middleware for protecting /dashboard routes",
      },
      {
        type: "terminal",
        command: "npm install jose bcryptjs",
        output:
          "added 2 packages in 1.2s\n\n2 packages are looking for funding\n  run `npm fund` for details",
      },
      {
        type: "terminal",
        command: "npm run build",
        output: "✓ Compiled successfully\n✓ Linting passed\n✓ Type checking passed\nRoute (app)\n├ ○ /api/auth/login\n├ ○ /api/auth/signup\n├ ○ /api/auth/reset-password\n└ ƒ /dashboard (protected)",
      },
    ],
    codeBlocks: [
      {
        language: "typescript",
        file: "src/lib/auth/jwt.ts",
        code: `import { SignJWT, jwtVerify } from "jose";

const secret = new TextEncoder().encode(
  process.env.JWT_SECRET || "default-secret-change-me"
);

export async function signToken(payload: Record<string, unknown>) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("7d")
    .setIssuedAt()
    .sign(secret);
}

export async function verifyToken(token: string) {
  const { payload } = await jwtVerify(token, secret);
  return payload;
}`,
      },
      {
        language: "typescript",
        file: "src/app/api/auth/login/route.ts",
        code: `import { NextResponse } from "next/server";
import { comparePassword } from "@/lib/auth/password";
import { signToken } from "@/lib/auth/jwt";
import { findUserByEmail } from "@/lib/db/users";

export async function POST(request: Request) {
  const { email, password } = await request.json();

  const user = await findUserByEmail(email);
  if (!user) {
    return NextResponse.json(
      { error: "Invalid credentials" },
      { status: 401 }
    );
  }

  const valid = await comparePassword(password, user.passwordHash);
  if (!valid) {
    return NextResponse.json(
      { error: "Invalid credentials" },
      { status: 401 }
    );
  }

  const token = await signToken({ userId: user.id, email });
  return NextResponse.json({ token, user: { id: user.id, email } });
}`,
      },
    ],
  },
  {
    id: 3,
    role: "user",
    content: "Great! Now add rate limiting to the auth endpoints.",
    timestamp: "2:36 PM",
  },
  {
    id: 4,
    role: "assistant",
    content:
      "I'll add rate limiting to protect the auth endpoints from brute force attacks.",
    timestamp: "2:36 PM",
    actions: [
      {
        type: "thinking",
        content:
          "For rate limiting, I'll create a simple in-memory rate limiter using a Map with IP-based tracking. In production this would use Redis, but for now a Map works.\n\nRate limits:\n- Login: 5 attempts per 15 minutes per IP\n- Signup: 3 attempts per hour per IP\n- Reset password: 3 attempts per hour per IP",
      },
      {
        type: "file_create",
        file: "src/lib/rate-limit.ts",
        description: "In-memory rate limiter with sliding window",
      },
      {
        type: "file_edit",
        file: "src/app/api/auth/login/route.ts",
        description: "Added rate limiting — 5 attempts per 15 min per IP",
      },
      {
        type: "file_edit",
        file: "src/app/api/auth/signup/route.ts",
        description: "Added rate limiting — 3 attempts per hour per IP",
      },
      {
        type: "web_search",
        query: "Next.js rate limiting best practices edge runtime",
        results: [
          "Vercel Rate Limiting Guide — vercel.com/guides/rate-limiting",
          "next-rate-limit npm package documentation",
          "Upstash Redis rate limiting for Next.js",
        ],
      },
      {
        type: "terminal",
        command: "npm run lint && npm run build",
        output: "✓ No lint errors\n✓ Compiled successfully in 2.1s",
      },
    ],
    codeBlocks: [
      {
        language: "typescript",
        file: "src/lib/rate-limit.ts",
        code: `interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): { success: boolean; remaining: number } {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { success: true, remaining: limit - 1 };
  }

  if (entry.count >= limit) {
    return { success: false, remaining: 0 };
  }

  entry.count++;
  return { success: true, remaining: limit - entry.count };
}`,
      },
    ],
  },
];

function ThinkingBlock({ content }: { content: string }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="my-2 rounded-xl border border-gray-200 bg-gray-50">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 px-4 py-2.5 text-left"
      >
        <Sparkles size={14} className="text-amber-500" />
        <span className="text-xs font-medium text-gray-600">
          Thinking process
        </span>
        <Clock size={12} className="ml-1 text-gray-400" />
        <span className="text-[11px] text-gray-400">2.3s</span>
        {expanded ? (
          <ChevronUp size={14} className="ml-auto text-gray-400" />
        ) : (
          <ChevronDown size={14} className="ml-auto text-gray-400" />
        )}
      </button>
      {expanded && (
        <div className="border-t border-gray-200 px-4 py-3">
          <pre className="whitespace-pre-wrap text-xs leading-relaxed text-gray-600">
            {content}
          </pre>
        </div>
      )}
    </div>
  );
}

function ActionItem({ action }: { action: ToolAction }) {
  const iconMap = {
    file_create: { icon: Plus, color: "text-green-500", bg: "bg-green-50", label: "Created" },
    file_edit: { icon: Pencil, color: "text-blue-500", bg: "bg-blue-50", label: "Edited" },
    file_read: { icon: Eye, color: "text-gray-500", bg: "bg-gray-50", label: "Read" },
    terminal: { icon: Terminal, color: "text-amber-500", bg: "bg-amber-50", label: "Ran command" },
    web_search: { icon: Search, color: "text-purple-500", bg: "bg-purple-50", label: "Searched" },
    browser: { icon: Globe, color: "text-cyan-500", bg: "bg-cyan-50", label: "Browsed" },
    thinking: { icon: Sparkles, color: "text-amber-500", bg: "bg-amber-50", label: "Thinking" },
  };

  if (action.type === "thinking") {
    return <ThinkingBlock content={action.content} />;
  }

  const config = iconMap[action.type];
  const Icon = config.icon;

  return (
    <div className="flex items-start gap-2.5 py-1.5">
      <div className={`mt-0.5 rounded-md p-1 ${config.bg}`}>
        <Icon size={12} className={config.color} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium text-gray-500">
            {config.label}
          </span>
          <CheckCircle2 size={11} className="text-green-500" />
        </div>
        {action.type === "file_create" || action.type === "file_edit" ? (
          <div>
            <code className="text-xs font-medium text-rose-600">
              {action.file}
            </code>
            <p className="text-[11px] text-gray-400">{action.description}</p>
          </div>
        ) : action.type === "file_read" ? (
          <code className="text-xs text-gray-600">{action.file}</code>
        ) : action.type === "terminal" ? (
          <div className="mt-1 rounded-lg bg-gray-900 px-3 py-2">
            <div className="text-xs text-gray-400">
              <span className="text-rose-400">$</span> {action.command}
            </div>
            <pre className="mt-1 whitespace-pre-wrap text-[11px] text-gray-500">
              {action.output}
            </pre>
          </div>
        ) : action.type === "web_search" ? (
          <div>
            <p className="text-xs text-gray-600">
              &quot;{action.query}&quot;
            </p>
            <div className="mt-1 space-y-0.5">
              {action.results.map((r, i) => (
                <p key={i} className="text-[11px] text-blue-500">
                  {r}
                </p>
              ))}
            </div>
          </div>
        ) : action.type === "browser" ? (
          <code className="text-xs text-blue-500">{action.url}</code>
        ) : null}
      </div>
    </div>
  );
}

export default function ChatPage() {
  const [messages] = useState<Message[]>(agentConversation);
  const [inputValue, setInputValue] = useState("");
  const [rightPanel, setRightPanel] = useState<
    "none" | "browser" | "terminal"
  >("none");
  const model = "Auto";

  return (
    <div className="flex h-full flex-col">
      {/* Top bar */}
      <div className="flex h-11 items-center justify-between border-b border-gray-200 bg-white px-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-900">
            Build auth system with JWT
          </span>
          <span className="rounded bg-green-50 px-1.5 py-0.5 text-[10px] font-medium text-green-600">
            Agent active
          </span>
          <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500">
            7 files changed
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
            <ArrowLeft size={14} />
          </button>
          <button className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
            <ArrowRight size={14} />
          </button>
          <div className="ml-2 flex items-center rounded-lg border border-gray-200">
            <button className="rounded-l-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
              <Code size={14} />
            </button>
            <button
              onClick={() =>
                setRightPanel(rightPanel === "browser" ? "none" : "browser")
              }
              className={`p-1.5 ${rightPanel === "browser" ? "bg-gray-100 text-gray-900" : "text-gray-400 hover:bg-gray-100 hover:text-gray-600"}`}
            >
              <Globe size={14} />
            </button>
            <button
              onClick={() =>
                setRightPanel(rightPanel === "terminal" ? "none" : "terminal")
              }
              className={`rounded-r-lg p-1.5 ${rightPanel === "terminal" ? "bg-gray-100 text-gray-900" : "text-gray-400 hover:bg-gray-100 hover:text-gray-600"}`}
            >
              <Terminal size={14} />
            </button>
          </div>
          <button className="ml-1 rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
            <FolderOpen size={14} />
          </button>
          <button className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
            <MoreHorizontal size={14} />
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Main chat */}
        <div className="flex flex-1 flex-col">
          <div className="flex-1 overflow-y-auto">
            <div className="mx-auto max-w-3xl px-6 py-6">
              {messages.map((msg) => (
                <div key={msg.id} className="mb-6">
                  {msg.role === "user" ? (
                    <div className="flex justify-end">
                      <div className="max-w-[80%]">
                        <div className="rounded-2xl bg-gray-100 px-4 py-3">
                          <p className="text-sm leading-relaxed text-gray-900">
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
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-rose-600">
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
                        {msg.isLoading ? (
                          <div className="flex items-center gap-2 text-sm text-gray-400">
                            <Loader2 size={14} className="animate-spin" />
                            Thinking...
                          </div>
                        ) : (
                          <>
                            <p className="text-sm leading-relaxed text-gray-700">
                              {msg.content}
                            </p>

                            {/* Agent actions */}
                            {msg.actions && msg.actions.length > 0 && (
                              <div className="mt-3 space-y-1 rounded-xl border border-gray-200 bg-white p-3">
                                <div className="mb-2 flex items-center gap-2">
                                  <Play size={12} className="text-rose-500" />
                                  <span className="text-[11px] font-semibold text-gray-700">
                                    Agent Actions
                                  </span>
                                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] text-gray-500">
                                    {msg.actions.length} steps
                                  </span>
                                </div>
                                {msg.actions.map((action, idx) => (
                                  <ActionItem key={idx} action={action} />
                                ))}
                              </div>
                            )}

                            {/* Code blocks */}
                            {msg.codeBlocks?.map((block, idx) => (
                              <div
                                key={idx}
                                className="my-3 overflow-hidden rounded-xl border border-gray-200"
                              >
                                <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-4 py-2">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-medium text-gray-500">
                                      {block.language}
                                    </span>
                                    {block.file && (
                                      <code className="text-[11px] text-rose-500">
                                        {block.file}
                                      </code>
                                    )}
                                  </div>
                                  <button className="text-gray-400 hover:text-gray-600">
                                    <Copy size={12} />
                                  </button>
                                </div>
                                <pre className="overflow-x-auto bg-gray-900 p-4 text-[13px] leading-relaxed text-gray-300">
                                  <code>{block.code}</code>
                                </pre>
                              </div>
                            ))}

                            {/* Message actions */}
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
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Input */}
          <div className="border-t border-gray-100 bg-white px-6 py-4">
            <div className="mx-auto max-w-3xl">
              <div className="flex items-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-sm focus-within:border-gray-300 focus-within:shadow-md">
                <Plus size={18} className="shrink-0 text-gray-400" />
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="Send follow-up..."
                  className="flex-1 bg-transparent text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none"
                />
                <div className="flex items-center gap-2">
                  <button className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-gray-500 hover:bg-gray-100">
                    {model}
                    <ChevronDown size={12} />
                  </button>
                  <button className="text-gray-400 hover:text-gray-600">
                    <Mic size={16} />
                  </button>
                </div>
              </div>
              <div className="mt-2 flex items-center justify-between px-1">
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

        {/* Right panel */}
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
            {rightPanel === "browser" && (
              <div className="flex flex-1 items-center justify-center bg-white">
                <div className="text-center">
                  <Globe size={48} className="mx-auto mb-3 text-gray-200" />
                  <p className="text-sm font-medium text-gray-400">
                    Preview
                  </p>
                  <p className="mt-1 text-xs text-gray-300">
                    localhost:3000
                  </p>
                </div>
              </div>
            )}
            {rightPanel === "terminal" && (
              <div className="flex-1 bg-gray-950 p-4 font-mono text-sm text-gray-300">
                <div>
                  <span className="text-rose-400">~/teskel $</span>{" "}
                  <span className="text-gray-400">npm install jose bcryptjs</span>
                </div>
                <div className="mt-1 text-gray-500">
                  added 2 packages in 1.2s
                </div>
                <div className="mt-2">
                  <span className="text-rose-400">~/teskel $</span>{" "}
                  <span className="text-gray-400">npm run build</span>
                </div>
                <div className="mt-1 text-gray-500">
                  ▲ Next.js 16.2.7 (Turbopack)
                </div>
                <div className="text-green-400">✓ Compiled successfully</div>
                <div className="text-green-400">✓ Linting passed</div>
                <div className="text-green-400">✓ Type checking passed</div>
                <div className="mt-2 flex items-center">
                  <span className="text-rose-400">~/teskel $</span>
                  <span className="ml-1 inline-block h-4 w-1.5 animate-pulse bg-gray-500" />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
