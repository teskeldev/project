"use client";

import { useState } from "react";
import { GitPullRequest, MessageSquare, Check, X, ChevronDown, Plus, Minus } from "lucide-react";

interface ReviewFile {
  name: string;
  additions: number;
  deletions: number;
  status: "modified" | "added" | "deleted";
}

interface ReviewComment {
  id: number;
  file: string;
  line: number;
  author: string;
  content: string;
  suggestion?: string;
  resolved: boolean;
}

const files: ReviewFile[] = [
  { name: "src/components/Hero.tsx", additions: 45, deletions: 12, status: "modified" },
  { name: "src/components/Features.tsx", additions: 88, deletions: 34, status: "modified" },
  { name: "src/components/Testimonials.tsx", additions: 74, deletions: 0, status: "added" },
  { name: "src/app/page.tsx", additions: 3, deletions: 1, status: "modified" },
  { name: "src/components/OldBanner.tsx", additions: 0, deletions: 28, status: "deleted" },
];

const comments: ReviewComment[] = [
  {
    id: 1,
    file: "src/components/Hero.tsx",
    line: 15,
    author: "Teskel AI",
    content: "Consider extracting the animation configuration into a constant for reusability.",
    suggestion: `const fadeInUp = {\n  initial: { opacity: 0, y: 20 },\n  animate: { opacity: 1, y: 0 },\n  transition: { duration: 0.5 }\n};`,
    resolved: false,
  },
  {
    id: 2,
    file: "src/components/Features.tsx",
    line: 42,
    author: "Teskel AI",
    content: "This component re-renders on every parent update. Consider wrapping with React.memo since props are stable.",
    resolved: false,
  },
  {
    id: 3,
    file: "src/components/Testimonials.tsx",
    line: 8,
    author: "Teskel AI",
    content: "The testimonials data should be moved to a separate data file for maintainability.",
    suggestion: `// src/data/testimonials.ts\nexport const testimonials = [\n  { name: "...", quote: "...", title: "..." },\n  ...\n];`,
    resolved: true,
  },
];

export default function ReviewPage() {
  const [activeFile, setActiveFile] = useState<string>(files[0].name);
  const [reviewComments, setReviewComments] = useState(comments);

  const resolveComment = (id: number) => {
    setReviewComments((prev) => prev.map((c) => c.id === id ? { ...c, resolved: !c.resolved } : c));
  };

  return (
    <div className="flex h-full">
      {/* File tree */}
      <div className="w-[300px] border-r border-gray-100">
        <div className="border-b border-gray-100 p-4">
          <div className="flex items-center gap-2">
            <GitPullRequest size={16} className="text-green-600" />
            <h1 className="text-[14px] font-semibold text-gray-900">PR #142: Add landing page</h1>
          </div>
          <p className="mt-1 text-[12px] text-gray-500">feat/landing → main</p>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 border-b border-gray-100 px-4 py-3">
          <span className="flex items-center gap-1 text-[12px] text-green-600">
            <Plus size={12} />
            {files.reduce((a, f) => a + f.additions, 0)}
          </span>
          <span className="flex items-center gap-1 text-[12px] text-red-500">
            <Minus size={12} />
            {files.reduce((a, f) => a + f.deletions, 0)}
          </span>
          <span className="flex items-center gap-1 text-[12px] text-gray-500">
            <MessageSquare size={12} />
            {reviewComments.filter((c) => !c.resolved).length} unresolved
          </span>
        </div>

        {/* Files */}
        <div className="p-2">
          {files.map((file) => (
            <button
              key={file.name}
              onClick={() => setActiveFile(file.name)}
              className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[12px] transition-colors ${
                activeFile === file.name ? "bg-blue-50 text-blue-700" : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              <span className={`h-2 w-2 rounded-full ${
                file.status === "added" ? "bg-green-500" :
                file.status === "deleted" ? "bg-red-500" :
                "bg-yellow-500"
              }`} />
              <span className="flex-1 truncate font-mono">{file.name.split("/").pop()}</span>
              <span className="text-[10px] text-gray-400">
                +{file.additions} -{file.deletions}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Diff view */}
      <div className="flex flex-1 flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-3">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[13px] text-gray-700">{activeFile}</span>
          </div>
          <div className="flex items-center gap-2">
            <button className="rounded-md border border-gray-200 px-3 py-1.5 text-[12px] font-medium text-gray-600 hover:bg-gray-50">
              Unified
              <ChevronDown size={12} className="ml-1 inline" />
            </button>
            <button className="flex items-center gap-1.5 rounded-md bg-green-600 px-3 py-1.5 text-[12px] font-medium text-white hover:bg-green-700">
              <Check size={12} />
              Approve
            </button>
            <button className="flex items-center gap-1.5 rounded-md border border-red-200 px-3 py-1.5 text-[12px] font-medium text-red-600 hover:bg-red-50">
              <X size={12} />
              Request Changes
            </button>
          </div>
        </div>

        {/* Diff content */}
        <div className="flex-1 overflow-auto">
          <div className="font-mono text-[12px]">
            {/* Unchanged */}
            <DiffLine type="context" num={10} content="import Link from 'next/link';" />
            <DiffLine type="context" num={11} content="" />
            <DiffLine type="deletion" num={12} content={"export default function Hero() {"} />
            <DiffLine type="addition" num={12} content={"export default function Hero({ animated = true }: Props) {"} />
            <DiffLine type="context" num={13} content={"  return ("} />
            <DiffLine type="context" num={14} content={'    <section className="px-6 pb-16 pt-24">'} />
            <DiffLine type="addition" num={15} content={"      <motion.div initial={fadeInUp}>"} />
            <DiffLine type="context" num={16} content={'        <h1 className="text-4xl font-medium">'} />
            <DiffLine type="deletion" num={17} content={"          Welcome to Teskel"} />
            <DiffLine type="addition" num={17} content={"          Built to make you extraordinarily productive"} />
            <DiffLine type="context" num={18} content={"        </h1>"} />
            <DiffLine type="addition" num={19} content={"      </motion.div>"} />
            <DiffLine type="context" num={20} content={"    </section>"} />
          </div>
        </div>

        {/* Comments panel */}
        <div className="border-t border-gray-100">
          <div className="px-6 py-3">
            <h3 className="text-[13px] font-semibold text-gray-900">AI Review Comments</h3>
          </div>
          <div className="max-h-[200px] space-y-3 overflow-auto px-6 pb-4">
            {reviewComments.filter((c) => c.file === activeFile).map((comment) => (
              <div
                key={comment.id}
                className={`rounded-lg border p-3 ${comment.resolved ? "border-gray-100 bg-gray-50" : "border-blue-100 bg-blue-50/30"}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] font-medium text-gray-900">{comment.author}</span>
                    <span className="text-[11px] text-gray-400">line {comment.line}</span>
                  </div>
                  <button
                    onClick={() => resolveComment(comment.id)}
                    className={`rounded px-2 py-0.5 text-[11px] font-medium ${
                      comment.resolved ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {comment.resolved ? "Resolved" : "Resolve"}
                  </button>
                </div>
                <p className="mt-1.5 text-[12px] text-gray-600">{comment.content}</p>
                {comment.suggestion && (
                  <pre className="mt-2 rounded bg-gray-900 p-2 text-[11px] text-gray-300">
                    {comment.suggestion}
                  </pre>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function DiffLine({ type, num, content }: { type: "addition" | "deletion" | "context"; num: number; content: string }) {
  const bg = type === "addition" ? "bg-green-50" : type === "deletion" ? "bg-red-50" : "";
  const textColor = type === "addition" ? "text-green-800" : type === "deletion" ? "text-red-800" : "text-gray-700";
  const prefix = type === "addition" ? "+" : type === "deletion" ? "-" : " ";
  const prefixColor = type === "addition" ? "text-green-600" : type === "deletion" ? "text-red-500" : "text-gray-400";

  return (
    <div className={`flex ${bg} border-b border-gray-50`}>
      <span className="w-12 shrink-0 px-2 py-0.5 text-right text-[11px] text-gray-400">{num}</span>
      <span className={`w-5 shrink-0 text-center py-0.5 ${prefixColor}`}>{prefix}</span>
      <span className={`flex-1 px-2 py-0.5 ${textColor}`}>{content || "\u00A0"}</span>
    </div>
  );
}
