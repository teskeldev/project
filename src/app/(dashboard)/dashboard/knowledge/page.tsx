"use client";

import { useState } from "react";
import { Plus, FileText, Book, Folder, Star, Search, MoreHorizontal } from "lucide-react";

interface KnowledgeItem {
  id: number;
  title: string;
  type: "document" | "instructions" | "context";
  content: string;
  project?: string;
  starred: boolean;
  updated: string;
}

const knowledgeItems: KnowledgeItem[] = [
  {
    id: 1,
    title: "Project Architecture",
    type: "document",
    content: "Next.js 16 app router with route groups: (auth), (dashboard), (marketing). Tailwind CSS 4 for styling. Framer Motion for animations.",
    project: "teskel-web",
    starred: true,
    updated: "2h ago",
  },
  {
    id: 2,
    title: "Coding Standards",
    type: "instructions",
    content: "Use TypeScript strict mode. Prefer functional components. Use server components by default, client only when needed. Follow Airbnb style guide.",
    starred: true,
    updated: "1d ago",
  },
  {
    id: 3,
    title: "API Conventions",
    type: "instructions",
    content: "REST endpoints follow /api/v1/{resource}. Use zod for validation. Return consistent error format: { error: string, code: number }.",
    project: "teskel-api",
    starred: false,
    updated: "2d ago",
  },
  {
    id: 4,
    title: "Database Schema",
    type: "context",
    content: "PostgreSQL with Drizzle ORM. Main tables: users, projects, sessions, agents, artifacts. Use UUID for all primary keys.",
    project: "teskel-api",
    starred: false,
    updated: "3d ago",
  },
  {
    id: 5,
    title: "Deployment Guide",
    type: "document",
    content: "Vercel for frontend. Railway for API. Neon for PostgreSQL. Upstash for Redis. GitHub Actions for CI/CD.",
    starred: false,
    updated: "5d ago",
  },
  {
    id: 6,
    title: "Component Library Guide",
    type: "context",
    content: "Custom design system built on top of Tailwind. Color tokens defined in globals.css. Graphite Slate theme with blue accent. All components in src/components/.",
    project: "teskel-web",
    starred: true,
    updated: "1w ago",
  },
];

export default function KnowledgePage() {
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<string>("all");

  const filtered = knowledgeItems.filter((item) => {
    const matchSearch = item.title.toLowerCase().includes(search.toLowerCase()) || item.content.toLowerCase().includes(search.toLowerCase());
    if (activeFilter === "starred") return matchSearch && item.starred;
    if (activeFilter === "all") return matchSearch;
    return matchSearch && item.type === activeFilter;
  });

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-[22px] font-semibold text-gray-900">Projects & Knowledge</h1>
            <p className="mt-1 text-[14px] text-gray-500">Custom instructions and context for your AI agents</p>
          </div>
          <button className="flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-[13px] font-medium text-white hover:bg-gray-800">
            <Plus size={14} />
            Add Knowledge
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search knowledge base..."
            className="w-full rounded-lg border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-[13px] text-gray-900 placeholder-gray-400 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-50"
          />
        </div>

        {/* Filter tabs */}
        <div className="mb-6 flex gap-2">
          {[
            { key: "all", label: "All", icon: Folder },
            { key: "starred", label: "Starred", icon: Star },
            { key: "instructions", label: "Instructions", icon: FileText },
            { key: "document", label: "Documents", icon: Book },
            { key: "context", label: "Context", icon: Folder },
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => setActiveFilter(f.key)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium transition-colors ${
                activeFilter === f.key ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              <f.icon size={12} />
              {f.label}
            </button>
          ))}
        </div>

        {/* Knowledge items */}
        <div className="space-y-3">
          {filtered.map((item) => (
            <div
              key={item.id}
              className="rounded-xl border border-gray-200 bg-white p-5 transition-shadow hover:shadow-sm"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className={`mt-0.5 rounded-lg p-2 ${
                    item.type === "instructions" ? "bg-purple-50 text-purple-600" :
                    item.type === "document" ? "bg-blue-50 text-blue-600" :
                    "bg-gray-100 text-gray-600"
                  }`}>
                    {item.type === "instructions" ? <FileText size={14} /> : item.type === "document" ? <Book size={14} /> : <Folder size={14} />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-[14px] font-semibold text-gray-900">{item.title}</h3>
                      {item.starred && <Star size={12} className="fill-yellow-400 text-yellow-400" />}
                    </div>
                    {item.project && (
                      <span className="mt-0.5 inline-block rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500">
                        {item.project}
                      </span>
                    )}
                    <p className="mt-2 text-[13px] leading-relaxed text-gray-500">{item.content}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-gray-400">{item.updated}</span>
                  <button className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
                    <MoreHorizontal size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
