import Link from "next/link";
import { Button } from "@/components/ui";

export default function Hero() {
  return (
    <section className="px-6 pb-16 pt-24 md:pb-24 md:pt-36">
      <div className="mx-auto max-w-[1100px]">
        {/* Eyebrow */}
        <div className="animate-fade-in-down mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-[12px] font-medium text-text-secondary shadow-sm">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--ai)] opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--ai)]" />
          </span>
          The living AI workspace
        </div>

        {/* Headline — owned, not borrowed */}
        <h1 className="animate-fade-in-up max-w-4xl text-[2.75rem] font-medium leading-[1.12] tracking-tight text-foreground md:text-[3.5rem] lg:text-[4rem]">
          Your codebase, alive.
          <br />
          <span className="text-text-secondary">Teskel works alongside you.</span>
        </h1>

        <p className="animate-fade-in-up stagger-2 mt-6 max-w-2xl text-[17px] leading-relaxed text-text-secondary">
          A bright, light-first workspace where AI agents plan, build, and review
          in the open — so you always see what they&apos;re thinking, what they
          touch, and what needs your sign-off.
        </p>

        {/* CTA */}
        <div className="animate-fade-in-up stagger-3 mt-10 flex flex-wrap items-center gap-4">
          <Button asChild size="lg" className="rounded-full px-6 py-3 text-[15px]">
            <Link href="/download" className="inline-flex items-center gap-2">
              Start building free
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="opacity-80">
                <path d="M8 12L8 3M8 12L4 8M8 12L12 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="rounded-full px-6 py-3 text-[15px]">
            <Link href="/enterprise" className="inline-flex items-center gap-2">
              Request a demo
              <span className="text-text-muted">&rarr;</span>
            </Link>
          </Button>
        </div>

        {/* Living Workspace preview — Teskel's signature: light canvas,
            an Agent Lane of live workers, awareness + approval surfaced. */}
        <div className="animate-fade-in-up stagger-4 mt-16 overflow-hidden rounded-2xl border border-border bg-surface shadow-xl shadow-border/40 md:mt-20">
          {/* Top bar */}
          <div className="flex items-center justify-between border-b border-border bg-surface-soft px-4 py-2.5">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-1.5">
                <div className="h-3 w-3 rounded-full bg-[#FF5F57]" />
                <div className="h-3 w-3 rounded-full bg-[#FEBC2E]" />
                <div className="h-3 w-3 rounded-full bg-[#28C840]" />
              </div>
              <span className="text-[13px] font-medium text-text-secondary">Teskel — acme-web</span>
            </div>
            {/* Context-aware bar: shows what the AI currently sees */}
            <div className="hidden items-center gap-2 rounded-full bg-[var(--ai-soft)] px-3 py-1 md:flex">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--ai)]" />
              <span className="text-[11px] font-medium text-[var(--ai)]">Context: 3 files · main · 2.8k tokens</span>
            </div>
          </div>

          {/* Agent Lane — live workers */}
          <div className="flex items-center gap-3 border-b border-border bg-surface px-5 py-3">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">Agents</span>
            <AgentNode label="Build landing" state="running" />
            <AgentNode label="Add auth" state="running" />
            <AgentNode label="Refactor API" state="review" />
            <span className="ml-auto text-[11px] text-text-muted">2 running · 1 awaiting review</span>
          </div>

          <div className="flex min-h-[420px] md:min-h-[480px]">
            {/* File explorer w/ awareness layer */}
            <div className="hidden w-[240px] border-r border-border bg-surface-soft p-4 md:block">
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-text-muted">Explorer</p>
              <FileRow name="app/" depth={0} folder />
              <FileRow name="page.tsx" depth={1} aware />
              <FileRow name="hero.tsx" depth={1} aware />
              <FileRow name="ui/" depth={0} folder />
              <FileRow name="button.tsx" depth={1} />
              <FileRow name="card.tsx" depth={1} />
              <div className="mt-4 rounded-lg border border-[var(--ai)]/30 bg-[var(--ai-soft)] px-3 py-2">
                <p className="text-[10px] font-medium text-[var(--ai)]">Awareness layer</p>
                <p className="mt-0.5 text-[11px] text-text-secondary">2 files in agent context</p>
              </div>
            </div>

            {/* Main: AI thinking + tool calls */}
            <div className="flex flex-1 flex-col">
              <div className="border-b border-border px-6 py-4">
                <h3 className="text-[15px] font-semibold text-foreground">Build Landing Page</h3>
                <div className="mt-3 flex items-start gap-2 rounded-lg bg-[var(--human-soft)] px-4 py-3">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--human)] text-[10px] font-bold text-white">Y</span>
                  <p className="text-[13px] text-text-secondary">make a landing page from the attached docs that explains what we do</p>
                </div>
              </div>

              <div className="flex-1 space-y-3 p-6">
                {/* Thinking */}
                <div className="flex items-center gap-2">
                  <ThinkingDots />
                  <span className="text-[12px] text-text-muted">Thinking — reading <span className="font-medium text-[var(--ai)]">page.tsx</span></span>
                </div>

                {/* Tool-call cards */}
                <ToolCall icon="read" title="Read 3 files" detail="page.tsx · hero.tsx · docs/brand.md" />
                <ToolCall icon="edit" title="Edit page.tsx" detail="+34 −6" />
                <ToolCall icon="run" title="Run dev server" detail="localhost:3000 ready" />
              </div>
            </div>

            {/* Approval column */}
            <div className="hidden w-[280px] border-l border-border bg-surface p-5 lg:block">
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-text-muted">Awaiting review</p>
              <div className="ai-aura rounded-xl border border-border bg-surface p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-semibold text-foreground">Refactor API</span>
                  <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-600">review</span>
                </div>
                <p className="mt-2 text-[11px] leading-relaxed text-text-secondary">
                  Extracted route handlers into typed services. 4 files changed.
                </p>
                <div className="mt-3 flex items-center gap-2 text-[11px] font-medium">
                  <span className="text-[var(--success)]">+128</span>
                  <span className="text-[var(--danger)]">−54</span>
                </div>
                <div className="mt-4 flex gap-2">
                  <button className="flex-1 rounded-lg bg-[var(--human)] px-3 py-1.5 text-[12px] font-medium text-white">Approve</button>
                  <button className="rounded-lg border border-border px-3 py-1.5 text-[12px] font-medium text-text-secondary">Reject</button>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="flex items-center justify-between border-t border-border bg-surface-soft px-4 py-2">
            <span className="text-[11px] text-text-muted">Plan, build, review — together.</span>
            <div className="flex items-center gap-3">
              <span className="rounded border border-border px-2 py-0.5 text-[10px] font-medium text-text-secondary">Agent</span>
              <span className="text-[10px] text-text-muted">Auto</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function AgentNode({ label, state }: { label: string; state: "running" | "review" | "done" }) {
  const ring =
    state === "running"
      ? "border-[var(--ai)] ai-breathe"
      : state === "review"
      ? "border-amber-400"
      : "border-[var(--success)]";
  const dot =
    state === "running" ? "bg-[var(--ai)]" : state === "review" ? "bg-amber-400" : "bg-[var(--success)]";
  return (
    <div className="flex items-center gap-2 rounded-full border border-border bg-surface-soft py-1 pl-1 pr-3">
      <span className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${ring}`}>
        <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      </span>
      <span className="text-[11px] font-medium text-text-secondary">{label}</span>
    </div>
  );
}

function ThinkingDots() {
  return (
    <span className="flex items-center gap-1">
      <span className="thinking-dot h-1.5 w-1.5 rounded-full bg-[var(--ai)]" style={{ animationDelay: "0s" }} />
      <span className="thinking-dot h-1.5 w-1.5 rounded-full bg-[var(--ai)]" style={{ animationDelay: "0.15s" }} />
      <span className="thinking-dot h-1.5 w-1.5 rounded-full bg-[var(--ai)]" style={{ animationDelay: "0.3s" }} />
    </span>
  );
}

function ToolCall({ icon, title, detail }: { icon: "read" | "edit" | "run"; title: string; detail: string }) {
  const glyph = icon === "read" ? "⌕" : icon === "edit" ? "✎" : "▸";
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-surface-soft px-3 py-2">
      <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[var(--ai-soft)] text-[12px] text-[var(--ai)]">{glyph}</span>
      <div className="min-w-0">
        <p className="text-[12px] font-medium text-foreground">{title}</p>
        <p className="truncate text-[11px] text-text-muted">{detail}</p>
      </div>
    </div>
  );
}

function FileRow({ name, depth, folder, aware }: { name: string; depth: number; folder?: boolean; aware?: boolean }) {
  return (
    <div
      className={`flex items-center gap-2 rounded-md py-1 text-[12px] ${
        aware ? "border-l-2 border-[var(--ai)] bg-[var(--ai-soft)] pl-2" : "pl-2"
      }`}
      style={{ marginLeft: depth * 12 }}
    >
      <span className="text-text-muted">{folder ? "▸" : ""}</span>
      <span className={aware ? "font-medium text-[var(--ai)]" : "text-text-secondary"}>{name}</span>
    </div>
  );
}
