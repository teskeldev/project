/**
 * POST /api/oauth/[provider]/poll
 *
 * Polls for device-code authorization completion.
 * Called repeatedly by the frontend until status is "authorized", "denied", or "error".
 *
 * Body: { sessionKey: string }
 * Response: { status: "pending" | "authorized" | "denied" | "error", message?: string, interval?: number }
 */
import { z } from "zod";
import { apiSuccess, handleApiError, requireUser, validateBody, ApiError } from "@/lib/api";
import { prisma } from "@/lib/db";
import { encryptJson } from "@/lib/crypto";
import { OAUTH_PROVIDER_CONFIGS } from "@/lib/integrations/oauth-configs";
import { getDeviceState, deleteDeviceState } from "@/lib/integrations/oauth-state";

type RouteContext = { params: Promise<{ provider: string }> };

const bodySchema = z.object({ sessionKey: z.string().min(1) });

export async function POST(req: Request, ctx: RouteContext) {
  try {
    const user = await requireUser();
    const { provider } = await ctx.params;
    const { sessionKey } = await validateBody(req, bodySchema);

    const cfg = OAUTH_PROVIDER_CONFIGS[provider];
    if (!cfg) throw new ApiError("Unknown OAuth provider", 404, "NOT_FOUND");

    const state = getDeviceState(sessionKey);
    if (!state) throw new ApiError("OAuth session expired — please start again", 410, "SESSION_EXPIRED");

    // Security: only the user who started the flow can poll it
    if (state.userId !== user.id) throw new ApiError("Forbidden", 403, "FORBIDDEN");

    const tokenRes = await fetch(cfg.deviceTokenUrl!, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        client_id: cfg.clientId,
        device_code: state.deviceCode,
        grant_type: "urn:ietf:params:oauth:grant-type:device_code",
      }),
    });

    let data: {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      scope?: string;
      error?: string;
      interval?: number;
    };

    // GitHub returns 200 with error field on pending; handle both 200 and 4xx
    const text = await tokenRes.text();
    try {
      data = JSON.parse(text);
    } catch {
      // Some providers return form-encoded responses (GitHub legacy)
      const params = new URLSearchParams(text);
      data = Object.fromEntries(params.entries());
    }

    const errorCode = data.error;

    if (errorCode === "authorization_pending" || errorCode === "slow_down") {
      const newInterval = errorCode === "slow_down"
        ? Math.min((data.interval ?? state.interval) + 5, 30)
        : state.interval;
      return apiSuccess({ status: "pending", interval: newInterval });
    }

    if (errorCode === "access_denied" || errorCode === "expired_token") {
      deleteDeviceState(sessionKey);
      return apiSuccess({ status: "denied", message: "Access was denied or the code expired." });
    }

    if (errorCode) {
      deleteDeviceState(sessionKey);
      return apiSuccess({ status: "error", message: `Provider error: ${errorCode}` });
    }

    if (!data.access_token) {
      return apiSuccess({ status: "pending", interval: state.interval });
    }

    // Authorized — fetch additional token if needed (e.g. GitHub Copilot)
    let copilotToken: string | undefined;
    if (cfg.copilotTokenUrl) {
      try {
        const copRes = await fetch(cfg.copilotTokenUrl, {
          headers: {
            Authorization: `token ${data.access_token}`,
            Accept: "application/json",
            "Editor-Version": "vscode/1.85.0",
            "Copilot-Integration-Id": "vscode-chat",
          },
        });
        if (copRes.ok) {
          const copData = await copRes.json() as { token?: string };
          copilotToken = copData.token;
        }
      } catch {
        // non-fatal — save without Copilot token
      }
    }

    const expiresAt = data.expires_in ? Date.now() + data.expires_in * 1000 : undefined;

    const config: Record<string, unknown> = {
      accessToken: data.access_token,
      ...(data.refresh_token ? { refreshToken: data.refresh_token } : {}),
      ...(expiresAt ? { expiresAt } : {}),
      ...(data.scope ? { scope: data.scope } : {}),
      ...(copilotToken ? { copilotToken } : {}),
    };

    // Upsert integration
    const existing = await prisma.integration.findFirst({
      where: { workspaceId: state.workspaceId, provider },
    });

    if (existing) {
      await prisma.integration.update({
        where: { id: existing.id },
        data: { encryptedConfig: encryptJson(config), name: cfg.name, enabled: true },
      });
    } else {
      await prisma.integration.create({
        data: {
          workspaceId: state.workspaceId,
          provider,
          name: cfg.name,
          encryptedConfig: encryptJson(config),
          enabled: true,
          priority: 100,
        },
      });
    }

    deleteDeviceState(sessionKey);
    return apiSuccess({ status: "authorized" });
  } catch (err) {
    return handleApiError(err);
  }
}
