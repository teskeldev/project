/**
 * Built-in Fusion templates (read-only). "Use template" copies one into the
 * workspace, mapping the template's preferred providers to whatever models the
 * workspace actually has (missing ones are skipped, see templates/use route).
 *
 * Templates reference providers (not concrete model ids) so they adapt to each
 * workspace's connected models. Pure data — safe on client + server.
 */
import type { FusionStrategy, JudgeOption } from "./catalog";

export type FusionTemplate = {
  id: string;
  name: string;
  description: string;
  /** Preferred providers, in priority order, for picking workspace models. */
  providers: string[];
  /** Skill slugs to attach if present in the workspace. */
  skillSlugs: string[];
  strategy: FusionStrategy;
  judge: JudgeOption;
};

export const FUSION_TEMPLATES: FusionTemplate[] = [
  {
    id: "senior-fullstack",
    name: "Senior Fullstack",
    description: "Architecture, code, and security review across top coding models.",
    providers: ["openai", "anthropic"],
    skillSlugs: ["architecture-review", "code-review", "security-review"],
    strategy: "parallel",
    judge: "anthropic",
  },
  {
    id: "product-designer",
    name: "Product Designer",
    description: "UI/UX critique with multimodal models.",
    providers: ["anthropic", "google"],
    skillSlugs: ["ui-review", "ux-review"],
    strategy: "parallel",
    judge: "auto",
  },
  {
    id: "web3-auditor",
    name: "Web3 Auditor",
    description: "Solidity audit and threat modeling.",
    providers: ["anthropic", "deepseek"],
    skillSlugs: ["solidity-audit", "threat-modeling"],
    strategy: "consensus",
    judge: "anthropic",
  },
  {
    id: "research-analyst",
    name: "Research Analyst",
    description: "Cross-checked research and fact verification.",
    providers: ["openai", "anthropic", "google"],
    skillSlugs: ["research", "fact-check"],
    strategy: "consensus",
    judge: "auto",
  },
];

export function getFusionTemplate(id: string): FusionTemplate | undefined {
  return FUSION_TEMPLATES.find((t) => t.id === id);
}
