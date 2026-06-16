import { z } from "zod";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";
import {
  apiSuccess,
  handleApiError,
  requireUser,
  validateBody,
  ApiError,
  NO_STORE_HEADERS,
  type SessionUser,
} from "@/lib/api";
import { decrypt, encrypt } from "@/lib/crypto";
import { enforceRateLimit } from "@/lib/rate-limit";

async function requireWorkspaceMember(user: SessionUser, workspaceId: string) {
  const member = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: user.id } },
  });
  if (!member) {
    throw new ApiError(
      "You do not have access to this workspace",
      403,
      "FORBIDDEN"
    );
  }
  return member;
}

function maskSecret(secret: string): string {
  const last4 = secret.slice(-4);
  return `whsec_****${last4}`;
}

/**
 * Validates a webhook URL to prevent SSRF attacks.
 * - Only allows https:// URLs
 * - Rejects URLs with IP addresses (requires domain names)
 * - Rejects URLs targeting internal/private networks
 */
function validateWebhookUrl(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new ApiError("Invalid webhook URL", 400, "INVALID_URL");
  }

  // Only allow HTTPS
  if (parsed.protocol !== "https:") {
    throw new ApiError(
      "Webhook URL must use HTTPS",
      400,
      "INVALID_URL_PROTOCOL"
    );
  }

  const hostname = parsed.hostname.toLowerCase();

  // Reject localhost variants
  if (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "0.0.0.0" ||
    hostname === "::1" ||
    hostname === "[::1]"
  ) {
    throw new ApiError(
      "Webhook URL must not target localhost",
      400,
      "INVALID_URL_HOST"
    );
  }

  // Reject IP addresses entirely (IPv4 and IPv6)
  const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  const ipv6Regex = /^\[?[0-9a-f:]+\]?$/i;

  if (ipv4Regex.test(hostname) || ipv6Regex.test(hostname)) {
    throw new ApiError(
      "Webhook URL must use a domain name, not an IP address",
      400,
      "INVALID_URL_IP"
    );
  }

  // Additional check: reject internal network patterns in hostname
  // (in case of DNS rebinding or encoded IPs)
  const internalPatterns = [
    /^10\./,
    /^172\.(1[6-9]|2[0-9]|3[01])\./,
    /^192\.168\./,
    /^169\.254\./,
    /^127\./,
    /^0\./,
  ];

  for (const pattern of internalPatterns) {
    if (pattern.test(hostname)) {
      throw new ApiError(
        "Webhook URL must not target internal networks",
        400,
        "INVALID_URL_INTERNAL"
      );
    }
  }
}

// GET /api/webhooks?workspaceId=...
// List webhooks for a workspace.
export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get("workspaceId");

    if (!workspaceId) {
      throw new ApiError("workspaceId is required", 400, "MISSING_PARAM");
    }

    await requireWorkspaceMember(user, workspaceId);

    const webhooks = await prisma.webhook.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        workspaceId: true,
        url: true,
        secret: true,
        events: true,
        enabled: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { deliveries: true } },
      },
    });

    // Mask secrets in response. Stored value is the encrypted ciphertext;
    // decrypt to plaintext so we can show a useful masked preview.
    const sanitizedWebhooks = webhooks.map((wh) => {
      let plaintext: string;
      try {
        plaintext = decrypt(wh.secret);
      } catch {
        plaintext = "";
      }
      return {
        ...wh,
        secret: plaintext ? maskSecret(plaintext) : "",
      };
    });

    return apiSuccess({ webhooks: sanitizedWebhooks }, { headers: NO_STORE_HEADERS });
  } catch (err) {
    return handleApiError(err);
  }
}

const KNOWN_WEBHOOK_EVENTS = [
  "agent.completed",
  "agent.failed",
  "changeset.created",
  "changeset.applied",
  "changeset.rejected",
  "chat.message.created",
  "project.created",
  "user.invited",
  "file.created",
  "file.updated",
  "file.deleted",
] as const;

const createWebhookSchema = z.object({
  workspaceId: z.string().min(1, "workspaceId is required"),
  url: z.string().url("Must be a valid URL"),
  events: z
    .array(z.enum(KNOWN_WEBHOOK_EVENTS))
    .min(1, "At least one event is required"),
  enabled: z.boolean().optional().default(true),
});

// POST /api/webhooks
// Create a new webhook. A secret is auto-generated.
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const { workspaceId, url, events, enabled } = await validateBody(
      req,
      createWebhookSchema
    );

    await enforceRateLimit(`webhooks:create:${workspaceId}`, 10, 60_000);

    const member = await requireWorkspaceMember(user, workspaceId);

    // Role check: only ADMIN or OWNER can create webhooks
    if (member.role !== "ADMIN" && member.role !== "OWNER") {
      throw new ApiError(
        "Only admins and owners can create webhooks",
        403,
        "FORBIDDEN"
      );
    }

    // Validate URL against SSRF
    validateWebhookUrl(url);

    const secret = randomBytes(32).toString("hex");
    const encryptedSecret = encrypt(secret);

    const webhook = await prisma.webhook.create({
      data: {
        workspaceId,
        url,
        secret: encryptedSecret,
        events,
        enabled,
      },
    });

    // Return full plaintext secret only on creation. The stored value is the
    // encrypted ciphertext, so we override the response with the plaintext.
    return apiSuccess(
      { webhook: { ...webhook, secret } },
      { status: 201 }
    );
  } catch (err) {
    return handleApiError(err);
  }
}
