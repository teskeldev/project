/**
 * Extension runtime — resolves installed extensions into active hooks
 * that the UI can consume.
 *
 * Extensions are JSON-configured (not executable code) for security.
 * Each extension declares hooks that modify UI behavior.
 */

import { sanitizeUrl } from "@/lib/sanitize";

/**
 * Sanitize and constrain a hook `action` field. The action is consumed by
 * the UI as a button target: either a `notify:<message>` token, a relative
 * path starting with `/` (no scheme), or an empty string when the value
 * cannot be made safe.
 *
 * Absolute URLs (http/https/etc) are intentionally dropped to prevent
 * extensions from hijacking the UI into opening arbitrary external sites.
 * Authors wanting external links should ship them as separate "open URL"
 * affordances handled by an allowlisted handler.
 */
function sanitizeAction(raw: unknown): string {
  const value = typeof raw === "string" ? raw : "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("notify:")) {
    // Strip any control characters from the message portion.
    const msg = trimmed.slice(7).replace(/[\x00-\x1f\x7f]/g, "");
    return `notify:${msg}`;
  }
  if (trimmed.startsWith("/")) {
    // Already a relative path; just route it through sanitizeUrl to
    // defensively strip any javascript:/data: tricks that might be
    // embedded via URL encoding.
    const safe = sanitizeUrl(trimmed);
    return safe.startsWith("/") ? safe : "";
  }
  // Anything else (absolute URLs, schemes, etc.) is rejected.
  return "";
}

export type ExtensionHookType =
  | "command"
  | "statusBar"
  | "fileIcon"
  | "editorAction"
  | "sidebarBadge"
  | "theme"
  | "snippet"
  | "linter"
  | "formatter";

export type ExtensionHook = {
  type: ExtensionHookType;
  config: Record<string, unknown>;
};

export type RegistryEntryWithHooks = {
  registryId: string;
  name: string;
  author: string;
  description: string;
  category: string;
  icon: string;
  installs: string;
  rating: number;
  hooks?: ExtensionHook[];
};

export type CommandHook = {
  extensionId: string;
  extensionName: string;
  label: string;
  description?: string;
  /**
   * Always-safe action target: either a `notify:<message>` token, a
   * relative path starting with `/`, or an empty string. Sanitized at
   * resolution time by `sanitizeAction` in this module.
   */
  action: string;
  icon?: string;
  keybinding?: string;
};

export type StatusBarHook = {
  extensionId: string;
  extensionName: string;
  text: string;
  tooltip?: string;
  position: "left" | "right";
  priority: number;
};

export type FileIconHook = {
  extensionId: string;
  extensionName: string;
  patterns: Record<string, string>; // glob pattern -> emoji/icon
};

export type EditorActionHook = {
  extensionId: string;
  extensionName: string;
  label: string;
  icon?: string;
  /**
   * Always-safe action target: either a `notify:<message>` token, a
   * relative path starting with `/`, or an empty string. Sanitized at
   * resolution time by `sanitizeAction` in this module.
   */
  action: string;
};

export type ResolvedExtensions = {
  commands: CommandHook[];
  statusBarItems: StatusBarHook[];
  fileIcons: FileIconHook[];
  editorActions: EditorActionHook[];
};

/**
 * Given a list of installed extension registryIds and the full registry,
 * resolve all active hooks into a structured result.
 */
export function resolveExtensions(
  installedRegistryIds: string[],
  registry: RegistryEntryWithHooks[]
): ResolvedExtensions {
  const result: ResolvedExtensions = {
    commands: [],
    statusBarItems: [],
    fileIcons: [],
    editorActions: [],
  };

  const installedSet = new Set(installedRegistryIds);

  for (const entry of registry) {
    if (!installedSet.has(entry.registryId)) continue;
    if (!entry.hooks) continue;

    for (const hook of entry.hooks) {
      switch (hook.type) {
        case "command": {
          const cfg = hook.config;
          result.commands.push({
            extensionId: entry.registryId,
            extensionName: entry.name,
            label: (cfg.label as string) ?? "",
            description: cfg.description as string | undefined,
            action: sanitizeAction(cfg.action),
            icon: cfg.icon as string | undefined,
            keybinding: cfg.keybinding as string | undefined,
          });
          break;
        }
        case "statusBar": {
          const cfg = hook.config;
          result.statusBarItems.push({
            extensionId: entry.registryId,
            extensionName: entry.name,
            text: (cfg.text as string) ?? "",
            tooltip: cfg.tooltip as string | undefined,
            position: (cfg.position as "left" | "right") ?? "right",
            priority: (cfg.priority as number) ?? 0,
          });
          break;
        }
        case "fileIcon": {
          const cfg = hook.config;
          result.fileIcons.push({
            extensionId: entry.registryId,
            extensionName: entry.name,
            patterns: (cfg.patterns as Record<string, string>) ?? {},
          });
          break;
        }
        case "editorAction": {
          const cfg = hook.config;
          result.editorActions.push({
            extensionId: entry.registryId,
            extensionName: entry.name,
            label: (cfg.label as string) ?? "",
            icon: cfg.icon as string | undefined,
            action: sanitizeAction(cfg.action),
          });
          break;
        }
        // Other hook types (theme, snippet, linter, formatter) are metadata-only
        // and don't produce UI hooks in this version.
        default:
          break;
      }
    }
  }

  // Sort status bar items by priority (higher = more important = shown first)
  result.statusBarItems.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));

  return result;
}
