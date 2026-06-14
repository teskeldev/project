/**
 * Client-side helper that fetches installed extensions and resolves
 * their hooks into UI-consumable structures.
 */

import { apiFetch } from "@/lib/client/api";
import {
  resolveExtensions,
  type RegistryEntryWithHooks,
  type ResolvedExtensions,
} from "@/lib/extensions/runtime";
import type { InstalledExtension } from "@/lib/client/extensions";

/** Empty result for when no extensions are active. */
const EMPTY: ResolvedExtensions = {
  commands: [],
  statusBarItems: [],
  fileIcons: [],
  editorActions: [],
};

/**
 * Fetch installed extensions for a workspace, match them against the
 * registry, and return resolved hooks.
 *
 * Returns an empty result if no workspace is provided.
 */
export async function getActiveExtensionHooks(
  workspaceId?: string | null
): Promise<ResolvedExtensions> {
  if (!workspaceId) return EMPTY;

  try {
    // Fetch registry and installed extensions in parallel
    const [registryRes, installedRes] = await Promise.all([
      apiFetch<{ extensions: RegistryEntryWithHooks[] }>(
        "/api/extensions/registry"
      ),
      apiFetch<{ extensions: InstalledExtension[] }>(
        `/api/extensions?workspaceId=${encodeURIComponent(workspaceId)}`
      ),
    ]);

    const installedIds = installedRes.extensions.map((e) => e.registryId);

    if (installedIds.length === 0) return EMPTY;

    return resolveExtensions(installedIds, registryRes.extensions);
  } catch {
    // Silently return empty on error — extensions are non-critical
    return EMPTY;
  }
}
