/**
 * Client helpers for the Skills API.
 *
 * Wraps the shared `apiFetch` envelope unwrapper. Server enforces authz; these
 * are thin typed fetchers consumed by the Skills dashboard page.
 */
import { apiFetch } from "@/lib/client/api";

export type Skill = {
  id: string;
  workspaceId: string | null;
  projectId: string | null;
  name: string;
  slug: string;
  description: string;
  content: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ListSkillsParams = {
  workspaceId?: string;
  projectId?: string;
};

export function listSkills(
  params?: ListSkillsParams
): Promise<{ skills: Skill[] }> {
  const qs = new URLSearchParams();
  if (params?.workspaceId) qs.set("workspaceId", params.workspaceId);
  if (params?.projectId) qs.set("projectId", params.projectId);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return apiFetch(`/api/skills${suffix}`);
}

export function getSkill(id: string): Promise<{ skill: Skill }> {
  return apiFetch(`/api/skills/${id}`);
}

export type CreateSkillInput = {
  workspaceId: string;
  projectId?: string | null;
  name: string;
  slug: string;
  description: string;
  content: string;
  enabled?: boolean;
};

export function createSkill(
  input: CreateSkillInput
): Promise<{ skill: Skill }> {
  return apiFetch("/api/skills", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export type UpdateSkillInput = {
  name?: string;
  slug?: string;
  description?: string;
  content?: string;
  enabled?: boolean;
};

export function updateSkill(
  id: string,
  input: UpdateSkillInput
): Promise<{ skill: Skill }> {
  return apiFetch(`/api/skills/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteSkill(
  id: string
): Promise<{ deleted: boolean; id: string }> {
  return apiFetch(`/api/skills/${id}`, { method: "DELETE" });
}
