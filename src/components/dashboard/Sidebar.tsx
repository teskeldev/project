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
} from "lucide-react";

const chatHistory = [
  { id: 1, title: "Ideation for SaaS product", time: "Today" },
  { id: 2, title: "Build landing page", time: "Today" },
  { id: 3, title: "Fix auth middleware", time: "Yesterday" },
  { id: 4, title: "Database migration help", time: "Yesterday" },
  { id: 5, title: "API endpoint review", time: "2 days ago" },
  { id: 6, title: "React component refactor", time: "3 days ago" },
];

const repositories = [
  { name: "teskel-web", active: true },
  { name: "teskel-api", active: false },
  { name: "teskel-editor", active: false },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [reposOpen, setReposOpen] = useState(true);

  return (
    <aside className="flex h-screen w-60 flex-col border-r border-gray-200 bg-white">
      {/* Top actions */}
      <div className="space-y-1 p-3">
        {/* Search */}
        <button className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-gray-500 transition-colors hover:bg-gray-100">
          <Search size={16} />
          <span>Search</span>
        </button>

        {/* New Agent */}
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

        {/* Automations */}
        <button className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900">
          <Calendar size={16} />
          <span>Automations</span>
        </button>

        {/* Customize */}
        <button className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900">
          <Sliders size={16} />
          <span>Customize</span>
        </button>
      </div>

      {/* Repositories section */}
      <div className="px-3 pb-2">
        <button
          onClick={() => setReposOpen(!reposOpen)}
          className="flex w-full items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-400 hover:text-gray-600"
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
                className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm ${
                  repo.active
                    ? "text-gray-900"
                    : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                }`}
              >
                <FolderOpen size={14} />
                <span className="truncate">{repo.name}</span>
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
              <button
                className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                  i === 0
                    ? "bg-gray-100 text-gray-900"
                    : "text-gray-500 hover:bg-gray-50 hover:text-gray-700"
                }`}
              >
                <MessageSquare size={14} className="shrink-0 text-gray-400" />
                <span className="truncate">{chat.title}</span>
              </button>
            </div>
          );
        })}
      </div>

      {/* Bottom - User */}
      <div className="border-t border-gray-200 p-3">
        <Link
          href="/dashboard/settings"
          className="flex items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-gray-100"
        >
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-rose-100 text-xs font-bold text-rose-600">
            T
          </div>
          <div className="flex-1 min-w-0">
            <p className="truncate text-sm font-medium text-gray-900">Teskel Dev</p>
            <p className="text-[11px] text-gray-400">Pro Plan</p>
          </div>
          <div className="flex items-center gap-1">
            <button className="text-gray-400 hover:text-gray-600">
              <Settings size={14} />
            </button>
          </div>
        </Link>
      </div>
    </aside>
  );
}
