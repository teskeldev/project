/**
 * Client helpers for the Rules API (Phase 7b).
 *
 * Wraps the shared `apiFetch` envelope unwrapper. Server enforces authz; these
 * are thin typed fetchers consumed by the Rules dashboard page.
 */
import { apiFetch } from "@/lib/client/api";

export type RuleScope = "GLOBAL" | "WORKSPACE" | "PROJECT" | "FILE";

export type Rule = {
  id: string;
  workspaceId: string | null;
  projectId: string | null;
  scope: RuleScope;
  filePattern: string | null;
  title: string;
  content: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ListRulesParams = {
  projectId?: string;
  scope?: RuleScope;
};

export function listRules(
  params?: ListRulesParams
): Promise<{ rules: Rule[] }> {
  const qs = new URLSearchParams();
  if (params?.projectId) qs.set("projectId", params.projectId);
  if (params?.scope) qs.set("scope", params.scope);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return apiFetch(`/api/rules${suffix}`);
}

export type CreateRuleInput = {
  scope: RuleScope;
  title: string;
  content: string;
  filePattern?: string;
  workspaceId?: string;
  projectId?: string;
  enabled?: boolean;
};

export function createRule(
  input: CreateRuleInput
): Promise<{ rule: Rule }> {
  return apiFetch("/api/rules", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export type UpdateRuleInput = {
  title?: string;
  content?: string;
  filePattern?: string | null;
  enabled?: boolean;
};

export function updateRule(
  ruleId: string,
  input: UpdateRuleInput
): Promise<{ rule: Rule }> {
  return apiFetch(`/api/rules/${ruleId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteRule(
  ruleId: string
): Promise<{ deleted: boolean; id: string }> {
  return apiFetch(`/api/rules/${ruleId}`, { method: "DELETE" });
}
