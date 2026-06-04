"use client";

import { useState } from "react";
import {
  File,
  Plus,
  ChevronDown,
  Check,
  RotateCcw,
  Sparkles,
  ArrowRight,
  GitBranch,
  Mic,
  Globe,
  Code,
  Terminal,
  FileText,
} from "lucide-react";

interface FileChange {
  file: string;
  status: "added" | "modified" | "deleted";
  additions: number;
  deletions: number;
  diff: DiffLine[];
}

interface DiffLine {
  type: "added" | "removed" | "context";
  content: string;
  lineNumber?: number;
}

const fileChanges: FileChange[] = [
  {
    file: "src/lib/auth/jwt.ts",
    status: "added",
    additions: 18,
    deletions: 0,
    diff: [
      { type: "added", content: 'import { SignJWT, jwtVerify } from "jose";', lineNumber: 1 },
      { type: "added", content: "", lineNumber: 2 },
      { type: "added", content: "const secret = new TextEncoder().encode(", lineNumber: 3 },
      { type: "added", content: '  process.env.JWT_SECRET || "default-secret"', lineNumber: 4 },
      { type: "added", content: ");", lineNumber: 5 },
      { type: "added", content: "", lineNumber: 6 },
      { type: "added", content: "export async function signToken(payload: Record<string, unknown>) {", lineNumber: 7 },
      { type: "added", content: "  return new SignJWT(payload)", lineNumber: 8 },
      { type: "added", content: '    .setProtectedHeader({ alg: "HS256" })', lineNumber: 9 },
      { type: "added", content: '    .setExpirationTime("7d")', lineNumber: 10 },
      { type: "added", content: "    .setIssuedAt()", lineNumber: 11 },
      { type: "added", content: "    .sign(secret);", lineNumber: 12 },
      { type: "added", content: "}", lineNumber: 13 },
    ],
  },
  {
    file: "src/app/api/auth/login/route.ts",
    status: "added",
    additions: 24,
    deletions: 0,
    diff: [
      { type: "added", content: 'import { NextResponse } from "next/server";', lineNumber: 1 },
      { type: "added", content: 'import { comparePassword } from "@/lib/auth/password";', lineNumber: 2 },
      { type: "added", content: 'import { signToken } from "@/lib/auth/jwt";', lineNumber: 3 },
      { type: "added", content: "", lineNumber: 4 },
      { type: "added", content: "export async function POST(request: Request) {", lineNumber: 5 },
      { type: "added", content: "  const { email, password } = await request.json();", lineNumber: 6 },
      { type: "added", content: "  const user = await findUserByEmail(email);", lineNumber: 7 },
      { type: "added", content: "", lineNumber: 8 },
      { type: "added", content: "  if (!user) {", lineNumber: 9 },
      { type: "added", content: "    return NextResponse.json(", lineNumber: 10 },
      { type: "added", content: '      { error: "Invalid credentials" },', lineNumber: 11 },
      { type: "added", content: "      { status: 401 }", lineNumber: 12 },
      { type: "added", content: "    );", lineNumber: 13 },
      { type: "added", content: "  }", lineNumber: 14 },
    ],
  },
  {
    file: "src/middleware.ts",
    status: "added",
    additions: 15,
    deletions: 0,
    diff: [
      { type: "added", content: 'import { NextResponse } from "next/server";', lineNumber: 1 },
      { type: "added", content: 'import type { NextRequest } from "next/server";', lineNumber: 2 },
      { type: "added", content: 'import { verifyToken } from "@/lib/auth/jwt";', lineNumber: 3 },
      { type: "added", content: "", lineNumber: 4 },
      { type: "added", content: "export async function middleware(request: NextRequest) {", lineNumber: 5 },
      { type: "added", content: '  const token = request.cookies.get("auth-token")?.value;', lineNumber: 6 },
      { type: "added", content: "", lineNumber: 7 },
      { type: "added", content: "  if (!token) {", lineNumber: 8 },
      { type: "added", content: '    return NextResponse.redirect(new URL("/login", request.url));', lineNumber: 9 },
      { type: "added", content: "  }", lineNumber: 10 },
    ],
  },
  {
    file: "package.json",
    status: "modified",
    additions: 2,
    deletions: 0,
    diff: [
      { type: "context", content: '  "dependencies": {', lineNumber: 11 },
      { type: "context", content: '    "next": "16.2.7",', lineNumber: 12 },
      { type: "added", content: '    "jose": "^5.2.0",', lineNumber: 13 },
      { type: "added", content: '    "bcryptjs": "^2.4.3",', lineNumber: 14 },
      { type: "context", content: '    "react": "19.2.4",', lineNumber: 15 },
      { type: "context", content: '    "react-dom": "19.2.4"', lineNumber: 16 },
    ],
  },
];

export default function ComposerPage() {
  const [selectedFile, setSelectedFile] = useState(0);
  const [inputValue, setInputValue] = useState("");
  const [acceptedFiles, setAcceptedFiles] = useState<Set<string>>(new Set());
  const model = "Auto";

  const totalAdditions = fileChanges.reduce((s, f) => s + f.additions, 0);
  const totalDeletions = fileChanges.reduce((s, f) => s + f.deletions, 0);

  const toggleAccept = (file: string) => {
    const next = new Set(acceptedFiles);
    if (next.has(file)) next.delete(file);
    else next.add(file);
    setAcceptedFiles(next);
  };

  return (
    <div className="flex h-full flex-col bg-white">
      {/* Top bar */}
      <div className="flex h-11 items-center justify-between border-b border-gray-200 px-4">
        <div className="flex items-center gap-3">
          <Sparkles size={16} className="text-blue-500" />
          <span className="text-sm font-medium text-gray-900">Composer</span>
          <span className="rounded bg-gray-100 px-2 py-0.5 text-[10px] text-gray-500">
            {fileChanges.length} files
          </span>
          <span className="text-[10px] text-green-600">
            +{totalAdditions}
          </span>
          <span className="text-[10px] text-red-500">
            -{totalDeletions}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50">
            <RotateCcw size={12} className="mr-1.5 inline" />
            Revert all
          </button>
          <button className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800">
            <Check size={12} className="mr-1.5 inline" />
            Accept all ({fileChanges.length})
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* File list */}
        <div className="w-64 border-r border-gray-200 bg-gray-50">
          <div className="p-3">
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <GitBranch size={12} />
              <span className="font-medium">feature/auth-system</span>
            </div>
          </div>
          <div className="space-y-0.5 px-2">
            {fileChanges.map((f, i) => (
              <button
                key={f.file}
                onClick={() => setSelectedFile(i)}
                className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[13px] transition-colors ${
                  selectedFile === i
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                <File
                  size={14}
                  className={
                    f.status === "added"
                      ? "text-green-500"
                      : f.status === "modified"
                        ? "text-amber-500"
                        : "text-red-500"
                  }
                />
                <span className="flex-1 truncate">
                  {f.file.split("/").pop()}
                </span>
                <div className="flex items-center gap-1">
                  {f.additions > 0 && (
                    <span className="text-[10px] text-green-600">
                      +{f.additions}
                    </span>
                  )}
                  {f.deletions > 0 && (
                    <span className="text-[10px] text-red-500">
                      -{f.deletions}
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Diff view */}
        <div className="flex flex-1 flex-col">
          {/* File header */}
          <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-4 py-2">
            <div className="flex items-center gap-2">
              <code className="text-sm text-gray-700">
                {fileChanges[selectedFile].file}
              </code>
              <span
                className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                  fileChanges[selectedFile].status === "added"
                    ? "bg-green-100 text-green-700"
                    : fileChanges[selectedFile].status === "modified"
                      ? "bg-amber-100 text-amber-700"
                      : "bg-red-100 text-red-700"
                }`}
              >
                {fileChanges[selectedFile].status}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {acceptedFiles.has(fileChanges[selectedFile].file) ? (
                <span className="flex items-center gap-1 text-xs text-green-600">
                  <Check size={12} /> Accepted
                </span>
              ) : (
                <>
                  <button className="rounded-lg border border-gray-200 px-2.5 py-1 text-[11px] text-gray-500 hover:bg-gray-100">
                    Reject
                  </button>
                  <button
                    onClick={() =>
                      toggleAccept(fileChanges[selectedFile].file)
                    }
                    className="rounded-lg bg-gray-900 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-gray-800"
                  >
                    Accept
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Diff content */}
          <div className="flex-1 overflow-auto font-mono text-[13px]">
            {fileChanges[selectedFile].diff.map((line, i) => (
              <div
                key={i}
                className={`flex ${
                  line.type === "added"
                    ? "bg-green-50"
                    : line.type === "removed"
                      ? "bg-red-50"
                      : "bg-white"
                }`}
              >
                <span className="w-12 shrink-0 px-2 py-0.5 text-right text-xs text-gray-400">
                  {line.lineNumber}
                </span>
                <span
                  className={`w-6 shrink-0 px-1 py-0.5 text-center text-xs ${
                    line.type === "added"
                      ? "text-green-600"
                      : line.type === "removed"
                        ? "text-red-600"
                        : "text-gray-300"
                  }`}
                >
                  {line.type === "added"
                    ? "+"
                    : line.type === "removed"
                      ? "-"
                      : " "}
                </span>
                <span
                  className={`flex-1 px-2 py-0.5 ${
                    line.type === "added"
                      ? "text-green-800"
                      : line.type === "removed"
                        ? "text-red-800"
                        : "text-gray-700"
                  }`}
                >
                  {line.content || "\u00A0"}
                </span>
              </div>
            ))}
          </div>

          {/* Composer input */}
          <div className="border-t border-gray-200 bg-white px-4 py-3">
            <div className="flex items-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-2.5 shadow-sm focus-within:border-gray-300">
              <Plus size={16} className="shrink-0 text-gray-400" />
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Describe changes to make across files..."
                className="flex-1 bg-transparent text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none"
              />
              <button className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-gray-500 hover:bg-gray-100">
                {model} <ChevronDown size={12} />
              </button>
              <button className="text-gray-400 hover:text-gray-600">
                <Mic size={14} />
              </button>
              {inputValue.trim() && (
                <button className="flex h-6 w-6 items-center justify-center rounded-lg bg-gray-900 text-white hover:bg-gray-800">
                  <ArrowRight size={12} />
                </button>
              )}
            </div>
            <div className="mt-1.5 flex items-center gap-2 px-1">
              <button className="flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] text-gray-400 hover:bg-gray-100">
                <Globe size={10} /> Web
              </button>
              <button className="flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] text-gray-400 hover:bg-gray-100">
                <Code size={10} /> Code
              </button>
              <button className="flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] text-gray-400 hover:bg-gray-100">
                <Terminal size={10} /> Terminal
              </button>
              <button className="flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] text-gray-400 hover:bg-gray-100">
                <FileText size={10} /> Docs
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
