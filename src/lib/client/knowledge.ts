/**
 * Client helpers for the Knowledge API (Phase 7b).
 *
 * Wraps the shared `apiFetch` envelope unwrapper. Server enforces authz.
 */
import { apiFetch } from "@/lib/client/api";

export type KnowledgeType = "TEXT" | "FILE" | "URL" | "NOTE";

export type KnowledgeItem = {
  id: string;
  workspaceId: string;
  projectId: string | null;
  title: string;
  type: KnowledgeType;
  content: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
};

export function listKnowledge(
  projectId?: string
): Promise<{ items: KnowledgeItem[] }> {
  const qs = projectId ? `?projectId=${encodeURIComponent(projectId)}` : "";
  return apiFetch(`/api/knowledge${qs}`);
}

export type CreateKnowledgeInput = {
  workspaceId: string;
  projectId?: string | null;
  title: string;
  type: KnowledgeType;
  content: string;
  metadata?: Record<string, unknown>;
};

export function createKnowledge(
  input: CreateKnowledgeInput
): Promise<{ item: KnowledgeItem }> {
  return apiFetch("/api/knowledge", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export type UpdateKnowledgeInput = {
  title?: string;
  type?: KnowledgeType;
  content?: string;
  metadata?: Record<string, unknown> | null;
  projectId?: string | null;
};

export function updateKnowledge(
  id: string,
  input: UpdateKnowledgeInput
): Promise<{ item: KnowledgeItem }> {
  return apiFetch(`/api/knowledge/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteKnowledge(
  id: string
): Promise<{ deleted: boolean; id: string }> {
  return apiFetch(`/api/knowledge/${id}`, { method: "DELETE" });
}

export function searchKnowledge(
  q: string,
  projectId?: string | null
): Promise<{ items: KnowledgeItem[] }> {
  return apiFetch("/api/knowledge/search", {
    method: "POST",
    body: JSON.stringify({ q, projectId: projectId ?? undefined }),
  });
}
