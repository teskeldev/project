/**
 * GET /api/oauth/[provider]/callback?code=...&state=...
 *
 * PKCE authorization-code callback. Provider redirects here after user grants access.
 * Exchanges the code for tokens, saves the integration, and redirects the popup
 * to /api/oauth/done which posts a success message to the opener.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { encryptJson } from "@/lib/crypto";
import { OAUTH_PROVIDER_CONFIGS } from "@/lib/integrations/oauth-configs";
import { getPkceState, deletePkceState } from "@/lib/integrations/oauth-state";
import { toSafeIntegration } from "@/lib/integrations/server";

type RouteContext = { params: Promise<{ provider: string }> };

function errRedirect(origin: string, provider: string, message: string): Response {
  const url = new URL("/api/oauth/done", origin);
  url.searchParams.set("provider", provider);
  url.searchParams.set("error", message);
  return NextResponse.redirect(url.toString());
}

export async function GET(req: Request, ctx: RouteContext) {
  const { provider } = await ctx.params;
  const origin = new URL(req.url).origin;
  const { searchParams } = new URL(req.url);

  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const errorParam = searchParams.get("error");

  if (errorParam) {
    return errRedirect(origin, provider, searchParams.get("error_description") ?? errorParam);
  }

  if (!code || !state) {
    return errRedirect(origin, provider, "Missing code or state in callback");
  }

  const cfg = OAUTH_PROVIDER_CONFIGS[provider];
  if (!cfg) return errRedirect(origin, provider, "Unknown provider");

  const pkce = getPkceState(state);
  if (!pkce) return errRedirect(origin, provider, "OAuth session expired or invalid state");
  deletePkceState(state);

  // Exchange code for tokens
  const tokenParams = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: pkce.redirectUri,
    client_id: cfg.clientId,
    code_verifier: pkce.codeVerifier,
  });

  let tokenData: {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
    error?: string;
    error_description?: string;
  };

  try {
    const tokenRes = await fetch(cfg.tokenUrl!, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: tokenParams.toString(),
    });
    tokenData = await tokenRes.json();
  } catch {
    return errRedirect(origin, provider, "Failed to exchange authorization code");
  }

  if (!tokenData.access_token || tokenData.error) {
    return errRedirect(origin, provider, tokenData.error_description ?? tokenData.error ?? "Token exchange failed");
  }

  const expiresAt = tokenData.expires_in
    ? Date.now() + tokenData.expires_in * 1000
    : undefined;

  // Try to get user email (best effort)
  let email: string | undefined;
  if (provider === "claude-code" && tokenData.access_token) {
    try {
      const meRes = await fetch("https://api.anthropic.com/v1/oauth/userinfo", {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      if (meRes.ok) {
        const me = await meRes.json() as { email?: string };
        email = me.email;
      }
    } catch {
      // non-fatal
    }
  }

  const config: Record<string, unknown> = {
    accessToken: tokenData.access_token,
    ...(tokenData.refresh_token ? { refreshToken: tokenData.refresh_token } : {}),
    ...(expiresAt ? { expiresAt } : {}),
    ...(tokenData.scope ? { scope: tokenData.scope } : {}),
    ...(email ? { email } : {}),
  };

  const displayName = email ? `${cfg.name} (${email})` : cfg.name;

  // Upsert integration — one per provider per workspace
  const existing = await prisma.integration.findFirst({
    where: { workspaceId: pkce.workspaceId, provider },
  });

  if (existing) {
    await prisma.integration.update({
      where: { id: existing.id },
      data: { encryptedConfig: encryptJson(config), name: displayName, enabled: true },
    });
  } else {
    const created = await prisma.integration.create({
      data: {
        workspaceId: pkce.workspaceId,
        provider,
        name: displayName,
        encryptedConfig: encryptJson(config),
        enabled: true,
        priority: 100,
      },
    });
    void toSafeIntegration(created); // warm safe representation (no-op side-effect)
  }

  // Redirect popup to done page
  const doneUrl = new URL("/api/oauth/done", origin);
  doneUrl.searchParams.set("provider", provider);
  return NextResponse.redirect(doneUrl.toString());
}
