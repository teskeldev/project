/**
 * Client-side typed fetch wrapper for Teskel APIs.
 *
 * All server routes respond with either:
 *   { success: true,  data }
 *   { success: false, error: { message, code? } }
 *
 * `apiFetch` unwraps `data` on success and throws `ApiClientError` on failure
 * (network errors, non-2xx, or `{ success:false }` payloads).
 */

export class ApiClientError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status = 0, code?: string) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.code = code;
  }
}

type ApiEnvelope<T> =
  | { success: true; data: T }
  | { success: false; error: { message: string; code?: string } };

export async function apiFetch<T>(
  url: string,
  options?: RequestInit
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options?.headers ?? {}),
      },
    });
  } catch (err) {
    throw new ApiClientError(
      err instanceof Error ? err.message : "Network request failed",
      0,
      "NETWORK_ERROR"
    );
  }

  let body: ApiEnvelope<T> | null = null;
  try {
    body = (await res.json()) as ApiEnvelope<T>;
  } catch {
    // No/invalid JSON body.
  }

  if (!res.ok || !body || body.success === false) {
    const message =
      body && body.success === false
        ? body.error.message
        : `Request failed with status ${res.status}`;
    const code =
      body && body.success === false ? body.error.code : undefined;
    throw new ApiClientError(message, res.status, code);
  }

  return body.data;
}

/* -------------------------------------------------------------------------- */
/* Shared domain types (mirror the API responses)                             */
/* -------------------------------------------------------------------------- */

export type Workspace = {
  id: string;
  name: string;
  slug: string;
  ownerId: string;
  role: string;
  projectCount: number;
  memberCount: number;
  createdAt: string;
  updatedAt: string;
};

export type Project = {
  id: string;
  workspaceId: string;
  name: string;
  slug: string;
  description: string | null;
  storageKey: string;
  defaultBranch?: string;
  createdAt: string;
  updatedAt: string;
};

export type FileNodeType = "FILE" | "FOLDER";

export type FileNode = {
  id: string;
  name: string;
  path: string;
  type: FileNodeType;
  language?: string | null;
  size?: number;
  parentId?: string | null;
  updatedAt?: string;
  children?: FileNode[];
};

export type FileContent = {
  path: string;
  content: string;
  language: string | null;
  size: number;
};

export type ProjectTemplate = "blank" | "node";

/* -------------------------------------------------------------------------- */
/* Endpoint helpers                                                           */
/* -------------------------------------------------------------------------- */

export function listWorkspaces(): Promise<{ workspaces: Workspace[] }> {
  return apiFetch("/api/workspaces");
}

export function listProjects(
  workspaceId?: string
): Promise<{ projects: Project[] }> {
  const qs = workspaceId
    ? `?workspaceId=${encodeURIComponent(workspaceId)}`
    : "";
  return apiFetch(`/api/projects${qs}`);
}

export function createProject(input: {
  workspaceId: string;
  name: string;
  description?: string;
  template?: ProjectTemplate;
}): Promise<{ project: Project }> {
  return apiFetch("/api/projects", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function createWorkspace(name: string): Promise<{ workspace: Workspace }> {
  return apiFetch("/api/workspaces", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export function getFileTree(
  projectId: string
): Promise<{ tree: FileNode[] }> {
  return apiFetch(`/api/projects/${projectId}/files/tree`);
}

export function getFileContent(
  projectId: string,
  path: string
): Promise<FileContent> {
  return apiFetch(
    `/api/projects/${projectId}/files/content?path=${encodeURIComponent(path)}`
  );
}

export function saveFile(
  projectId: string,
  path: string,
  content: string
): Promise<{ path: string; size: number }> {
  return apiFetch(`/api/projects/${projectId}/files`, {
    method: "PATCH",
    body: JSON.stringify({ path, content }),
  });
}

export function createFileNode(
  projectId: string,
  input: {
    parentPath?: string;
    name: string;
    type: FileNodeType;
    content?: string;
  }
): Promise<{ node: FileNode }> {
  return apiFetch(`/api/projects/${projectId}/files`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function renameFileNode(
  projectId: string,
  oldPath: string,
  newPath: string
): Promise<{ node: FileNode }> {
  return apiFetch(`/api/projects/${projectId}/files/rename`, {
    method: "POST",
    body: JSON.stringify({ oldPath, newPath }),
  });
}

export function deleteFileNode(
  projectId: string,
  path: string
): Promise<{ deleted: boolean; path: string }> {
  return apiFetch(
    `/api/projects/${projectId}/files?path=${encodeURIComponent(path)}`,
    { method: "DELETE" }
  );
}

/* -------------------------------------------------------------------------- */
/* Chat (Phase 3) domain types + helpers                                      */
/* -------------------------------------------------------------------------- */

export type ChatMessageRole = "USER" | "ASSISTANT" | "SYSTEM" | "TOOL";

export type ChatThread = {
  id: string;
  title: string;
  projectId: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
};

export type ChatMessage = {
  id: string;
  threadId: string;
  role: ChatMessageRole;
  content: string;
  metadata?: unknown;
  createdAt: string;
};

/** Minimal ChangeSet shape returned by the changeset generator. */
export type ChangeSet = {
  id: string;
  projectId: string;
  status: string;
  summary?: string | null;
  createdAt?: string;
  [key: string]: unknown;
};

export function listThreads(
  projectId: string
): Promise<{ threads: ChatThread[] }> {
  return apiFetch(`/api/projects/${projectId}/chat/threads`);
}

export function createThread(
  projectId: string,
  title?: string
): Promise<{ thread: ChatThread }> {
  return apiFetch(`/api/projects/${projectId}/chat/threads`, {
    method: "POST",
    body: JSON.stringify(title ? { title } : {}),
  });
}

export function listMessages(
  threadId: string
): Promise<{ messages: ChatMessage[] }> {
  return apiFetch(`/api/chat/threads/${threadId}/messages`);
}

export function generateChangeSet(input: {
  projectId: string;
  instruction: string;
  selectedPaths?: string[];
}): Promise<{ changeSet: ChangeSet }> {
  return apiFetch("/api/ai/generate-changeset", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/* -------------------------------------------------------------------------- */
/* ChangeSets / review (Phase 4)                                              */
/* -------------------------------------------------------------------------- */

export type ChangeSetStatus = "DRAFT" | "PENDING_REVIEW" | "APPLIED" | "REJECTED";
export type FileChangeType = "CREATE" | "UPDATE" | "DELETE" | "RENAME";
export type FileChangeStatus = "PENDING" | "ACCEPTED" | "REJECTED";

export type ChangeSetSummary = {
  id: string;
  projectId: string;
  agentRunId: string | null;
  title: string;
  description: string | null;
  status: ChangeSetStatus;
  createdAt: string;
  updatedAt: string;
  fileChangeCount: number;
  summary: { additions: number; deletions: number };
};

export type FileChange = {
  id: string;
  filePath: string;
  oldPath: string | null;
  changeType: FileChangeType;
  oldContent: string | null;
  newContent: string | null;
  diff: string | null;
  status: FileChangeStatus;
  createdAt: string;
  updatedAt: string;
};

export type ChangeSetDetail = {
  id: string;
  projectId: string;
  agentRunId: string | null;
  title: string;
  description: string | null;
  status: ChangeSetStatus;
  createdAt: string;
  updatedAt: string;
  fileChanges: FileChange[];
};

export type ApplyOutcome = {
  fileChangeId: string;
  filePath: string;
  changeType: FileChangeType;
};
export type ApplyConflict = ApplyOutcome & { reason: string };
export type ApplyFailure = ApplyOutcome & { error: string };

export type ApplyResult = {
  applied: ApplyOutcome[];
  conflicts: ApplyConflict[];
  failures: ApplyFailure[];
  changeSetStatus: ChangeSetStatus;
};

export function listChangeSets(
  projectId: string,
  status?: string
): Promise<{ changesets: ChangeSetSummary[] }> {
  const qs = status ? `?status=${encodeURIComponent(status)}` : "";
  return apiFetch(`/api/projects/${projectId}/changesets${qs}`);
}

export function getChangeSet(
  changeSetId: string
): Promise<{ changeSet: ChangeSetDetail }> {
  return apiFetch(`/api/changesets/${changeSetId}`);
}

export function updateFileChange(
  fileChangeId: string,
  status: "ACCEPTED" | "REJECTED"
): Promise<{ fileChange: FileChange }> {
  return apiFetch(`/api/file-changes/${fileChangeId}`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

export function applyChangeSet(
  changeSetId: string,
  applyAll = false
): Promise<ApplyResult> {
  return apiFetch(`/api/changesets/${changeSetId}/apply`, {
    method: "POST",
    body: JSON.stringify({ applyAll }),
  });
}

export function rejectChangeSet(
  changeSetId: string
): Promise<{ changeSet: ChangeSetDetail }> {
  return apiFetch(`/api/changesets/${changeSetId}/reject`, {
    method: "POST",
  });
}