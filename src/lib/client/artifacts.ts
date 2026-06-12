/**
 * Client helpers for the Artifacts API.
 */
import { apiFetch } from "@/lib/client/api";

export type ArtifactType = "CODE" | "DOCUMENT" | "CHART" | "WEBAPP" | "IMAGE";

export type Artifact = {
  id: string;
  projectId: string;
  userId: string;
  title: string;
  type: ArtifactType;
  content: string;
  language: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
};

/** List item (no content field to keep payloads small). */
export type ArtifactListItem = Omit<Artifact, "content">;

export function listArtifacts(
  projectId: string,
  type?: ArtifactType
): Promise<{ artifacts: ArtifactListItem[] }> {
  const qs = type ? `?type=${encodeURIComponent(type)}` : "";
  return apiFetch(`/api/projects/${projectId}/artifacts${qs}`);
}

export function getArtifact(
  artifactId: string
): Promise<{ artifact: Artifact }> {
  return apiFetch(`/api/artifacts/${artifactId}`);
}

export type CreateArtifactInput = {
  title: string;
  type: ArtifactType;
  content: string;
  language?: string;
  metadata?: Record<string, unknown>;
};

export function createArtifact(
  projectId: string,
  input: CreateArtifactInput
): Promise<{ artifact: Artifact }> {
  return apiFetch(`/api/projects/${projectId}/artifacts`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export type UpdateArtifactInput = {
  title?: string;
  content?: string;
  metadata?: Record<string, unknown> | null;
};

export function updateArtifact(
  artifactId: string,
  input: UpdateArtifactInput
): Promise<{ artifact: Artifact }> {
  return apiFetch(`/api/artifacts/${artifactId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteArtifact(
  artifactId: string
): Promise<{ deleted: boolean; id: string }> {
  return apiFetch(`/api/artifacts/${artifactId}`, { method: "DELETE" });
}
