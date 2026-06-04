"use client";

import { useState } from "react";
import {
  Plus,
  X,
  Copy,
  Maximize2,
  ChevronDown,
  Split,
  Trash2,
} from "lucide-react";

interface TerminalTab {
  id: number;
  name: string;
  cwd: string;
  lines: TerminalLine[];
}

interface TerminalLine {
  type: "prompt" | "output" | "error" | "success" | "info";
  content: string;
}

const defaultTabs: TerminalTab[] = [
  {
    id: 1,
    name: "bash",
    cwd: "~/teskel-web",
    lines: [
      { type: "prompt", content: "npm run dev" },
      { type: "info", content: "▲ Next.js 16.2.7 (Turbopack)" },
      { type: "info", content: "- Local:    http://localhost:3000" },
      { type: "info", content: "- Network:  http://192.168.1.5:3000" },
      { type: "success", content: "✓ Ready in 847ms" },
      { type: "info", content: "" },
      { type: "info", content: "○ Compiling /dashboard ..." },
      { type: "success", content: "✓ Compiled /dashboard in 312ms" },
      { type: "info", content: "○ Compiling /dashboard/editor ..." },
      { type: "success", content: "✓ Compiled /dashboard/editor in 189ms" },
      { type: "info", content: "○ Compiling /dashboard/chat ..." },
      { type: "success", content: "✓ Compiled /dashboard/chat in 245ms" },
      { type: "info", content: "GET /dashboard 200 in 42ms" },
      { type: "info", content: "GET /dashboard/chat 200 in 38ms" },
    ],
  },
  {
    id: 2,
    name: "node",
    cwd: "~/teskel-web",
    lines: [
      { type: "prompt", content: "npm run lint" },
      { type: "success", content: "✓ No ESLint warnings or errors" },
      { type: "prompt", content: "npm run build" },
      { type: "info", content: "▲ Next.js 16.2.7 (Turbopack)" },
      { type: "info", content: "Creating an optimized production build..." },
      { type: "success", content: "✓ Compiled successfully in 4.3s" },
      { type: "success", content: "✓ TypeScript checking passed in 2.9s" },
      { type: "success", content: "✓ Linting passed" },
      { type: "info", content: "" },
      { type: "info", content: "Route (app)              Size   First Load JS" },
      { type: "info", content: "┌ ○ /                    5.2 kB      89.1 kB" },
      { type: "info", content: "├ ○ /dashboard           3.8 kB      87.7 kB" },
      { type: "info", content: "├ ○ /dashboard/chat      4.1 kB      88.0 kB" },
      { type: "info", content: "├ ○ /dashboard/editor    5.6 kB      89.5 kB" },
      { type: "info", content: "├ ○ /login               2.4 kB      86.3 kB" },
      { type: "info", content: "└ ○ /pricing             3.1 kB      87.0 kB" },
      { type: "info", content: "" },
      { type: "success", content: "✓ Build completed successfully" },
    ],
  },
  {
    id: 3,
    name: "git",
    cwd: "~/teskel-web",
    lines: [
      { type: "prompt", content: "git status" },
      { type: "info", content: "On branch feature/auth-system" },
      { type: "info", content: "Changes to be committed:" },
      { type: "success", content: "  new file:   src/lib/auth/jwt.ts" },
      { type: "success", content: "  new file:   src/lib/auth/password.ts" },
      { type: "success", content: "  new file:   src/app/api/auth/login/route.ts" },
      { type: "success", content: "  new file:   src/app/api/auth/signup/route.ts" },
      { type: "success", content: "  new file:   src/middleware.ts" },
      { type: "info", content: "  modified:   package.json" },
      { type: "info", content: "  modified:   package-lock.json" },
      { type: "info", content: "" },
      { type: "prompt", content: "git log --oneline -5" },
      { type: "info", content: "a3f2c1d feat: add rate limiting to auth endpoints" },
      { type: "info", content: "8b4e7f2 feat: implement JWT auth with login/signup" },
      { type: "info", content: "5d1a9c3 feat: add middleware for protected routes" },
      { type: "info", content: "2e6f8b1 refactor: rebuild workspace to cursor style" },
      { type: "info", content: "f44827b feat: final build polish" },
    ],
  },
];

export default function TerminalPage() {
  const [tabs, setTabs] = useState(defaultTabs);
  const [activeTab, setActiveTab] = useState(1);
  const [inputValue, setInputValue] = useState("");

  const currentTab = tabs.find((t) => t.id === activeTab);

  const closeTab = (id: number) => {
    const newTabs = tabs.filter((t) => t.id !== id);
    setTabs(newTabs);
    if (activeTab === id && newTabs.length > 0) {
      setActiveTab(newTabs[0].id);
    }
  };

  const addTab = () => {
    const newId = Math.max(...tabs.map((t) => t.id)) + 1;
    const newTab: TerminalTab = {
      id: newId,
      name: "bash",
      cwd: "~/teskel-web",
      lines: [{ type: "prompt", content: "" }],
    };
    setTabs([...tabs, newTab]);
    setActiveTab(newId);
  };

  const handleCommand = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || !currentTab) return;

    const newLine: TerminalLine = { type: "prompt", content: inputValue };
    const outputLine: TerminalLine = {
      type: "info",
      content: `Command '${inputValue}' executed`,
    };

    setTabs(
      tabs.map((t) =>
        t.id === activeTab
          ? { ...t, lines: [...t.lines, newLine, outputLine] }
          : t
      )
    );
    setInputValue("");
  };

  return (
    <div className="flex h-full flex-col bg-gray-950">
      {/* Tab bar */}
      <div className="flex items-center justify-between border-b border-gray-800 bg-gray-900">
        <div className="flex items-center">
          {tabs.map((tab) => (
            <div
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`group flex cursor-pointer items-center gap-2 border-r border-gray-800 px-4 py-2 text-[13px] ${
                activeTab === tab.id
                  ? "bg-gray-950 text-gray-200"
                  : "text-gray-500 hover:bg-gray-800 hover:text-gray-400"
              }`}
            >
              <span className={`h-2 w-2 rounded-full ${
                activeTab === tab.id ? "bg-green-500" : "bg-gray-600"
              }`} />
              <span>{tab.name}</span>
              <span className="text-[10px] text-gray-600">{tab.cwd}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  closeTab(tab.id);
                }}
                className="rounded p-0.5 opacity-0 hover:bg-gray-700 group-hover:opacity-100"
              >
                <X size={10} className="text-gray-500" />
              </button>
            </div>
          ))}
          <button
            onClick={addTab}
            className="px-3 py-2 text-gray-600 hover:bg-gray-800 hover:text-gray-400"
          >
            <Plus size={14} />
          </button>
        </div>
        <div className="flex items-center gap-1 px-3">
          <button className="rounded p-1.5 text-gray-600 hover:bg-gray-800 hover:text-gray-400">
            <Split size={14} />
          </button>
          <button className="rounded p-1.5 text-gray-600 hover:bg-gray-800 hover:text-gray-400">
            <Copy size={14} />
          </button>
          <button className="rounded p-1.5 text-gray-600 hover:bg-gray-800 hover:text-gray-400">
            <Trash2 size={14} />
          </button>
          <button className="rounded p-1.5 text-gray-600 hover:bg-gray-800 hover:text-gray-400">
            <Maximize2 size={14} />
          </button>
          <button className="rounded p-1.5 text-gray-600 hover:bg-gray-800 hover:text-gray-400">
            <ChevronDown size={14} />
          </button>
        </div>
      </div>

      {/* Terminal output */}
      <div className="flex-1 overflow-auto p-4 font-mono text-[13px]">
        {currentTab?.lines.map((line, i) => (
          <div key={i} className="leading-6">
            {line.type === "prompt" ? (
              <div>
                <span className="text-blue-400">{currentTab.cwd} $</span>{" "}
                <span className="text-gray-300">{line.content}</span>
              </div>
            ) : line.type === "error" ? (
              <span className="text-red-400">{line.content}</span>
            ) : line.type === "success" ? (
              <span className="text-green-400">{line.content}</span>
            ) : (
              <span className="text-gray-500">{line.content || "\u00A0"}</span>
            )}
          </div>
        ))}

        {/* Active input */}
        <form onSubmit={handleCommand} className="flex items-center leading-6">
          <span className="text-blue-400">
            {currentTab?.cwd || "~"} $
          </span>
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            className="ml-1 flex-1 bg-transparent text-gray-300 caret-gray-300 focus:outline-none"
            autoFocus
          />
        </form>
      </div>

      {/* Status bar */}
      <div className="flex h-6 items-center justify-between border-t border-gray-800 bg-gray-900 px-4 text-[11px] text-gray-600">
        <div className="flex items-center gap-3">
          <span>{tabs.length} terminals</span>
          <span>bash 5.2.15</span>
        </div>
        <div className="flex items-center gap-3">
          <span>UTF-8</span>
          <span>LF</span>
        </div>
      </div>
    </div>
  );
}
