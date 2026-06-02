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
  Mic,
  Plus,
  Maximize2,
  MoreHorizontal,
  X,
} from "lucide-react";

interface Message {
  id: number;
  role: "user" | "assistant";
  content: string;
  codeBlocks?: { language: string; code: string }[];
  thinking?: string;
}

const sampleConversation: Message[] = [
  {
    id: 1,
    role: "user",
    content: "Build a responsive navbar component with a mobile hamburger menu using Next.js and Tailwind CSS.",
  },
  {
    id: 2,
    role: "assistant",
    content:
      "I'll create a responsive navbar component with a hamburger menu for mobile. Here's the implementation:",
    codeBlocks: [
      {
        language: "tsx",
        code: `"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 border-b bg-white">
      <div className="mx-auto max-w-7xl px-4">
        <div className="flex h-16 items-center justify-between">
          <Link href="/" className="text-xl font-bold">
            Logo
          </Link>

          {/* Desktop menu */}
          <div className="hidden md:flex items-center gap-6">
            <Link href="/features">Features</Link>
            <Link href="/pricing">Pricing</Link>
            <Link href="/docs">Docs</Link>
          </div>

          {/* Mobile toggle */}
          <button
            className="md:hidden"
            onClick={() => setIsOpen(!isOpen)}
          >
            {isOpen ? <X /> : <Menu />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {isOpen && (
        <div className="border-t px-4 py-3 md:hidden">
          <Link href="/features" className="block py-2">
            Features
          </Link>
          <Link href="/pricing" className="block py-2">
            Pricing
          </Link>
          <Link href="/docs" className="block py-2">
            Docs
          </Link>
        </div>
      )}
    </nav>
  );
}`,
      },
    ],
  },
  {
    id: 3,
    role: "user",
    content: "Can you add a dropdown menu for the Products section?",
  },
  {
    id: 4,
    role: "assistant",
    content:
      "Sure! I'll add a dropdown menu to the Products section with hover support and smooth animations:",
    codeBlocks: [
      {
        language: "tsx",
        code: `const [dropdownOpen, setDropdownOpen] = useState(false);

<div className="relative">
  <button
    onMouseEnter={() => setDropdownOpen(true)}
    onMouseLeave={() => setDropdownOpen(false)}
    className="flex items-center gap-1"
  >
    Products <ChevronDown size={14} />
  </button>
  {dropdownOpen && (
    <div className="absolute top-full left-0 mt-2
      w-48 rounded-lg border bg-white p-2 shadow-lg">
      <Link href="/editor" className="block rounded px-3 py-2
        hover:bg-gray-50">Editor</Link>
      <Link href="/terminal" className="block rounded px-3 py-2
        hover:bg-gray-50">Terminal</Link>
      <Link href="/agent" className="block rounded px-3 py-2
        hover:bg-gray-50">AI Agent</Link>
    </div>
  )}
</div>`,
      },
    ],
  },
];

export default function DashboardPage() {
  const [messages, setMessages] = useState<Message[]>(sampleConversation);
  const [inputValue, setInputValue] = useState("");
  const [rightPanel, setRightPanel] = useState<"none" | "browser" | "code" | "terminal">("none");
  const model = "Auto";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    const userMsg: Message = {
      id: messages.length + 1,
      role: "user",
      content: inputValue,
    };
    setMessages([...messages, userMsg]);
    setInputValue("");

    setTimeout(() => {
      const aiMsg: Message = {
        id: messages.length + 2,
        role: "assistant",
        content:
          "I'll help you with that. Let me think about the best approach...",
      };
      setMessages((prev) => [...prev, aiMsg]);
    }, 1000);
  };

  return (
    <div className="flex h-full flex-col">
      {/* Top bar - navigation */}
      <div className="flex h-11 items-center justify-between border-b border-gray-200 bg-white px-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-900">
            Ideation for SaaS product
          </span>
        </div>

        <div className="flex items-center gap-1">
          {/* Navigation arrows */}
          <button className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
            <ArrowLeft size={14} />
          </button>
          <button className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
            <ArrowRight size={14} />
          </button>

          {/* View toggles */}
          <div className="ml-2 flex items-center rounded-lg border border-gray-200">
            <button
              className="rounded-l-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              title="Code view"
            >
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
              title="Browser view"
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
              title="Terminal view"
            >
              <Terminal size={14} />
            </button>
          </div>

          {/* Copy / More */}
          <button className="ml-1 rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
            <Copy size={14} />
          </button>
          <button className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
            <MoreHorizontal size={14} />
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Main chat area */}
        <div className="flex flex-1 flex-col">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto">
            <div className="mx-auto max-w-3xl px-6 py-6">
              {messages.map((msg) => (
                <div key={msg.id} className="mb-6">
                  {msg.role === "user" ? (
                    <div className="flex justify-end">
                      <div className="max-w-[80%] rounded-2xl bg-gray-100 px-4 py-3">
                        <p className="text-sm leading-relaxed text-gray-900">
                          {msg.content}
                        </p>
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
                      </div>
                      <div className="pl-8">
                        <p className="text-sm leading-relaxed text-gray-700">
                          {msg.content}
                        </p>
                        {msg.codeBlocks?.map((block, idx) => (
                          <div
                            key={idx}
                            className="my-3 overflow-hidden rounded-xl border border-gray-200"
                          >
                            <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-4 py-2">
                              <span className="text-xs font-medium text-gray-500">
                                {block.language}
                              </span>
                              <button className="text-gray-400 hover:text-gray-600">
                                <Copy size={12} />
                              </button>
                            </div>
                            <pre className="overflow-x-auto bg-gray-900 p-4 text-[13px] leading-relaxed text-gray-300">
                              <code>{block.code}</code>
                            </pre>
                          </div>
                        ))}
                        {/* Action buttons */}
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
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Input area */}
          <div className="border-t border-gray-100 bg-white px-6 py-4">
            <form onSubmit={handleSubmit} className="mx-auto max-w-3xl">
              <div className="flex items-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-sm focus-within:border-gray-300 focus-within:shadow-md">
                <Plus
                  size={18}
                  className="shrink-0 text-gray-400"
                />
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="Send follow-up"
                  className="flex-1 bg-transparent text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none"
                />
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-gray-500 hover:bg-gray-100"
                  >
                    {model}
                    <ChevronDown size={12} />
                  </button>
                  <button
                    type="button"
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <Mic size={16} />
                  </button>
                </div>
              </div>
              <div className="mt-2 flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                  >
                    <Globe size={12} />
                    Web
                  </button>
                  <button
                    type="button"
                    className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                  >
                    <Code size={12} />
                    Code
                  </button>
                  <button
                    type="button"
                    className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                  >
                    <Terminal size={12} />
                    Terminal
                  </button>
                  <button
                    type="button"
                    className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                  >
                    <FileText size={12} />
                    Docs
                  </button>
                </div>
                <span className="text-[11px] text-gray-400">Local</span>
              </div>
            </form>
          </div>
        </div>

        {/* Right panel - Browser / Terminal */}
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
                      <span className="text-xs text-gray-400">
                        Search or enter URL
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
              <div className="flex flex-1 items-center justify-center text-gray-300">
                <div className="text-center">
                  <Globe size={48} className="mx-auto mb-3 opacity-30" />
                  <p className="text-sm text-gray-400">
                    Enter a URL to browse
                  </p>
                </div>
              </div>
            )}

            {rightPanel === "terminal" && (
              <div className="flex-1 bg-gray-950 p-4 font-mono text-sm text-gray-300">
                <div>
                  <span className="text-rose-500">~/project $</span>{" "}
                  <span className="text-gray-400">npm run dev</span>
                </div>
                <div className="mt-1 text-gray-500">
                  ▲ Next.js 16.2.7 (Turbopack)
                </div>
                <div className="text-gray-500">
                  - Local: http://localhost:3000
                </div>
                <div className="text-gray-500">
                  - Network: http://192.168.1.5:3000
                </div>
                <div className="mt-1 text-green-400">✓ Ready in 1.2s</div>
                <div className="mt-2 flex items-center">
                  <span className="text-rose-500">~/project $</span>
                  <span className="ml-1 h-4 w-1.5 animate-pulse bg-gray-500" />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
