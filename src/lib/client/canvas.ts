/**
 * Client helpers for the Documents (Canvas) API.
 */
import { apiFetch } from "@/lib/client/api";

export type Document = {
  id: string;
  projectId: string;
  userId: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
};

/** List item (no content field to keep payloads small). */
export type DocumentListItem = Omit<Document, "content">;

export function listDocuments(
  projectId: string
): Promise<{ documents: DocumentListItem[] }> {
  return apiFetch(`/api/documents?projectId=${encodeURIComponent(projectId)}`);
}

export function getDocument(
  documentId: string
): Promise<{ document: Document }> {
  return apiFetch(`/api/documents/${documentId}`);
}

export function createDocument(input: {
  projectId: string;
  title: string;
  content?: string;
}): Promise<{ document: Document }> {
  return apiFetch("/api/documents", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateDocument(
  documentId: string,
  input: { title?: string; content?: string }
): Promise<{ document: Document }> {
  return apiFetch(`/api/documents/${documentId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteDocument(
  documentId: string
): Promise<{ deleted: boolean; id: string }> {
  return apiFetch(`/api/documents/${documentId}`, { method: "DELETE" });
}
