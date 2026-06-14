/**
 * Client helpers for the Slash Commands API.
 *
 * Wraps the shared `apiFetch` envelope unwrapper. Server enforces authz; these
 * are thin typed fetchers consumed by the Commands dashboard page and the
 * chat input slash-command dropdown.
 */
import { apiFetch } from "@/lib/client/api";

export type CommandVariable = {
  name: string;
  description: string;
  required: boolean;
  defaultValue?: string;
};

export type SlashCommand = {
  id: string;
  name: string;
  description: string;
  template: string;
  variables: CommandVariable[];
  builtin?: boolean;
};

export type ListCommandsParams = {
  workspaceId?: string;
};

export function listCommands(
  params?: ListCommandsParams
): Promise<{ commands: SlashCommand[] }> {
  const qs = new URLSearchParams();
  if (params?.workspaceId) qs.set("workspaceId", params.workspaceId);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return apiFetch(`/api/commands${suffix}`);
}

export type CreateCommandInput = {
  workspaceId: string;
  name: string;
  description: string;
  template: string;
  variables?: CommandVariable[];
};

export function createCommand(
  input: CreateCommandInput
): Promise<{ command: SlashCommand }> {
  return apiFetch("/api/commands", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export type UpdateCommandInput = {
  name?: string;
  description?: string;
  template?: string;
  variables?: CommandVariable[];
};

export function updateCommand(
  id: string,
  input: UpdateCommandInput
): Promise<{ command: SlashCommand }> {
  return apiFetch(`/api/commands/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteCommand(
  id: string
): Promise<{ deleted: boolean; id: string }> {
  return apiFetch(`/api/commands/${id}`, { method: "DELETE" });
}

/**
 * Resolve a command template: replace {{variables}} with provided values.
 * Client-side utility for preview and submission.
 */
export function resolveCommandTemplate(
  template: string,
  values: Record<string, string>
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, varName: string) => {
    return values[varName] ?? "";
  });
}
