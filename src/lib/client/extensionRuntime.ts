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

// In-memory cache, keyed by workspaceId. Multiple components on the same
// page (ExtensionStatusBar, CommandPalette, etc.) all hit the same data;
// without caching, the registry + installed list is fetched on every mount
// and on every workspace ref change. The 5-second polling that used to
// hammer these endpoints was removed in favor of the `extensions-changed`
// event, but a short-lived cache still avoids the duplicate fetches that
// happen during the same render cycle.
const CACHE_TTL_MS = 30_000;
let cache: {
  workspaceId: string;
  result: ResolvedExtensions;
  at: number;
} | null = null;

/** Drop the cached extension hooks. Called from install/uninstall flows. */
export function invalidateExtensionCache(): void {
  cache = null;
}

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

  const now = Date.now();
  if (cache && cache.workspaceId === workspaceId && now - cache.at < CACHE_TTL_MS) {
    return cache.result;
  }

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

    if (installedIds.length === 0) {
      cache = { workspaceId, result: EMPTY, at: now };
      return EMPTY;
    }

    const result = resolveExtensions(installedIds, registryRes.extensions);
    cache = { workspaceId, result, at: now };
    return result;
  } catch {
    // Silently return empty on error — extensions are non-critical
    return EMPTY;
  }
}
