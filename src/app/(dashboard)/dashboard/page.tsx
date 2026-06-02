"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  Globe,
  Code,
  Terminal,
  FileText,
  ChevronDown,
  Mic,
  Plus,
  ArrowRight,
  Zap,
  Bug,
  Palette,
  Database,
  Shield,
  Rocket,
} from "lucide-react";

const suggestions = [
  {
    icon: Zap,
    label: "Build a feature",
    prompt: "Build a new feature for my project",
    color: "text-amber-500",
  },
  {
    icon: Bug,
    label: "Fix a bug",
    prompt: "Help me debug and fix an issue",
    color: "text-red-500",
  },
  {
    icon: Palette,
    label: "Design a component",
    prompt: "Design and implement a UI component",
    color: "text-purple-500",
  },
  {
    icon: Database,
    label: "Set up database",
    prompt: "Set up database schema and queries",
    color: "text-blue-500",
  },
  {
    icon: Shield,
    label: "Add authentication",
    prompt: "Implement authentication and authorization",
    color: "text-green-500",
  },
  {
    icon: Rocket,
    label: "Deploy project",
    prompt: "Help me deploy my project to production",
    color: "text-rose-500",
  },
];

const recentProjects = [
  { name: "teskel-web", lang: "TypeScript", time: "2 hours ago" },
  { name: "teskel-api", lang: "Python", time: "5 hours ago" },
  { name: "teskel-editor", lang: "Rust", time: "1 day ago" },
];

export default function DashboardPage() {
  const [inputValue, setInputValue] = useState("");
  const router = useRouter();
  const model = "Auto";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;
    router.push("/dashboard/chat");
  };

  const handleSuggestion = (prompt: string) => {
    setInputValue(prompt);
  };

  return (
    <div className="flex h-full flex-col items-center justify-center bg-white">
      <div className="w-full max-w-2xl px-6">
        {/* Logo & greeting */}
        <div className="mb-8 text-center">
          <div className="mb-4 inline-flex items-center justify-center rounded-2xl bg-gradient-to-br from-rose-500 to-rose-600 p-3 shadow-lg shadow-rose-200">
            <Sparkles size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-semibold text-gray-900">
            What do you want to build?
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            Teskel can write code, fix bugs, run commands, and search the web.
          </p>
        </div>

        {/* Input */}
        <form onSubmit={handleSubmit}>
          <div className="flex items-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-3.5 shadow-sm transition-shadow focus-within:border-gray-300 focus-within:shadow-md">
            <Plus size={18} className="shrink-0 text-gray-400" />
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Ask Teskel anything..."
              className="flex-1 bg-transparent text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none"
              autoFocus
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
              {inputValue.trim() && (
                <button
                  type="submit"
                  className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-600 text-white hover:bg-rose-700"
                >
                  <ArrowRight size={14} />
                </button>
              )}
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

        {/* Suggestion cards */}
        <div className="mt-8 grid grid-cols-3 gap-3">
          {suggestions.map((s) => (
            <button
              key={s.label}
              onClick={() => handleSuggestion(s.prompt)}
              className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 text-left transition-all hover:border-gray-300 hover:shadow-sm"
            >
              <s.icon size={18} className={s.color} />
              <span className="text-xs font-medium text-gray-700">
                {s.label}
              </span>
            </button>
          ))}
        </div>

        {/* Recent projects */}
        <div className="mt-10">
          <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-gray-400">
            Recent projects
          </h3>
          <div className="flex gap-3">
            {recentProjects.map((p) => (
              <button
                key={p.name}
                onClick={() => router.push("/dashboard/projects")}
                className="flex flex-1 items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 transition-all hover:border-gray-300 hover:shadow-sm"
              >
                <Code size={16} className="text-gray-400" />
                <div className="text-left">
                  <p className="text-xs font-medium text-gray-900">{p.name}</p>
                  <p className="text-[11px] text-gray-400">
                    {p.lang} · {p.time}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 text-center">
        <div className="flex items-center gap-3 text-[11px] text-gray-400">
          <span>Teskel v1.0</span>
          <span>·</span>
          <button className="hover:text-gray-600">Keyboard shortcuts</button>
          <span>·</span>
          <button className="hover:text-gray-600">Documentation</button>
        </div>
      </div>
    </div>
  );
}
