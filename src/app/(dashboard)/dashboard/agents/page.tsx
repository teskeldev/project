"use client";

import { useState } from "react";
import { Play, Pause, RotateCcw, ExternalLink, Clock, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

type AgentStatus = "running" | "completed" | "failed" | "queued";

interface Agent {
  id: number;
  title: string;
  status: AgentStatus;
  model: string;
  started: string;
  duration: string;
  steps: number;
  branch?: string;
  pr?: string;
}

const agents: Agent[] = [
  { id: 1, title: "Build Landing Page", status: "running", model: "Composer 2.5", started: "2 min ago", duration: "2m 14s", steps: 7, branch: "feat/landing" },
  { id: 2, title: "Fix Auth Middleware", status: "running", model: "Opus 4.8", started: "5 min ago", duration: "5m 02s", steps: 4, branch: "fix/auth" },
  { id: 3, title: "Add Stripe Integration", status: "completed", model: "Composer 2.5", started: "1h ago", duration: "12m 45s", steps: 15, branch: "feat/stripe", pr: "#142" },
  { id: 4, title: "Refactor Database Models", status: "completed", model: "GPT-5.5", started: "2h ago", duration: "8m 30s", steps: 11, branch: "refactor/models", pr: "#141" },
  { id: 5, title: "Write API Tests", status: "failed", model: "Opus 4.8", started: "3h ago", duration: "4m 15s", steps: 6 },
  { id: 6, title: "Update Dependencies", status: "queued", model: "Auto", started: "-", duration: "-", steps: 0 },
];

const statusConfig: Record<AgentStatus, { icon: typeof CheckCircle2; color: string; bg: string; label: string }> = {
  running: { icon: Loader2, color: "text-blue-600", bg: "bg-blue-50", label: "Running" },
  completed: { icon: CheckCircle2, color: "text-green-600", bg: "bg-green-50", label: "Completed" },
  failed: { icon: AlertCircle, color: "text-red-600", bg: "bg-red-50", label: "Failed" },
  queued: { icon: Clock, color: "text-gray-500", bg: "bg-gray-50", label: "Queued" },
};

export default function BackgroundAgentsPage() {
  const [selectedAgent, setSelectedAgent] = useState<Agent>(agents[0]);
  const [filter, setFilter] = useState<AgentStatus | "all">("all");

  const filtered = filter === "all" ? agents : agents.filter((a) => a.status === filter);

  return (
    <div className="flex h-full">
      {/* Agent list */}
      <div className="w-[360px] border-r border-gray-100">
        <div className="border-b border-gray-100 p-4">
          <div className="flex items-center justify-between">
            <h1 className="text-[15px] font-semibold text-gray-900">Background Agents</h1>
            <button className="flex items-center gap-1.5 rounded-md bg-gray-900 px-3 py-1.5 text-[12px] font-medium text-white hover:bg-gray-800">
              <Play size={12} />
              New Agent
            </button>
          </div>
          <p className="mt-1 text-[12px] text-gray-500">Cloud agents running tasks in parallel</p>
        </div>

        {/* Filters */}
        <div className="flex gap-1 border-b border-gray-100 p-3">
          {(["all", "running", "completed", "failed", "queued"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-md px-2.5 py-1 text-[11px] font-medium capitalize transition-colors ${
                filter === f ? "bg-gray-900 text-white" : "text-gray-500 hover:bg-gray-100"
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Agent items */}
        <div className="space-y-1 p-2">
          {filtered.map((agent) => {
            const config = statusConfig[agent.status];
            const Icon = config.icon;
            return (
              <button
                key={agent.id}
                onClick={() => setSelectedAgent(agent)}
                className={`flex w-full items-start gap-3 rounded-lg p-3 text-left transition-colors ${
                  selectedAgent.id === agent.id ? "bg-gray-50 ring-1 ring-gray-200" : "hover:bg-gray-50"
                }`}
              >
                <div className={`mt-0.5 rounded-md p-1.5 ${config.bg}`}>
                  <Icon size={14} className={`${config.color} ${agent.status === "running" ? "animate-spin" : ""}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-gray-900">{agent.title}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-[11px] text-gray-400">{agent.model}</span>
                    <span className="text-gray-300">&middot;</span>
                    <span className="text-[11px] text-gray-400">{agent.duration}</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Agent detail */}
      <div className="flex flex-1 flex-col">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div>
            <h2 className="text-[15px] font-semibold text-gray-900">{selectedAgent.title}</h2>
            <div className="mt-1 flex items-center gap-3">
              <span className={`flex items-center gap-1 text-[12px] ${statusConfig[selectedAgent.status].color}`}>
                {statusConfig[selectedAgent.status].label}
              </span>
              {selectedAgent.branch && (
                <span className="rounded bg-gray-100 px-2 py-0.5 text-[11px] font-mono text-gray-600">
                  {selectedAgent.branch}
                </span>
              )}
              {selectedAgent.pr && (
                <span className="flex items-center gap-1 text-[12px] text-blue-600">
                  <ExternalLink size={11} />
                  PR {selectedAgent.pr}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {selectedAgent.status === "running" && (
              <button className="flex items-center gap-1.5 rounded-md border border-gray-200 px-3 py-1.5 text-[12px] font-medium text-gray-600 hover:bg-gray-50">
                <Pause size={12} />
                Pause
              </button>
            )}
            {selectedAgent.status === "failed" && (
              <button className="flex items-center gap-1.5 rounded-md bg-gray-900 px-3 py-1.5 text-[12px] font-medium text-white hover:bg-gray-800">
                <RotateCcw size={12} />
                Retry
              </button>
            )}
          </div>
        </div>

        {/* Steps timeline */}
        <div className="flex-1 overflow-auto p-6">
          <div className="space-y-4">
            <StepItem step={1} title="Analyzing task requirements" status="completed" detail="Parsed task description and identified 3 subtasks" />
            <StepItem step={2} title="Setting up environment" status="completed" detail="Installed dependencies, created branch feat/landing" />
            <StepItem step={3} title="Creating component structure" status="completed" detail="Created 5 new files in src/components/" />
            <StepItem step={4} title="Implementing Hero section" status="completed" detail="Added responsive hero with gradient text and CTA" />
            <StepItem step={5} title="Building feature cards" status={selectedAgent.status === "running" ? "running" : "completed"} detail="Writing feature grid with interactive demos" />
            {selectedAgent.steps > 5 && (
              <>
                <StepItem step={6} title="Running tests" status={selectedAgent.status === "completed" ? "completed" : "pending"} detail="npm test — 24 passed" />
                <StepItem step={7} title="Creating PR" status={selectedAgent.status === "completed" ? "completed" : "pending"} detail="Opened PR #142 with description" />
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StepItem({ step, title, status, detail }: { step: number; title: string; status: string; detail: string }) {
  return (
    <div className="flex gap-4">
      <div className="flex flex-col items-center">
        <div className={`flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-medium ${
          status === "completed" ? "bg-green-100 text-green-700" :
          status === "running" ? "bg-blue-100 text-blue-700" :
          "bg-gray-100 text-gray-400"
        }`}>
          {status === "completed" ? "✓" : status === "running" ? "•" : step}
        </div>
        <div className="mt-1 h-full w-px bg-gray-100" />
      </div>
      <div className="pb-6">
        <p className={`text-[13px] font-medium ${status === "pending" ? "text-gray-400" : "text-gray-900"}`}>{title}</p>
        <p className="mt-0.5 text-[12px] text-gray-500">{detail}</p>
      </div>
    </div>
  );
}
