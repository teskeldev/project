import {
  apiSuccess,
  handleApiError,
  requireUser,
  ApiError,
} from "@/lib/api";
import { PLAN_CONFIGS, type PlanTier } from "@/lib/billing-config";
import { prisma } from "@/lib/db";
import {
  getCurrentPeriodStart,
  getUsage,
} from "@/lib/quota";
import type { Role } from "@prisma/client";

/**
 * GET /api/billing/usage?workspaceId=...
 *
 * Returns current billing period usage stats for the workspace.
 */
export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get("workspaceId")?.trim();

    if (!workspaceId) {
      throw new ApiError("workspaceId is required", 422, "VALIDATION_ERROR");
    }

    // Verify workspace membership
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

    // Only ADMIN/OWNER can view billing/usage.
    const allowedRoles: Role[] = ["ADMIN", "OWNER"];
    if (!allowedRoles.includes(member.role)) {
      throw new ApiError("Insufficient permissions", 403, "FORBIDDEN");
    }

    // Get subscription to determine plan and billing period
    const subscription = await prisma.subscription.findUnique({
      where: { workspaceId },
    });

    const plan: PlanTier = (subscription?.plan as PlanTier) ?? "FREE";
    const planConfig = PLAN_CONFIGS[plan];

    // Determine billing period start (default: start of current month)
    const periodStart = await getCurrentPeriodStart(workspaceId);

    // Compute usage for each quota type using the shared helper.
    const [aiTokensUsed, computeMinutesUsed, storageMbUsed] = await Promise.all([
      getUsage(workspaceId, "ai_tokens", periodStart),
      getUsage(workspaceId, "compute_minutes", periodStart),
      getUsage(workspaceId, "storage_mb", periodStart),
    ]);

    const pct = (used: number, limit: number): number => {
      if (!Number.isFinite(limit) || limit <= 0) return 0;
      return Math.min(100, Math.round((used / limit) * 100));
    };

    const usage = {
      aiTokens: {
        used: aiTokensUsed,
        limit: planConfig.limits.aiTokens,
        percent: pct(aiTokensUsed, planConfig.limits.aiTokens),
      },
      computeMinutes: {
        used: computeMinutesUsed,
        limit: planConfig.limits.computeMinutes,
        percent: pct(computeMinutesUsed, planConfig.limits.computeMinutes),
      },
      storageMb: {
        used: storageMbUsed,
        limit: planConfig.limits.storageMb,
        percent: pct(storageMbUsed, planConfig.limits.storageMb),
      },
    };

    return apiSuccess({
      plan,
      planName: planConfig.name,
      status: subscription?.status ?? "ACTIVE",
      currentPeriodStart: periodStart.toISOString(),
      currentPeriodEnd: subscription?.currentPeriodEnd?.toISOString() ?? null,
      cancelAtPeriodEnd: subscription?.cancelAtPeriodEnd ?? false,
      usage,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
