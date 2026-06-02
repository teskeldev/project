"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Plus,
  Search,
  GitBranch,
  Clock,
  FolderOpen,
  Globe,
  Lock,
  Activity,
  Users,
  ArrowUpRight,
} from "lucide-react";

const projects = [
  {
    name: "teskel-web",
    description: "Main marketing website and landing page",
    language: "TypeScript",
    languageColor: "#3178c6",
    stars: 142,
    updated: "2 hours ago",
    isPrivate: false,
    branch: "main",
    status: "active",
    contributors: 5,
  },
  {
    name: "teskel-api",
    description: "Backend API service with authentication and AI integration",
    language: "Python",
    languageColor: "#3572A5",
    stars: 89,
    updated: "5 hours ago",
    isPrivate: true,
    branch: "develop",
    status: "active",
    contributors: 3,
  },
  {
    name: "teskel-editor",
    description: "Core code editor component with LSP support",
    language: "Rust",
    languageColor: "#dea584",
    stars: 256,
    updated: "1 day ago",
    isPrivate: true,
    branch: "main",
    status: "active",
    contributors: 8,
  },
  {
    name: "teskel-extension",
    description: "VS Code extension for Teskel AI integration",
    language: "TypeScript",
    languageColor: "#3178c6",
    stars: 78,
    updated: "3 days ago",
    isPrivate: false,
    branch: "release/v2",
    status: "idle",
    contributors: 2,
  },
  {
    name: "teskel-docs",
    description: "Documentation site built with Nextra",
    language: "MDX",
    languageColor: "#fcb32c",
    stars: 34,
    updated: "1 week ago",
    isPrivate: false,
    branch: "main",
    status: "idle",
    contributors: 4,
  },
  {
    name: "teskel-mobile",
    description: "Mobile companion app for iOS and Android",
    language: "Dart",
    languageColor: "#00B4AB",
    stars: 12,
    updated: "2 weeks ago",
    isPrivate: true,
    branch: "feat/notifications",
    status: "idle",
    contributors: 2,
  },
];

export default function ProjectsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "idle">("all");

  const filtered = projects.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter =
      filter === "all" || p.status === filter;
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="p-8">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Repositories</h1>
            <p className="mt-1 text-sm text-gray-500">
              Your connected repositories and projects
            </p>
          </div>
          <button className="flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-gray-800">
            <Plus size={16} />
            Connect repository
          </button>
        </div>

        {/* Search and filters */}
        <div className="mb-6 flex items-center gap-4">
          <div className="flex flex-1 items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2.5">
            <Search size={16} className="text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search repositories..."
              className="flex-1 bg-transparent text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none"
            />
          </div>
          <div className="flex rounded-lg border border-gray-200">
            {(["all", "active", "idle"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2.5 text-xs font-medium capitalize ${
                  filter === f
                    ? "bg-gray-100 text-gray-900"
                    : "text-gray-500 hover:text-gray-700"
                } ${f === "all" ? "rounded-l-lg" : ""} ${f === "idle" ? "rounded-r-lg" : ""}`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Project list */}
        <div className="space-y-2">
          {filtered.map((project) => (
            <Link
              key={project.name}
              href="/dashboard"
              className="group flex items-center justify-between rounded-xl border border-gray-200 bg-white px-5 py-4 transition-all hover:border-gray-300 hover:shadow-sm"
            >
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-50 text-gray-400 group-hover:bg-gray-100">
                  <FolderOpen size={20} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-gray-900 group-hover:text-rose-600">
                      {project.name}
                    </h3>
                    <span className="flex items-center gap-1 rounded-full border border-gray-200 px-2 py-0.5 text-[10px] text-gray-500">
                      {project.isPrivate ? <Lock size={10} /> : <Globe size={10} />}
                      {project.isPrivate ? "Private" : "Public"}
                    </span>
                    {project.status === "active" && (
                      <span className="flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-medium text-green-600">
                        <Activity size={10} />
                        Active
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-sm text-gray-500">
                    {project.description}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-6">
                <div className="flex items-center gap-4 text-xs text-gray-400">
                  <span className="flex items-center gap-1.5">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: project.languageColor }}
                    />
                    {project.language}
                  </span>
                  <span className="flex items-center gap-1">
                    <GitBranch size={12} />
                    {project.branch}
                  </span>
                  <span className="flex items-center gap-1">
                    <Users size={12} />
                    {project.contributors}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock size={12} />
                    {project.updated}
                  </span>
                </div>
                <ArrowUpRight
                  size={16}
                  className="text-gray-300 opacity-0 transition-opacity group-hover:opacity-100"
                />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
