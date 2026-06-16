"use client";

import { useEffect, useState, useCallback } from "react";
import { useProject } from "@/lib/store/project";
import { getActiveExtensionHooks } from "@/lib/client/extensionRuntime";
import type { StatusBarHook } from "@/lib/extensions/runtime";

/**
 * Renders extension-provided status bar items at the bottom of the dashboard.
 * Items appear/disappear as extensions are installed/uninstalled.
 */
export default function ExtensionStatusBar() {
  const { activeWorkspace } = useProject();
  const [items, setItems] = useState<StatusBarHook[]>([]);

  const loadHooks = useCallback(async () => {
    const hooks = await getActiveExtensionHooks(activeWorkspace?.id);
    setItems(hooks.statusBarItems);
  }, [activeWorkspace?.id]);

  useEffect(() => {
    void loadHooks();
  }, [loadHooks]);

  // Listen for custom event dispatched when extensions are installed/uninstalled
  useEffect(() => {
    const handler = () => void loadHooks();
    window.addEventListener("extensions-changed", handler);
    return () => window.removeEventListener("extensions-changed", handler);
  }, [loadHooks]);

  if (items.length === 0) return null;

  const leftItems = items.filter((i) => i.position === "left");
  const rightItems = items.filter((i) => i.position === "right");

  return (
    <footer
      className="flex h-6 shrink-0 items-center justify-between border-t px-3 text-[11px]"
      style={{
        borderColor: "var(--border)",
        background: "var(--background)",
        color: "var(--foreground)",
      }}
    >
      <div className="flex items-center gap-3">
        {leftItems.map((item, i) => (
          <span
            key={`${item.extensionId}-${i}`}
            className="cursor-default opacity-70 transition-opacity hover:opacity-100"
            title={item.tooltip}
          >
            {item.text}
          </span>
        ))}
      </div>
      <div className="flex items-center gap-3">
        {rightItems.map((item, i) => (
          <span
            key={`${item.extensionId}-${i}`}
            className="cursor-default opacity-70 transition-opacity hover:opacity-100"
            title={item.tooltip}
          >
            {item.text}
          </span>
        ))}
      </div>
    </footer>
  );
}
