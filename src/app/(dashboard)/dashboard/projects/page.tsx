"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Search,
  Clock,
  FolderOpen,
  Activity,
  ArrowUpRight,
  Loader2,
  X,
} from "lucide-react";
import { useProject } from "@/lib/store/project";
import type { Project } from "@/lib/client/api";

/** Derive a "language" label from the project name heuristic or storageKey. */
function deriveLanguage(project: Project): { name: string; color: string } {
  const name = project.name.toLowerCase();
  if (name.includes("ts") || name.includes("next") || name.includes("react"))
    return { name: "TypeScript", color: "#3178c6" };
  if (name.includes("py") || name.includes("django") || name.includes("flask"))
    return { name: "Python", color: "#3572A5" };
  if (name.includes("rust") || name.includes("cargo"))
    return { name: "Rust", color: "#dea584" };
  if (name.includes("go") || name.includes("gin"))
    return { name: "Go", color: "#00ADD8" };
  if (name.includes("java") || name.includes("spring"))
    return { name: "Java", color: "#b07219" };
  return { name: "Project", color: "#6b7280" };
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  return `${weeks}w ago`;
}

export default function ProjectsPage() {
  const router = useRouter();
  const {
    projects,
    loading,
    error,
    setActiveProject,
    createNewProject,
    refresh,
  } = useProject();

  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "idle">("all");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newTemplate, setNewTemplate] = useState<"blank" | "node">("blank");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const filtered = projects.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.description ?? "").toLowerCase().includes(searchQuery.toLowerCase());
    if (filter === "all") return matchesSearch;
    // "active" = has a description or recently updated; "idle" = no description
    const isActive = !!p.description;
    if (filter === "active") return matchesSearch && isActive;
    return matchesSearch && !isActive;
  });

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    setCreateError(null);
    try {
      await createNewProject({ name: newName.trim(), template: newTemplate });
      setShowCreateForm(false);
      setNewName("");
      setNewTemplate("blank");
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed to create project");
    } finally {
      setCreating(false);
    }
  };

  const handleProjectClick = (project: Project) => {
    setActiveProject(project.id);
    router.push("/dashboard/editor");
  };

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
          <button
            onClick={() => setShowCreateForm(true)}
            className="flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-gray-800"
          >
            <Plus size={16} />
            Connect repository
          </button>
        </div>

        {/* Create form */}
        {showCreateForm && (
          <div className="mb-6 rounded-xl border border-gray-200 bg-white p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-900">Create new project</h2>
              <button
                onClick={() => { setShowCreateForm(false); setCreateError(null); }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={16} />
              </button>
            </div>
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <label htmlFor="new-project-name" className="mb-1 block text-xs font-medium text-gray-600">
                  Project name
                </label>
                <input
                  id="new-project-name"
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="my-project"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-gray-400 focus:outline-none"
                  onKeyDown={(e) => { if (e.key === "Enter") void handleCreate(); }}
                />
              </div>
              <div>
                <label htmlFor="new-project-template" className="mb-1 block text-xs font-medium text-gray-600">
                  Template
                </label>
                <select
                  id="new-project-template"
                  value={newTemplate}
                  onChange={(e) => setNewTemplate(e.target.value as "blank" | "node")}
                  className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-gray-400 focus:outline-none"
                >
                  <option value="blank">Blank</option>
                  <option value="node">Node.js</option>
                </select>
              </div>
              <button
                onClick={() => void handleCreate()}
                disabled={creating || !newName.trim()}
                className="flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:opacity-50"
              >
                {creating && <Loader2 size={14} className="animate-spin" />}
                Create
              </button>
            </div>
            {createError && (
              <p className="mt-2 text-xs text-red-600">{createError}</p>
            )}
          </div>
        )}

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

        {/* Loading state */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={24} className="animate-spin text-gray-400" />
          </div>
        )}

        {/* Error state */}
        {error && !loading && (
          <div className="rounded-xl border border-red-100 bg-red-50 px-5 py-4 text-sm text-red-700">
            {error}
            <button onClick={() => void refresh()} className="ml-2 underline">
              Retry
            </button>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && projects.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <FolderOpen size={48} className="mb-4 text-gray-300" />
            <h2 className="text-lg font-medium text-gray-700">No projects yet</h2>
            <p className="mt-1 text-sm text-gray-500">
              Create one to get started
            </p>
            <button
              onClick={() => setShowCreateForm(true)}
              className="mt-4 flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-gray-800"
            >
              <Plus size={16} />
              Create project
            </button>
          </div>
        )}

        {/* No results from filter */}
        {!loading && !error && projects.length > 0 && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Search size={32} className="mb-3 text-gray-300" />
            <p className="text-sm text-gray-500">No projects match your search</p>
          </div>
        )}

        {/* Project list */}
        {!loading && !error && (
          <div className="space-y-2">
            {filtered.map((project) => {
              const lang = deriveLanguage(project);
              return (
                <button
                  key={project.id}
                  onClick={() => handleProjectClick(project)}
                  className="group flex w-full items-center justify-between rounded-xl border border-gray-200 bg-white px-5 py-4 text-left transition-all hover:border-gray-300 hover:shadow-sm"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-50 text-gray-400 group-hover:bg-gray-100">
                      <FolderOpen size={20} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-gray-900 group-hover:text-blue-600">
                          {project.name}
                        </h3>
                        {project.description && (
                          <span className="flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-medium text-green-600">
                            <Activity size={10} />
                            Active
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-sm text-gray-500">
                        {project.description || project.storageKey}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="flex items-center gap-4 text-xs text-gray-400">
                      <span className="flex items-center gap-1.5">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: lang.color }}
                        />
                        {lang.name}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock size={12} />
                        {timeAgo(project.updatedAt)}
                      </span>
                    </div>
                    <ArrowUpRight
                      size={16}
                      className="text-gray-300 opacity-0 transition-opacity group-hover:opacity-100"
                    />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
