"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Monitor, Moon, Sun, AlertCircle, Loader2 } from "lucide-react";
import {
  fetchProfile,
  updatePreferences,
  type UserPreferences,
} from "@/lib/client/settings";
import {
  Card,
  CardContent,
  Toggle,
  Separator,
} from "@/components/ui";

/* -------------------------------------------------------------------------- */
/* Debounce hook                                                              */
/* -------------------------------------------------------------------------- */

function useDebounce<T extends (...args: never[]) => void>(
  fn: T,
  delay: number,
): T {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fnRef = useRef(fn);
  useEffect(() => {
    fnRef.current = fn;
  }, [fn]);

  return useCallback(
    (...args: Parameters<T>) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => fnRef.current(...args), delay);
    },
    [delay],
  ) as unknown as T;
}

/* -------------------------------------------------------------------------- */
/* Component                                                                  */
/* -------------------------------------------------------------------------- */

export default function AppearanceTab() {
  const [prefs, setPrefs] = useState<UserPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchProfile()
      .then((u) => {
        setPrefs((u.preferences as UserPreferences) ?? {});
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const persist = useCallback(
    (patch: Partial<UserPreferences>) => {
      setPrefs((prev) => ({ ...prev, ...patch }));
      updatePreferences(patch).catch(() => {});
    },
    [],
  );

  const debouncedPersist = useDebounce(
    (patch: Partial<UserPreferences>) => {
      updatePreferences(patch).catch(() => {});
    },
    400,
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 size={24} className="animate-spin text-text-muted" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
        <AlertCircle size={16} />
        {error}
      </div>
    );
  }

  const theme = prefs?.theme ?? "system";
  const fontSize = prefs?.fontSize ?? 14;
  const wordWrap = prefs?.wordWrap ?? true;
  const minimap = prefs?.minimap ?? false;
  const vim = prefs?.vim ?? false;

  return (
    <div>
      <h2 className="mb-4 text-lg font-medium text-foreground">Appearance</h2>

      {/* Theme selector */}
      <Card>
        <CardContent className="pt-6">
          <h3 className="mb-4 text-sm font-medium text-text-secondary">Theme</h3>
          <div className="flex gap-4">
            {(
              [
                { id: "system", icon: Monitor, label: "System" },
                { id: "light", icon: Sun, label: "Light" },
                { id: "dark", icon: Moon, label: "Dark" },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                onClick={() => persist({ theme: t.id })}
                className={`flex flex-1 flex-col items-center gap-2 rounded-xl border p-4 transition-colors ${
                  theme === t.id
                    ? "border-accent bg-accent-light"
                    : "border-border hover:border-border-strong"
                }`}
              >
                <t.icon
                  size={20}
                  className={
                    theme === t.id ? "text-accent" : "text-text-muted"
                  }
                />
                <span className="text-xs text-text-secondary">{t.label}</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Editor settings */}
      <Card className="mt-6">
        <CardContent className="pt-6">
          <h3 className="mb-4 text-sm font-medium text-text-secondary">Editor</h3>
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs text-text-muted">
                Font size: {fontSize}px
              </label>
              <input
                type="range"
                min={10}
                max={24}
                value={fontSize}
                onChange={(e) => {
                  const v = parseInt(e.target.value);
                  setPrefs((prev) => ({ ...prev, fontSize: v }));
                  debouncedPersist({ fontSize: v });
                }}
                className="w-full accent-blue-500"
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-text-secondary">Word wrap</p>
                <p className="text-xs text-text-muted">
                  Wrap long lines in the editor
                </p>
              </div>
              <Toggle
                checked={wordWrap}
                onCheckedChange={(v) => persist({ wordWrap: v })}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-text-secondary">Minimap</p>
                <p className="text-xs text-text-muted">
                  Show code overview minimap
                </p>
              </div>
              <Toggle
                checked={minimap}
                onCheckedChange={(v) => persist({ minimap: v })}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-text-secondary">Vim keybindings</p>
                <p className="text-xs text-text-muted">
                  Use Vim-style keyboard shortcuts
                </p>
              </div>
              <Toggle
                checked={vim}
                onCheckedChange={(v) => persist({ vim: v })}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
