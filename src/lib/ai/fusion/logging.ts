/**
 * Fusion request logging + analytics rollups over FusionRequestLog.
 * SERVER-ONLY.
 */
import { prisma } from "@/lib/db";

export type FusionRequestInput = {
  provider: string;
  modelId?: string;
  tokensIn?: number;
  tokensOut?: number;
  costUsd?: number;
  latencyMs?: number;
  success?: boolean;
  error?: string;
};

export async function recordFusionRequest(workspaceId: string, input: FusionRequestInput): Promise<void> {
  try {
    await prisma.fusionRequestLog.create({
      data: {
        workspaceId,
        provider: input.provider,
        modelId: input.modelId ?? null,
        tokensIn: input.tokensIn ?? 0,
        tokensOut: input.tokensOut ?? 0,
        costUsd: input.costUsd ?? 0,
        latencyMs: input.latencyMs ?? 0,
        success: input.success ?? true,
        error: input.error ?? null,
      },
    });
  } catch {
    // Logging must never break a request.
  }
}

