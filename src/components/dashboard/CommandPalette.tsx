"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  FileText,
  Settings,
  FolderOpen,
  MessageSquare,
  Terminal,
  Globe,
  Keyboard,
  PenLine,
  ArrowRight,
  Code,
  GitBranch,
  Puzzle,
  Layers,
} from "lucide-react";

interface Command {
  id: string;
  label: string;
  icon: React.ElementType;
  shortcut?: string;
  action: () => void;
  category: string;
}

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const commands: Command[] = [
    { id: "new-chat", label: "New Agent", icon: PenLine, shortcut: "Ctrl+N", action: () => router.push("/dashboard"), category: "General" },
    { id: "search", label: "Search in project", icon: Search, shortcut: "Ctrl+Shift+F", action: () => {}, category: "General" },
    { id: "editor", label: "Open Editor", icon: Code, action: () => router.push("/dashboard/editor"), category: "Workspace" },
    { id: "composer", label: "Open Composer", icon: Layers, action: () => router.push("/dashboard/composer"), category: "Workspace" },
    { id: "terminal", label: "Open Terminal", icon: Terminal, shortcut: "Ctrl+`", action: () => router.push("/dashboard/terminal"), category: "Workspace" },
    { id: "git", label: "Source Control", icon: GitBranch, action: () => router.push("/dashboard/git"), category: "Workspace" },
    { id: "extensions", label: "Extensions", icon: Puzzle, action: () => router.push("/dashboard/extensions"), category: "Workspace" },
    { id: "browser", label: "Toggle Browser", icon: Globe, shortcut: "Ctrl+Shift+B", action: () => {}, category: "View" },
    { id: "projects", label: "Go to Repositories", icon: FolderOpen, action: () => router.push("/dashboard/projects"), category: "Navigation" },
    { id: "settings", label: "Go to Settings", icon: Settings, action: () => router.push("/dashboard/settings"), category: "Navigation" },
    { id: "chat", label: "Open Chat", icon: MessageSquare, action: () => router.push("/dashboard/chat"), category: "Navigation" },
    { id: "docs", label: "Open Documentation", icon: FileText, action: () => router.push("/docs"), category: "Navigation" },
    { id: "shortcuts", label: "Keyboard Shortcuts", icon: Keyboard, shortcut: "Ctrl+/", action: () => {}, category: "Help" },
  ];

  const filtered = commands.filter((c) =>
    c.label.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
        setQuery("");
        setSelectedIndex(0);
      }
      if (e.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const handleQueryChange = (newQuery: string) => {
    setQuery(newQuery);
    setSelectedIndex(0);
  };

  const handleSelect = (cmd: Command) => {
    setOpen(false);
    setQuery("");
    cmd.action();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter" && filtered[selectedIndex]) {
      handleSelect(filtered[selectedIndex]);
    }
  };

  if (!open) return null;

  const categories = [...new Set(filtered.map((c) => c.category))];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh] animate-fade-in">
      <div className="absolute inset-0 bg-black/20 backdrop-blur-md" onClick={() => setOpen(false)} />
      <div className="animate-scale-in relative w-full max-w-lg overflow-hidden rounded-2xl border border-gray-200/80 bg-white/95 shadow-2xl backdrop-blur-xl">
        <div className="flex items-center gap-3 border-b border-gray-200 px-4 py-3">
          <Search size={16} className="text-gray-400" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a command or search..."
            className="flex-1 bg-transparent text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none"
          />
          <kbd className="rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-[10px] text-gray-400">ESC</kbd>
        </div>
        <div className="max-h-72 overflow-y-auto p-2">
          {categories.map((cat) => (
            <div key={cat}>
              <p className="mb-1 mt-2 px-3 text-[10px] font-medium uppercase tracking-wider text-gray-400 first:mt-0">{cat}</p>
              {filtered
                .filter((c) => c.category === cat)
                .map((cmd) => {
                  const globalIndex = filtered.indexOf(cmd);
                  return (
                    <button
                      key={cmd.id}
                      onClick={() => handleSelect(cmd)}
                      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-all duration-150 ${
                        globalIndex === selectedIndex ? "bg-blue-50/70 text-gray-900" : "text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      <cmd.icon size={16} className="shrink-0 text-gray-400" />
                      <span className="flex-1">{cmd.label}</span>
                      {cmd.shortcut && (
                        <kbd className="rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-[10px] text-gray-400">{cmd.shortcut}</kbd>
                      )}
                      {globalIndex === selectedIndex && <ArrowRight size={12} className="text-gray-400" />}
                    </button>
                  );
                })}
            </div>
          ))}
          {filtered.length === 0 && (
            <p className="px-3 py-4 text-center text-sm text-gray-400">No commands found</p>
          )}
        </div>
      </div>
    </div>
  );
}
