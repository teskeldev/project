/**
 * POST /api/oauth/[provider]/start
 *
 * Initiates an OAuth flow for the given provider.
 *
 * PKCE response:  { type: "redirect", url: string }
 * Device response: { type: "device_code", sessionKey, userCode, verificationUri, interval, expiresIn }
 */
import { z } from "zod";
import { apiSuccess, handleApiError, requireUser, validateBody, ApiError } from "@/lib/api";
import { prisma } from "@/lib/db";
import { OAUTH_PROVIDER_CONFIGS } from "@/lib/integrations/oauth-configs";
import { setPkceState, setDeviceState } from "@/lib/integrations/oauth-state";
import { randomBase64url, pkceChallenge } from "@/lib/integrations/oauth-utils";

type RouteContext = { params: Promise<{ provider: string }> };

const bodySchema = z.object({ workspaceId: z.string().min(1) });

export async function POST(req: Request, ctx: RouteContext) {
  try {
    const user = await requireUser();
    const { provider } = await ctx.params;
    const { workspaceId } = await validateBody(req, bodySchema);

    const cfg = OAUTH_PROVIDER_CONFIGS[provider];
    if (!cfg) throw new ApiError("Unknown OAuth provider", 404, "NOT_FOUND");

    // Verify workspace membership (any role can connect personal OAuth)
    const member = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: user.id } },
    });
    if (!member) throw new ApiError("You do not have access to this workspace", 403, "FORBIDDEN");
    if (member.role !== "ADMIN" && member.role !== "OWNER") {
      throw new ApiError("Only admins and owners can manage integrations", 403, "FORBIDDEN");
    }

    const origin = new URL(req.url).origin;

    if (cfg.flowType === "authorization_code_pkce") {
      const state = randomBase64url();
      const verifier = randomBase64url();
      const challenge = pkceChallenge(verifier);
      const redirectUri = `${origin}/api/oauth/${provider}/callback`;

      setPkceState(state, { codeVerifier: verifier, redirectUri, userId: user.id, workspaceId, provider });

      const params = new URLSearchParams({
        response_type: "code",
        client_id: cfg.clientId,
        redirect_uri: redirectUri,
        scope: cfg.scopes ?? "",
        state,
        code_challenge: challenge,
        code_challenge_method: "S256",
      });

      return apiSuccess({ type: "redirect", url: `${cfg.authorizeUrl}?${params.toString()}` });
    }

    // device_code flow
    const deviceRes = await fetch(cfg.deviceCodeUrl!, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        client_id: cfg.clientId,
        scope: cfg.deviceScopes,
      }),
    });

    if (!deviceRes.ok) {
      const text = await deviceRes.text().catch(() => "");
      throw new ApiError(`Provider device-code request failed: ${text || deviceRes.status}`, 502, "UPSTREAM_ERROR");
    }

    const deviceData = await deviceRes.json() as {
      device_code?: string;
      user_code?: string;
      verification_uri?: string;
      verification_url?: string; // GitHub uses verification_uri, others vary
      expires_in?: number;
      interval?: number;
    };

    const deviceCode = deviceData.device_code;
    const userCode = deviceData.user_code;
    const verificationUri = deviceData.verification_uri ?? deviceData.verification_url ?? "";
    const expiresIn = deviceData.expires_in ?? 600;
    const interval = deviceData.interval ?? 5;

    if (!deviceCode || !userCode) {
      throw new ApiError("Invalid device-code response from provider", 502, "UPSTREAM_ERROR");
    }

    const sessionKey = randomBase64url(24);
    setDeviceState(sessionKey, { deviceCode, userId: user.id, workspaceId, provider, interval }, expiresIn * 1000);

    return apiSuccess({ type: "device_code", sessionKey, userCode, verificationUri, interval, expiresIn });
  } catch (err) {
    return handleApiError(err);
  }
}
