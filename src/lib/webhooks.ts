import { createHmac } from "node:crypto";
import { resolve4, resolve6 } from "node:dns/promises";
import { Agent, fetch as undiciFetch } from "undici";
import { prisma } from "@/lib/db";

/**
 * Webhook dispatch service.
 * Finds matching webhooks for a workspace/event and delivers payloads.
 */

/**
 * Private/reserved IPv4 ranges that must be blocked for SSRF protection.
 */
const BLOCKED_IPV4_RANGES: Array<{ network: number; mask: number }> = [
  // 127.0.0.0/8 (loopback)
  { network: 0x7f000000, mask: 0xff000000 },
  // 10.0.0.0/8 (private)
  { network: 0x0a000000, mask: 0xff000000 },
  // 172.16.0.0/12 (private)
  { network: 0xac100000, mask: 0xfff00000 },
  // 192.168.0.0/16 (private)
  { network: 0xc0a80000, mask: 0xffff0000 },
  // 169.254.0.0/16 (link-local)
  { network: 0xa9fe0000, mask: 0xffff0000 },
  // 100.64.0.0/10 (CGNAT / carrier-grade NAT)
  { network: 0x64400000, mask: 0xffc00000 },
];

/**
 * Parse an IPv4 address string into a 32-bit integer.
 */
function ipv4ToInt(ip: string): number {
  const parts = ip.split(".").map(Number);
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

/**
 * Check if an IPv4 address falls within any blocked range.
 */
function isBlockedIPv4(ip: string): boolean {
  const ipInt = ipv4ToInt(ip);
  return BLOCKED_IPV4_RANGES.some(({ network, mask }) => (ipInt & mask) === network);
}

/**
 * Extract the embedded IPv4 address from an IPv4-mapped IPv6 address
 * (::ffff:0:0/96). Handles both dotted (::ffff:a.b.c.d) and hex
 * (::ffff:hhhh:hhhh) forms. Returns null if the form is unrecognized.
 */
function extractIPv4FromMappedV6(normalized: string): string | null {
  const tail = normalized.slice("::ffff:".length);

  // Dotted form: ::ffff:a.b.c.d
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(tail)) {
    const octets = tail.split(".").map(Number);
    if (octets.every((o) => o >= 0 && o <= 255)) return tail;
    return null;
  }

  // Hex form: ::ffff:hhhh or ::ffff:hhhh:hhhh (1 or 2 16-bit groups)
  if (/^[0-9a-f:]+$/.test(tail)) {
    const groups = tail.split(":");
    if (groups.length >= 1 && groups.length <= 2) {
      const high = groups[0] ? parseInt(groups[0], 16) : 0;
      const low = groups[1] !== undefined ? parseInt(groups[1], 16) : 0;
      if (Number.isNaN(high) || Number.isNaN(low) || high > 0xffff || low > 0xffff) {
        return null;
      }
      return `${(high >> 8) & 0xff}.${high & 0xff}.${(low >> 8) & 0xff}.${low & 0xff}`;
    }
  }
  return null;
}

/**
 * Check if an IPv6 address is blocked (loopback, unique local, or
 * IPv4-mapped to a blocked IPv4 range).
 */
function isBlockedIPv6(ip: string): boolean {
  const normalized = ip.toLowerCase().split("%")[0]; // strip zone id
  // ::1 loopback
  if (normalized === "::1" || normalized === "0000:0000:0000:0000:0000:0000:0000:0001") {
    return true;
  }
  // fc00::/7 — unique local addresses (fc00:: and fd00::)
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) {
    return true;
  }
  // ::ffff:0:0/96 — IPv4-mapped IPv6. Validate the embedded IPv4 against
  // the blocked IPv4 ranges. Fail closed on unparseable forms.
  if (normalized.startsWith("::ffff:")) {
    const v4 = extractIPv4FromMappedV6(normalized);
    if (v4 === null) return true;
    return isBlockedIPv4(v4);
  }
  return false;
}

/**
 * Validate a webhook delivery URL and produce a safe fetch function
 * whose TCP connection is pinned to a pre-validated IP.
 *
 * This prevents DNS rebinding (TOCTOU) attacks: the hostname is resolved
 * once, every returned A/AAAA record is checked against the blocked
 * ranges, and the fetch is then bound to the first valid IP via an
 * undici Agent with a custom `connect.lookup`. The receiver still sees
 * the original hostname in TLS SNI and the Host header, but the
 * underlying socket connects to the IP we verified — so a second
 * DNS lookup at fetch time cannot redirect the request to a private
 * address.
 */
async function createSafeWebhookFetch(
  url: string
): Promise<{ safeFetch: (init?: RequestInit) => Promise<Response> }> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`Invalid webhook URL: ${url}`);
  }

  // Block non-http/https schemes
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`Blocked webhook URL: only http and https schemes are allowed, got ${parsed.protocol}`);
  }

  const hostname = parsed.hostname;

  // Block URLs with IP addresses directly (require domain names)
  const ipv4Pattern = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (ipv4Pattern.test(hostname)) {
    throw new Error(`Blocked webhook URL: IP addresses are not allowed, use a domain name instead`);
  }
  if (hostname.includes(":") && /^[0-9a-fA-F:]+$/.test(hostname)) {
    throw new Error(`Blocked webhook URL: IP addresses are not allowed, use a domain name instead`);
  }

  // Block localhost
  if (hostname === "localhost" || hostname === "localhost.localdomain") {
    throw new Error(`Blocked webhook URL: localhost is not allowed`);
  }

  // Resolve every A and AAAA record. We must validate ALL of them,
  // because an attacker can publish multiple records where only some
  // are safe; the connection could then be rebound to the unsafe one.
  let ipv4Addresses: string[] = [];
  let ipv6Addresses: string[] = [];

  try {
    ipv4Addresses = await resolve4(hostname);
  } catch {
    // No A records — that's fine, check AAAA
  }

  try {
    ipv6Addresses = await resolve6(hostname);
  } catch {
    // No AAAA records — that's fine
  }

  if (ipv4Addresses.length === 0 && ipv6Addresses.length === 0) {
    throw new Error(`Blocked webhook URL: could not resolve hostname ${hostname}`);
  }

  const validIPv4 = ipv4Addresses.filter((ip) => !isBlockedIPv4(ip));
  const validIPv6 = ipv6Addresses.filter((ip) => !isBlockedIPv6(ip));

  if (validIPv4.length === 0 && validIPv6.length === 0) {
    throw new Error(`Blocked webhook URL: hostname ${hostname} resolves only to private/reserved IP addresses`);
  }

  // Prefer IPv4 for the pinned connection (most webhook receivers are IPv4).
  const pinnedIP = validIPv4[0] ?? validIPv6[0];
  const pinnedFamily = validIPv4.length > 0 ? 4 : 6;

  // Pin the TCP connection to the validated IP. The hostname is still
  // used for TLS SNI and the Host header, so the receiver sees a normal
  // request — but the underlying socket connects to the IP we verified.
  const agent = new Agent({
    connect: {
      lookup: (_hostname, _opts, cb) => {
        cb(null, pinnedIP, pinnedFamily);
      },
    },
  });

  const safeFetch = async (init: RequestInit = {}): Promise<Response> => {
    try {
      // undici's fetch accepts `dispatcher` to bind the request to a
      // specific Agent. The standard RequestInit type does not include
      // it, so we cast to undici's extended init type.
      const opts = { ...init, dispatcher: agent } as Parameters<typeof undiciFetch>[1];
      return (await undiciFetch(url, opts)) as unknown as Response;
    } finally {
      // Best-effort cleanup of the per-request connection pool.
      // We don't await — the caller has already received the response
      // headers, and close() will wait internally for body consumption.
      void agent.close();
    }
  };

  return { safeFetch };
}

/**
 * Sign a payload string with HMAC-SHA256 using the webhook secret.
 */
function signPayload(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload, "utf8").digest("hex");
}

/**
 * Deliver a webhook payload to a single URL.
 * Records the delivery attempt in the database.
 */
async function deliverWebhook(
  webhookId: string,
  url: string,
  secret: string,
  event: string,
  payload: Record<string, unknown>
): Promise<boolean> {
  const body = JSON.stringify(payload);
  const signature = signPayload(body, secret);

  let statusCode: number | null = null;
  let response: string | null = null;
  let success = false;

  try {
    // SSRF validation + IP-pinned fetch (prevents DNS rebinding TOCTOU)
    const { safeFetch } = await createSafeWebhookFetch(url);

    const res = await safeFetch({
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-Event": event,
        "X-Webhook-Signature": `sha256=${signature}`,
        "User-Agent": "Teskel-Webhooks/1.0",
      },
      body,
      signal: AbortSignal.timeout(10000),
    });

    statusCode = res.status;
    try {
      response = await res.text();
      if (response.length > 4096) {
        response = response.slice(0, 4096);
      }
    } catch {
      response = null;
    }
    success = res.ok;
  } catch (err) {
    response = err instanceof Error ? err.message : "Request failed";
    success = false;
  }

  await prisma.webhookDelivery.create({
    data: {
      webhookId,
      event,
      payload: payload as unknown as import("@prisma/client/runtime/library").InputJsonValue,
      statusCode,
      response,
      success,
    },
  });

  return success;
}

/**
 * Dispatch a webhook event to all matching webhooks in a workspace.
 * Includes simple retry logic: 1 retry after 5 seconds on failure.
 */
export async function dispatchWebhook(
  workspaceId: string,
  event: string,
  payload: Record<string, unknown>
): Promise<void> {
  const webhooks = await prisma.webhook.findMany({
    where: {
      workspaceId,
      enabled: true,
      events: { has: event },
    },
  });

  if (webhooks.length === 0) return;

  const deliveryPromises = webhooks.map(async (webhook) => {
    const success = await deliverWebhook(webhook.id, webhook.url, webhook.secret, event, payload);

    // If delivery failed, retry once after 5s
    if (!success) {
      await new Promise((resolve) => setTimeout(resolve, 5000));
      await deliverWebhook(webhook.id, webhook.url, webhook.secret, event, payload);
    }
  });

  // Fire and forget — don't block the caller.
  // Promise.allSettled never rejects, so no .catch() needed.
  void Promise.allSettled(deliveryPromises);
}

/**
 * Send a test delivery to a specific webhook.
 */
export async function sendTestWebhook(webhookId: string): Promise<{
  success: boolean;
  statusCode: number | null;
  response: string | null;
}> {
  const webhook = await prisma.webhook.findUnique({ where: { id: webhookId } });
  if (!webhook) {
    throw new Error("Webhook not found");
  }

  const testPayload = {
    event: "test",
    timestamp: new Date().toISOString(),
    data: { message: "This is a test webhook delivery from Teskel." },
  };

  const body = JSON.stringify(testPayload);
  const signature = signPayload(body, webhook.secret);

  let statusCode: number | null = null;
  let response: string | null = null;
  let success = false;

  try {
    // SSRF validation + IP-pinned fetch (prevents DNS rebinding TOCTOU)
    const { safeFetch } = await createSafeWebhookFetch(webhook.url);

    const res = await safeFetch({
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-Event": "test",
        "X-Webhook-Signature": `sha256=${signature}`,
        "User-Agent": "Teskel-Webhooks/1.0",
      },
      body,
      signal: AbortSignal.timeout(10000),
    });

    statusCode = res.status;
    try {
      response = await res.text();
      if (response.length > 4096) {
        response = response.slice(0, 4096);
      }
    } catch {
      response = null;
    }
    success = res.ok;
  } catch (err) {
    response = err instanceof Error ? err.message : "Request failed";
    success = false;
  }

  await prisma.webhookDelivery.create({
    data: {
      webhookId,
      event: "test",
      payload: testPayload,
      statusCode,
      response,
      success,
    },
  });

  return { success, statusCode, response };
}
