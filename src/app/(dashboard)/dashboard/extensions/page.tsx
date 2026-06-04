"use client";

import { useState } from "react";
import {
  Search,
  Download,
  Star,
  Check,
  Puzzle,
  ChevronDown,
  ExternalLink,
  TrendingUp,
} from "lucide-react";

type ExtTab = "marketplace" | "installed";

interface Extension {
  id: string;
  name: string;
  author: string;
  description: string;
  installs: string;
  rating: number;
  icon: string;
  installed: boolean;
  category: string;
}

const extensions: Extension[] = [
  {
    id: "1",
    name: "Python",
    author: "Microsoft",
    description: "IntelliSense, linting, debugging, code formatting, refactoring, and more for Python.",
    installs: "98M",
    rating: 4.8,
    icon: "🐍",
    installed: true,
    category: "Languages",
  },
  {
    id: "2",
    name: "ESLint",
    author: "Microsoft",
    description: "Integrates ESLint into your editor for JavaScript and TypeScript linting.",
    installs: "32M",
    rating: 4.7,
    icon: "📋",
    installed: true,
    category: "Linters",
  },
  {
    id: "3",
    name: "Prettier",
    author: "Prettier",
    description: "Code formatter using Prettier. Supports JavaScript, TypeScript, CSS, and more.",
    installs: "42M",
    rating: 4.6,
    icon: "✨",
    installed: true,
    category: "Formatters",
  },
  {
    id: "4",
    name: "Tailwind CSS IntelliSense",
    author: "Tailwind Labs",
    description: "Intelligent Tailwind CSS tooling: autocomplete, linting, hover previews.",
    installs: "12M",
    rating: 4.9,
    icon: "🎨",
    installed: true,
    category: "Styling",
  },
  {
    id: "5",
    name: "GitLens",
    author: "GitKraken",
    description: "Supercharge Git inside your editor — blame, history, stash, and more.",
    installs: "28M",
    rating: 4.5,
    icon: "🔍",
    installed: false,
    category: "Git",
  },
  {
    id: "6",
    name: "Docker",
    author: "Microsoft",
    description: "Makes it easy to build, manage, and deploy containerized applications.",
    installs: "18M",
    rating: 4.4,
    icon: "🐳",
    installed: false,
    category: "DevOps",
  },
  {
    id: "7",
    name: "Thunder Client",
    author: "Thunder Client",
    description: "Lightweight REST API client for testing APIs directly from your editor.",
    installs: "8M",
    rating: 4.7,
    icon: "⚡",
    installed: false,
    category: "Testing",
  },
  {
    id: "8",
    name: "Prisma",
    author: "Prisma",
    description: "Adds syntax highlighting, formatting, and auto-completion for Prisma Schema files.",
    installs: "5M",
    rating: 4.8,
    icon: "💎",
    installed: false,
    category: "Database",
  },
  {
    id: "9",
    name: "Error Lens",
    author: "Alexander",
    description: "Improve highlighting of errors, warnings and other language diagnostics.",
    installs: "9M",
    rating: 4.6,
    icon: "🔴",
    installed: false,
    category: "Utilities",
  },
  {
    id: "10",
    name: "Rust Analyzer",
    author: "rust-lang",
    description: "Provides Rust language support: code completion, go to definition, and more.",
    installs: "6M",
    rating: 4.9,
    icon: "🦀",
    installed: false,
    category: "Languages",
  },
];

export default function ExtensionsPage() {
  const [tab, setTab] = useState<ExtTab>("marketplace");
  const [query, setQuery] = useState("");
  const [installedIds, setInstalledIds] = useState<Set<string>>(
    new Set(extensions.filter((e) => e.installed).map((e) => e.id))
  );

  const filtered = extensions.filter(
    (e) =>
      (tab === "installed" ? installedIds.has(e.id) : true) &&
      (query
        ? e.name.toLowerCase().includes(query.toLowerCase()) ||
          e.description.toLowerCase().includes(query.toLowerCase())
        : true)
  );

  const toggleInstall = (id: string) => {
    const next = new Set(installedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setInstalledIds(next);
  };

  return (
    <div className="flex h-full flex-col bg-white">
      {/* Header */}
      <div className="border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Puzzle size={20} className="text-blue-500" />
            <h1 className="text-lg font-semibold text-gray-900">Extensions</h1>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span>{installedIds.size} installed</span>
            <span>·</span>
            <span>{extensions.length} available</span>
          </div>
        </div>

        {/* Search */}
        <div className="mt-4 flex items-center gap-3">
          <div className="flex flex-1 items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2.5">
            <Search size={16} className="text-gray-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search extensions..."
              className="flex-1 bg-transparent text-sm placeholder:text-gray-400 focus:outline-none"
            />
          </div>
          <button className="flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2.5 text-xs text-gray-600 hover:bg-gray-50">
            Category <ChevronDown size={12} />
          </button>
          <button className="flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2.5 text-xs text-gray-600 hover:bg-gray-50">
            <TrendingUp size={12} /> Sort
          </button>
        </div>

        {/* Tabs */}
        <div className="mt-4 flex gap-4">
          <button
            onClick={() => setTab("marketplace")}
            className={`pb-2 text-sm font-medium ${
              tab === "marketplace"
                ? "border-b-2 border-blue-500 text-gray-900"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Marketplace
          </button>
          <button
            onClick={() => setTab("installed")}
            className={`pb-2 text-sm font-medium ${
              tab === "installed"
                ? "border-b-2 border-blue-500 text-gray-900"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Installed ({installedIds.size})
          </button>
        </div>
      </div>

      {/* Extension list */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-2">
          {filtered.map((ext) => (
            <div
              key={ext.id}
              className="flex items-start gap-4 rounded-xl border border-gray-200 p-4 transition-colors hover:border-gray-300"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gray-100 text-2xl">
                {ext.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-gray-900">
                    {ext.name}
                  </h3>
                  <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500">
                    {ext.category}
                  </span>
                </div>
                <p className="text-[11px] text-gray-500">by {ext.author}</p>
                <p className="mt-1 text-xs text-gray-600 line-clamp-1">
                  {ext.description}
                </p>
                <div className="mt-2 flex items-center gap-3 text-[11px] text-gray-400">
                  <span className="flex items-center gap-1">
                    <Download size={10} /> {ext.installs}
                  </span>
                  <span className="flex items-center gap-1">
                    <Star size={10} className="text-amber-400" /> {ext.rating}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {installedIds.has(ext.id) ? (
                  <button
                    onClick={() => toggleInstall(ext.id)}
                    className="flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-50"
                  >
                    <Check size={12} className="text-green-500" />
                    Installed
                  </button>
                ) : (
                  <button
                    onClick={() => toggleInstall(ext.id)}
                    className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800"
                  >
                    Install
                  </button>
                )}
                <button className="rounded p-1.5 text-gray-400 hover:bg-gray-100">
                  <ExternalLink size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
