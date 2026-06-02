"use client";

import { useState } from "react";
import {
  ChevronRight,
  ChevronDown,
  File,
  FolderOpen,
  Folder,
  X,
  Search,
  GitBranch,
  Play,
  Terminal,
  MoreHorizontal,
  Copy,
  Maximize2,
  Split,
  Settings,
  Plus,
} from "lucide-react";

interface FileNode {
  name: string;
  type: "file" | "folder";
  children?: FileNode[];
  language?: string;
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
          { name: "layout.tsx", type: "file", language: "tsx" },
          { name: "page.tsx", type: "file", language: "tsx" },
          { name: "globals.css", type: "file", language: "css" },
        ],
      },
      {
        name: "components",
        type: "folder",
        children: [
          { name: "Navbar.tsx", type: "file", language: "tsx" },
          { name: "Hero.tsx", type: "file", language: "tsx" },
          { name: "Features.tsx", type: "file", language: "tsx" },
          { name: "Footer.tsx", type: "file", language: "tsx" },
        ],
      },
      {
        name: "lib",
        type: "folder",
        children: [
          { name: "utils.ts", type: "file", language: "ts" },
          { name: "api.ts", type: "file", language: "ts" },
          { name: "auth.ts", type: "file", language: "ts" },
        ],
      },
    ],
  },
  { name: "package.json", type: "file", language: "json" },
  { name: "tsconfig.json", type: "file", language: "json" },
  { name: "tailwind.config.ts", type: "file", language: "ts" },
  { name: "next.config.ts", type: "file", language: "ts" },
  { name: ".env.local", type: "file", language: "env" },
  { name: "README.md", type: "file", language: "md" },
];

const sampleCode: Record<string, { content: string; lines: number }> = {
  "page.tsx": {
    lines: 42,
    content: `import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import Features from "@/components/Features";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <>
      <Navbar />
      <main className="flex-1">
        <Hero />
        <Features />
      </main>
      <Footer />
    </>
  );
}`,
  },
  "Navbar.tsx": {
    lines: 68,
    content: `"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 border-b bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-xl font-bold">TESKEL</span>
        </Link>

        <div className="hidden items-center gap-6 md:flex">
          <Link href="/features" className="text-sm text-gray-600 hover:text-gray-900">
            Features
          </Link>
          <Link href="/pricing" className="text-sm text-gray-600 hover:text-gray-900">
            Pricing
          </Link>
          <Link href="/docs" className="text-sm text-gray-600 hover:text-gray-900">
            Docs
          </Link>
          <Link href="/login" className="text-sm font-medium text-gray-900">
            Sign in
          </Link>
          <Link
            href="/signup"
            className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700"
          >
            Get Started
          </Link>
        </div>

        <button className="md:hidden" onClick={() => setIsOpen(!isOpen)}>
          {isOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>
    </nav>
  );
}`,
  },
  "utils.ts": {
    lines: 31,
    content: `import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.slice(0, length) + "...";
}

export async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}`,
  },
};

interface Tab {
  name: string;
  language: string;
}

function FileTreeItem({
  node,
  depth,
  onSelect,
  selectedFile,
}: {
  node: FileNode;
  depth: number;
  onSelect: (name: string) => void;
  selectedFile: string;
}) {
  const [expanded, setExpanded] = useState(depth === 0);

  if (node.type === "folder") {
    return (
      <div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex w-full items-center gap-1 py-1 pr-2 text-left text-[13px] text-gray-600 hover:bg-gray-100"
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
        >
          {expanded ? (
            <ChevronDown size={14} className="shrink-0 text-gray-400" />
          ) : (
            <ChevronRight size={14} className="shrink-0 text-gray-400" />
          )}
          {expanded ? (
            <FolderOpen size={14} className="shrink-0 text-amber-500" />
          ) : (
            <Folder size={14} className="shrink-0 text-amber-500" />
          )}
          <span className="ml-1 truncate">{node.name}</span>
        </button>
        {expanded &&
          node.children?.map((child) => (
            <FileTreeItem
              key={child.name}
              node={child}
              depth={depth + 1}
              onSelect={onSelect}
              selectedFile={selectedFile}
            />
          ))}
      </div>
    );
  }

  const langColors: Record<string, string> = {
    tsx: "text-blue-500",
    ts: "text-blue-500",
    css: "text-purple-500",
    json: "text-yellow-600",
    md: "text-gray-500",
    env: "text-green-600",
  };

  return (
    <button
      onClick={() => onSelect(node.name)}
      className={`flex w-full items-center gap-1 py-1 pr-2 text-left text-[13px] transition-colors ${
        selectedFile === node.name
          ? "bg-rose-50 text-gray-900"
          : "text-gray-600 hover:bg-gray-100"
      }`}
      style={{ paddingLeft: `${depth * 12 + 22}px` }}
    >
      <File
        size={14}
        className={`shrink-0 ${langColors[node.language || ""] || "text-gray-400"}`}
      />
      <span className="ml-1 truncate">{node.name}</span>
    </button>
  );
}

export default function EditorPage() {
  const [selectedFile, setSelectedFile] = useState("page.tsx");
  const [tabs, setTabs] = useState<Tab[]>([
    { name: "page.tsx", language: "tsx" },
    { name: "Navbar.tsx", language: "tsx" },
  ]);
  const [activeTab, setActiveTab] = useState("page.tsx");
  const [showTerminal, setShowTerminal] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);

  const handleFileSelect = (name: string) => {
    setSelectedFile(name);
    setActiveTab(name);
    if (!tabs.find((t) => t.name === name)) {
      setTabs([...tabs, { name, language: "tsx" }]);
    }
  };

  const closeTab = (name: string) => {
    const newTabs = tabs.filter((t) => t.name !== name);
    setTabs(newTabs);
    if (activeTab === name && newTabs.length > 0) {
      setActiveTab(newTabs[newTabs.length - 1].name);
      setSelectedFile(newTabs[newTabs.length - 1].name);
    }
  };

  const currentCode = sampleCode[activeTab];
  const codeLines = currentCode?.content.split("\n") || [];

  return (
    <div className="flex h-full flex-col bg-white">
      {/* Top bar */}
      <div className="flex h-10 items-center justify-between border-b border-gray-200 bg-gray-50 px-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-sm text-gray-500">
            <GitBranch size={14} />
            <span className="text-xs font-medium">main</span>
          </div>
          <span className="text-xs text-gray-400">teskel-web</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setSearchOpen(!searchOpen)}
            className="rounded p-1.5 text-gray-400 hover:bg-gray-200 hover:text-gray-600"
          >
            <Search size={14} />
          </button>
          <button className="rounded p-1.5 text-gray-400 hover:bg-gray-200 hover:text-gray-600">
            <Play size={14} />
          </button>
          <button className="rounded p-1.5 text-gray-400 hover:bg-gray-200 hover:text-gray-600">
            <Split size={14} />
          </button>
          <button
            onClick={() => setShowTerminal(!showTerminal)}
            className={`rounded p-1.5 ${showTerminal ? "bg-gray-200 text-gray-700" : "text-gray-400 hover:bg-gray-200 hover:text-gray-600"}`}
          >
            <Terminal size={14} />
          </button>
          <button className="rounded p-1.5 text-gray-400 hover:bg-gray-200 hover:text-gray-600">
            <Settings size={14} />
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* File explorer */}
        <div className="flex w-56 flex-col border-r border-gray-200 bg-white">
          <div className="flex h-9 items-center justify-between border-b border-gray-100 px-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Explorer
            </span>
            <div className="flex items-center gap-0.5">
              <button className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
                <Plus size={12} />
              </button>
              <button className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
                <MoreHorizontal size={12} />
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto py-1">
            {fileTree.map((node) => (
              <FileTreeItem
                key={node.name}
                node={node}
                depth={0}
                onSelect={handleFileSelect}
                selectedFile={selectedFile}
              />
            ))}
          </div>
        </div>

        {/* Editor area */}
        <div className="flex flex-1 flex-col">
          {/* Tabs */}
          <div className="flex h-9 items-center border-b border-gray-200 bg-gray-50">
            {tabs.map((tab) => (
              <div
                key={tab.name}
                onClick={() => {
                  setActiveTab(tab.name);
                  setSelectedFile(tab.name);
                }}
                className={`group flex h-full cursor-pointer items-center gap-2 border-r border-gray-200 px-3 text-[13px] ${
                  activeTab === tab.name
                    ? "border-b-2 border-b-rose-500 bg-white text-gray-900"
                    : "text-gray-500 hover:bg-gray-100"
                }`}
              >
                <File size={12} className="text-blue-500" />
                <span>{tab.name}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTab(tab.name);
                  }}
                  className="rounded p-0.5 opacity-0 hover:bg-gray-200 group-hover:opacity-100"
                >
                  <X size={10} />
                </button>
              </div>
            ))}
          </div>

          {/* Search bar */}
          {searchOpen && (
            <div className="flex items-center gap-2 border-b border-gray-200 bg-gray-50 px-3 py-2">
              <Search size={14} className="text-gray-400" />
              <input
                type="text"
                placeholder="Search in file..."
                className="flex-1 bg-transparent text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none"
                autoFocus
              />
              <button
                onClick={() => setSearchOpen(false)}
                className="rounded p-1 text-gray-400 hover:bg-gray-200"
              >
                <X size={12} />
              </button>
            </div>
          )}

          {/* Code area + terminal */}
          <div className="flex flex-1 flex-col overflow-hidden">
            {/* Code editor */}
            <div className="flex-1 overflow-auto">
              {currentCode ? (
                <div className="flex">
                  {/* Line numbers */}
                  <div className="sticky left-0 flex flex-col bg-gray-50 px-3 py-3 text-right font-mono text-xs leading-6 text-gray-400">
                    {codeLines.map((_, i) => (
                      <span key={i}>{i + 1}</span>
                    ))}
                  </div>
                  {/* Code */}
                  <pre className="flex-1 py-3 pr-6 font-mono text-[13px] leading-6 text-gray-800">
                    <code>
                      {codeLines.map((line, i) => (
                        <div
                          key={i}
                          className="hover:bg-gray-50"
                          style={{ minHeight: "24px" }}
                        >
                          {colorize(line)}
                        </div>
                      ))}
                    </code>
                  </pre>
                  {/* Minimap */}
                  <div className="w-16 border-l border-gray-100 bg-gray-50 p-1">
                    <div className="space-y-px">
                      {codeLines.map((line, i) => (
                        <div
                          key={i}
                          className="h-[2px] rounded-sm bg-gray-300"
                          style={{
                            width: `${Math.min(line.length * 0.8, 100)}%`,
                            opacity: line.trim() ? 0.5 : 0.1,
                          }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-gray-400">
                  Select a file to view
                </div>
              )}
            </div>

            {/* Terminal */}
            {showTerminal && (
              <div className="flex flex-col border-t border-gray-200">
                <div className="flex h-8 items-center justify-between bg-gray-950 px-3">
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] font-medium text-gray-400">
                      TERMINAL
                    </span>
                    <span className="text-[11px] text-gray-600">PROBLEMS</span>
                    <span className="text-[11px] text-gray-600">OUTPUT</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button className="rounded p-1 text-gray-500 hover:text-gray-300">
                      <Plus size={12} />
                    </button>
                    <button className="rounded p-1 text-gray-500 hover:text-gray-300">
                      <Copy size={12} />
                    </button>
                    <button className="rounded p-1 text-gray-500 hover:text-gray-300">
                      <Maximize2 size={12} />
                    </button>
                    <button
                      onClick={() => setShowTerminal(false)}
                      className="rounded p-1 text-gray-500 hover:text-gray-300"
                    >
                      <X size={12} />
                    </button>
                  </div>
                </div>
                <div className="h-36 overflow-auto bg-gray-950 p-3 font-mono text-[13px] text-gray-300">
                  <div>
                    <span className="text-rose-400">~/teskel-web $</span>{" "}
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
                  <div className="mt-1 text-green-400">✓ Ready in 847ms</div>
                  <div className="mt-1 text-gray-500">
                    ○ Compiling /dashboard ...
                  </div>
                  <div className="text-green-400">
                    ✓ Compiled /dashboard in 312ms
                  </div>
                  <div className="mt-2 flex items-center">
                    <span className="text-rose-400">~/teskel-web $</span>
                    <span className="ml-1 inline-block h-4 w-1.5 animate-pulse bg-gray-500" />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Status bar */}
      <div className="flex h-6 items-center justify-between border-t border-gray-200 bg-gray-50 px-3 text-[11px] text-gray-500">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <GitBranch size={11} /> main
          </span>
          <span>0 errors, 0 warnings</span>
        </div>
        <div className="flex items-center gap-3">
          <span>Ln 1, Col 1</span>
          <span>UTF-8</span>
          <span>TypeScript React</span>
          <span>Spaces: 2</span>
        </div>
      </div>
    </div>
  );
}

function colorize(line: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  const remaining = line;
  let key = 0;

  const keywords =
    /\b(import|export|default|function|return|const|let|var|from|if|else|new|true|false|null|undefined|typeof|async|await)\b/g;
  const strings = /(["'`])(?:(?!\1|\\).|\\.)*\1/g;
  const comments = /(\/\/.*$)/g;
  const jsxTags = /(<\/?[A-Z][a-zA-Z]*|<\/?[a-z]+)/g;

  if (comments.test(remaining)) {
    return (
      <span key={key} className="text-gray-400 italic">
        {remaining}
      </span>
    );
  }

  const tokens: { start: number; end: number; className: string }[] = [];

  let match;
  keywords.lastIndex = 0;
  while ((match = keywords.exec(remaining)) !== null) {
    tokens.push({
      start: match.index,
      end: match.index + match[0].length,
      className: "text-purple-600 font-medium",
    });
  }

  strings.lastIndex = 0;
  while ((match = strings.exec(remaining)) !== null) {
    tokens.push({
      start: match.index,
      end: match.index + match[0].length,
      className: "text-green-700",
    });
  }

  jsxTags.lastIndex = 0;
  while ((match = jsxTags.exec(remaining)) !== null) {
    tokens.push({
      start: match.index,
      end: match.index + match[0].length,
      className: "text-rose-600",
    });
  }

  tokens.sort((a, b) => a.start - b.start);

  const filtered: typeof tokens = [];
  let lastEnd = 0;
  for (const t of tokens) {
    if (t.start >= lastEnd) {
      filtered.push(t);
      lastEnd = t.end;
    }
  }

  let pos = 0;
  for (const t of filtered) {
    if (t.start > pos) {
      parts.push(
        <span key={key++}>{remaining.slice(pos, t.start)}</span>
      );
    }
    parts.push(
      <span key={key++} className={t.className}>
        {remaining.slice(t.start, t.end)}
      </span>
    );
    pos = t.end;
  }
  if (pos < remaining.length) {
    parts.push(<span key={key++}>{remaining.slice(pos)}</span>);
  }

  return parts.length > 0 ? parts : remaining;
}
