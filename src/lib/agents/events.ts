/**
 * Shared agent event protocol.
 *
 * Extracted from the runner so both the runner and the queue event-bus can
 * depend on these types without forming an import cycle.
 */
import type { AgentStepType } from "@prisma/client";

export type AgentEvent =
  | { type: "queued" }
  | { type: "planning" }
  | { type: "step_started"; step: AgentStepEvent }
  | { type: "step_completed"; step: AgentStepEvent }
  | { type: "generating_diff" }
  | { type: "waiting_approval"; changeSetId: string }
  | { type: "completed" }
  | { type: "failed"; error: string }
  | { type: "cancelled" };

export type AgentStepEvent = {
  id: string;
  type: AgentStepType;
  title: string;
  status: "RUNNING" | "COMPLETED" | "FAILED";
  output?: unknown;
};
