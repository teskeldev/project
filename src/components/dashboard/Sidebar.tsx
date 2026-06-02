"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  FolderOpen,
  MessageSquare,
  Terminal,
  Settings,
  Search,
  Plus,
  ChevronDown,
  Sparkles,
  GitBranch,
  Users,
  LogOut,
} from "lucide-react";

const mainNav = [
  { label: "Home", href: "/dashboard", icon: Home },
  { label: "Projects", href: "/dashboard/projects", icon: FolderOpen },
  { label: "AI Chat", href: "/dashboard", icon: MessageSquare, badge: "New" },
  { label: "Terminal", href: "/dashboard", icon: Terminal },
];

const bottomNav = [
  { label: "Settings", href: "/dashboard/settings", icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={`flex h-screen flex-col border-r border-gray-800 bg-gray-900 transition-all ${
        collapsed ? "w-16" : "w-64"
      }`}
    >
      {/* Header */}
      <div className="flex h-14 items-center justify-between border-b border-gray-800 px-4">
        {!collapsed && (
          <Link href="/dashboard" className="flex items-center gap-2">
            <svg
              width="24"
              height="24"
              viewBox="0 0 28 28"
              fill="none"
              className="text-rose-500"
            >
              <rect width="28" height="28" rx="6" fill="currentColor" />
              <path d="M8 8h4v12H8V8zm8 0h4v12h-4V8z" fill="white" />
            </svg>
            <span className="text-lg font-bold text-white">Teskel</span>
          </Link>
        )}
        {collapsed && (
          <svg
            width="24"
            height="24"
            viewBox="0 0 28 28"
            fill="none"
            className="mx-auto text-rose-500"
          >
            <rect width="28" height="28" rx="6" fill="currentColor" />
            <path d="M8 8h4v12H8V8zm8 0h4v12h-4V8z" fill="white" />
          </svg>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="rounded p-1 text-gray-500 hover:bg-gray-800 hover:text-gray-300"
          aria-label="Toggle sidebar"
        >
          <ChevronDown
            size={16}
            className={`transition-transform ${collapsed ? "rotate-[-90deg]" : "rotate-90"}`}
          />
        </button>
      </div>

      {/* New chat button */}
      <div className="p-3">
        <button className="flex w-full items-center justify-center gap-2 rounded-lg bg-rose-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-rose-700">
          <Plus size={16} />
          {!collapsed && "New Chat"}
        </button>
      </div>

      {/* Search */}
      {!collapsed && (
        <div className="px-3 pb-2">
          <div className="flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2">
            <Search size={14} className="text-gray-500" />
            <span className="text-xs text-gray-500">Search...</span>
            <kbd className="ml-auto rounded border border-gray-700 bg-gray-900 px-1.5 py-0.5 text-[10px] text-gray-500">
              /
            </kbd>
          </div>
        </div>
      )}

      {/* Main nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-2">
        <div className="space-y-1">
          {mainNav.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.label}
                href={item.href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                  isActive
                    ? "bg-gray-800 text-white"
                    : "text-gray-400 hover:bg-gray-800/50 hover:text-gray-200"
                }`}
              >
                <item.icon size={18} />
                {!collapsed && (
                  <>
                    <span className="flex-1">{item.label}</span>
                    {item.badge && (
                      <span className="rounded-full bg-rose-600 px-2 py-0.5 text-[10px] font-medium text-white">
                        {item.badge}
                      </span>
                    )}
                  </>
                )}
              </Link>
            );
          })}
        </div>

        {/* Recent chats */}
        {!collapsed && (
          <div className="mt-6">
            <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-gray-600">
              Recent
            </p>
            <div className="space-y-1">
              {[
                "Build landing page",
                "Fix auth middleware",
                "Database migration",
                "API endpoint review",
              ].map((chat) => (
                <button
                  key={chat}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-gray-400 transition-colors hover:bg-gray-800/50 hover:text-gray-200"
                >
                  <Sparkles size={14} className="shrink-0 text-gray-600" />
                  <span className="truncate">{chat}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Workspace */}
        {!collapsed && (
          <div className="mt-6">
            <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-gray-600">
              Workspace
            </p>
            <div className="space-y-1">
              <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-gray-400 transition-colors hover:bg-gray-800/50 hover:text-gray-200">
                <GitBranch size={14} className="shrink-0" />
                <span className="truncate">main</span>
              </button>
              <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-gray-400 transition-colors hover:bg-gray-800/50 hover:text-gray-200">
                <Users size={14} className="shrink-0" />
                <span className="truncate">Team workspace</span>
              </button>
            </div>
          </div>
        )}
      </nav>

      {/* Bottom */}
      <div className="border-t border-gray-800 p-3">
        {bottomNav.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.label}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                isActive
                  ? "bg-gray-800 text-white"
                  : "text-gray-400 hover:bg-gray-800/50 hover:text-gray-200"
              }`}
            >
              <item.icon size={18} />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}

        {/* User */}
        <div className="mt-2 flex items-center gap-3 rounded-lg px-3 py-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-rose-600 text-xs font-bold text-white">
            T
          </div>
          {!collapsed && (
            <div className="flex flex-1 items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-200">Teskel Dev</p>
                <p className="text-xs text-gray-500">Pro Plan</p>
              </div>
              <button className="text-gray-500 hover:text-gray-300">
                <LogOut size={14} />
              </button>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
