import Link from "next/link";

export default function EditorDemo() {
  return (
    <section className="px-6 py-20 md:py-28">
      <div className="mx-auto max-w-[1100px]">
        {/* Section: Agents */}
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <h2 className="text-[1.75rem] font-medium leading-tight tracking-tight text-foreground md:text-[2.25rem]">
              Agents turn ideas into code
            </h2>
            <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-text-secondary">
              Accelerate development by handing off tasks to Teskel, while you focus on making decisions.
            </p>
            <Link href="/#product" className="mt-6 inline-flex items-center gap-1.5 text-[15px] font-medium text-foreground hover:text-accent">
              Learn about agentic development <span className="text-text-muted">&rarr;</span>
            </Link>
          </div>

          {/* IDE demo */}
          <div className="overflow-hidden rounded-xl border border-border bg-editor-bg shadow-lg dark:border-editor-border">
            {/* Title bar */}
            <div className="flex items-center justify-between border-b border-editor-border bg-[#0D1117] px-4 py-2.5">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <div className="h-2.5 w-2.5 rounded-full bg-[#FF5F57]" />
                  <div className="h-2.5 w-2.5 rounded-full bg-[#FEBC2E]" />
                  <div className="h-2.5 w-2.5 rounded-full bg-[#28C840]" />
                </div>
                <span className="text-[11px] text-text-muted">Teskel</span>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-editor-border bg-[#0D1117]">
              <div className="border-b border-b-accent bg-editor-bg px-4 py-2 text-[12px] text-white">
                feature-prd.md
              </div>
              <div className="px-4 py-2 text-[12px] text-text-muted">
                presence.ts
              </div>
            </div>

            {/* Content split */}
            <div className="flex">
              {/* Editor content */}
              <div className="flex-1 p-5 font-mono text-[12px] leading-6 text-gray-300">
                <p className="text-white font-semibold text-[14px] font-sans">Mission Control Interface</p>
                <p className="mt-3 text-text-muted font-sans text-[12px] leading-relaxed">
                  A grid view of all open windows as scaled previews, allowing quick selection to bring any window to front.
                </p>
                <p className="mt-4 text-white font-medium text-[13px] font-sans">Trigger</p>
                <p className="mt-1 text-text-muted font-sans text-[12px]">
                  Menu item in MenuBar.tsx (View &gt; Mission Control), hotkey F3.
                </p>
                <p className="mt-4 text-white font-medium text-[13px] font-sans">View Behavior</p>
                <p className="mt-1 text-text-muted font-sans text-[12px]">
                  Overlay existing windows into a grid of live previews with spring-based layout animations.
                </p>
              </div>

              {/* Plan panel */}
              <div className="w-[220px] border-l border-editor-border p-4">
                <p className="text-[11px] font-semibold text-text-muted">Plans</p>
                <div className="mt-3 space-y-2">
                  <p className="text-[11px] font-medium text-gray-300">3 Tasks</p>
                  <div className="rounded bg-editor-border/50 px-2.5 py-2 text-[11px] text-text-muted">
                    Add multiplayer mode to useAppStore.ts
                  </div>
                  <div className="rounded bg-editor-border/50 px-2.5 py-2 text-[11px] text-text-muted">
                    Create MissionControlView.tsx
                  </div>
                  <div className="rounded bg-editor-border/50 px-2.5 py-2 text-[11px] text-text-muted">
                    Update AppManager.tsx
                  </div>
                </div>
              </div>
            </div>

            {/* Input bar */}
            <div className="border-t border-editor-border bg-[#0D1117] px-4 py-3">
              <div className="flex items-center justify-between rounded-lg border border-editor-border bg-editor-bg px-3 py-2">
                <span className="text-[12px] text-text-muted">Plan, search, build anything...</span>
                <div className="flex items-center gap-2">
                  <span className="rounded bg-editor-border px-2 py-0.5 text-[10px] text-text-muted">Plan</span>
                  <span className="text-[10px] text-text-muted">Composer 2.5</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Section: Tab autocomplete */}
        <div className="mt-24 grid items-center gap-12 lg:grid-cols-2">
          {/* Editor with ghost text */}
          <div className="order-2 overflow-hidden rounded-xl border border-border bg-editor-bg shadow-lg lg:order-1 dark:border-editor-border">
            <div className="flex items-center gap-4 border-b border-editor-border bg-[#0D1117] px-4 py-2.5">
              <div className="flex items-center gap-1.5">
                <div className="h-2.5 w-2.5 rounded-full bg-[#FF5F57]" />
                <div className="h-2.5 w-2.5 rounded-full bg-[#FEBC2E]" />
                <div className="h-2.5 w-2.5 rounded-full bg-[#28C840]" />
              </div>
              <span className="text-[11px] text-text-muted">Teskel</span>
            </div>

            <div className="flex border-b border-editor-border">
              <div className="border-b border-b-accent bg-editor-bg px-4 py-2 text-[12px] text-white">Dashboard.tsx</div>
              <div className="px-4 py-2 text-[12px] text-text-muted">SupportChat.tsx</div>
            </div>

            <div className="p-5 font-mono text-[12px] leading-7">
              <div><span className="text-green-400">&quot;use client&quot;</span>;</div>
              <div className="mt-1"><span className="text-purple-400">import</span> React, {"{ useState }"} <span className="text-purple-400">from</span> <span className="text-green-400">&quot;react&quot;</span>;</div>
              <div><span className="text-purple-400">import</span> Navigation <span className="text-purple-400">from</span> <span className="text-green-400">&quot;./Navigation&quot;</span>;</div>
              <div><span className="text-purple-400">import</span> SupportChat <span className="text-purple-400">from</span> <span className="text-green-400">&quot;./SupportChat&quot;</span>;</div>
              <div className="mt-2"><span className="text-blue-400">export default function</span> <span className="text-yellow-300">Dashboard</span>() {"{"}</div>
              <div className="ml-4"><span className="text-purple-400">const</span> [activeTab, setActiveTab] = <span className="text-yellow-300">useState</span>(<span className="text-green-400">&quot;support&quot;</span>);</div>
              <div className="ml-4 mt-1"><span className="text-purple-400">return</span> (</div>
              <div className="ml-8"><span className="text-gray-300">&lt;div className=&quot;flex h-[600px] border rounded-lg&quot;&gt;</span></div>
              <div className="ml-12"><span className="text-gray-300">&lt;div className=&quot;w-64 border-r&quot;&gt;</span></div>

              {/* Ghost suggestion */}
              <div className="ml-16 flex items-center gap-3">
                <span className="text-text-muted">&lt;Navigation activeTab={"{activeTab}"} /&gt;</span>
                <span className="rounded border border-editor-border bg-editor-border px-2 py-0.5 text-[10px] font-medium text-accent">Tab</span>
              </div>

              <div className="ml-12"><span className="text-gray-300">&lt;/div&gt;</span></div>
              <div className="ml-8"><span className="text-gray-300">&lt;/div&gt;</span></div>
              <div className="ml-4">);</div>
              <div>{"}"}</div>
            </div>
          </div>

          {/* Description */}
          <div className="order-1 lg:order-2">
            <h2 className="text-[1.75rem] font-medium leading-tight tracking-tight text-foreground md:text-[2.25rem]">
              Magically accurate autocomplete
            </h2>
            <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-text-secondary">
              Our specialized Tab model predicts your next action with striking speed and precision.
            </p>
            <Link href="/#product" className="mt-6 inline-flex items-center gap-1.5 text-[15px] font-medium text-foreground hover:text-accent">
              Learn about Tab <span className="text-text-muted">&rarr;</span>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
