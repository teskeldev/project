import Link from "next/link";

export default function Features() {
  return (
    <section id="product" className="px-6 py-20 md:py-28">
      <div className="mx-auto max-w-[1100px]">
        <h2 className="text-center text-[1.75rem] font-medium tracking-tight text-foreground md:text-[2.25rem]">
          Stay on the frontier
        </h2>

        {/* Feature grid */}
        <div className="mt-16 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* Use the best model */}
          <div className="rounded-xl border border-border bg-surface p-6 dark:bg-surface">
            <h3 className="text-[16px] font-semibold text-foreground">Use the best model for every task</h3>
            <p className="mt-2 text-[14px] leading-relaxed text-text-secondary">
              Choose between every cutting-edge model from OpenAI, Anthropic, Gemini, xAI, and Teskel.
            </p>
            <Link href="/docs" className="mt-4 inline-flex items-center gap-1 text-[13px] font-medium text-foreground hover:text-accent">
              Explore models <span className="text-[11px]">↗</span>
            </Link>
            {/* Model selector preview */}
            <div className="mt-5 overflow-hidden rounded-lg border border-border bg-surface-soft">
              <div className="space-y-0 divide-y divide-border">
                <ModelRow name="Auto" badge="Suggested" active />
                <ModelRow name="Composer 2.5" />
                <ModelRow name="GPT-5.5" />
                <ModelRow name="Opus 4.8" />
                <ModelRow name="Gemini 3.1 Pro" />
              </div>
            </div>
          </div>

          {/* Codebase understanding */}
          <div className="rounded-xl border border-border bg-surface p-6 dark:bg-surface">
            <h3 className="text-[16px] font-semibold text-foreground">Complete codebase understanding</h3>
            <p className="mt-2 text-[14px] leading-relaxed text-text-secondary">
              Teskel learns how your codebase works, no matter the scale or complexity.
            </p>
            <Link href="/docs" className="mt-4 inline-flex items-center gap-1 text-[13px] font-medium text-foreground hover:text-accent">
              Learn about codebase indexing <span className="text-[11px]">↗</span>
            </Link>
            {/* Index visualization */}
            <div className="mt-5 rounded-lg border border-editor-border bg-editor-bg p-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-green-500" />
                  <span className="text-[11px] text-text-muted">Indexed 2,847 files</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-accent" />
                  <span className="text-[11px] text-text-muted">Semantic search active</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-purple-500" />
                  <span className="text-[11px] text-text-muted">Context-aware completions</span>
                </div>
              </div>
              <div className="mt-4 rounded bg-editor-border/50 px-3 py-2">
                <span className="text-[12px] text-gray-300">Where are these menu label colors defined?</span>
              </div>
              <div className="mt-2 text-[11px] text-text-muted">Grepping...</div>
            </div>
          </div>

          {/* Enterprise */}
          <div className="rounded-xl border border-border bg-surface p-6 dark:bg-surface">
            <h3 className="text-[16px] font-semibold text-foreground">Develop enduring software</h3>
            <p className="mt-2 text-[14px] leading-relaxed text-text-secondary">
              Trusted by leading companies to accelerate development, securely and at scale.
            </p>
            <Link href="/enterprise" className="mt-4 inline-flex items-center gap-1 text-[13px] font-medium text-foreground hover:text-accent">
              Explore enterprise <span className="text-text-muted">&rarr;</span>
            </Link>
            {/* Security badges */}
            <div className="mt-5 space-y-3">
              <div className="flex items-center gap-3 rounded-lg border border-border bg-surface-soft px-4 py-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-50 dark:bg-green-950">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                </div>
                <div>
                  <p className="text-[12px] font-medium text-foreground">SOC 2 Certified</p>
                  <p className="text-[11px] text-text-muted">Enterprise-grade security</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-lg border border-border bg-surface-soft px-4 py-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-950">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </div>
                <div>
                  <p className="text-[12px] font-medium text-foreground">Zero data retention</p>
                  <p className="text-[11px] text-text-muted">Your code stays private</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-lg border border-border bg-surface-soft px-4 py-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-50 dark:bg-purple-950">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9333ea" strokeWidth="2">
                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                  </svg>
                </div>
                <div>
                  <p className="text-[12px] font-medium text-foreground">Self-hosted option</p>
                  <p className="text-[11px] text-text-muted">Run on your own infra</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ModelRow({ name, badge, active }: { name: string; badge?: string; active?: boolean }) {
  return (
    <div className={`flex items-center justify-between px-3 py-2.5 ${active ? "bg-surface" : ""}`}>
      <div className="flex items-center gap-2">
        <span className={`text-[13px] ${active ? "font-medium text-foreground" : "text-text-secondary"}`}>{name}</span>
        {badge && <span className="rounded bg-accent-light px-1.5 py-0.5 text-[10px] font-medium text-accent">{badge}</span>}
      </div>
      {active && <span className="text-[13px] text-accent">✓</span>}
    </div>
  );
}
