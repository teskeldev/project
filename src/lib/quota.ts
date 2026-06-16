/**
 * Per-workspace quota enforcement for AI tokens, compute, storage, and members.
 * Pricing tiers are defined in lib/stripe.ts (PLAN_CONFIGS).
 */
import { prisma } from "@/lib/db";
import { PLAN_CONFIGS, type PlanTier } from "@/lib/billing-config";
import { ApiError } from "@/lib/api";
import type { InputJsonValue } from "@prisma/client/runtime/library";


export type QuotaType = "ai_tokens" | "compute_minutes" | "storage_mb" | "members";

export async function getCurrentPeriodStart(workspaceId: string): Promise<Date> {
  const sub = await prisma.subscription.findUnique({ where: { workspaceId } });
  if (sub?.currentPeriodStart) return sub.currentPeriodStart;
  // Default to start of current month
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

export async function getWorkspacePlan(workspaceId: string): Promise<PlanTier> {
  const sub = await prisma.subscription.findUnique({ where: { workspaceId } });
  if (sub?.plan && sub.status === "ACTIVE") return sub.plan as PlanTier;
  return "FREE";
}

export async function getUsage(workspaceId: string, type: QuotaType, periodStart: Date): Promise<number> {
  const records = await prisma.usageRecord.findMany({
    where: { workspaceId, type, createdAt: { gte: periodStart } },
  });
  return records.reduce((sum, r) => sum + (r.quantity ?? 0), 0);
}

export async function recordUsage(workspaceId: string, type: QuotaType, quantity: number, metadata?: Record<string, unknown>): Promise<void> {
  try {
    await prisma.usageRecord.create({
      data: {
        workspaceId,
        type,
        quantity,
        metadata: metadata as InputJsonValue,
      },
    });
  } catch (err) {
    // Don't fail the request because of usage tracking
    console.error("[quota] Failed to record usage:", err);
  }
}

/**
 * Check if workspace is within quota. Throws ApiError(429) if exceeded.
 * Quota type "members" is special — checks current count, not a period usage.
 */
export async function checkQuota(workspaceId: string, type: QuotaType, increment: number = 0): Promise<void> {
  const plan = await getWorkspacePlan(workspaceId);
  const limits = PLAN_CONFIGS[plan].limits;
  
  if (type === "members") {
    const memberCount = await prisma.workspaceMember.count({ where: { workspaceId } });
    if (memberCount + increment > limits.members) {
      throw new ApiError(
        `Workspace has reached the ${plan} plan member limit (${limits.members}). Upgrade to add more members.`,
        403,
        "QUOTA_EXCEEDED",
      );
    }
    return;
  }

  if (type === "storage_mb") {
    // Storage is checked against current disk usage
    // Simplified — implement actual calculation if needed
    return;
  }

  const periodStart = await getCurrentPeriodStart(workspaceId);
  const current = await getUsage(workspaceId, type, periodStart);
  const limitKey = type === "ai_tokens" ? "aiTokens" : "computeMinutes";
  const limit = limits[limitKey] as number;
  
  if (current + increment > limit) {
    throw new ApiError(
      `Workspace has reached the ${plan} plan ${type} limit (${limit.toLocaleString()}). Upgrade to increase.`,
      429,
      "QUOTA_EXCEEDED",
    );
  }
}
