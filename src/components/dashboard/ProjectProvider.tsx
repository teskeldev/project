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
  initialWorkspaces,
  initialProjects,
}: {
  children: React.ReactNode;
  initialWorkspaces?: Workspace[];
  initialProjects?: Project[];
}) {
  // The layout passes the workspace + project lists pre-fetched from the
  // server. We seed the state from those values so the very first paint
  // already has `activeProject` / `activeWorkspace` resolved and child
  // pages don't have to wait for an extra client round-trip.
  const [workspaces, setWorkspaces] = useState<Workspace[]>(
    initialWorkspaces ?? []
  );
  const [projects, setProjects] = useState<Project[]>(initialProjects ?? []);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(() => {
    const stored = readStoredProjectId();
    const valid = (initialProjects ?? []).find((p) => p.id === stored);
    if (valid) return valid.id;
    return (initialProjects ?? [])[0]?.id ?? null;
  });
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(
    // Only show the "loading" state on the client if we received nothing
    // from the server (e.g. an unauthenticated or partial render).
    (initialWorkspaces?.length ?? 0) === 0 &&
      (initialProjects?.length ?? 0) === 0
  );
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
      setWorkspaces((prev) => {
        const unchanged = prev.length === ws.length && prev.every((w, i) => w.id === ws[i].id && w.updatedAt === ws[i].updatedAt);
        return unchanged ? prev : ws;
      });
      setProjects((prev) => {
        const unchanged = prev.length === pj.length && prev.every((p, i) => p.id === pj[i].id && p.updatedAt === pj[i].updatedAt);
        return unchanged ? prev : pj;
      });

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
    // Only kick off a client-side refresh on mount if we didn't already
    // receive data from the server-side layout. If the layout pre-fetched
    // workspaces + projects, calling refresh() here would clobber that
    // initial state with a fresh round-trip, briefly flip `loading` to
    // true, and cause any page-level `useEffect(..., [loading])` to
    // double-fetch (e.g. /api/dashboard/summary runs twice on first load).
    if (
      (initialWorkspaces?.length ?? 0) === 0 &&
      (initialProjects?.length ?? 0) === 0
    ) {
      void refresh();
    }
    // We intentionally don't depend on `initialWorkspaces`/`initialProjects`
    // because their values are effectively static for the lifetime of the
    // component (the layout only re-renders the whole tree on a real nav).
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const activeWorkspaceRef = useRef(activeWorkspace);
  const workspacesRef = useRef(workspaces);
  useEffect(() => {
    activeWorkspaceRef.current = activeWorkspace;
    workspacesRef.current = workspaces;
  }, [activeWorkspace, workspaces]);

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
      // Use refs for workspace data to keep the callback identity stable
      const workspaceId = activeWorkspaceRef.current?.id ?? workspacesRef.current[0]?.id;
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
    [setActiveProject]
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
