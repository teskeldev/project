/**
 * Client-side typed helpers for the webhooks API.
 */
import { apiFetch } from "@/lib/client/api";

export type WebhookDelivery = {
  id: string;
  webhookId: string;
  event: string;
  statusCode: number | null;
  success: boolean;
  requestBody: string | null;
  responseBody: string | null;
  error: string | null;
  createdAt: string;
};

export type Webhook = {
  id: string;
  workspaceId: string;
  url: string;
  events: string[];
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: { deliveries: number };
};

export type WebhookDetail = Webhook & {
  deliveries?: WebhookDelivery[];
};

export type WebhookTestResult = {
  success: boolean;
  statusCode?: number;
  error?: string;
};

export function listWebhooks(
  workspaceId: string
): Promise<{ webhooks: Webhook[] }> {
  return apiFetch(
    `/api/webhooks?workspaceId=${encodeURIComponent(workspaceId)}`
  );
}

export function getWebhook(
  id: string
): Promise<{ webhook: WebhookDetail; deliveries: WebhookDelivery[] }> {
  return apiFetch(`/api/webhooks/${id}`);
}

export function createWebhook(input: {
  workspaceId: string;
  url: string;
  events: string[];
  enabled?: boolean;
}): Promise<{ webhook: Webhook }> {
  return apiFetch("/api/webhooks", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateWebhook(
  id: string,
  input: { url?: string; events?: string[]; enabled?: boolean }
): Promise<{ webhook: Webhook }> {
  return apiFetch(`/api/webhooks/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteWebhook(
  id: string
): Promise<{ deleted: boolean; id: string }> {
  return apiFetch(`/api/webhooks/${id}`, { method: "DELETE" });
}

export function testWebhook(id: string): Promise<WebhookTestResult> {
  return apiFetch(`/api/webhooks/${id}/test`, { method: "POST" });
}
