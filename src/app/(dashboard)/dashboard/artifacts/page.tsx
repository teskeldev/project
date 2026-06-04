"use client";

import { useState } from "react";
import { FileText, Code, BarChart3, Globe, Image, Play } from "lucide-react";

const artifactTypes = [
  { id: "code", icon: Code, label: "Code", color: "text-blue-600 bg-blue-50" },
  { id: "document", icon: FileText, label: "Document", color: "text-purple-600 bg-purple-50" },
  { id: "chart", icon: BarChart3, label: "Chart", color: "text-green-600 bg-green-50" },
  { id: "webapp", icon: Globe, label: "Web App", color: "text-orange-600 bg-orange-50" },
  { id: "image", icon: Image, label: "Image", color: "text-pink-600 bg-pink-50" },
];

const artifacts = [
  {
    id: 1,
    title: "Dashboard Component",
    type: "code",
    language: "tsx",
    preview: `export default function Dashboard() {\n  const [data, setData] = useState([]);\n  \n  useEffect(() => {\n    fetchAnalytics().then(setData);\n  }, []);\n\n  return (\n    <div className="grid grid-cols-3 gap-4">\n      {data.map(item => (\n        <MetricCard key={item.id} {...item} />\n      ))}\n    </div>\n  );\n}`,
    time: "2 min ago",
  },
  {
    id: 2,
    title: "API Documentation",
    type: "document",
    preview: "# Authentication API\n\n## POST /auth/login\n\nAuthenticates a user and returns a JWT token.\n\n### Request Body\n```json\n{\n  \"email\": \"user@example.com\",\n  \"password\": \"...\"\n}\n```",
    time: "5 min ago",
  },
  {
    id: 3,
    title: "Revenue Analytics",
    type: "chart",
    preview: "Monthly Revenue Chart — Q1 2026",
    time: "10 min ago",
  },
  {
    id: 4,
    title: "Interactive Form Builder",
    type: "webapp",
    preview: "Live preview of form builder component",
    time: "15 min ago",
  },
];

export default function ArtifactsPage() {
  const [activeArtifact, setActiveArtifact] = useState(artifacts[0]);
  const [activeType, setActiveType] = useState<string | null>(null);

  const filtered = activeType
    ? artifacts.filter((a) => a.type === activeType)
    : artifacts;

  return (
    <div className="flex h-full">
      {/* Artifact list */}
      <div className="w-[320px] border-r border-gray-100 bg-[#FAFAFA]">
        <div className="border-b border-gray-100 p-4">
          <h1 className="text-[15px] font-semibold text-gray-900">Artifacts</h1>
          <p className="mt-1 text-[12px] text-gray-500">
            AI-generated code, documents, and visualizations
          </p>
        </div>

        {/* Type filters */}
        <div className="flex gap-1 border-b border-gray-100 p-3">
          <button
            onClick={() => setActiveType(null)}
            className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
              !activeType ? "bg-gray-900 text-white" : "text-gray-500 hover:bg-gray-100"
            }`}
          >
            All
          </button>
          {artifactTypes.map((type) => (
            <button
              key={type.id}
              onClick={() => setActiveType(type.id)}
              className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
                activeType === type.id ? "bg-gray-900 text-white" : "text-gray-500 hover:bg-gray-100"
              }`}
            >
              {type.label}
            </button>
          ))}
        </div>

        {/* List */}
        <div className="space-y-1 p-2">
          {filtered.map((artifact) => {
            const typeInfo = artifactTypes.find((t) => t.id === artifact.type);
            const Icon = typeInfo?.icon || Code;
            return (
              <button
                key={artifact.id}
                onClick={() => setActiveArtifact(artifact)}
                className={`flex w-full items-start gap-3 rounded-lg p-3 text-left transition-colors ${
                  activeArtifact.id === artifact.id ? "bg-white shadow-sm" : "hover:bg-white/60"
                }`}
              >
                <div className={`mt-0.5 rounded-md p-1.5 ${typeInfo?.color}`}>
                  <Icon size={14} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-gray-900">{artifact.title}</p>
                  <p className="mt-0.5 text-[11px] text-gray-400">{artifact.time}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Preview area */}
      <div className="flex flex-1 flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-3">
          <div className="flex items-center gap-3">
            <h2 className="text-[14px] font-semibold text-gray-900">{activeArtifact.title}</h2>
            <span className="rounded bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-500">
              {activeArtifact.type}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button className="rounded-md border border-gray-200 px-3 py-1.5 text-[12px] font-medium text-gray-600 hover:bg-gray-50">
              Copy
            </button>
            <button className="rounded-md border border-gray-200 px-3 py-1.5 text-[12px] font-medium text-gray-600 hover:bg-gray-50">
              Download
            </button>
            {activeArtifact.type === "webapp" && (
              <button className="flex items-center gap-1.5 rounded-md bg-gray-900 px-3 py-1.5 text-[12px] font-medium text-white hover:bg-gray-800">
                <Play size={12} />
                Run
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {activeArtifact.type === "code" ? (
            <div className="overflow-hidden rounded-lg border border-gray-200 bg-[#0B0F19]">
              <div className="flex items-center justify-between border-b border-gray-800 px-4 py-2">
                <span className="text-[11px] text-gray-400">{(activeArtifact as typeof artifacts[0]).language}</span>
              </div>
              <pre className="overflow-x-auto p-4 font-mono text-[12px] leading-6 text-gray-300">
                {activeArtifact.preview}
              </pre>
            </div>
          ) : activeArtifact.type === "chart" ? (
            <div className="rounded-lg border border-gray-200 bg-white p-8">
              <p className="mb-4 text-[14px] font-medium text-gray-800">{activeArtifact.preview}</p>
              {/* Mock chart */}
              <div className="flex h-[300px] items-end gap-3">
                {[40, 65, 55, 80, 72, 90, 85, 95, 88, 100, 92, 110].map((h, i) => (
                  <div key={i} className="flex flex-1 flex-col items-center gap-1">
                    <div
                      className="w-full rounded-t bg-blue-500/80"
                      style={{ height: `${h}%` }}
                    />
                    <span className="text-[10px] text-gray-400">{["J","F","M","A","M","J","J","A","S","O","N","D"][i]}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : activeArtifact.type === "webapp" ? (
            <div className="overflow-hidden rounded-lg border border-gray-200">
              <div className="flex items-center gap-2 border-b border-gray-100 bg-[#FAFAFA] px-3 py-2">
                <div className="flex gap-1.5">
                  <div className="h-2.5 w-2.5 rounded-full bg-red-400" />
                  <div className="h-2.5 w-2.5 rounded-full bg-yellow-400" />
                  <div className="h-2.5 w-2.5 rounded-full bg-green-400" />
                </div>
                <div className="flex-1 rounded bg-white px-3 py-1 text-center text-[11px] text-gray-400 ring-1 ring-gray-200">
                  localhost:3000/form-builder
                </div>
              </div>
              <div className="bg-white p-8">
                <p className="text-[16px] font-medium text-gray-800">Form Builder</p>
                <div className="mt-4 space-y-3">
                  <div className="rounded-lg border border-gray-200 p-3">
                    <label className="text-[12px] font-medium text-gray-600">Full Name</label>
                    <div className="mt-1 h-8 rounded border border-gray-200 bg-gray-50" />
                  </div>
                  <div className="rounded-lg border border-gray-200 p-3">
                    <label className="text-[12px] font-medium text-gray-600">Email Address</label>
                    <div className="mt-1 h-8 rounded border border-gray-200 bg-gray-50" />
                  </div>
                  <button className="rounded-md bg-blue-600 px-4 py-2 text-[13px] font-medium text-white">
                    Submit
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-gray-200 bg-white p-6">
              <pre className="whitespace-pre-wrap font-mono text-[13px] leading-7 text-gray-700">
                {activeArtifact.preview}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
