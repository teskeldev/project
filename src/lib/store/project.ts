"use client";

import { createContext, useContext } from "react";
import type {
  Project,
  Workspace,
  ProjectTemplate,
} from "@/lib/client/api";

/**
 * Active-project store shape. Backed by React context (see
 * `src/components/dashboard/ProjectProvider.tsx`). Consumed via `useProject()`.
 */
export type ProjectStore = {
  workspaces: Workspace[];
  projects: Project[];
  activeWorkspace: Workspace | null;
  activeProject: Project | null;

  loading: boolean;
  error: string | null;

  /** Switch the active project by id (persists to localStorage). */
  setActiveProject: (projectId: string | null) => void;
  /** Switch the active workspace by id. */
  setActiveWorkspace: (workspaceId: string) => void;
  /** Re-fetch workspaces + projects from the API. */
  refresh: () => Promise<void>;
  /** Create a project and make it active. */
  createNewProject: (input: {
    name: string;
    template?: ProjectTemplate;
    description?: string;
  }) => Promise<Project>;
};

export const ACTIVE_PROJECT_KEY = "teskel.activeProjectId";

export const ProjectContext = createContext<ProjectStore | null>(null);

/** Access the active-project store. Throws if used outside <ProjectProvider>. */
export function useProject(): ProjectStore {
  const ctx = useContext(ProjectContext);
  if (!ctx) {
    throw new Error("useProject must be used within a <ProjectProvider>");
  }
  return ctx;
}
