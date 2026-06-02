"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Search,
  PenLine,
  Calendar,
  Sliders,
  FolderOpen,
  Settings,
  ChevronDown,
  ChevronRight,
  MessageSquare,
  Keyboard,
  Code,
  Terminal,
  GitBranch,
  Puzzle,
  Layers,
} from "lucide-react";

const chatHistory = [
  { id: 1, title: "Build auth system with JWT", time: "Today" },
  { id: 2, title: "Ideation for SaaS product", time: "Today" },
  { id: 3, title: "Fix auth middleware", time: "Today" },
  { id: 4, title: "Database migration help", time: "Yesterday" },
  { id: 5, title: "API endpoint review", time: "Yesterday" },
  { id: 6, title: "React component refactor", time: "3 days ago" },
  { id: 7, title: "Deploy to Vercel", time: "3 days ago" },
  { id: 8, title: "Setup CI/CD pipeline", time: "1 week ago" },
];

const repositories = [
  { name: "teskel-web", active: true },
  { name: "teskel-api", active: false },
  { name: "teskel-editor", active: false },
];

const workspaceLinks = [
  { href: "/dashboard/editor", icon: Code, label: "Editor" },
  { href: "/dashboard/composer", icon: Layers, label: "Composer" },
  { href: "/dashboard/terminal", icon: Terminal, label: "Terminal" },
  { href: "/dashboard/git", icon: GitBranch, label: "Git" },
  { href: "/dashboard/extensions", icon: Puzzle, label: "Extensions" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [reposOpen, setReposOpen] = useState(true);
  const [collapsed, setCollapsed] = useState(false);

  if (collapsed) {
    return (
      <aside className="flex h-screen w-12 flex-col items-center border-r border-gray-200 bg-white py-3">
        <button
          onClick={() => setCollapsed(false)}
          className="mb-3 rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          title="Expand sidebar"
        >
          <ChevronRight size={16} />
        </button>
        <Link href="/dashboard" className="mb-1 rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600" title="New Agent">
          <PenLine size={16} />
        </Link>
        <button className="mb-1 rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600" title="Search (Ctrl+K)">
          <Search size={16} />
        </button>
        {workspaceLinks.map((link) => (
          <Link key={link.href} href={link.href} className={`mb-1 rounded-lg p-2 ${pathname === link.href ? "bg-gray-100 text-gray-900" : "text-gray-400 hover:bg-gray-100 hover:text-gray-600"}`} title={link.label}>
            <link.icon size={16} />
          </Link>
        ))}
        <div className="flex-1" />
        <Link href="/dashboard/settings" className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600" title="Settings">
          <Settings size={16} />
        </Link>
      </aside>
    );
  }

  return (
    <aside className="flex h-screen w-60 flex-col border-r border-gray-200 bg-white">
      {/* Top actions */}
      <div className="space-y-0.5 p-3">
        <button
          onClick={() => setCollapsed(true)}
          className="mb-2 flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
        >
          <ChevronDown size={16} className="-rotate-90" />
          <span className="text-xs">Collapse</span>
        </button>

        <button className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700">
          <Search size={16} />
          <span>Search</span>
          <kbd className="ml-auto rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-[10px] text-gray-400">
            Ctrl+K
          </kbd>
        </button>

        <Link
          href="/dashboard"
          className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
            pathname === "/dashboard"
              ? "bg-gray-100 text-gray-900"
              : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
          }`}
        >
          <PenLine size={16} />
          <span>New Agent</span>
          <kbd className="ml-auto rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-[10px] text-gray-400">
            Ctrl+N
          </kbd>
        </Link>

        <button className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900">
          <Calendar size={16} />
          <span>Automations</span>
        </button>

        <button className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900">
          <Sliders size={16} />
          <span>Customize</span>
        </button>
      </div>

      {/* Workspace tools */}
      <div className="border-t border-gray-100 px-3 py-2">
        <p className="mb-1 px-3 text-[10px] font-medium uppercase tracking-wider text-gray-400">
          Workspace
        </p>
        {workspaceLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-sm transition-colors ${
              pathname === link.href
                ? "bg-gray-100 text-gray-900"
                : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"
            }`}
          >
            <link.icon size={14} />
            <span>{link.label}</span>
          </Link>
        ))}
      </div>

      {/* Repositories */}
      <div className="border-t border-gray-100 px-3 py-2">
        <button
          onClick={() => setReposOpen(!reposOpen)}
          className="flex w-full items-center gap-1 px-3 py-1.5 text-[10px] font-medium uppercase tracking-wider text-gray-400 hover:text-gray-600"
        >
          {reposOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          Repositories
        </button>
        {reposOpen && (
          <div className="mt-1 space-y-0.5">
            {repositories.map((repo) => (
              <Link
                key={repo.name}
                href="/dashboard/projects"
                className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition-colors ${
                  repo.active
                    ? "text-gray-900"
                    : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                }`}
              >
                <FolderOpen size={14} />
                <span className="truncate">{repo.name}</span>
                {repo.active && (
                  <span className="ml-auto h-1.5 w-1.5 rounded-full bg-green-500" />
                )}
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Chat history */}
      <div className="flex-1 overflow-y-auto border-t border-gray-100 px-3 py-2">
        {chatHistory.map((chat, i) => {
          const showTimeLabel =
            i === 0 || chatHistory[i - 1].time !== chat.time;
          return (
            <div key={chat.id}>
              {showTimeLabel && (
                <p className="mb-1 mt-3 px-3 text-[10px] font-medium uppercase tracking-wider text-gray-400 first:mt-1">
                  {chat.time}
                </p>
              )}
              <Link
                href="/dashboard/chat"
                className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                  i === 0 && pathname === "/dashboard/chat"
                    ? "bg-gray-100 text-gray-900"
                    : "text-gray-500 hover:bg-gray-50 hover:text-gray-700"
                }`}
              >
                <MessageSquare size={14} className="shrink-0 text-gray-400" />
                <span className="truncate">{chat.title}</span>
              </Link>
            </div>
          );
        })}
      </div>

      {/* Bottom */}
      <div className="border-t border-gray-200 p-3">
        <div className="mb-2 flex items-center gap-2 px-3">
          <Keyboard size={12} className="text-gray-400" />
          <span className="text-[10px] text-gray-400">
            Ctrl+K for commands
          </span>
        </div>
        <Link
          href="/dashboard/settings"
          className={`flex items-center gap-3 rounded-lg px-3 py-2 transition-colors ${
            pathname === "/dashboard/settings"
              ? "bg-gray-100"
              : "hover:bg-gray-100"
          }`}
        >
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-rose-100 text-xs font-bold text-rose-600">
            T
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-gray-900">
              Teskel Dev
            </p>
            <p className="text-[11px] text-gray-400">Pro Plan</p>
          </div>
          <Settings size={14} className="text-gray-400" />
        </Link>
      </div>
    </aside>
  );
}
