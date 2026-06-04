"use client";

import { useState } from "react";
import { Bold, Italic, List, Code, Link2, Image, Undo2, Redo2, Sparkles, Download, Share2 } from "lucide-react";

export default function CanvasPage() {
  const [title, setTitle] = useState("Project Technical Specification");
  const [aiSuggestion, setAiSuggestion] = useState(true);

  return (
    <div className="flex h-full">
      {/* Main editor */}
      <div className="flex flex-1 flex-col">
        {/* Toolbar */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-2">
          <div className="flex items-center gap-1">
            <ToolbarButton icon={Undo2} label="Undo" />
            <ToolbarButton icon={Redo2} label="Redo" />
            <div className="mx-2 h-5 w-px bg-gray-200" />
            <ToolbarButton icon={Bold} label="Bold" />
            <ToolbarButton icon={Italic} label="Italic" />
            <ToolbarButton icon={Code} label="Code" />
            <div className="mx-2 h-5 w-px bg-gray-200" />
            <ToolbarButton icon={List} label="List" />
            <ToolbarButton icon={Link2} label="Link" />
            <ToolbarButton icon={Image} label="Image" />
          </div>
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-1.5 rounded-md border border-gray-200 px-3 py-1.5 text-[12px] font-medium text-gray-600 hover:bg-gray-50">
              <Share2 size={12} />
              Share
            </button>
            <button className="flex items-center gap-1.5 rounded-md border border-gray-200 px-3 py-1.5 text-[12px] font-medium text-gray-600 hover:bg-gray-50">
              <Download size={12} />
              Export
            </button>
            <button
              onClick={() => setAiSuggestion(!aiSuggestion)}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors ${
                aiSuggestion ? "bg-blue-600 text-white" : "border border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              <Sparkles size={12} />
              AI Assist
            </button>
          </div>
        </div>

        {/* Document */}
        <div className="flex-1 overflow-auto px-16 py-10">
          <div className="mx-auto max-w-2xl">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full border-none text-[28px] font-semibold text-gray-900 outline-none placeholder:text-gray-300"
              placeholder="Untitled Document"
            />

            <div className="mt-8 space-y-6 text-[15px] leading-7 text-gray-700">
              <div>
                <h2 className="mb-2 text-[18px] font-semibold text-gray-900">Overview</h2>
                <p>
                  Teskel is a next-generation AI coding platform that combines intelligent code completion,
                  autonomous agents, and collaborative tools into a unified development environment.
                </p>
              </div>

              <div>
                <h2 className="mb-2 text-[18px] font-semibold text-gray-900">Architecture</h2>
                <p>
                  The system is built on a microservices architecture with the following core components:
                </p>
                <ul className="mt-3 list-inside list-disc space-y-1.5 text-[14px] text-gray-600">
                  <li>Frontend: Next.js 16 with React 19 and Server Components</li>
                  <li>API Layer: FastAPI with async PostgreSQL connections</li>
                  <li>Agent Runtime: Sandboxed execution environments with Docker</li>
                  <li>AI Pipeline: Multi-model routing with fallback strategies</li>
                  <li>Real-time: WebSocket connections for live collaboration</li>
                </ul>
              </div>

              <div>
                <h2 className="mb-2 text-[18px] font-semibold text-gray-900">Key Decisions</h2>
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 font-mono text-[13px] text-gray-700">
                  <p className="font-sans font-medium text-gray-900">Model Selection Strategy</p>
                  <p className="mt-2">
                    Use routing model to select optimal model per task:<br />
                    - Simple completions → Fast model (low latency)<br />
                    - Complex reasoning → Opus/GPT (high accuracy)<br />
                    - Code generation → Composer (multi-file aware)
                  </p>
                </div>
              </div>

              {/* AI suggestion */}
              {aiSuggestion && (
                <div className="rounded-lg border border-blue-100 bg-blue-50/50 p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <Sparkles size={14} className="text-blue-600" />
                    <span className="text-[12px] font-medium text-blue-700">AI Suggestion</span>
                  </div>
                  <p className="text-[14px] leading-relaxed text-blue-800/80">
                    Consider adding a section on Security & Compliance. Based on the architecture described,
                    you should document: authentication flow (JWT + refresh tokens), data encryption at rest
                    and in transit, SOC 2 compliance measures, and API rate limiting strategy.
                  </p>
                  <div className="mt-3 flex gap-2">
                    <button className="rounded-md bg-blue-600 px-3 py-1 text-[12px] font-medium text-white hover:bg-blue-700">
                      Accept
                    </button>
                    <button className="rounded-md border border-blue-200 px-3 py-1 text-[12px] font-medium text-blue-700 hover:bg-blue-100">
                      Dismiss
                    </button>
                  </div>
                </div>
              )}

              <div>
                <h2 className="mb-2 text-[18px] font-semibold text-gray-900">Timeline</h2>
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="py-2 text-left font-medium text-gray-500">Phase</th>
                      <th className="py-2 text-left font-medium text-gray-500">Duration</th>
                      <th className="py-2 text-left font-medium text-gray-500">Status</th>
                    </tr>
                  </thead>
                  <tbody className="text-gray-700">
                    <tr className="border-b border-gray-100">
                      <td className="py-2">Core Editor</td>
                      <td className="py-2">4 weeks</td>
                      <td className="py-2"><span className="rounded bg-green-100 px-1.5 py-0.5 text-[11px] font-medium text-green-700">Complete</span></td>
                    </tr>
                    <tr className="border-b border-gray-100">
                      <td className="py-2">Agent System</td>
                      <td className="py-2">6 weeks</td>
                      <td className="py-2"><span className="rounded bg-blue-100 px-1.5 py-0.5 text-[11px] font-medium text-blue-700">In Progress</span></td>
                    </tr>
                    <tr className="border-b border-gray-100">
                      <td className="py-2">MCP Integrations</td>
                      <td className="py-2">3 weeks</td>
                      <td className="py-2"><span className="rounded bg-gray-100 px-1.5 py-0.5 text-[11px] font-medium text-gray-600">Planned</span></td>
                    </tr>
                    <tr>
                      <td className="py-2">Enterprise Features</td>
                      <td className="py-2">4 weeks</td>
                      <td className="py-2"><span className="rounded bg-gray-100 px-1.5 py-0.5 text-[11px] font-medium text-gray-600">Planned</span></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ToolbarButton({ icon: Icon, label }: { icon: typeof Bold; label: string }) {
  return (
    <button
      className="rounded-md p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
      title={label}
    >
      <Icon size={16} />
    </button>
  );
}
