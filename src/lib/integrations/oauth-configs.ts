/**
 * OAuth provider configurations — one entry per supported OAuth AI provider.
 * Used by both the API routes (server) and the OAuthModal UI (client).
 * No secrets here — only public OAuth client metadata.
 */

export type OAuthFlowType = "authorization_code_pkce" | "device_code";

export type OAuthProviderConfig = {
  id: string;
  name: string;
  icon: string;
  color: string;
  description: string;
  flowType: OAuthFlowType;
  clientId: string;
  // PKCE / authorization_code
  authorizeUrl?: string;
  tokenUrl?: string;
  scopes?: string;
  // Device code
  deviceCodeUrl?: string;
  deviceTokenUrl?: string;
  deviceScopes?: string;
  // GitHub Copilot: secondary Copilot-specific token endpoint
  copilotTokenUrl?: string;
  // Token refresh: how many ms before expiry to proactively refresh
  refreshLeadMs?: number;
};

export const OAUTH_PROVIDER_CONFIGS: Record<string, OAuthProviderConfig> = {
  "claude-code": {
    id: "claude-code",
    name: "Claude Code",
    icon: "CC",
    color: "#D97757",
    description:
      "Connect your Anthropic Claude Code subscription via OAuth to use Claude as an AI provider.",
    flowType: "authorization_code_pkce",
    clientId: "9d1c250a-e61b-44d9-88ed-5944d1962f5e",
    authorizeUrl: "https://claude.ai/oauth/authorize",
    tokenUrl: "https://api.anthropic.com/v1/oauth/token",
    scopes: "org:create_api_key user:profile user:inference",
    refreshLeadMs: 14_400_000, // refresh 4 hours before expiry
  },
  "github-copilot": {
    id: "github-copilot",
    name: "GitHub Copilot",
    icon: "GH",
    color: "#24292f",
    description:
      "Route AI requests through your GitHub Copilot subscription via device-code OAuth.",
    flowType: "device_code",
    clientId: "Iv1.b507a08c87ecfe98",
    deviceCodeUrl: "https://github.com/login/device/code",
    deviceTokenUrl: "https://github.com/login/oauth/access_token",
    deviceScopes: "read:user",
    copilotTokenUrl: "https://api.github.com/copilot_internal/v2/token",
  },
  "kilocode": {
    id: "kilocode",
    name: "Kilo Code",
    icon: "KC",
    color: "#FF6B35",
    description:
      "Kilo Code provides free AI models via OAuth — connect with device-code flow, no credit card needed.",
    flowType: "device_code",
    clientId: "kilocode",
    deviceCodeUrl: "https://api.kilo.ai/api/device-auth/codes",
    deviceTokenUrl: "https://api.kilo.ai/api/device-auth/tokens",
    deviceScopes: "api:access",
  },
};

export const OAUTH_PROVIDER_IDS = Object.keys(OAUTH_PROVIDER_CONFIGS);
