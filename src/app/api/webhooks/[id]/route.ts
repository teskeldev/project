import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  apiSuccess,
  handleApiError,
  requireUser,
  validateBody,
  ApiError,
  type SessionUser,
} from "@/lib/api";

type RouteContext = { params: Promise<{ id: string }> };

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

  if (parsed.protocol !== "https:") {
    throw new ApiError(
      "Webhook URL must use HTTPS",
      400,
      "INVALID_URL_PROTOCOL"
    );
  }

  const hostname = parsed.hostname.toLowerCase();

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

  const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  const ipv6Regex = /^\[?[0-9a-f:]+\]?$/i;

  if (ipv4Regex.test(hostname) || ipv6Regex.test(hostname)) {
    throw new ApiError(
      "Webhook URL must use a domain name, not an IP address",
      400,
      "INVALID_URL_IP"
    );
  }

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

async function loadAuthorizedWebhook(user: SessionUser, id: string) {
  const webhook = await prisma.webhook.findUnique({ where: { id } });
  if (!webhook) {
    throw new ApiError("Webhook not found", 404, "NOT_FOUND");
  }
  const member = await prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId: webhook.workspaceId,
        userId: user.id,
      },
    },
  });
  if (!member) {
    throw new ApiError(
      "You do not have access to this webhook",
      403,
      "FORBIDDEN"
    );
  }
  return { webhook, member };
}

// GET /api/webhooks/:id
// Get webhook details + recent deliveries.
export async function GET(_req: Request, ctx: RouteContext) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;

    const { webhook } = await loadAuthorizedWebhook(user, id);

    const deliveries = await prisma.webhookDelivery.findMany({
      where: { webhookId: id },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    // Mask secret in GET response
    const sanitizedWebhook = {
      ...webhook,
      secret: maskSecret(webhook.secret),
    };

    return apiSuccess({ webhook: sanitizedWebhook, deliveries });
  } catch (err) {
    return handleApiError(err);
  }
}

const updateWebhookSchema = z
  .object({
    url: z.string().url("Must be a valid URL").optional(),
    events: z.array(z.string().min(1)).min(1).optional(),
    enabled: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: "No fields to update",
  });

// PATCH /api/webhooks/:id
// Update webhook (url, events, enabled).
export async function PATCH(req: Request, ctx: RouteContext) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;

    const { member } = await loadAuthorizedWebhook(user, id);

    // Role check: only ADMIN or OWNER can update webhooks
    if (member.role !== "ADMIN" && member.role !== "OWNER") {
      throw new ApiError(
        "Only admins and owners can update webhooks",
        403,
        "FORBIDDEN"
      );
    }

    const data = await validateBody(req, updateWebhookSchema);

    // Validate URL against SSRF if URL is being updated
    if (data.url) {
      validateWebhookUrl(data.url);
    }

    const updated = await prisma.webhook.update({
      where: { id },
      data,
    });

    // Mask secret in response
    const sanitizedWebhook = {
      ...updated,
      secret: maskSecret(updated.secret),
    };

    return apiSuccess({ webhook: sanitizedWebhook });
  } catch (err) {
    return handleApiError(err);
  }
}

// DELETE /api/webhooks/:id
export async function DELETE(_req: Request, ctx: RouteContext) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;

    const { member } = await loadAuthorizedWebhook(user, id);

    // Role check: only ADMIN or OWNER can delete webhooks
    if (member.role !== "ADMIN" && member.role !== "OWNER") {
      throw new ApiError(
        "Only admins and owners can delete webhooks",
        403,
        "FORBIDDEN"
      );
    }

    await prisma.webhook.delete({ where: { id } });

    return apiSuccess({ deleted: true, id });
  } catch (err) {
    return handleApiError(err);
  }
}
