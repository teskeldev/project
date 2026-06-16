/**
 * Client helpers for the Extensions API.
 */
import { apiFetch } from "@/lib/client/api";
import { invalidateExtensionCache } from "@/lib/client/extensionRuntime";

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

export async function installExtension(input: {
  workspaceId: string;
  registryId: string;
  name: string;
  author: string;
  version: string;
}): Promise<{ extension: InstalledExtension }> {
  const result = await apiFetch<{ extension: InstalledExtension }>("/api/extensions", {
    method: "POST",
    body: JSON.stringify(input),
  });
  invalidateExtensionCache();
  return result;
}

export async function uninstallExtension(
  extensionId: string
): Promise<{ deleted: boolean; id: string }> {
  const result = await apiFetch<{ deleted: boolean; id: string }>(`/api/extensions/${extensionId}`, { method: "DELETE" });
  invalidateExtensionCache();
  return result;
}
