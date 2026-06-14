import Link from "next/link";
import { Button } from "@/components/ui";

export default function Hero() {
  return (
    <section className="px-6 pb-16 pt-24 md:pb-24 md:pt-36">
      <div className="mx-auto max-w-[1100px]">
        {/* Headline */}
        <h1 className="max-w-4xl text-[2.75rem] font-medium leading-[1.15] tracking-tight text-foreground md:text-[3.5rem] lg:text-[4rem]">
          Built to make you extraordinarily productive, Teskel is the best coding agent.
        </h1>

        {/* CTA */}
        <div className="mt-10 flex flex-wrap items-center gap-4">
          <Button asChild size="lg" className="rounded-full px-6 py-3 text-[15px]">
            <Link href="/download" className="inline-flex items-center gap-2">
              Download for free
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="opacity-80">
                <path d="M8 12L8 3M8 12L4 8M8 12L12 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
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

        {/* Product Demo - full width realistic IDE */}
        <div className="mt-16 overflow-hidden rounded-xl border border-border bg-surface shadow-xl shadow-border/50 dark:shadow-none md:mt-20">
          {/* Top bar */}
          <div className="flex items-center justify-between border-b border-border bg-surface-soft px-4 py-2.5">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-1.5">
                <div className="h-3 w-3 rounded-full bg-[#FF5F57]" />
                <div className="h-3 w-3 rounded-full bg-[#FEBC2E]" />
                <div className="h-3 w-3 rounded-full bg-[#28C840]" />
              </div>
              <span className="text-[13px] font-medium text-text-secondary">Teskel Desktop</span>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-[11px] text-text-muted">Get Teskel</span>
              <span className="text-text-muted">&#8943;</span>
            </div>
          </div>

          <div className="flex min-h-[420px] md:min-h-[500px]">
            {/* Sidebar - task list */}
            <div className="hidden w-[260px] border-r border-border bg-surface-soft p-4 md:block">
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-text-muted">In Progress 3</p>
              <TaskItem label="Build Landing Page" status="Reading docs" spinning />
              <TaskItem label="Analyze Tab vs Agent Usage" status="Fetching data" spinning />
              <TaskItem label="Plan Mission Control" status="Generating plan" spinning />

              <p className="mb-3 mt-6 text-[11px] font-semibold uppercase tracking-wider text-text-muted">Ready for Review 3</p>
              <ReviewItem label="PyTorch MNIST Experiments" time="10m" />
              <ReviewItem label="Set up Teskel Rules for Dash..." time="30m" />
              <ReviewItem label="Bioinformatics Tools" time="45m" changes="+135 -21" />
            </div>

            {/* Main area */}
            <div className="flex flex-1 flex-col">
              {/* Task header */}
              <div className="border-b border-border px-6 py-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-[15px] font-semibold text-foreground">Build Landing Page</h3>
                  <div className="flex items-center gap-2">
                    <button className="rounded-md border border-border px-2.5 py-1 text-[11px] font-medium text-text-secondary hover:bg-surface-soft">Browser</button>
                    <button className="rounded-md border border-border px-2.5 py-1 text-[11px] font-medium text-text-secondary hover:bg-surface-soft">Terminal</button>
                  </div>
                </div>
                <div className="mt-3 rounded-lg bg-surface-soft px-4 py-3">
                  <p className="text-[13px] text-text-secondary">make a landing page based on attached docs explaining what we do</p>
                </div>
              </div>

              {/* Browser preview */}
              <div className="flex-1 p-6">
                <div className="h-full overflow-hidden rounded-lg border border-border">
                  {/* URL bar */}
                  <div className="flex items-center gap-2 border-b border-border bg-surface-soft px-3 py-2">
                    <div className="flex gap-1">
                      <div className="h-1.5 w-1.5 rounded-full bg-text-muted" />
                      <div className="h-1.5 w-1.5 rounded-full bg-text-muted" />
                      <div className="h-1.5 w-1.5 rounded-full bg-text-muted" />
                    </div>
                    <div className="flex-1 rounded bg-surface px-3 py-1 text-center text-[11px] text-text-muted ring-1 ring-border">
                      http://localhost:3000
                    </div>
                  </div>
                  {/* Page content */}
                  <div className="bg-surface p-8">
                    <p className="font-serif text-xl font-medium text-foreground">Acme Labs</p>
                    <p className="mt-4 max-w-md text-[14px] leading-relaxed text-text-secondary">
                      Software creation is changing. We are a group of researchers,
                      engineers, and technologists inventing at the edge of what&apos;s useful and possible.
                    </p>
                    <p className="mt-2 text-[14px] text-text-secondary">We have much to learn, try, and build.</p>
                    <button className="mt-5 text-[14px] font-medium text-foreground underline underline-offset-4 hover:text-accent">
                      See projects
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Right panel - CLI */}
            <div className="hidden w-[320px] border-l border-border bg-editor-bg p-5 lg:block">
              <div className="mb-3 flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-green-500" />
                <span className="text-[12px] font-medium text-text-muted">Teskel CLI</span>
              </div>
              <div className="mt-4">
                <p className="text-[13px] font-semibold text-white">Teskel Agent</p>
                <p className="text-[11px] text-text-muted">~/teskel/project-web</p>
              </div>
              <div className="mt-4 rounded-lg bg-editor-border/50 p-3">
                <p className="text-[12px] font-medium text-gray-200">Analyze Tab vs Agent Usage Patterns</p>
                <p className="mt-2 text-[11px] leading-relaxed text-text-muted">
                  Help me understand how teams split their focus between the tab view and the agents panel across our workspaces.
                </p>
              </div>
              <div className="mt-4 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-text-muted" />
                  <span className="text-[11px] text-text-muted">Thought 7s</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-green-500" />
                  <span className="text-[11px] text-text-muted">Reading workspace usage exports...</span>
                </div>
              </div>
              <div className="mt-6 rounded-lg border border-editor-border px-3 py-2">
                <span className="text-[11px] text-text-muted">Add a follow-up</span>
              </div>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="flex items-center justify-between border-t border-border bg-surface-soft px-4 py-2">
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-text-muted">Plan, search, build anything...</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="rounded border border-border px-2 py-0.5 text-[10px] font-medium text-text-secondary">Agent</span>
              <span className="text-[10px] text-text-muted">Composer 2.5</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function TaskItem({ label, status, spinning }: { label: string; status: string; spinning?: boolean }) {
  return (
    <div className="mb-2 flex items-start gap-2.5 rounded-lg p-2 transition-colors hover:bg-surface">
      {spinning ? (
        <div className="mt-0.5 h-4 w-4 animate-spin rounded-full border-[1.5px] border-accent border-t-transparent" />
      ) : (
        <div className="mt-0.5 h-4 w-4 rounded-full border-[1.5px] border-text-muted" />
      )}
      <div>
        <p className="text-[13px] font-medium text-foreground">{label}</p>
        <p className="text-[11px] text-text-muted">{status}</p>
      </div>
    </div>
  );
}

function ReviewItem({ label, time, changes }: { label: string; time: string; changes?: string }) {
  return (
    <div className="mb-2 flex items-start gap-2.5 rounded-lg p-2 transition-colors hover:bg-surface">
      <div className="mt-0.5 h-4 w-4 rounded-full border-[1.5px] border-green-500" />
      <div className="flex flex-1 items-start justify-between">
        <div>
          <p className="text-[13px] font-medium text-foreground">{label}</p>
          {changes && <p className="text-[11px] text-text-muted">{changes}</p>}
        </div>
        <span className="text-[11px] text-text-muted">{time}</span>
      </div>
    </div>
  );
}
