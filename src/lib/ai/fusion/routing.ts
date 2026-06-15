/**
 * Routing config helpers. A routing pipeline is an ordered list of model refs
 * ("provider:modelId") plus a strategy that the Playground executor interprets:
 *   - sequential : run steps in order, stop at the first success
 *   - parallel   : run all steps at once (fan-out for a judge)
 *   - fallback   : try steps in order until one succeeds
 *   - cost       : order by cheapest first (hint; ordering supplied in steps)
 *   - latency    : order by fastest first (hint; ordering supplied in steps)
 * Pure logic — no DB, no network.
 */
import type { RoutingStrategy } from "./catalog";

export type RoutingConfig = {
  steps?: string[]; // ordered "provider:modelId" refs
  weights?: Record<string, number>;
  maxFanout?: number;
};

export function resolveRoutingSteps(config: RoutingConfig | null | undefined): string[] {
  const steps = config?.steps ?? [];
  const max = config?.maxFanout;
  return typeof max === "number" && max > 0 ? steps.slice(0, max) : steps;
}

/** Whether a strategy fans out to every step (parallel) vs. tries them in order. */
export function isParallel(strategy: RoutingStrategy | string): boolean {
  return strategy === "parallel";
}

/** Whether the executor should stop at the first successful step. */
export function stopsAtFirstSuccess(strategy: RoutingStrategy | string): boolean {
  return strategy === "sequential" || strategy === "fallback";
}
