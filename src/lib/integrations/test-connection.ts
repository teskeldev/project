/**
 * Server-only connection tests for integration providers.
 *
 * Given a provider + its DECRYPTED config, perform a lightweight check and
 * return a SAFE { ok, message } result. The secret (apiKey/token) is used only
 * in outbound request headers and is NEVER returned or logged.
 *
 * Network may be unavailable in some environments; all fetches are wrapped so a
 * transport failure degrades to a friendly error rather than throwing.
 */
import type { ProviderId } from "@/lib/integrations/providers";

export type TestResult = { ok: boolean; message: string };

const FETCH_TIMEOUT_MS = 10_000;

/** fetch with an abort-based timeout; never throws (returns the error). */
async function safeFetch(
  url: string,
  init: RequestInit
): Promise<{ res: Response } | { error: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    return { res };
  } catch (err) {
    // Could be a network/DNS error or an abort (timeout).
    const message =
      err instanceof Error && err.name === "AbortError"
        ? "Request timed out"
        : "Could not reach the provider (network unavailable)";
    return { error: message };
  } finally {
    clearTimeout(timer);
  }
}

function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

async function testOpenAI(config: Record<string, unknown>): Promise<TestResult> {
  const apiKey = typeof config.apiKey === "string" ? config.apiKey.trim() : "";
  if (!apiKey) {
    return { ok: false, message: "API key is missing." };
  }
  const baseUrl = stripTrailingSlash(
    typeof config.baseUrl === "string" && config.baseUrl.trim().length > 0
      ? config.baseUrl.trim()
      : "https://api.openai.com/v1"
  );

  // Lightweight: list models. Avoids spending tokens on a completion.
  const result = await safeFetch(`${baseUrl}/models`, {
    method: "GET",
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if ("error" in result) {
    return { ok: false, message: result.error };
  }
  const { res } = result;
  if (res.ok) {
    return { ok: true, message: "Connected. Credentials are valid." };
  }
  if (res.status === 401 || res.status === 403) {
    return { ok: false, message: "Authentication failed. Check the API key." };
  }
  return {
    ok: false,
    message: `Provider returned HTTP ${res.status}.`,
  };
}

async function testGitHub(config: Record<string, unknown>): Promise<TestResult> {
  const token = typeof config.token === "string" ? config.token.trim() : "";
  if (!token) {
    return { ok: false, message: "Token is missing." };
  }

  const result = await safeFetch("https://api.github.com/user", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "Teskel-Integration-Test",
    },
  });

  if ("error" in result) {
    // Network unavailable: fall back to a presence check so the user still
    // gets a useful (non-blocking) signal.
    return {
      ok: true,
      message:
        "Token saved. Could not verify against GitHub (network unavailable).",
    };
  }
  const { res } = result;
  if (res.ok) {
    return { ok: true, message: "Connected to GitHub." };
  }
  if (res.status === 401 || res.status === 403) {
    return { ok: false, message: "GitHub rejected the token." };
  }
  return { ok: false, message: `GitHub returned HTTP ${res.status}.` };
}

function testAnthropic(config: Record<string, unknown>): TestResult {
  // TODO(phase-future): perform a real Anthropic API call (e.g. GET /v1/models
  // with the x-api-key + anthropic-version headers). For this phase we only
  // validate that a plausibly-formatted key is present.
  const apiKey = typeof config.apiKey === "string" ? config.apiKey.trim() : "";
  if (!apiKey) {
    return { ok: false, message: "API key is missing." };
  }
  if (!apiKey.startsWith("sk-")) {
    return {
      ok: false,
      message: "Key format looks unexpected (expected an 'sk-' prefix).",
    };
  }
  return {
    ok: true,
    message: "Key saved (format looks valid). Live test not yet implemented.",
  };
}

function testMcp(config: Record<string, unknown>): TestResult {
  // TODO(phase-future): perform a real MCP handshake (initialize / list tools)
  // against the configured server URL. For this phase we validate config shape.
  const url = typeof config.url === "string" ? config.url.trim() : "";
  if (!url) {
    return { ok: false, message: "Server URL is missing." };
  }
  try {
    new URL(url);
  } catch {
    return { ok: false, message: "Server URL is not a valid URL." };
  }
  return {
    ok: true,
    message: "Config saved. MCP handshake not yet implemented.",
  };
}

/** Dispatch a connection test by provider. */
export async function testConnection(
  provider: ProviderId,
  config: Record<string, unknown>
): Promise<TestResult> {
  switch (provider) {
    case "openai":
      return testOpenAI(config);
    case "github":
      return testGitHub(config);
    case "anthropic":
      return testAnthropic(config);
    case "mcp":
      return testMcp(config);
    default:
      return { ok: false, message: "Unsupported provider." };
  }
}