/**
 * Client-side typed helpers for the AI providers API.
 *
 * The /api/ai/providers endpoint returns a plain JSON response (not wrapped in
 * the standard { success, data } envelope), so we use a direct fetch here
 * rather than `apiFetch`.
 */

export type AIModel = {
  id: string;
  name: string;
  contextWindow: number;
  pricing?: { input: number; output: number };
};

export type AIProviderInfo = {
  id: string;
  name: string;
  models: AIModel[];
  requiresApiKey?: boolean;
};

export async function listProviders(): Promise<{ providers: AIProviderInfo[] }> {
  const res = await fetch("/api/ai/providers");
  if (!res.ok) {
    throw new Error(`Failed to fetch providers: ${res.status}`);
  }
  return res.json();
}
