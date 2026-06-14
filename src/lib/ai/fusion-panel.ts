/**
 * Multi-Model Fusion Pipeline — Panel → Judge Orchestration
 *
 * Dispatches the same prompt to multiple AI models in parallel (blind to each
 * other), then uses a frontier model (judge) to synthesize the results.
 *
 * Follows the Fusion-Fable methodology:
 * - Independence, then synthesis: no assigned roles/personas.
 * - Track A: Code/Artifact tasks: run, verify, and merge.
 * - Track B: Research/Analysis tasks: structured synthesis (Consensus, Contradictions,
 *            Partial Coverage, Unique Insights, Blind Spots) and grounded final answer.
 */
import { chat, isAIConfiguredAsync, type AIMessage } from "@/lib/ai/provider";
import { validateSyntax } from "./validators/ast-validator";
import { runTests } from "./validators/test-runner";
import { getFusionConfig } from "./fusion-config";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type FusionOptions = {
  task: string;
  context?: string;
  systemPrompt?: string;
  panelSlug?: "opus4.8-4.8" | "opus4.8-gpt5.5" | "opus4.8-gpt5.5-gemini3.1pro" | string;
  workspaceId?: string;
  projectId?: string;

  // Validation / Verification (for Track A)
  validateSyntax?: boolean;
  runLint?: boolean;
  runTests?: boolean;
  testCommand?: string;
  cwd?: string;

  signal?: AbortSignal;
};

export type PanelistResponse = {
  model: string;
  provider: string;
  response: string;
  verification?: {
    syntaxValid: boolean;
    feedback: string;
  };
};

export type FusionResult = {
  success: boolean;
  deliverable: string;
  panelSlug: string;
  panelists: string[];
  track: "A" | "B";
  analysis?: {
    consensus: string;
    contradictions: string;
    partial: string;
    unique: string;
    blindSpots: string;
  };
  candidates?: PanelistResponse[];
  mergeRationale?: string;
  durationMs: number;
};

// ---------------------------------------------------------------------------
// Judge Prompts
// ---------------------------------------------------------------------------

const JUDGE_TRACK_A_PROMPT = `You are the Judge model in a Multi-Model Fusion pipeline.
Your task is to merge the outputs of independent panelist models into a single, cohesive, working artifact.

Task:
{{task}}

Candidate A (Model: {{modelA}}, Provider: {{providerA}}):
- Syntax Valid: {{syntaxA}}
- Verification Feedback: {{feedbackA}}
- Code:
\`\`\`
{{codeA}}
\`\`\`

Candidate B (Model: {{modelB}}, Provider: {{providerB}}):
- Syntax Valid: {{syntaxB}}
- Verification Feedback: {{feedbackB}}
- Code:
\`\`\`
{{codeB}}
\`\`\`

Instructions for merging:
1. Understand the design, architecture, and tradeoffs of each candidate.
2. Decide what to keep based on which candidate's parts actually succeeded or worked.
3. Pick the stronger candidate as the foundation, and graft specific successful pieces from the other.
4. Resolve any contradictions/disagreements in favor of the one that demonstrably worked.
5. Ensure the seams between grafted pieces are clean (no mismatched signatures, types, imports).
6. Return a JSON object containing:
   - "code": the complete merged code
   - "mergeRationale": a brief explanation of how you merged them, what you took from each, and why.

Do not output anything other than a valid JSON object matching this structure:
{
  "code": "string",
  "mergeRationale": "string"
}`;

const JUDGE_TRACK_B_PROMPT = `You are the Judge model in a Multi-Model Fusion pipeline.
Your task is to synthesize the answers of independent panelist models into a single structured analysis and grounded final answer.

Task:
{{task}}

Panelist responses:
{{responses}}

Instructions:
1. Identify **Consensus**: Points where panelists independently agree. Note who agreed.
2. Identify **Contradictions**: Direct disagreements on facts, opinions, or recommendations. State the competing positions and who holds them.
3. Identify **Partial Coverage**: Important sub-questions or details that only some panelists addressed.
4. Identify **Unique Insights**: Valuable points raised by exactly one panelist.
5. Identify **Blind Spots**: What the panel as a whole missed or got wrong, including shared assumptions none questioned. You can add your own blind spots that none of them named.
6. Write the **Final Answer**: Grounded in the synthesis, leading with high-confidence consensus and folding in unique insights.

Format your output exactly as a structured markdown document with these headers:
# Final Answer
[Your grounded final answer]

# Consensus
- [Point] (Attributed to: [Panelist(s)])

# Contradictions
- [Conflict] (Attributed to: [Panelist A] vs [Panelist B])

# Partial Coverage
- [Sub-point] (Attributed to: [Panelist(s)])

# Unique Insights
- [Insight] (Attributed to: [Panelist])

# Blind Spots
- [Blind spot] (Attributed to: [Panelist(s)] or added by Judge)
`;

// ---------------------------------------------------------------------------
// Panel Detection
// ---------------------------------------------------------------------------

export async function detectPanel(workspaceId?: string): Promise<{
  slug: string;
  panelists: { model: string; provider: string; temperature?: number }[];
  judge: { model: string; provider: string };
}> {
  const config = await getFusionConfig();
  const isAnthropic = await isAIConfiguredAsync("anthropic", workspaceId);
  const isOpenai = await isAIConfiguredAsync("openai", workspaceId);
  const isGroq = await isAIConfiguredAsync("groq", workspaceId);

  // If a custom panel is explicitly configured, use it
  if (config.defaultPanelSlug !== "auto") {
    return {
      slug: config.defaultPanelSlug,
      panelists: config.panelists,
      judge: config.judge,
    };
  }

  // Set the strongest available model as judge
  let judgeModel = "gpt-4o-mini";
  let judgeProvider = "openai";

  if (isAnthropic) {
    judgeModel = "claude-opus-4-8";
    judgeProvider = "anthropic";
  } else if (isOpenai) {
    judgeModel = "gpt-4o";
    judgeProvider = "openai";
  }

  // Panel determination
  if (isAnthropic && isOpenai && isGroq) {
    return {
      slug: "opus4.8-gpt5.5-gemini3.1pro",
      panelists: [
        { model: "claude-opus-4-8", provider: "anthropic" },
        { model: "gpt-4o", provider: "openai" },
        { model: "llama-3.1-70b", provider: "groq" },
      ],
      judge: { model: judgeModel, provider: judgeProvider },
    };
  } else if (isAnthropic && isOpenai) {
    return {
      slug: "opus4.8-gpt5.5",
      panelists: [
        { model: "claude-opus-4-8", provider: "anthropic" },
        { model: "gpt-4o", provider: "openai" },
      ],
      judge: { model: judgeModel, provider: judgeProvider },
    };
  } else {
    // Single provider or fallback
    const provider = isAnthropic ? "anthropic" : isOpenai ? "openai" : "openai";
    const model = isAnthropic ? "claude-opus-4-8" : isOpenai ? "gpt-4o" : "gpt-4o-mini";
    return {
      slug: "opus4.8-4.8",
      panelists: [
        { model, provider },
        { model, provider },
      ],
      judge: { model: judgeModel, provider: judgeProvider },
    };
  }
}

// ---------------------------------------------------------------------------
// Execution Engine
// ---------------------------------------------------------------------------

export async function executeFusion(options: FusionOptions): Promise<FusionResult> {
  const startTime = Date.now();
  const { task, context = "", systemPrompt, workspaceId, signal } = options;

  // 1. Detect / Resolve Panel
  const panel = await detectPanel(workspaceId);
  const config = await getFusionConfig();
  const panelSlug = options.panelSlug || panel.slug;
  let panelists = panel.panelists;

  // Use config-defined panelists if no slug was explicitly passed and config isn't auto
  if (!options.panelSlug && config.defaultPanelSlug !== "auto") {
    panelists = config.panelists;
  }

  // Override panelists based on chosen slug if requested explicitly
  if (options.panelSlug === "opus4.8-4.8") {
    const provider = panel.judge.provider;
    const model = panel.judge.model;
    panelists = [
      { model, provider },
      { model, provider },
    ];
  } else if (options.panelSlug === "opus4.8-gpt5.5") {
    panelists = [
      { model: "claude-opus-4-8", provider: "anthropic" },
      { model: "gpt-4o", provider: "openai" },
    ];
  } else if (options.panelSlug === "opus4.8-gpt5.5-gemini3.1pro") {
    panelists = [
      { model: "claude-opus-4-8", provider: "anthropic" },
      { model: "gpt-4o", provider: "openai" },
      { model: "llama-3.1-70b", provider: "groq" },
    ];
  }

  // 2. Classify task (Track A code/artifact vs Track B research/analysis)
  const isCodeTask =
    /\b(code|write|implement|fix|refactor|function|class|method|component|script|json|schema|yaml|dockerfile|prisma)\b/i.test(
      task
    ) || options.validateSyntax === true;

  const track = isCodeTask ? ("A" as const) : ("B" as const);

  // 3. Prompt building for panelists (Verbatim + brief instruction)
  const panelistPrompt = `${context}\n\nTask: ${task}\n\nInstruction: Please solve the task above. Provide a complete, self-contained solution. You are one of several independent experts answering this, so return your absolute best work.`;

  // 4. Concurrently trigger all panelists
  const panelistPromises = panelists.map(async (p, index): Promise<PanelistResponse> => {
    const messages: AIMessage[] = [
      {
        role: "system",
        content:
          systemPrompt ||
          "You are an expert AI developer and analyst. Solve the task completely and directly.",
      },
      { role: "user", content: panelistPrompt },
    ];

    try {
      const response = await chat(messages, {
        model: p.model,
        provider: p.provider,
        workspaceId,
        temperature: index === 1 ? 0.4 : 0.2, // slight temp difference for variety
        signal,
      });

      return {
        model: p.model,
        provider: p.provider,
        response,
      };
    } catch (err) {
      return {
        model: p.model,
        provider: p.provider,
        response: `Error running panelist: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  });

  const responses = await Promise.all(panelistPromises);

  // 5. Verification for Track A candidates
  if (track === "A") {
    for (const res of responses) {
      const code = extractCode(res.response);
      const syntaxValid = validateSyntax(code).valid;
      let feedback = "";

      if (options.runTests && options.testCommand && options.cwd) {
        try {
          const testResult = await runTests(options.testCommand, options.cwd);
          feedback = `Tests: ${testResult.passedTests}/${testResult.totalTests} passed.`;
        } catch {
          feedback = "Tests execution failed.";
        }
      }

      res.verification = {
        syntaxValid,
        feedback,
      };
    }
  }

  // 6. Judge synthesis
  let deliverable = "";
  let mergeRationale: string | undefined;
  let analysis: FusionResult["analysis"];

  if (track === "A") {
    // Track A Merge
    const judgePrompt = JUDGE_TRACK_A_PROMPT.replace("{{task}}", task)
      .replace("{{modelA}}", responses[0]?.model || "Unknown")
      .replace("{{providerA}}", responses[0]?.provider || "Unknown")
      .replace("{{syntaxA}}", String(responses[0]?.verification?.syntaxValid ?? "unknown"))
      .replace("{{feedbackA}}", responses[0]?.verification?.feedback || "none")
      .replace("{{codeA}}", extractCode(responses[0]?.response))
      .replace("{{modelB}}", responses[1]?.model || "Unknown")
      .replace("{{providerB}}", responses[1]?.provider || "Unknown")
      .replace("{{syntaxB}}", String(responses[1]?.verification?.syntaxValid ?? "unknown"))
      .replace("{{feedbackB}}", responses[1]?.verification?.feedback || "none")
      .replace("{{codeB}}", extractCode(responses[1]?.response || ""));

    const judgeMessages: AIMessage[] = [
      {
        role: "system",
        content: "You are an expert software architect merging code implementations.",
      },
      { role: "user", content: judgePrompt },
    ];

    try {
      const judgeResponse = await chat(judgeMessages, {
        model: panel.judge.model,
        provider: panel.judge.provider,
        workspaceId,
        temperature: 0.1,
        signal,
      });

      const parsed = parseJsonMerge(judgeResponse);
      deliverable = parsed.code;
      mergeRationale = parsed.mergeRationale;
    } catch {
      // Fallback: use first candidate if merge fails
      deliverable = extractCode(responses[0]?.response || "");
      mergeRationale = "Failed to run automated merge; fallback to Candidate A.";
    }
  } else {
    // Track B Synthesis
    const responsesBlock = responses
      .map(
        (r, idx) =>
          `Panelist ${idx + 1} (${r.model} via ${r.provider}):\n${r.response}\n---`
      )
      .join("\n\n");

    const judgePrompt = JUDGE_TRACK_B_PROMPT.replace("{{task}}", task).replace(
      "{{responses}}",
      responsesBlock
    );

    const judgeMessages: AIMessage[] = [
      {
        role: "system",
        content: "You are an expert analyst synthesizing multi-model insights.",
      },
      { role: "user", content: judgePrompt },
    ];

    const synthesis = await chat(judgeMessages, {
      model: panel.judge.model,
      provider: panel.judge.provider,
      workspaceId,
      temperature: 0.2,
      signal,
    });

    deliverable = synthesis;

    // Parse sections for structured result
    analysis = {
      consensus: extractMarkdownSection(synthesis, "Consensus"),
      contradictions: extractMarkdownSection(synthesis, "Contradictions"),
      partial: extractMarkdownSection(synthesis, "Partial Coverage"),
      unique: extractMarkdownSection(synthesis, "Unique Insights"),
      blindSpots: extractMarkdownSection(synthesis, "Blind Spots"),
    };
  }

  const durationMs = Date.now() - startTime;

  return {
    success: true,
    deliverable,
    panelSlug,
    panelists: panelists.map((p) => `${p.model} (${p.provider})`),
    track,
    analysis,
    candidates: responses,
    mergeRationale,
    durationMs,
  };
}

// ---------------------------------------------------------------------------
// Helper Functions
// ---------------------------------------------------------------------------

function extractCode(text: string): string {
  const match = text.match(/```[a-zA-Z0-9-]*\n([\s\S]*?)\n```/);
  return match ? match[1].trim() : text.trim();
}

function parseJsonMerge(text: string): { code: string; mergeRationale: string } {
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.code && parsed.mergeRationale) {
        return parsed;
      }
    }
  } catch {
    // Ignore JSON parse error and fallback below
  }

  // Fallback regex parsers
  const code = extractCode(text);
  return {
    code,
    mergeRationale: "Extracted code directly from judge response.",
  };
}

function extractMarkdownSection(text: string, sectionTitle: string): string {
  const regex = new RegExp(
    `#+\\s+${sectionTitle}[\\r\\n]+([\\s\\S]*?)(?:[\\r\\n]+#+|$)`,
    "i"
  );
  const match = text.match(regex);
  return match ? match[1].trim() : "No details found.";
}
