/**
 * Routing strategy resolution — turn a strategy + model pool into an ordered
 * execution list (primary first, the rest as the fallback chain). Pure logic.
 */
import type { RoutingStrategy, ModelCapabilities, ModelPricing } from "./catalog";

export type RoutableModel = {
  id: string;
  modelId: string;
  pricing: ModelPricing;
  capabilities: ModelCapabilities;
};

export type RoutingConfig = {
  fallbackChain?: string[];
  weights?: Record<string, number>;
  rules?: unknown[];
};

function blended(p: ModelPricing): number {
  return (p.input + p.output) / 2;
}

/**
 * Returns the models in execution order for a strategy. The first element is the
 * primary; the remainder form the fallback chain.
 */
export function resolveRouting(
  strategy: RoutingStrategy,
  models: RoutableModel[],
  config: RoutingConfig = {}
): RoutableModel[] {
  const pool = [...models];
  const byId = new Map(pool.map((m) => [m.id, m]));

  switch (strategy) {
    case "cheapest":
    case "cost":
      return pool.sort((a, b) => blended(a.pricing) - blended(b.pricing));
    case "quality":
      // Higher price ≈ stronger model as a heuristic, reasoning first.
      return pool.sort(
        (a, b) =>
          Number(b.capabilities.reasoning) - Number(a.capabilities.reasoning) ||
          blended(b.pricing) - blended(a.pricing)
      );
    case "fastest":
    case "latency":
      // No live latency data yet — approximate "fast" as cheaper/smaller models.
      return pool.sort((a, b) => blended(a.pricing) - blended(b.pricing));
    case "coding":
      return pool.sort(
        (a, b) => Number(b.capabilities.tools) - Number(a.capabilities.tools) || blended(b.pricing) - blended(a.pricing)
      );
    case "research":
      return pool.sort((a, b) => Number(b.capabilities.reasoning) - Number(a.capabilities.reasoning));
    case "vision":
      return pool
        .filter((m) => m.capabilities.vision)
        .concat(pool.filter((m) => !m.capabilities.vision));
    case "weighted": {
      const w = config.weights ?? {};
      return pool.sort((a, b) => (w[b.id] ?? 0) - (w[a.id] ?? 0));
    }
    case "fallback":
    case "custom": {
      const chain = config.fallbackChain ?? [];
      const ordered = chain.map((id) => byId.get(id)).filter((m): m is RoutableModel => !!m);
      const rest = pool.filter((m) => !chain.includes(m.id));
      return [...ordered, ...rest];
    }
    default:
      return pool;
  }
}
