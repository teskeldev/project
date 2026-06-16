/**
 * Client-side API helpers for the notification system.
 */

import { apiFetch } from "@/lib/client/api";

export type NotificationType =
  | "AGENT_COMPLETED"
  | "AGENT_FAILED"
  | "CHANGESET_READY"
  | "CHANGESET_APPLIED"
  | "TEAM_INVITE"
  | "SYSTEM";

export type Notification = {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  metadata: Record<string, unknown> | null;
  createdAt: string;
};

export type NotificationListResponse = {
  notifications: Notification[];
  total: number;
  unreadCount: number;
};

/** Fetch notifications for the current user. */
export function listNotifications(options?: {
  read?: boolean;
  limit?: number;
  offset?: number;
}): Promise<NotificationListResponse> {
  const params = new URLSearchParams();
  if (options?.read !== undefined) params.set("read", String(options.read));
  if (options?.limit !== undefined) params.set("limit", String(options.limit));
  if (options?.offset !== undefined) params.set("offset", String(options.offset));
  const qs = params.toString();
  return apiFetch(`/api/notifications${qs ? `?${qs}` : ""}`);
}

/** Mark one or more notifications as read. */
export function markNotificationsRead(ids: string[]): Promise<{ updated: number }> {
  return apiFetch("/api/notifications", {
    method: "PATCH",
    body: JSON.stringify({ ids }),
  });
}

/** Mark all notifications as read. */
export function markAllNotificationsRead(): Promise<{ updated: number }> {
  return apiFetch("/api/notifications", {
    method: "PATCH",
    body: JSON.stringify({ all: true }),
  });
}

/** Delete a notification. */
export function deleteNotification(id: string): Promise<{ deleted: boolean }> {
  return apiFetch(`/api/notifications/${id}`, {
    method: "DELETE",
  });
}
