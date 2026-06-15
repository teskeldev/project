/**
 * runFusion — execute a Fusion: inject Rules → Knowledge → Skills as system
 * context, run the configured models per strategy, then reconcile with the
 * judge into one result. Limits are best-effort. SERVER-ONLY.
 */
import { chat, isAIConfiguredAsync } from "@/lib/ai/provider";
import { getProviderConfig } from "@/lib/ai/providers";
import { recordUsage } from "@/lib/quota";
import { recordFusionRequest } from "./logging";
import { resolveFusion, type ResolvedFusion, type ResolvedModel } from "./resolver";

const CHARS_PER_TOKEN = 4;
const estTokens = (t: string) => Math.ceil(t.length / CHARS_PER_TOKEN);

const JUDGE_DEFAULT_MODEL: Record<string, { provider: string; modelId: string }> = {
  anthropic: { provider: "anthropic", modelId: "claude-opus-4-8" },
  openai: { provider: "openai", modelId: "gpt-4o" },
  google: { provider: "google", modelId: "gemini-3.1-pro" },
};

export type FusionModelRun = {
  ref: string; provider: string; modelId: string; ok: boolean;
  response: string; latencyMs: number; tokensIn: number; tokensOut: number; error?: string;
};

export type FusionRunResult = {
  runs: FusionModelRun[];
  fused: string;
  judgeUsed: string;
  warnings: string[];
  metrics: { tokens: number; costUsd: number; latencyMs: number; executionMs: number };
};

function buildSystem(resolved: ResolvedFusion): string {
  const parts: string[] = [];
  if (resolved.rules.length) {
    parts.push("--- RULES ---\n" + resolved.rules.map((r) => `# ${r.title}\n${r.content}`).join("\n\n"));
  }
  if (resolved.knowledge.length) {
    parts.push("--- KNOWLEDGE ---\n" + resolved.knowledge.map((k) => `# ${k.title}\n${k.content}`).join("\n\n"));
  }
  if (resolved.skills.length) {
    parts.push("--- SKILLS ---\n" + resolved.skills.map((s) => `# ${s.title}\n${s.content}`).join("\n\n"));
  }
  let block = parts.join("\n\n");
  // Keep the injected context bounded.
  if (block.length > 16000) block = block.slice(0, 16000);
  return block || "You are an expert assistant.";
}

async function resolveJudge(
  judge: string,
  judgeModelId: string | null,
  workspaceId: string,
  firstRef: string | undefined
): Promise<{ provider: string; modelId: string }> {
  if (judgeModelId) {
    const i = judgeModelId.indexOf(":");
    if (i !== -1) return { provider: judgeModelId.slice(0, i), modelId: judgeModelId.slice(i + 1) };
  }
  if (judge !== "auto" && JUDGE_DEFAULT_MODEL[judge]) {
    if (await isAIConfiguredAsync(judge, workspaceId)) return JUDGE_DEFAULT_MODEL[judge];
  }
  // Auto priority: Claude Opus → GPT-5.5 → Gemini → first available model.
  for (const p of ["anthropic", "openai", "google"]) {
    if (await isAIConfiguredAsync(p, workspaceId)) return JUDGE_DEFAULT_MODEL[p];
  }
  if (firstRef) {
    const i = firstRef.indexOf(":");
    return i !== -1 ? { provider: firstRef.slice(0, i), modelId: firstRef.slice(i + 1) } : { provider: "openai", modelId: firstRef };
  }
  return JUDGE_DEFAULT_MODEL.openai;
}

const JUDGE_SYSTEM: Record<string, string> = {
  parallel:
    "You are the Judge. Merge the strongest parts of the independent model answers below into one cohesive answer, resolving conflicts in favor of the better-supported claim.",
  consensus:
    "You are the Judge. Identify where the independent answers agree (highest confidence), note disagreements, and write a single grounded final answer.",
};

async function runModel(
  workspaceId: string,
  m: ResolvedModel,
  system: string,
  prompt: string,
  maxTokens: number,
  timeoutMs: number
): Promise<FusionModelRun> {
  const baseUrl = getProviderConfig(m.provider)?.baseUrl || undefined;
  const start = Date.now();
  try {
    const response = await chat(
      [
        { role: "system", content: system },
        { role: "user", content: prompt },
      ],
      { model: m.modelId, provider: m.provider, baseUrl, workspaceId, maxTokens: maxTokens || undefined, signal: AbortSignal.timeout(timeoutMs) }
    );
    const latencyMs = Date.now() - start;
    const tokensIn = estTokens(system + prompt);
    const tokensOut = estTokens(response);
    void recordFusionRequest(workspaceId, { provider: m.provider, modelId: m.modelId, tokensIn, tokensOut, latencyMs, success: true });
    return { ref: m.ref, provider: m.provider, modelId: m.modelId, ok: true, response, latencyMs, tokensIn, tokensOut };
  } catch (err) {
    const latencyMs = Date.now() - start;
    const message = err instanceof Error ? err.message : String(err);
    void recordFusionRequest(workspaceId, { provider: m.provider, modelId: m.modelId, latencyMs, success: false, error: message });
    return { ref: m.ref, provider: m.provider, modelId: m.modelId, ok: false, response: "", latencyMs, tokensIn: 0, tokensOut: 0, error: message };
  }
}

export async function runFusion(opts: {
  fusionId: string;
  prompt: string;
  workspaceId: string;
  projectId?: string;
  signal?: AbortSignal;
}): Promise<FusionRunResult> {
  const start = Date.now();
  const resolved = await resolveFusion(opts.fusionId, opts.workspaceId, opts.projectId);
  const warnings = [...resolved.warnings];
  const { strategy, judge, judgeModelId, limits } = resolved.fusion;
  const system = buildSystem(resolved);

  let targets = resolved.models;
  if (targets.length === 0) {
    return {
      runs: [],
      fused: "No available models in this Fusion. Connect a provider in Integrations.",
      judgeUsed: "none",
      warnings,
      metrics: { tokens: 0, costUsd: 0, latencyMs: 0, executionMs: Date.now() - start },
    };
  }
  if (strategy === "single") targets = targets.slice(0, 1);
  else targets = targets.slice(0, 6); // cap fan-out

  const runs = await Promise.all(
    targets.map((m) => runModel(opts.workspaceId, m, system, opts.prompt, limits.maxTokens, limits.timeoutMs))
  );

  const ok = runs.filter((r) => r.ok);
  let fused: string;
  let judgeUsed = "none";

  if (ok.length === 0) {
    fused = "All model runs failed. Check provider configuration in Integrations.";
  } else if (ok.length === 1 || strategy === "single") {
    fused = ok[0]?.response ?? runs[0].response;
  } else {
    const j = await resolveJudge(judge, judgeModelId, opts.workspaceId, ok[0]?.ref);
    judgeUsed = `${j.provider}:${j.modelId}`;
    const block = ok.map((r, i) => `Answer ${i + 1} (${r.modelId}):\n${r.response}`).join("\n\n---\n\n");
    const sys = JUDGE_SYSTEM[strategy] ?? JUDGE_SYSTEM.consensus;
    try {
      fused = await chat(
        [
          { role: "system", content: sys },
          { role: "user", content: `Task:\n${opts.prompt}\n\nModel answers:\n${block}` },
        ],
        { model: j.modelId, provider: j.provider, baseUrl: getProviderConfig(j.provider)?.baseUrl || undefined, workspaceId: opts.workspaceId, temperature: 0.2, signal: opts.signal }
      );
    } catch {
      fused = ok[0].response;
      warnings.push("Judge failed; returned the first successful answer.");
    }
  }

  const tokens = runs.reduce((s, r) => s + r.tokensIn + r.tokensOut, 0);
  if (tokens > 0) void recordUsage(opts.workspaceId, "ai_tokens", tokens, { source: "fusion", fusionId: opts.fusionId });
  if (limits.maxTokens && tokens > limits.maxTokens) warnings.push(`Token budget exceeded (${tokens}/${limits.maxTokens}).`);

  return {
    runs,
    fused,
    judgeUsed,
    warnings,
    metrics: {
      tokens,
      costUsd: 0, // best-effort; per-model pricing not tracked in the read-only registry
      latencyMs: Math.max(0, ...runs.map((r) => r.latencyMs)),
      executionMs: Date.now() - start,
    },
  };
}
