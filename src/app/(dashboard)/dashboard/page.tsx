"use client";

import { useState } from "react";
import {
  ChevronRight,
  ChevronDown,
  File,
  Folder,
  Play,
  GitBranch,
  Bell,
  Search,
  MoreHorizontal,
  Send,
  Sparkles,
  PanelLeftClose,
  PanelBottomClose,
  X,
  Plus,
} from "lucide-react";

interface FileNode {
  name: string;
  type: "file" | "folder";
  children?: FileNode[];
}

const fileTree: FileNode[] = [
  {
    name: "src",
    type: "folder",
    children: [
      {
        name: "app",
        type: "folder",
        children: [
          { name: "layout.tsx", type: "file" },
          { name: "page.tsx", type: "file" },
          { name: "globals.css", type: "file" },
        ],
      },
      {
        name: "components",
        type: "folder",
        children: [
          { name: "Navbar.tsx", type: "file" },
          { name: "Hero.tsx", type: "file" },
          { name: "Features.tsx", type: "file" },
          { name: "Footer.tsx", type: "file" },
        ],
      },
      {
        name: "lib",
        type: "folder",
        children: [{ name: "utils.ts", type: "file" }],
      },
    ],
  },
  { name: "package.json", type: "file" },
  { name: "tsconfig.json", type: "file" },
  { name: "README.md", type: "file" },
];

function FileTreeItem({
  node,
  depth = 0,
}: {
  node: FileNode;
  depth?: number;
}) {
  const [open, setOpen] = useState(depth < 2);

  if (node.type === "folder") {
    return (
      <div>
        <button
          onClick={() => setOpen(!open)}
          className="flex w-full items-center gap-1.5 rounded px-2 py-1 text-left text-xs text-gray-400 hover:bg-gray-800 hover:text-gray-200"
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
        >
          {open ? (
            <ChevronDown size={12} />
          ) : (
            <ChevronRight size={12} />
          )}
          <Folder size={14} className="text-blue-400" />
          <span>{node.name}</span>
        </button>
        {open &&
          node.children?.map((child) => (
            <FileTreeItem key={child.name} node={child} depth={depth + 1} />
          ))}
      </div>
    );
  }

  const ext = node.name.split(".").pop();
  const iconColor =
    ext === "tsx" || ext === "ts"
      ? "text-blue-400"
      : ext === "css"
        ? "text-purple-400"
        : ext === "json"
          ? "text-yellow-400"
          : "text-gray-400";

  return (
    <button
      className="flex w-full items-center gap-1.5 rounded px-2 py-1 text-left text-xs text-gray-400 hover:bg-gray-800 hover:text-gray-200"
      style={{ paddingLeft: `${depth * 12 + 20}px` }}
    >
      <File size={14} className={iconColor} />
      <span>{node.name}</span>
    </button>
  );
}

const codeContent = `"use client";

import React, { useState } from "react";
import Navigation from "./Navigation";
import SupportChat from "./SupportChat";

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState("support");
  const [messages, setMessages] = useState<Message[]>([]);

  const handleSendMessage = async (content: string) => {
    const newMessage: Message = {
      id: Date.now(),
      role: "user",
      content,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, newMessage]);

    // AI response
    const response = await fetch("/api/chat", {
      method: "POST",
      body: JSON.stringify({ messages: [...messages, newMessage] }),
    });
    const data = await response.json();
    setMessages((prev) => [...prev, data.message]);
  };

  return (
    <div className="flex h-[600px] border rounded-lg overflow-hidden">
      <div className="w-64 border-r">
        <Navigation activeTab={activeTab} onTabChange={setActiveTab} />
      </div>
      <div className="flex-1 p-4">
        <SupportChat messages={messages} onSend={handleSendMessage} />
      </div>
    </div>
  );
}`;

const terminalLines = [
  { prompt: true, text: "npm run dev" },
  { prompt: false, text: "  ▲ Next.js 16.2.7 (Turbopack)" },
  { prompt: false, text: "  - Local:   http://localhost:3000" },
  { prompt: false, text: "  - Network: http://192.168.1.5:3000" },
  { prompt: false, text: "" },
  { prompt: false, text: " ✓ Starting..." },
  { prompt: false, text: " ✓ Ready in 1.2s" },
];

export default function DashboardPage() {
  const [showExplorer, setShowExplorer] = useState(true);
  const [showTerminal, setShowTerminal] = useState(true);
  const [showChat, setShowChat] = useState(true);
  const [chatInput, setChatInput] = useState("");
  const [activeTab, setActiveTab] = useState("Dashboard.tsx");

  const tabs = ["Dashboard.tsx", "SupportChat.tsx"];

  return (
    <div className="flex h-full flex-col">
      {/* Top bar */}
      <div className="flex h-12 items-center justify-between border-b border-gray-800 bg-gray-900 px-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setShowExplorer(!showExplorer)}
            className="text-gray-500 hover:text-gray-300"
          >
            <PanelLeftClose size={16} />
          </button>
          <div className="flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-800 px-3 py-1.5">
            <Search size={14} className="text-gray-500" />
            <span className="text-xs text-gray-500">
              Search files... 
            </span>
            <kbd className="ml-8 rounded border border-gray-700 bg-gray-900 px-1.5 py-0.5 text-[10px] text-gray-500">
              Ctrl+P
            </kbd>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 rounded-lg border border-gray-700 px-3 py-1.5 text-xs text-gray-400 hover:bg-gray-800">
            <GitBranch size={14} />
            main
          </button>
          <button className="flex items-center gap-2 rounded-lg bg-green-600/20 px-3 py-1.5 text-xs text-green-400">
            <Play size={14} />
            Running
          </button>
          <button className="relative text-gray-500 hover:text-gray-300">
            <Bell size={16} />
            <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-rose-500" />
          </button>
          <button className="text-gray-500 hover:text-gray-300">
            <MoreHorizontal size={16} />
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* File explorer */}
        {showExplorer && (
          <div className="w-56 shrink-0 overflow-y-auto border-r border-gray-800 bg-gray-900">
            <div className="flex items-center justify-between border-b border-gray-800 px-3 py-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                Explorer
              </span>
              <button className="text-gray-500 hover:text-gray-300">
                <Plus size={14} />
              </button>
            </div>
            <div className="py-1">
              {fileTree.map((node) => (
                <FileTreeItem key={node.name} node={node} />
              ))}
            </div>
          </div>
        )}

        {/* Editor + terminal */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-gray-800 bg-gray-900">
            {tabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex items-center gap-2 border-r border-gray-800 px-4 py-2.5 text-xs ${
                  activeTab === tab
                    ? "bg-gray-950 text-white"
                    : "text-gray-500 hover:text-gray-300"
                }`}
              >
                <File size={12} className="text-blue-400" />
                {tab}
                {activeTab === tab && (
                  <X
                    size={12}
                    className="ml-2 text-gray-600 hover:text-gray-300"
                  />
                )}
              </button>
            ))}
          </div>

          {/* Code area */}
          <div className="flex-1 overflow-auto bg-gray-950 p-4 font-mono text-sm">
            {codeContent.split("\n").map((line, i) => (
              <div key={i} className="flex hover:bg-gray-900/50">
                <span className="mr-4 w-8 select-none text-right text-gray-700">
                  {i + 1}
                </span>
                <span className="text-gray-300">
                  {line
                    .replace(
                      /(import|export|default|function|const|return|async|await|from)/g,
                      '<span class="text-purple-400">$1</span>'
                    )
                    .replace(
                      /(".*?")/g,
                      '<span class="text-green-400">$1</span>'
                    )}
                </span>
              </div>
            ))}
          </div>

          {/* Terminal */}
          {showTerminal && (
            <div className="h-48 shrink-0 border-t border-gray-800 bg-gray-950">
              <div className="flex items-center justify-between border-b border-gray-800 px-4 py-1.5">
                <div className="flex items-center gap-4">
                  <span className="text-xs font-medium text-white">
                    Terminal
                  </span>
                  <span className="text-xs text-gray-600">Problems</span>
                  <span className="text-xs text-gray-600">Output</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowTerminal(false)}
                    className="text-gray-500 hover:text-gray-300"
                  >
                    <PanelBottomClose size={14} />
                  </button>
                </div>
              </div>
              <div className="overflow-auto p-3 font-mono text-xs">
                {terminalLines.map((line, i) => (
                  <div key={i} className="leading-relaxed">
                    {line.prompt && (
                      <span className="text-green-400">~/project $ </span>
                    )}
                    <span className={line.prompt ? "text-white" : "text-gray-400"}>
                      {line.text}
                    </span>
                  </div>
                ))}
                <div className="mt-1 flex items-center">
                  <span className="text-green-400">~/project $ </span>
                  <span className="ml-1 h-4 w-1.5 animate-pulse bg-gray-400" />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* AI Chat panel */}
        {showChat && (
          <div className="flex w-80 shrink-0 flex-col border-l border-gray-800 bg-gray-900">
            <div className="flex items-center justify-between border-b border-gray-800 px-4 py-3">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-rose-500" />
                <span className="text-sm font-medium text-white">
                  Teskel AI
                </span>
              </div>
              <button
                onClick={() => setShowChat(false)}
                className="text-gray-500 hover:text-gray-300"
              >
                <X size={14} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {/* Welcome message */}
              <div className="mb-4 rounded-xl bg-gray-800 p-4">
                <div className="mb-2 flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-rose-600">
                    <Sparkles size={12} className="text-white" />
                  </div>
                  <span className="text-xs font-medium text-gray-300">
                    Teskel AI
                  </span>
                </div>
                <p className="text-sm leading-relaxed text-gray-300">
                  Hi! I&apos;m Teskel AI. I can help you with:
                </p>
                <ul className="mt-2 space-y-1 text-sm text-gray-400">
                  <li>• Writing and editing code</li>
                  <li>• Debugging errors</li>
                  <li>• Explaining code logic</li>
                  <li>• Generating tests</li>
                  <li>• Refactoring suggestions</li>
                </ul>
              </div>

              {/* Sample conversation */}
              <div className="mb-4 rounded-xl bg-gray-800/50 p-4">
                <p className="text-sm text-gray-300">
                  How do I add authentication to this Next.js app?
                </p>
              </div>

              <div className="mb-4 rounded-xl bg-gray-800 p-4">
                <div className="mb-2 flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-rose-600">
                    <Sparkles size={12} className="text-white" />
                  </div>
                  <span className="text-xs font-medium text-gray-300">
                    Teskel AI
                  </span>
                </div>
                <p className="text-sm leading-relaxed text-gray-300">
                  I recommend using <code className="rounded bg-gray-700 px-1 text-rose-400">NextAuth.js</code> for authentication. Here&apos;s a quick setup:
                </p>
                <div className="mt-3 rounded-lg bg-gray-950 p-3 font-mono text-xs text-gray-300">
                  <div className="text-green-400">npm install next-auth</div>
                  <div className="mt-2 text-gray-500">
                    {`// src/app/api/auth/[...nextauth]/route.ts`}
                  </div>
                  <div className="text-purple-400">
                    import NextAuth from &quot;next-auth&quot;
                  </div>
                </div>
              </div>
            </div>

            {/* Chat input */}
            <div className="border-t border-gray-800 p-3">
              <div className="flex items-center gap-2 rounded-xl border border-gray-700 bg-gray-800 px-3 py-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Ask Teskel AI..."
                  className="flex-1 bg-transparent text-sm text-white placeholder:text-gray-500 focus:outline-none"
                />
                <button className="text-gray-500 hover:text-rose-500">
                  <Send size={16} />
                </button>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-[10px] text-gray-600">
                  / for commands · @ for files
                </span>
                <span className="text-[10px] text-gray-600">
                  Teskel AI 2.5
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
