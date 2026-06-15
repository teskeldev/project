/**
 * Resolve an AI provider API key.
 * Priority: env var > DB integration (encrypted).
 *
 * This bridges the Integrations page (where users store keys) with the
 * AI provider (which needs keys to make API calls).
 */
import { prisma } from "@/lib/db";
import { decryptJson } from "@/lib/crypto";

export type ResolvedKey = {
  apiKey: string;
  source: "env" | "db";
} | null;

const ENV_KEY_MAP: Record<string, string> = {
  openai: "OPENAI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
  google: "GOOGLE_API_KEY",
  groq: "GROQ_API_KEY",
  openrouter: "OPENROUTER_API_KEY",
  deepseek: "DEEPSEEK_API_KEY",
  cerebras: "CEREBRAS_API_KEY",
  together: "TOGETHER_API_KEY",
  fireworks: "FIREWORKS_API_KEY",
  xai: "XAI_API_KEY",
  "azure-openai": "AZURE_OPENAI_API_KEY",
};

/**
 * Resolve API key for a provider.
 * @param providerId - 'openai' | 'anthropic' | 'groq' | 'ollama'
 * @param workspaceId - optional workspace to check DB integrations
 */
export async function resolveApiKey(
  providerId: string,
  workspaceId?: string
): Promise<ResolvedKey> {
  // 1. Check environment variable
  const envVar = ENV_KEY_MAP[providerId];
  if (envVar) {
    const envKey = process.env[envVar]?.trim();
    if (envKey && envKey.length > 0) {
      return { apiKey: envKey, source: "env" };
    }
  }

  // 2. Ollama doesn't need a key
  if (providerId === "ollama") {
    return { apiKey: "", source: "env" };
  }

  // 3. Check database integrations
  if (!workspaceId) return null;

  try {
    const integration = await prisma.integration.findFirst({
      where: {
        workspaceId,
        provider: providerId,
        enabled: true,
      },
      select: { encryptedConfig: true },
    });

    if (!integration) return null;

    const config = decryptJson<Record<string, string>>(integration.encryptedConfig);
    const apiKey = config.apiKey || config.api_key || config.token;

    if (apiKey && apiKey.trim().length > 0) {
      return { apiKey: apiKey.trim(), source: "db" };
    }
  } catch {
    // Decryption failure or DB error — fall through
  }

  return null;
}
