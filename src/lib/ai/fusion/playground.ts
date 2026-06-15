/**
 * Playground executor — run a prompt across selected models (per the routing
 * strategy), then reconcile with a judge into one fused result. Records each
 * model call to FusionRequestLog for Overview metrics. SERVER-ONLY.
 */
import { chat } from "@/lib/ai/provider";
import { getProviderConfig } from "@/lib/ai/providers";
import { recordFusionRequest } from "./logging";
import { resolveRoutingSteps, stopsAtFirstSuccess, type RoutingConfig } from "./routing";
import type { JudgeMode } from "./catalog";

export type ModelRun = {
  ref: string;
  provider: string;
  modelId: string;
  ok: boolean;
  response: string;
  latencyMs: number;
  tokensIn: number;
  tokensOut: number;
  error?: string;
};

export type PlaygroundResult = {
  runs: ModelRun[];
  fused: string;
  judgeMode: JudgeMode | string;
  judgeModel: string;
  durationMs: number;
};

const CHARS_PER_TOKEN = 4;
const estTokens = (t: string) => Math.ceil(t.length / CHARS_PER_TOKEN);

function parseRef(ref: string): { provider: string; modelId: string } {
  const i = ref.indexOf(":");
  return i === -1 ? { provider: "openai", modelId: ref } : { provider: ref.slice(0, i), modelId: ref.slice(i + 1) };
}

async function runModel(workspaceId: string, ref: string, prompt: string, signal?: AbortSignal): Promise<ModelRun> {
  const { provider, modelId } = parseRef(ref);
  const baseUrl = getProviderConfig(provider)?.baseUrl || undefined;
  const start = Date.now();
  try {
    const response = await chat([{ role: "user", content: prompt }], {
      model: modelId,
      provider,
      baseUrl,
      workspaceId,
      signal: signal ?? AbortSignal.timeout(60000),
    });
    const latencyMs = Date.now() - start;
    const tokensIn = estTokens(prompt);
    const tokensOut = estTokens(response);
    void recordFusionRequest(workspaceId, { provider, modelId, tokensIn, tokensOut, latencyMs, success: true });
    return { ref, provider, modelId, ok: true, response, latencyMs, tokensIn, tokensOut };
  } catch (err) {
    const latencyMs = Date.now() - start;
    const message = err instanceof Error ? err.message : String(err);
    void recordFusionRequest(workspaceId, { provider, modelId, latencyMs, success: false, error: message });
    return { ref, provider, modelId, ok: false, response: "", latencyMs, tokensIn: 0, tokensOut: 0, error: message };
  }
}

const JUDGE_PROMPTS: Record<string, string> = {
  consensus:
    "You are the Judge. Below are independent model answers to the same task. Identify where they agree (highest confidence), note disagreements, and write a single grounded final answer.",
  majority:
    "You are the Judge. Below are independent model answers. Determine the majority position and return the answer most models support, noting the vote split.",
  merge:
    "You are the Judge. Below are independent model answers. Merge their strongest parts into one cohesive answer, resolving conflicts in favor of the better-supported claim.",
  debate:
    "You are the Judge. Treat the answers below as positions in a debate. Weigh them against each other and return the most defensible conclusion with brief reasoning.",
};

export async function runPlayground(opts: {
  workspaceId: string;
  prompt: string;
  modelRefs: string[];
  strategy?: string;
  judgeMode?: JudgeMode | string;
  judgeModel?: string;
  routingConfig?: RoutingConfig;
  signal?: AbortSignal;
}): Promise<PlaygroundResult> {
  const start = Date.now();
  const { workspaceId, prompt, signal } = opts;
  const refs = opts.modelRefs.length ? opts.modelRefs : resolveRoutingSteps(opts.routingConfig);
  const strategy = opts.strategy ?? "parallel";
  const judgeMode = opts.judgeMode ?? "consensus";

  const runs: ModelRun[] = [];
  if (stopsAtFirstSuccess(strategy)) {
    for (const ref of refs) {
      const r = await runModel(workspaceId, ref, prompt, signal);
      runs.push(r);
      if (r.ok) break;
    }
  } else {
    runs.push(...(await Promise.all(refs.map((ref) => runModel(workspaceId, ref, prompt, signal)))));
  }

  const ok = runs.filter((r) => r.ok);
  // Judge: default to the first successful run's provider/model, but prefer an
  // explicit judge model (e.g. claude-opus-4-8) when provided.
  const judgeRef = opts.judgeModel || ok[0]?.ref || refs[0] || "openai:gpt-4o";
  const { provider: jProvider, modelId: jModel } = parseRef(judgeRef);

  let fused: string;
  if (ok.length === 0) {
    fused = "All model runs failed. Check provider configuration in Integrations.";
  } else if (ok.length === 1) {
    fused = ok[0].response;
  } else {
    const block = ok.map((r, i) => `Answer ${i + 1} (${r.modelId}):\n${r.response}`).join("\n\n---\n\n");
    const sys = JUDGE_PROMPTS[judgeMode] ?? JUDGE_PROMPTS.consensus;
    try {
      fused = await chat(
        [
          { role: "system", content: sys },
          { role: "user", content: `Task:\n${prompt}\n\nModel answers:\n${block}` },
        ],
        { model: jModel, provider: jProvider, baseUrl: getProviderConfig(jProvider)?.baseUrl || undefined, workspaceId, temperature: 0.2, signal }
      );
    } catch {
      fused = ok[0].response; // fall back to the first good answer
    }
  }

  return {
    runs,
    fused,
    judgeMode,
    judgeModel: `${jProvider}:${jModel}`,
    durationMs: Date.now() - start,
  };
}
