import { apiFetch } from "@/lib/client/api";

export type InlineCompletion = {
  text: string;
};

export async function getInlineCompletions(params: {
  projectId: string;
  filePath: string;
  content: string;
  line: number;
  column: number;
  language: string;
}): Promise<{ completions: InlineCompletion[] }> {
  return apiFetch("/api/ai/complete", {
    method: "POST",
    body: JSON.stringify(params),
  });
}
