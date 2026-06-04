"use client";

import Link from "next/link";

export default function Hero() {
  return (
    <section className="px-6 pb-16 pt-24 md:pb-24 md:pt-36">
      <div className="mx-auto max-w-[1100px]">
        {/* Headline */}
        <h1 className="max-w-4xl text-[2.75rem] font-medium leading-[1.15] tracking-tight text-[#0F172A] md:text-[3.5rem] lg:text-[4rem]">
          Built to make you extraordinarily productive, Teskel is the best coding agent.
        </h1>

        {/* CTA */}
        <div className="mt-10 flex flex-wrap items-center gap-4">
          <Link
            href="/download"
            className="inline-flex items-center gap-2 rounded-full bg-[#0F172A] px-6 py-3 text-[15px] font-medium text-white transition-colors hover:bg-[#1E293B]"
          >
            Download for free
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="opacity-80">
              <path d="M8 12L8 3M8 12L4 8M8 12L12 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </Link>
          <Link
            href="/enterprise"
            className="inline-flex items-center gap-2 rounded-full border border-[#E5E7EB] bg-white px-6 py-3 text-[15px] font-medium text-[#0F172A] transition-all hover:border-[#D1D5DB] hover:shadow-sm"
          >
            Request a demo
            <span className="text-gray-400">&rarr;</span>
          </Link>
        </div>

        {/* Product Demo - full width realistic IDE */}
        <div className="mt-16 overflow-hidden rounded-xl border border-[#E5E7EB] bg-white shadow-xl shadow-gray-200/50 md:mt-20">
          {/* Top bar */}
          <div className="flex items-center justify-between border-b border-gray-100 bg-[#FAFAFA] px-4 py-2.5">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-1.5">
                <div className="h-3 w-3 rounded-full bg-[#FF5F57]" />
                <div className="h-3 w-3 rounded-full bg-[#FEBC2E]" />
                <div className="h-3 w-3 rounded-full bg-[#28C840]" />
              </div>
              <span className="text-[13px] font-medium text-gray-500">Teskel Desktop</span>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-[11px] text-gray-400">Get Teskel</span>
              <span className="text-gray-300">&#8943;</span>
            </div>
          </div>

          <div className="flex min-h-[420px] md:min-h-[500px]">
            {/* Sidebar - task list */}
            <div className="hidden w-[260px] border-r border-gray-100 bg-[#FAFAFA] p-4 md:block">
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400">In Progress 3</p>
              <TaskItem label="Build Landing Page" status="Reading docs" spinning />
              <TaskItem label="Analyze Tab vs Agent Usage" status="Fetching data" spinning />
              <TaskItem label="Plan Mission Control" status="Generating plan" spinning />

              <p className="mb-3 mt-6 text-[11px] font-semibold uppercase tracking-wider text-gray-400">Ready for Review 3</p>
              <ReviewItem label="PyTorch MNIST Experiments" time="10m" />
              <ReviewItem label="Set up Teskel Rules for Dash..." time="30m" />
              <ReviewItem label="Bioinformatics Tools" time="45m" changes="+135 -21" />
            </div>

            {/* Main area */}
            <div className="flex flex-1 flex-col">
              {/* Task header */}
              <div className="border-b border-gray-100 px-6 py-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-[15px] font-semibold text-gray-900">Build Landing Page</h3>
                  <div className="flex items-center gap-2">
                    <button className="rounded-md border border-gray-200 px-2.5 py-1 text-[11px] font-medium text-gray-500 hover:bg-gray-50">Browser</button>
                    <button className="rounded-md border border-gray-200 px-2.5 py-1 text-[11px] font-medium text-gray-500 hover:bg-gray-50">Terminal</button>
                  </div>
                </div>
                <div className="mt-3 rounded-lg bg-gray-50 px-4 py-3">
                  <p className="text-[13px] text-gray-600">make a landing page based on attached docs explaining what we do</p>
                </div>
              </div>

              {/* Browser preview */}
              <div className="flex-1 p-6">
                <div className="h-full overflow-hidden rounded-lg border border-gray-200">
                  {/* URL bar */}
                  <div className="flex items-center gap-2 border-b border-gray-100 bg-[#FAFAFA] px-3 py-2">
                    <div className="flex gap-1">
                      <div className="h-1.5 w-1.5 rounded-full bg-gray-300" />
                      <div className="h-1.5 w-1.5 rounded-full bg-gray-300" />
                      <div className="h-1.5 w-1.5 rounded-full bg-gray-300" />
                    </div>
                    <div className="flex-1 rounded bg-white px-3 py-1 text-center text-[11px] text-gray-400 ring-1 ring-gray-200">
                      http://localhost:3000
                    </div>
                  </div>
                  {/* Page content */}
                  <div className="bg-white p-8">
                    <p className="font-serif text-xl font-medium text-gray-800">Acme Labs</p>
                    <p className="mt-4 max-w-md text-[14px] leading-relaxed text-gray-600">
                      Software creation is changing. We are a group of researchers,
                      engineers, and technologists inventing at the edge of what&apos;s useful and possible.
                    </p>
                    <p className="mt-2 text-[14px] text-gray-600">We have much to learn, try, and build.</p>
                    <button className="mt-5 text-[14px] font-medium text-gray-800 underline underline-offset-4 hover:text-blue-600">
                      See projects
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Right panel - CLI */}
            <div className="hidden w-[320px] border-l border-gray-100 bg-[#0B0F19] p-5 lg:block">
              <div className="mb-3 flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-green-500" />
                <span className="text-[12px] font-medium text-gray-400">Teskel CLI</span>
              </div>
              <div className="mt-4">
                <p className="text-[13px] font-semibold text-white">Teskel Agent</p>
                <p className="text-[11px] text-gray-500">~/teskel/project-web</p>
              </div>
              <div className="mt-4 rounded-lg bg-gray-800/50 p-3">
                <p className="text-[12px] font-medium text-gray-200">Analyze Tab vs Agent Usage Patterns</p>
                <p className="mt-2 text-[11px] leading-relaxed text-gray-400">
                  Help me understand how teams split their focus between the tab view and the agents panel across our workspaces.
                </p>
              </div>
              <div className="mt-4 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-gray-500" />
                  <span className="text-[11px] text-gray-400">Thought 7s</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-green-500" />
                  <span className="text-[11px] text-gray-400">Reading workspace usage exports...</span>
                </div>
              </div>
              <div className="mt-6 rounded-lg border border-gray-700 px-3 py-2">
                <span className="text-[11px] text-gray-500">Add a follow-up</span>
              </div>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="flex items-center justify-between border-t border-gray-100 bg-[#FAFAFA] px-4 py-2">
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-gray-400">Plan, search, build anything...</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="rounded border border-gray-200 px-2 py-0.5 text-[10px] font-medium text-gray-500">Agent</span>
              <span className="text-[10px] text-gray-400">Composer 2.5</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function TaskItem({ label, status, spinning }: { label: string; status: string; spinning?: boolean }) {
  return (
    <div className="mb-2 flex items-start gap-2.5 rounded-lg p-2 transition-colors hover:bg-white">
      {spinning ? (
        <div className="mt-0.5 h-4 w-4 animate-spin rounded-full border-[1.5px] border-blue-500 border-t-transparent" />
      ) : (
        <div className="mt-0.5 h-4 w-4 rounded-full border-[1.5px] border-gray-300" />
      )}
      <div>
        <p className="text-[13px] font-medium text-gray-800">{label}</p>
        <p className="text-[11px] text-gray-400">{status}</p>
      </div>
    </div>
  );
}

function ReviewItem({ label, time, changes }: { label: string; time: string; changes?: string }) {
  return (
    <div className="mb-2 flex items-start gap-2.5 rounded-lg p-2 transition-colors hover:bg-white">
      <div className="mt-0.5 h-4 w-4 rounded-full border-[1.5px] border-green-500" />
      <div className="flex flex-1 items-start justify-between">
        <div>
          <p className="text-[13px] font-medium text-gray-800">{label}</p>
          {changes && <p className="text-[11px] text-gray-400">{changes}</p>}
        </div>
        <span className="text-[11px] text-gray-400">{time}</span>
      </div>
    </div>
  );
}
