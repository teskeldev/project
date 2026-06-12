"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  listWorkspaces,
  listProjects,
  createProject as apiCreateProject,
  ApiClientError,
  type Project,
  type Workspace,
} from "@/lib/client/api";
import {
  ProjectContext,
  ACTIVE_PROJECT_KEY,
  type ProjectStore,
} from "@/lib/store/project";

function readStoredProjectId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(ACTIVE_PROJECT_KEY);
  } catch {
    return null;
  }
}

function persistProjectId(id: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (id) window.localStorage.setItem(ACTIVE_PROJECT_KEY, id);
    else window.localStorage.removeItem(ACTIVE_PROJECT_KEY);
  } catch {
    // ignore storage failures (private mode, quota, etc.)
  }
}

export default function ProjectProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Avoid clobbering an explicit user selection during background refreshes.
  const userSelectedRef = useRef(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [{ workspaces: ws }, { projects: pj }] = await Promise.all([
        listWorkspaces(),
        listProjects(),
      ]);
      setWorkspaces(ws);
      setProjects(pj);

      const stored = readStoredProjectId();
      setActiveProjectId((prev) => {
        const candidate = prev ?? stored;
        const valid = pj.find((p) => p.id === candidate);
        if (valid) return valid.id;
        // Fall back to the most-recently-updated project.
        return pj[0]?.id ?? null;
      });
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : "Failed to load workspaces"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const activeProject = useMemo(
    () => projects.find((p) => p.id === activeProjectId) ?? null,
    [projects, activeProjectId]
  );

  // The active workspace tracks the active project unless explicitly chosen.
  const activeWorkspace = useMemo(() => {
    const wsId = activeProject?.workspaceId ?? activeWorkspaceId;
    return workspaces.find((w) => w.id === wsId) ?? workspaces[0] ?? null;
  }, [workspaces, activeProject, activeWorkspaceId]);

  const setActiveProject = useCallback((projectId: string | null) => {
    userSelectedRef.current = true;
    setActiveProjectId(projectId);
    persistProjectId(projectId);
  }, []);

  const setActiveWorkspace = useCallback((workspaceId: string) => {
    setActiveWorkspaceId(workspaceId);
  }, []);

  const createNewProject = useCallback<ProjectStore["createNewProject"]>(
    async ({ name, template, description }) => {
      // Need a workspace to create a project under.
      const workspaceId = activeWorkspace?.id ?? workspaces[0]?.id;
      if (!workspaceId) {
        // No workspace yet: surface a clear error rather than guessing.
        throw new ApiClientError(
          "No workspace available. Create a workspace first.",
          400,
          "NO_WORKSPACE"
        );
      }

      const { project } = await apiCreateProject({
        workspaceId,
        name,
        template,
        description,
      });

      setProjects((prev) => [project, ...prev]);
      setActiveProject(project.id);
      return project;
    },
    [activeWorkspace, workspaces, setActiveProject]
  );

  const value = useMemo<ProjectStore>(
    () => ({
      workspaces,
      projects,
      activeWorkspace,
      activeProject,
      loading,
      error,
      setActiveProject,
      setActiveWorkspace,
      refresh,
      createNewProject,
    }),
    [
      workspaces,
      projects,
      activeWorkspace,
      activeProject,
      loading,
      error,
      setActiveProject,
      setActiveWorkspace,
      refresh,
      createNewProject,
    ]
  );

  return (
    <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>
  );
}
