"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Search,
  Lock,
  FolderOpen,
  FileText,
  MessageSquare,
  Bot,
  GitBranch,
  Layers,
  Terminal,
  BookOpen,
  Copy,
  Check,
} from "lucide-react";

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

type Endpoint = {
  method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  path: string;
  description: string;
  requestBody?: string;
  response: string;
  example?: string;
};

type Section = {
  id: string;
  title: string;
  icon: React.ElementType;
  description: string;
  endpoints: Endpoint[];
};

/* -------------------------------------------------------------------------- */
/* Data                                                                       */
/* -------------------------------------------------------------------------- */

const sections: Section[] = [
  {
    id: "authentication",
    title: "Authentication",
    icon: Lock,
    description:
      "All API requests require a Bearer token. Generate an API key from your workspace settings and include it in the Authorization header.",
    endpoints: [
      {
        method: "POST",
        path: "/api/keys",
        description: "Create a new API key for the authenticated user.",
        requestBody: `{ "name": "My CLI Key", "workspaceId": "ws_..." }`,
        response: `{ "key": { "id": "key_...", "name": "My CLI Key", "token": "tsk_live_...", "createdAt": "..." } }`,
      },
      {
        method: "GET",
        path: "/api/keys",
        description: "List all API keys for the current user.",
        response: `{ "keys": [{ "id": "key_...", "name": "...", "lastUsed": "...", "createdAt": "..." }] }`,
      },
      {
        method: "DELETE",
        path: "/api/keys/:keyId",
        description: "Revoke an API key.",
        response: `{ "deleted": true }`,
      },
    ],
  },
  {
    id: "projects",
    title: "Projects",
    icon: FolderOpen,
    description: "Create, list, update, and delete projects within a workspace.",
    endpoints: [
      {
        method: "GET",
        path: "/api/projects",
        description: "List all projects the user has access to. Optionally filter by workspaceId.",
        response: `{ "projects": [{ "id": "...", "name": "...", "slug": "...", "workspaceId": "...", "createdAt": "..." }] }`,
        example: `curl -H "Authorization: Bearer tsk_live_..." https://app.teskel.dev/api/projects?workspaceId=ws_abc`,
      },
      {
        method: "POST",
        path: "/api/projects",
        description: "Create a new project.",
        requestBody: `{ "workspaceId": "ws_...", "name": "My App", "description": "Optional", "template": "blank" }`,
        response: `{ "project": { "id": "...", "name": "My App", "slug": "my-app", ... } }`,
      },
      {
        method: "GET",
        path: "/api/projects/:projectId",
        description: "Get project details.",
        response: `{ "project": { "id": "...", "name": "...", "description": "...", ... } }`,
      },
      {
        method: "PATCH",
        path: "/api/projects/:projectId",
        description: "Update project name or description.",
        requestBody: `{ "name": "New Name", "description": "Updated desc" }`,
        response: `{ "project": { ... } }`,
      },
      {
        method: "DELETE",
        path: "/api/projects/:projectId",
        description: "Delete a project and all associated data.",
        response: `{ "deleted": true }`,
      },
    ],
  },
  {
    id: "files",
    title: "Files",
    icon: FileText,
    description: "Manage the file tree, read/write file content, and perform file operations.",
    endpoints: [
      {
        method: "GET",
        path: "/api/projects/:projectId/files/tree",
        description: "Get the full file tree for a project.",
        response: `{ "tree": [{ "name": "src", "path": "src", "type": "FOLDER", "children": [...] }] }`,
      },
      {
        method: "GET",
        path: "/api/projects/:projectId/files/content?path=src/index.ts",
        description: "Read the content of a file.",
        response: `{ "path": "src/index.ts", "content": "...", "language": "typescript", "size": 1234 }`,
      },
      {
        method: "POST",
        path: "/api/projects/:projectId/files",
        description: "Create a new file or folder.",
        requestBody: `{ "parentPath": "src", "name": "utils.ts", "type": "FILE", "content": "// new file" }`,
        response: `{ "node": { "id": "...", "name": "utils.ts", "path": "src/utils.ts", "type": "FILE" } }`,
      },
      {
        method: "PATCH",
        path: "/api/projects/:projectId/files",
        description: "Save/update file content.",
        requestBody: `{ "path": "src/index.ts", "content": "const x = 1;" }`,
        response: `{ "path": "src/index.ts", "size": 14 }`,
      },
      {
        method: "DELETE",
        path: "/api/projects/:projectId/files?path=src/old.ts",
        description: "Delete a file or folder.",
        response: `{ "deleted": true, "path": "src/old.ts" }`,
      },
      {
        method: "POST",
        path: "/api/projects/:projectId/files/rename",
        description: "Rename or move a file.",
        requestBody: `{ "oldPath": "src/old.ts", "newPath": "src/new.ts" }`,
        response: `{ "node": { "name": "new.ts", "path": "src/new.ts", ... } }`,
      },
    ],
  },
  {
    id: "chat",
    title: "Chat",
    icon: MessageSquare,
    description: "Manage chat threads and messages. Stream AI responses in real-time.",
    endpoints: [
      {
        method: "GET",
        path: "/api/projects/:projectId/chat/threads",
        description: "List all chat threads for a project.",
        response: `{ "threads": [{ "id": "...", "title": "...", "createdAt": "..." }] }`,
      },
      {
        method: "POST",
        path: "/api/projects/:projectId/chat/threads",
        description: "Create a new chat thread.",
        requestBody: `{ "title": "Help with auth" }`,
        response: `{ "thread": { "id": "...", "title": "Help with auth", ... } }`,
      },
      {
        method: "GET",
        path: "/api/chat/threads/:threadId/messages",
        description: "List messages in a thread.",
        response: `{ "messages": [{ "id": "...", "role": "USER", "content": "...", "createdAt": "..." }] }`,
      },
      {
        method: "POST",
        path: "/api/ai/chat/stream",
        description: "Stream an AI chat response. Returns a Server-Sent Events stream.",
        requestBody: `{ "threadId": "...", "message": "How do I add auth?", "projectId": "..." }`,
        response: `text/event-stream: data: {"type":"token","content":"..."}\ndata: {"type":"done"}`,
        example: `curl -N -H "Authorization: Bearer tsk_live_..." -d '{"threadId":"...","message":"Hello"}' https://app.teskel.dev/api/ai/chat/stream`,
      },
    ],
  },
  {
    id: "agents",
    title: "Agents",
    icon: Bot,
    description: "Create and manage autonomous AI agent runs that can modify code.",
    endpoints: [
      {
        method: "POST",
        path: "/api/projects/:projectId/agents",
        description: "Start a new agent run.",
        requestBody: `{ "instruction": "Add error handling to all API routes", "model": "gpt-4o" }`,
        response: `{ "agentRun": { "id": "...", "status": "RUNNING", "instruction": "...", ... } }`,
      },
      {
        method: "GET",
        path: "/api/projects/:projectId/agents",
        description: "List agent runs for a project.",
        response: `{ "agentRuns": [{ "id": "...", "status": "COMPLETED", "instruction": "...", ... }] }`,
      },
      {
        method: "GET",
        path: "/api/agents/:agentRunId",
        description: "Get details of a specific agent run.",
        response: `{ "agentRun": { "id": "...", "status": "...", "steps": [...], "changeSetId": "..." } }`,
      },
      {
        method: "POST",
        path: "/api/agents/:agentRunId/cancel",
        description: "Cancel a running agent.",
        response: `{ "agentRun": { "id": "...", "status": "CANCELLED" } }`,
      },
      {
        method: "GET",
        path: "/api/agents/:agentRunId/events",
        description: "Stream agent events (SSE). Includes step progress, tool calls, and completion.",
        response: `text/event-stream: data: {"type":"step","content":"Analyzing files..."}\ndata: {"type":"complete"}`,
      },
    ],
  },
  {
    id: "changesets",
    title: "Changesets",
    icon: Layers,
    description: "Review, apply, or reject code changes proposed by agents or AI.",
    endpoints: [
      {
        method: "GET",
        path: "/api/projects/:projectId/changesets",
        description: "List changesets for a project. Optionally filter by status.",
        response: `{ "changesets": [{ "id": "...", "title": "...", "status": "PENDING_REVIEW", "fileChangeCount": 3 }] }`,
      },
      {
        method: "GET",
        path: "/api/changesets/:changeSetId",
        description: "Get changeset details including all file changes with diffs.",
        response: `{ "changeSet": { "id": "...", "fileChanges": [{ "filePath": "...", "changeType": "UPDATE", "diff": "..." }] } }`,
      },
      {
        method: "POST",
        path: "/api/changesets/:changeSetId/apply",
        description: "Apply accepted file changes to the project.",
        requestBody: `{ "applyAll": true }`,
        response: `{ "applied": [...], "conflicts": [], "failures": [], "changeSetStatus": "APPLIED" }`,
      },
      {
        method: "POST",
        path: "/api/changesets/:changeSetId/reject",
        description: "Reject a changeset.",
        response: `{ "changeSet": { "id": "...", "status": "REJECTED" } }`,
      },
    ],
  },
  {
    id: "git",
    title: "Git",
    icon: GitBranch,
    description: "Full Git operations: status, staging, commits, branches, push/pull, and pull requests.",
    endpoints: [
      {
        method: "GET",
        path: "/api/projects/:projectId/git/status",
        description: "Get repository status (staged, unstaged, untracked files, branch info).",
        response: `{ "isRepo": true, "branch": "main", "staged": [...], "unstaged": [...], "clean": false }`,
      },
      {
        method: "POST",
        path: "/api/projects/:projectId/git/init",
        description: "Initialize a new git repository.",
        response: `{ "isRepo": true, "branch": "main", "staged": [], "unstaged": [], "clean": true }`,
      },
      {
        method: "POST",
        path: "/api/projects/:projectId/git/stage",
        description: "Stage files for commit.",
        requestBody: `{ "paths": ["src/index.ts", "src/utils.ts"] }`,
        response: `{ "isRepo": true, "staged": [...], ... }`,
      },
      {
        method: "POST",
        path: "/api/projects/:projectId/git/unstage",
        description: "Unstage files.",
        requestBody: `{ "paths": ["src/index.ts"] }`,
        response: `{ "isRepo": true, "staged": [...], ... }`,
      },
      {
        method: "POST",
        path: "/api/projects/:projectId/git/commit",
        description: "Create a commit.",
        requestBody: `{ "message": "feat: add auth middleware" }`,
        response: `{ "isRepo": true, "hash": "abc123...", "branch": "main" }`,
      },
      {
        method: "GET",
        path: "/api/projects/:projectId/git/branches",
        description: "List all branches.",
        response: `{ "isRepo": true, "current": "main", "branches": [{ "name": "main", "current": true, ... }] }`,
      },
      {
        method: "POST",
        path: "/api/projects/:projectId/git/branch",
        description: "Create a new branch.",
        requestBody: `{ "name": "feature/auth" }`,
        response: `{ "isRepo": true, "current": "feature/auth", "branches": [...] }`,
      },
      {
        method: "POST",
        path: "/api/projects/:projectId/git/checkout",
        description: "Switch to a branch.",
        requestBody: `{ "name": "main" }`,
        response: `{ "isRepo": true, "current": "main", "branches": [...] }`,
      },
      {
        method: "GET",
        path: "/api/projects/:projectId/git/log",
        description: "Get commit history.",
        response: `{ "isRepo": true, "commits": [{ "hash": "...", "message": "...", "author": "...", "date": "..." }] }`,
      },
      {
        method: "GET",
        path: "/api/projects/:projectId/git/diff",
        description: "Get diff for a file or the entire working tree.",
        response: `{ "isRepo": true, "diff": "--- a/file.ts\n+++ b/file.ts\n..." }`,
      },
      {
        method: "POST",
        path: "/api/projects/:projectId/git/push",
        description: "Push commits to the remote.",
        response: `{ "ok": true, "message": "Pushed to origin/main" }`,
      },
      {
        method: "POST",
        path: "/api/projects/:projectId/git/pull",
        description: "Pull changes from the remote.",
        response: `{ "ok": true, "message": "Already up to date" }`,
      },
      {
        method: "POST",
        path: "/api/projects/:projectId/git/pull-request",
        description: "Create a pull request on the connected GitHub repository.",
        requestBody: `{ "title": "feat: add auth", "body": "Adds JWT auth middleware", "base": "main", "head": "feature/auth" }`,
        response: `{ "pullRequest": { "number": 42, "title": "...", "url": "...", "state": "open" } }`,
      },
      {
        method: "GET",
        path: "/api/projects/:projectId/git/pull-request",
        description: "List pull requests for the project's repository.",
        response: `{ "pullRequests": [{ "number": 42, "title": "...", "state": "open", "author": "..." }] }`,
      },
    ],
  },
  {
    id: "search",
    title: "Search",
    icon: Search,
    description: "Full-text and semantic search across project files.",
    endpoints: [
      {
        method: "POST",
        path: "/api/projects/:projectId/search",
        description: "Full-text search across project files.",
        requestBody: `{ "query": "handleAuth", "fileTypes": ["ts", "tsx"], "limit": 20 }`,
        response: `{ "results": [{ "path": "src/auth.ts", "line": 42, "content": "export function handleAuth..." }] }`,
      },
      {
        method: "POST",
        path: "/api/projects/:projectId/search/semantic",
        description: "Semantic (AI-powered) search for conceptual matches.",
        requestBody: `{ "query": "authentication middleware", "limit": 10 }`,
        response: `{ "results": [{ "path": "...", "score": 0.92, "snippet": "..." }] }`,
      },
    ],
  },
  {
    id: "terminal",
    title: "Terminal",
    icon: Terminal,
    description: "Create terminal sessions and execute commands within a project.",
    endpoints: [
      {
        method: "POST",
        path: "/api/projects/:projectId/terminal/sessions",
        description: "Create a new terminal session.",
        response: `{ "session": { "id": "...", "projectId": "...", "createdAt": "..." } }`,
      },
      {
        method: "GET",
        path: "/api/terminal/:sessionId",
        description: "Get terminal session details and recent output.",
        response: `{ "session": { "id": "...", "status": "active", "output": "..." } }`,
      },
      {
        method: "POST",
        path: "/api/terminal/:sessionId/run",
        description: "Execute a command in the terminal session.",
        requestBody: `{ "command": "npm run build" }`,
        response: `{ "output": "...", "exitCode": 0 }`,
      },
      {
        method: "POST",
        path: "/api/terminal/:sessionId/kill",
        description: "Kill a running terminal session.",
        response: `{ "killed": true }`,
      },
    ],
  },
  {
    id: "rules-knowledge",
    title: "Rules & Knowledge",
    icon: BookOpen,
    description: "Manage AI rules (system prompts) and knowledge base entries.",
    endpoints: [
      {
        method: "GET",
        path: "/api/rules",
        description: "List all rules for the workspace.",
        response: `{ "rules": [{ "id": "...", "title": "...", "content": "...", "enabled": true }] }`,
      },
      {
        method: "POST",
        path: "/api/rules",
        description: "Create a new rule.",
        requestBody: `{ "title": "Code Style", "content": "Always use TypeScript strict mode...", "scope": "workspace" }`,
        response: `{ "rule": { "id": "...", "title": "Code Style", ... } }`,
      },
      {
        method: "GET",
        path: "/api/knowledge",
        description: "List knowledge base entries.",
        response: `{ "entries": [{ "id": "...", "title": "...", "type": "document", ... }] }`,
      },
      {
        method: "POST",
        path: "/api/knowledge",
        description: "Add a knowledge base entry.",
        requestBody: `{ "title": "API Guidelines", "content": "...", "type": "document" }`,
        response: `{ "entry": { "id": "...", "title": "API Guidelines", ... } }`,
      },
      {
        method: "POST",
        path: "/api/knowledge/search",
        description: "Search the knowledge base.",
        requestBody: `{ "query": "error handling best practices" }`,
        response: `{ "results": [{ "id": "...", "title": "...", "score": 0.89, "snippet": "..." }] }`,
      },
    ],
  },
];

/* -------------------------------------------------------------------------- */
/* Components                                                                 */
/* -------------------------------------------------------------------------- */

const methodColors: Record<string, string> = {
  GET: "bg-emerald-100 text-emerald-700",
  POST: "bg-blue-100 text-blue-700",
  PATCH: "bg-amber-100 text-amber-700",
  PUT: "bg-orange-100 text-orange-700",
  DELETE: "bg-red-100 text-red-700",
};

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="absolute right-2 top-2 rounded p-1 text-gray-400 hover:bg-gray-700 hover:text-gray-200"
      title="Copy"
    >
      {copied ? <Check size={14} /> : <Copy size={14} />}
    </button>
  );
}

function CodeBlock({ code, className = "" }: { code: string; className?: string }) {
  return (
    <div className={`relative rounded-lg bg-gray-900 p-4 ${className}`}>
      <CopyButton text={code} />
      <pre className="overflow-x-auto text-[13px] leading-relaxed text-gray-300">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function EndpointCard({ endpoint }: { endpoint: Endpoint }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-xl border border-gray-200 bg-white transition-shadow hover:shadow-sm">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-3 px-5 py-4 text-left"
      >
        <span
          className={`inline-flex min-w-[52px] items-center justify-center rounded-md px-2 py-1 text-[11px] font-bold ${methodColors[endpoint.method]}`}
        >
          {endpoint.method}
        </span>
        <code className="flex-1 text-sm font-medium text-gray-800">
          {endpoint.path}
        </code>
        <span className="text-xs text-gray-500">{expanded ? "−" : "+"}</span>
      </button>

      {expanded && (
        <div className="border-t border-gray-100 px-5 py-4">
          <p className="mb-4 text-sm text-gray-600">{endpoint.description}</p>

          {endpoint.requestBody && (
            <div className="mb-4">
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
                Request Body
              </h4>
              <CodeBlock code={endpoint.requestBody} />
            </div>
          )}

          <div className="mb-4">
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
              Response
            </h4>
            <CodeBlock code={endpoint.response} />
          </div>

          {endpoint.example && (
            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
                Example
              </h4>
              <CodeBlock code={endpoint.example} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Page                                                                       */
/* -------------------------------------------------------------------------- */

export default function ApiDocsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSection, setActiveSection] = useState<string | null>(null);

  const filteredSections = sections.filter((section) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    if (section.title.toLowerCase().includes(q)) return true;
    return section.endpoints.some(
      (ep) =>
        ep.path.toLowerCase().includes(q) ||
        ep.description.toLowerCase().includes(q)
    );
  });

  return (
    <div className="px-6 py-20">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-12 text-center"
        >
          <h1 className="text-4xl font-semibold tracking-tight text-gray-900 md:text-5xl">
            API Reference
          </h1>
          <p className="mx-auto mt-4 max-w-lg text-base text-gray-600">
            Complete reference for the Teskel REST API. Authenticate with a
            Bearer token and build powerful integrations.
          </p>

          {/* Search */}
          <div className="mx-auto mt-8 flex max-w-xl items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
            <Search size={20} className="text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search endpoints..."
              className="flex-1 bg-transparent text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none"
            />
          </div>
        </motion.div>

        {/* Auth intro */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="mb-12 rounded-2xl border border-blue-100 bg-blue-50/50 p-6"
        >
          <div className="flex items-start gap-3">
            <Lock size={20} className="mt-0.5 text-blue-600" />
            <div>
              <h2 className="text-sm font-semibold text-gray-900">
                Authentication
              </h2>
              <p className="mt-1 text-sm text-gray-600">
                Include your API key in the <code className="rounded bg-white px-1.5 py-0.5 text-xs font-medium">Authorization</code> header:
              </p>
              <CodeBlock
                code={`curl -H "Authorization: Bearer tsk_live_your_api_key" \\\n  https://app.teskel.dev/api/projects`}
                className="mt-3"
              />
              <p className="mt-3 text-xs text-gray-500">
                All responses follow the envelope format:{" "}
                <code className="rounded bg-white px-1 py-0.5 text-[11px]">
                  {"{ success: true, data: {...} }"}
                </code>{" "}
                or{" "}
                <code className="rounded bg-white px-1 py-0.5 text-[11px]">
                  {"{ success: false, error: { message, code } }"}
                </code>
              </p>
            </div>
          </div>
        </motion.div>

        <div className="flex gap-8">
          {/* Sidebar nav */}
          <nav className="hidden w-48 shrink-0 lg:block">
            <div className="sticky top-24 space-y-1">
              {sections.map((section) => (
                <a
                  key={section.id}
                  href={`#${section.id}`}
                  onClick={() => setActiveSection(section.id)}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
                    activeSection === section.id
                      ? "bg-gray-100 font-medium text-gray-900"
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                  }`}
                >
                  <section.icon size={14} />
                  {section.title}
                </a>
              ))}
            </div>
          </nav>

          {/* Main content */}
          <div className="min-w-0 flex-1 space-y-16">
            {filteredSections.map((section, i) => (
              <motion.section
                key={section.id}
                id={section.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: i * 0.02 }}
                viewport={{ once: true, margin: "-100px" }}
              >
                <div className="mb-6 flex items-center gap-3">
                  <div className="rounded-lg bg-gray-100 p-2">
                    <section.icon size={18} className="text-gray-700" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900">
                      {section.title}
                    </h2>
                    <p className="text-sm text-gray-500">
                      {section.description}
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  {section.endpoints.map((ep, j) => (
                    <EndpointCard key={`${ep.method}-${ep.path}-${j}`} endpoint={ep} />
                  ))}
                </div>
              </motion.section>
            ))}

            {filteredSections.length === 0 && (
              <div className="py-16 text-center">
                <Search size={32} className="mx-auto mb-3 text-gray-300" />
                <p className="text-sm text-gray-500">
                  No endpoints match &ldquo;{searchQuery}&rdquo;
                </p>
              </div>
            )}
          </div>
        </div>

        {/* OpenAPI link */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="mt-20 rounded-2xl bg-gray-900 p-12 text-center"
        >
          <h2 className="text-2xl font-semibold text-white">
            OpenAPI Specification
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm text-gray-400">
            Download the full OpenAPI 3.1 spec to generate client SDKs, import
            into Postman, or integrate with your toolchain.
          </p>
          <div className="mt-8 flex justify-center gap-4">
            <a
              href="/api/openapi"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-lg bg-white px-5 py-2.5 text-sm font-medium text-gray-900 hover:bg-gray-100"
            >
              Download JSON
            </a>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
