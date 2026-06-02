"use client";

import { useState } from "react";
import {
  Plus,
  Search,
  GitBranch,
  Star,
  Clock,
  MoreHorizontal,
  FolderOpen,
  Globe,
  Lock,
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
  },
];

export default function ProjectsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "public" | "private">("all");

  const filtered = projects.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter =
      filter === "all" ||
      (filter === "public" && !p.isPrivate) ||
      (filter === "private" && p.isPrivate);
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="p-8">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-white">Projects</h1>
            <p className="mt-1 text-sm text-gray-400">
              Manage and access your coding projects
            </p>
          </div>
          <button className="flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-rose-700">
            <Plus size={16} />
            New project
          </button>
        </div>

        {/* Search and filters */}
        <div className="mb-6 flex items-center gap-4">
          <div className="flex flex-1 items-center gap-2 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2.5">
            <Search size={16} className="text-gray-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Find a project..."
              className="flex-1 bg-transparent text-sm text-white placeholder:text-gray-500 focus:outline-none"
            />
          </div>
          <div className="flex rounded-lg border border-gray-700">
            {(["all", "public", "private"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2.5 text-xs font-medium capitalize ${
                  filter === f
                    ? "bg-gray-700 text-white"
                    : "text-gray-400 hover:text-gray-200"
                } ${f === "all" ? "rounded-l-lg" : ""} ${f === "private" ? "rounded-r-lg" : ""}`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Project list */}
        <div className="space-y-3">
          {filtered.map((project) => (
            <div
              key={project.name}
              className="group rounded-xl border border-gray-800 bg-gray-900 p-5 transition-colors hover:border-gray-700"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <FolderOpen
                    size={20}
                    className="mt-0.5 text-gray-500"
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-blue-400 hover:underline">
                        {project.name}
                      </h3>
                      <span
                        className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] ${
                          project.isPrivate
                            ? "border-gray-700 text-gray-500"
                            : "border-gray-700 text-gray-500"
                        }`}
                      >
                        {project.isPrivate ? (
                          <Lock size={10} />
                        ) : (
                          <Globe size={10} />
                        )}
                        {project.isPrivate ? "Private" : "Public"}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-gray-400">
                      {project.description}
                    </p>
                  </div>
                </div>
                <button className="text-gray-600 opacity-0 transition-opacity group-hover:opacity-100 hover:text-gray-300">
                  <MoreHorizontal size={16} />
                </button>
              </div>

              <div className="mt-4 flex items-center gap-6 text-xs text-gray-500">
                <span className="flex items-center gap-1.5">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: project.languageColor }}
                  />
                  {project.language}
                </span>
                <span className="flex items-center gap-1">
                  <Star size={12} />
                  {project.stars}
                </span>
                <span className="flex items-center gap-1">
                  <GitBranch size={12} />
                  {project.branch}
                </span>
                <span className="flex items-center gap-1">
                  <Clock size={12} />
                  Updated {project.updated}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
