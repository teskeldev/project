import { prisma } from "@/lib/db";
import type { NotificationType } from "@prisma/client";

/**
 * Server-side notification service.
 * Creates and manages notifications for users.
 */

export async function createNotification(
  userId: string,
  type: NotificationType,
  title: string,
  message: string,
  metadata?: Record<string, unknown>
) {
  try {
    return await prisma.notification.create({
      data: {
        userId,
        type,
        title,
        message,
        metadata: metadata ? (metadata as unknown as import("@prisma/client/runtime/library").InputJsonValue) : undefined,
      },
    });
  } catch (error) {
    console.error("[notifications] Failed to create notification:", error);
    return null;
  }
}

// ----------------------------- Helper functions -----------------------------

export async function notifyAgentCompleted(
  userId: string,
  agentRunId: string,
  goal: string
) {
  return createNotification(
    userId,
    "AGENT_COMPLETED",
    "Agent completed",
    `Agent finished: ${goal.slice(0, 100)}`,
    { agentRunId }
  );
}

export async function notifyAgentFailed(
  userId: string,
  agentRunId: string,
  goal: string,
  error?: string
) {
  return createNotification(
    userId,
    "AGENT_FAILED",
    "Agent failed",
    `Agent failed: ${goal.slice(0, 80)}${error ? ` — ${error.slice(0, 50)}` : ""}`,
    { agentRunId, error }
  );
}

export async function notifyChangesetReady(
  userId: string,
  changeSetId: string,
  title: string
) {
  return createNotification(
    userId,
    "CHANGESET_READY",
    "Changeset ready for review",
    `"${title.slice(0, 80)}" is ready for review.`,
    { changeSetId }
  );
}

export async function notifyChangesetApplied(
  userId: string,
  changeSetId: string,
  title: string
) {
  return createNotification(
    userId,
    "CHANGESET_APPLIED",
    "Changeset applied",
    `"${title.slice(0, 80)}" has been applied.`,
    { changeSetId }
  );
}

export async function notifyTeamInvite(
  userId: string,
  workspaceId: string,
  workspaceName: string,
  inviterName: string
) {
  return createNotification(
    userId,
    "TEAM_INVITE",
    "Team invitation",
    `${inviterName} invited you to join "${workspaceName}".`,
    { workspaceId }
  );
}

export async function notifySystem(
  userId: string,
  title: string,
  message: string,
  metadata?: Record<string, unknown>
) {
  return createNotification(userId, "SYSTEM", title, message, metadata);
}
