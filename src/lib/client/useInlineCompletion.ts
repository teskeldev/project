"use client";

import { useCallback, useRef } from "react";
import { getInlineCompletions, type InlineCompletion } from "@/lib/client/complete";

/**
 * Hook that returns a function to register an inline completion provider
 * on a Monaco editor instance. Call registerProvider(editor, monaco) after
 * the editor mounts.
 */
export function useInlineCompletion(projectId: string | null) {
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const registerProvider = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (editor: any, monaco: any) => {
      if (!projectId) return undefined;

      const provider = monaco.languages.registerInlineCompletionsProvider("*", {
        provideInlineCompletions: async (
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          model: any,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          position: any,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          _context: any,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          token: any
        ) => {
          // Cancel previous request
          abortRef.current?.abort();
          abortRef.current = new AbortController();

          // Debounce: wait 500ms after last keystroke
          if (debounceRef.current) clearTimeout(debounceRef.current);

          return new Promise((resolve) => {
            debounceRef.current = setTimeout(async () => {
              if (token.isCancellationRequested) {
                resolve({ items: [] });
                return;
              }

              try {
                const content = model.getValue();
                const filePath =
                  model.uri?.path?.replace(/^\//, "") || "untitled";
                const language = model.getLanguageId?.() || "";

                const { completions } = await getInlineCompletions({
                  projectId,
                  filePath,
                  content,
                  line: position.lineNumber,
                  column: position.column,
                  language,
                });

                if (token.isCancellationRequested) {
                  resolve({ items: [] });
                  return;
                }

                const items = completions.map((c: InlineCompletion) => ({
                  insertText: c.text,
                  range: {
                    startLineNumber: position.lineNumber,
                    startColumn: position.column,
                    endLineNumber: position.lineNumber,
                    endColumn: position.column,
                  },
                }));

                resolve({ items });
              } catch {
                resolve({ items: [] });
              }
            }, 500);
          });
        },
        freeInlineCompletions: () => {},
      });

      // Return disposable
      return provider;
    },
    [projectId]
  );

  return { registerProvider };
}
