"use client";

import { useState } from "react";
import { Plus, FileCode, Globe, FolderOpen, ToggleLeft, ToggleRight, Trash2, Edit3 } from "lucide-react";

interface Rule {
  id: number;
  name: string;
  scope: "global" | "project" | "file";
  enabled: boolean;
  content: string;
  project?: string;
  pattern?: string;
}

const rules: Rule[] = [
  {
    id: 1,
    name: "TypeScript Strict",
    scope: "global",
    enabled: true,
    content: "Always use TypeScript strict mode. Never use `any` type. Prefer interfaces over type aliases for object shapes. Use discriminated unions for complex state.",
  },
  {
    id: 2,
    name: "React Best Practices",
    scope: "global",
    enabled: true,
    content: "Use functional components only. Prefer server components by default. Use 'use client' directive only when necessary (hooks, browser APIs, event handlers). Memoize expensive computations with useMemo.",
  },
  {
    id: 3,
    name: "API Route Conventions",
    scope: "project",
    project: "teskel-api",
    enabled: true,
    content: "All API routes follow REST conventions. Use zod for request validation. Return { data } for success, { error, code } for failures. Always include rate limiting middleware.",
  },
  {
    id: 4,
    name: "Component Structure",
    scope: "project",
    project: "teskel-web",
    enabled: true,
    content: "Components in src/components/. Page components in src/app/. Shared UI primitives in src/components/ui/. Use barrel exports. Maximum 200 lines per component file.",
  },
  {
    id: 5,
    name: "Test File Rules",
    scope: "file",
    pattern: "**/*.test.{ts,tsx}",
    enabled: true,
    content: "Use Vitest for unit tests. Use @testing-library/react for component tests. Mock external APIs. Aim for 80% coverage on critical paths. Use describe/it/expect pattern.",
  },
  {
    id: 6,
    name: "CSS / Styling",
    scope: "global",
    enabled: false,
    content: "Use Tailwind CSS classes exclusively. No inline styles. No CSS modules. Use cn() helper for conditional classes. Follow Graphite Slate design tokens.",
  },
  {
    id: 7,
    name: "Git Commit Messages",
    scope: "global",
    enabled: true,
    content: "Follow Conventional Commits: feat, fix, refactor, docs, chore. Max 72 chars for subject. Include scope in parentheses. Use imperative mood.",
  },
];

export default function RulesPage() {
  const [activeScope, setActiveScope] = useState<string>("all");
  const [ruleList, setRuleList] = useState(rules);

  const filtered = activeScope === "all" ? ruleList : ruleList.filter((r) => r.scope === activeScope);

  const toggleRule = (id: number) => {
    setRuleList((prev) => prev.map((r) => r.id === id ? { ...r, enabled: !r.enabled } : r));
  };

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-[22px] font-semibold text-gray-900">Rules & Context</h1>
            <p className="mt-1 text-[14px] text-gray-500">Configure how Teskel writes and reviews code</p>
          </div>
          <button className="flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-[13px] font-medium text-white hover:bg-gray-800">
            <Plus size={14} />
            Add Rule
          </button>
        </div>

        {/* Scope filters */}
        <div className="mb-6 flex gap-2">
          {[
            { key: "all", label: "All Rules", icon: FileCode },
            { key: "global", label: "Global", icon: Globe },
            { key: "project", label: "Project", icon: FolderOpen },
            { key: "file", label: "File Pattern", icon: FileCode },
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => setActiveScope(f.key)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium transition-colors ${
                activeScope === f.key ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              <f.icon size={12} />
              {f.label}
            </button>
          ))}
        </div>

        {/* Rules list */}
        <div className="space-y-3">
          {filtered.map((rule) => (
            <div
              key={rule.id}
              className={`rounded-xl border bg-white p-5 transition-all ${
                rule.enabled ? "border-gray-200" : "border-gray-100 opacity-60"
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <h3 className="text-[14px] font-semibold text-gray-900">{rule.name}</h3>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      rule.scope === "global" ? "bg-blue-50 text-blue-600" :
                      rule.scope === "project" ? "bg-purple-50 text-purple-600" :
                      "bg-orange-50 text-orange-600"
                    }`}>
                      {rule.scope}
                    </span>
                    {rule.project && (
                      <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500">
                        {rule.project}
                      </span>
                    )}
                    {rule.pattern && (
                      <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[10px] text-gray-500">
                        {rule.pattern}
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-[13px] leading-relaxed text-gray-500">{rule.content}</p>
                </div>
                <div className="ml-4 flex items-center gap-2">
                  <button className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
                    <Edit3 size={14} />
                  </button>
                  <button className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-red-500">
                    <Trash2 size={14} />
                  </button>
                  <button
                    onClick={() => toggleRule(rule.id)}
                    className={`${rule.enabled ? "text-blue-600" : "text-gray-300"}`}
                  >
                    {rule.enabled ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
