/**
 * Client helpers for the Extensions API.
 */
import { apiFetch } from "@/lib/client/api";

export type RegistryExtension = {
  registryId: string;
  name: string;
  author: string;
  description: string;
  category: string;
  icon: string;
  installs: string;
  rating: number;
};

export type InstalledExtension = {
  id: string;
  workspaceId: string;
  registryId: string;
  name: string;
  author: string;
  version: string;
  config: Record<string, unknown> | null;
  createdAt: string;
};

export function fetchRegistry(): Promise<{ extensions: RegistryExtension[] }> {
  return apiFetch("/api/extensions/registry");
}

export function listInstalled(
  workspaceId: string
): Promise<{ extensions: InstalledExtension[] }> {
  return apiFetch(
    `/api/extensions?workspaceId=${encodeURIComponent(workspaceId)}`
  );
}

export function installExtension(input: {
  workspaceId: string;
  registryId: string;
  name: string;
  author: string;
  version: string;
}): Promise<{ extension: InstalledExtension }> {
  return apiFetch("/api/extensions", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function uninstallExtension(
  extensionId: string
): Promise<{ deleted: boolean; id: string }> {
  return apiFetch(`/api/extensions/${extensionId}`, { method: "DELETE" });
}
