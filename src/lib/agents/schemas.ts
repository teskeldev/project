/**
 * Phase 6 agent schemas + shared client/server DTO types.
 *
 * Kept in a dedicated file (NOT appended to the shared validators.ts) so the
 * agent feature owns its contract. Server routes validate bodies with these
 * zod schemas; client + server share the DTO types below.
 */
import { z } from "zod";
import type {
  AgentStatus,
  AgentStepType,
  StepStatus,
} from "@prisma/client";

/** POST /api/projects/:projectId/agents body. */
export const createAgentRunSchema = z.object({
  goal: z.string().min(4, "Describe the goal in a bit more detail").max(4000),
  threadId: z.string().min(1).optional(),
  fusionId: z.string().min(1).optional(),
});
export type CreateAgentRunInput = z.infer<typeof createAgentRunSchema>;

/* ------------------------------- DTO types ------------------------------- */

export type AgentStepDTO = {
  id: string;
  type: AgentStepType;
  title: string;
  status: StepStatus;
  input: unknown;
  output: unknown;
  createdAt: string;
  updatedAt: string;
};

/** The shape persisted in AgentRun.plan. */
export type AgentPlan = {
  summary?: string;
  steps: string[];
};

/** The shape persisted in AgentRun.result. */
export type AgentRunResult = {
  changeSetId?: string;
  message?: string;
};

export type AgentRunSummaryDTO = {
  id: string;
  projectId: string;
  threadId: string | null;
  userId: string;
  status: AgentStatus;
  goal: string;
  error: string | null;
  stepCount: number;
  changeSetId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AgentRunDetailDTO = AgentRunSummaryDTO & {
  plan: AgentPlan | null;
  result: AgentRunResult | null;
  steps: AgentStepDTO[];
};
