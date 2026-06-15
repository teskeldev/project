/**
 * Zod schemas for the two persisted Fusion configs (Routing, Judge).
 */
import { z } from "zod";
import { ROUTING_STRATEGIES, JUDGE_MODES } from "./catalog";

export const workspaceOnly = z.object({ workspaceId: z.string().min(1) });

/* Routing */
export const routingCreate = z.object({
  workspaceId: z.string().min(1),
  name: z.string().min(1).max(80),
  strategy: z.enum(ROUTING_STRATEGIES),
  config: z.unknown().default({}),
});
export const routingUpdate = z.object({
  workspaceId: z.string().min(1),
  name: z.string().min(1).max(80).optional(),
  strategy: z.enum(ROUTING_STRATEGIES).optional(),
  config: z.unknown().optional(),
});

/* Judge */
export const judgeCreate = z.object({
  workspaceId: z.string().min(1),
  name: z.string().min(1).max(80),
  mode: z.enum(JUDGE_MODES),
  judgeModelId: z.string().max(120).optional(),
  config: z.unknown().default({}),
});
export const judgeUpdate = z.object({
  workspaceId: z.string().min(1),
  name: z.string().min(1).max(80).optional(),
  mode: z.enum(JUDGE_MODES).optional(),
  judgeModelId: z.string().max(120).nullable().optional(),
  config: z.unknown().optional(),
});
