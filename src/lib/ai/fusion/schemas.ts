/**
 * Zod schemas for Fusion CRUD + playground.
 */
import { z } from "zod";
import { FUSION_STRATEGIES, JUDGE_OPTIONS } from "./catalog";

export const workspaceOnly = z.object({ workspaceId: z.string().min(1) });

const limits = z.object({
  maxCostUsd: z.number().min(0).max(1000),
  maxTokens: z.number().int().min(0).max(2_000_000),
  timeoutMs: z.number().int().min(1000).max(600_000),
});

const ids = z.array(z.string().max(60)).max(50);

export const fusionCreate = z.object({
  workspaceId: z.string().min(1),
  name: z.string().min(1).max(80),
  description: z.string().max(500).nullable().optional(),
  modelIds: z.array(z.string().max(160)).max(12).default([]),
  skillIds: ids.default([]),
  ruleIds: ids.default([]),
  knowledgeIds: ids.default([]),
  strategy: z.enum(FUSION_STRATEGIES).default("single"),
  judge: z.enum(JUDGE_OPTIONS).default("auto"),
  judgeModelId: z.string().max(160).nullable().optional(),
  limits: limits.optional(),
  status: z.enum(["draft", "active", "archived"]).optional(),
});

export const fusionUpdate = z.object({
  workspaceId: z.string().min(1),
  name: z.string().min(1).max(80).optional(),
  description: z.string().max(500).nullable().optional(),
  modelIds: z.array(z.string().max(160)).max(12).optional(),
  skillIds: ids.optional(),
  ruleIds: ids.optional(),
  knowledgeIds: ids.optional(),
  strategy: z.enum(FUSION_STRATEGIES).optional(),
  judge: z.enum(JUDGE_OPTIONS).optional(),
  judgeModelId: z.string().max(160).nullable().optional(),
  limits: limits.partial().optional(),
  status: z.enum(["draft", "active", "archived"]).optional(),
});

export const playgroundRun = z.object({
  workspaceId: z.string().min(1),
  fusionId: z.string().min(1),
  prompt: z.string().min(1).max(8000),
});
