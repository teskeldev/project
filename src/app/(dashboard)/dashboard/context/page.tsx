"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Brain, BookOpen, FileText, Zap, TerminalSquare, Loader2 } from "lucide-react";
import KnowledgeTab from "./tabs/KnowledgeTab";
import RulesTab from "./tabs/RulesTab";
import SkillsTab from "./tabs/SkillsTab";
import CommandsTab from "./tabs/CommandsTab";

type ContextTab = "knowledge" | "rules" | "skills" | "commands";

const TABS: { id: ContextTab; label: string; icon: React.ElementType }[] = [
  { id: "knowledge", label: "Knowledge", icon: BookOpen },
  { id: "rules", label: "Rules", icon: FileText },
  { id: "skills", label: "Skills", icon: Zap },
  { id: "commands", label: "Commands", icon: TerminalSquare },
];

function ContextInner() {
  const router = useRouter();
  const params = useSearchParams();
  const tab = (params.get("tab") ?? "knowledge") as ContextTab;

  return (
    <div className="flex h-full flex-col">
      {/* Header with tab nav */}
      <div className="flex-none border-b border-border bg-surface">
        <div className="flex items-center gap-2 px-6 pt-5">
          <Brain size={18} className="text-accent" />
          <h1 className="text-lg font-semibold text-foreground">Context</h1>
        </div>
        <nav className="flex gap-0 px-6 pt-2">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => router.push(`/dashboard/context?tab=${t.id}`, { scroll: false })}
              className={`relative flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors ${
                tab === t.id
                  ? "text-accent"
                  : "text-text-secondary hover:text-foreground"
              }`}
            >
              <t.icon size={14} />
              {t.label}
              {tab === t.id && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent" />
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content — fills remaining height */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        {tab === "knowledge" && <KnowledgeTab />}
        {tab === "rules" && <RulesTab />}
        {tab === "skills" && <SkillsTab />}
        {tab === "commands" && <CommandsTab />}
      </div>
    </div>
  );
}

export default function ContextPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-full items-center justify-center">
          <Loader2 size={20} className="animate-spin text-text-muted" />
        </div>
      }
    >
      <ContextInner />
    </Suspense>
  );
}
