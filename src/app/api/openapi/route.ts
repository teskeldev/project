import { NextResponse } from "next/server";

/**
 * GET /api/openapi
 *
 * Returns the OpenAPI 3.1 specification for the Teskel API as JSON.
 */
export async function GET() {
  const spec = {
    openapi: "3.1.0",
    info: {
      title: "Teskel API",
      version: "1.0.0",
      description:
        "The Teskel REST API provides programmatic access to projects, files, AI chat, agents, changesets, git operations, search, terminal sessions, rules, and knowledge base.",
      contact: {
        name: "Teskel Support",
        url: "https://teskel.dev/support",
      },
    },
    servers: [
      {
        url: "https://app.teskel.dev",
        description: "Production",
      },
      {
        url: "http://localhost:3000",
        description: "Local development",
      },
    ],
    security: [{ BearerAuth: [] }],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "API Key",
          description:
            "Use an API key generated from your workspace settings. Prefix: tsk_live_",
        },
      },
      schemas: {
        ApiSuccess: {
          type: "object",
          properties: {
            success: { type: "boolean", const: true },
            data: { type: "object" },
          },
          required: ["success", "data"],
        },
        ApiError: {
          type: "object",
          properties: {
            success: { type: "boolean", const: false },
            error: {
              type: "object",
              properties: {
                message: { type: "string" },
                code: { type: "string" },
              },
              required: ["message"],
            },
          },
          required: ["success", "error"],
        },
        Project: {
          type: "object",
          properties: {
            id: { type: "string" },
            workspaceId: { type: "string" },
            name: { type: "string" },
            slug: { type: "string" },
            description: { type: "string", nullable: true },
            storageKey: { type: "string" },
            defaultBranch: { type: "string" },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
          required: ["id", "workspaceId", "name", "slug", "storageKey"],
        },
        FileNode: {
          type: "object",
          properties: {
            id: { type: "string" },
            name: { type: "string" },
            path: { type: "string" },
            type: { type: "string", enum: ["FILE", "FOLDER"] },
            language: { type: "string", nullable: true },
            size: { type: "integer" },
            children: {
              type: "array",
              items: { $ref: "#/components/schemas/FileNode" },
            },
          },
          required: ["id", "name", "path", "type"],
        },
        FileContent: {
          type: "object",
          properties: {
            path: { type: "string" },
            content: { type: "string" },
            language: { type: "string", nullable: true },
            size: { type: "integer" },
          },
          required: ["path", "content", "size"],
        },
        ChatThread: {
          type: "object",
          properties: {
            id: { type: "string" },
            title: { type: "string" },
            projectId: { type: "string" },
            userId: { type: "string" },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
          required: ["id", "title", "projectId"],
        },
        ChatMessage: {
          type: "object",
          properties: {
            id: { type: "string" },
            threadId: { type: "string" },
            role: {
              type: "string",
              enum: ["USER", "ASSISTANT", "SYSTEM", "TOOL"],
            },
            content: { type: "string" },
            metadata: { type: "object" },
            createdAt: { type: "string", format: "date-time" },
          },
          required: ["id", "threadId", "role", "content"],
        },
        AgentRun: {
          type: "object",
          properties: {
            id: { type: "string" },
            projectId: { type: "string" },
            status: {
              type: "string",
              enum: [
                "PENDING",
                "RUNNING",
                "COMPLETED",
                "FAILED",
                "CANCELLED",
              ],
            },
            instruction: { type: "string" },
            model: { type: "string" },
            changeSetId: { type: "string", nullable: true },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
          required: ["id", "projectId", "status", "instruction"],
        },
        ChangeSet: {
          type: "object",
          properties: {
            id: { type: "string" },
            projectId: { type: "string" },
            title: { type: "string" },
            description: { type: "string", nullable: true },
            status: {
              type: "string",
              enum: ["DRAFT", "PENDING_REVIEW", "APPLIED", "REJECTED"],
            },
            fileChangeCount: { type: "integer" },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
          required: ["id", "projectId", "title", "status"],
        },
        FileChange: {
          type: "object",
          properties: {
            id: { type: "string" },
            filePath: { type: "string" },
            oldPath: { type: "string", nullable: true },
            changeType: {
              type: "string",
              enum: ["CREATE", "UPDATE", "DELETE", "RENAME"],
            },
            diff: { type: "string", nullable: true },
            status: {
              type: "string",
              enum: ["PENDING", "ACCEPTED", "REJECTED"],
            },
          },
          required: ["id", "filePath", "changeType", "status"],
        },
        GitStatus: {
          type: "object",
          properties: {
            isRepo: { type: "boolean" },
            branch: { type: "string", nullable: true },
            ahead: { type: "integer" },
            behind: { type: "integer" },
            staged: {
              type: "array",
              items: { $ref: "#/components/schemas/GitFileStatus" },
            },
            unstaged: {
              type: "array",
              items: { $ref: "#/components/schemas/GitFileStatus" },
            },
            untracked: {
              type: "array",
              items: { $ref: "#/components/schemas/GitFileStatus" },
            },
            clean: { type: "boolean" },
          },
          required: ["isRepo"],
        },
        GitFileStatus: {
          type: "object",
          properties: {
            path: { type: "string" },
            from: { type: "string" },
            index: { type: "string" },
            working: { type: "string" },
          },
          required: ["path", "index", "working"],
        },
        GitBranchInfo: {
          type: "object",
          properties: {
            name: { type: "string" },
            current: { type: "boolean" },
            commit: { type: "string" },
            label: { type: "string" },
          },
          required: ["name", "current"],
        },
        GitLogEntry: {
          type: "object",
          properties: {
            hash: { type: "string" },
            shortHash: { type: "string" },
            message: { type: "string" },
            author: { type: "string" },
            email: { type: "string" },
            date: { type: "string", format: "date-time" },
            filesChanged: { type: "integer" },
          },
          required: ["hash", "message", "author", "date"],
        },
        PullRequest: {
          type: "object",
          properties: {
            number: { type: "integer" },
            title: { type: "string" },
            body: { type: "string" },
            state: { type: "string", enum: ["open", "closed", "merged"] },
            url: { type: "string", format: "uri" },
            author: { type: "string" },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
          required: ["number", "title", "state"],
        },
        Rule: {
          type: "object",
          properties: {
            id: { type: "string" },
            title: { type: "string" },
            content: { type: "string" },
            enabled: { type: "boolean" },
            scope: { type: "string" },
          },
          required: ["id", "title", "content"],
        },
        KnowledgeEntry: {
          type: "object",
          properties: {
            id: { type: "string" },
            title: { type: "string" },
            content: { type: "string" },
            type: { type: "string" },
          },
          required: ["id", "title"],
        },
      },
    },
    paths: {
      "/api/projects": {
        get: {
          tags: ["Projects"],
          summary: "List projects",
          description:
            "List all projects the authenticated user has access to.",
          parameters: [
            {
              name: "workspaceId",
              in: "query",
              schema: { type: "string" },
              description: "Filter by workspace ID",
            },
          ],
          responses: {
            "200": {
              description: "List of projects",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean", const: true },
                      data: {
                        type: "object",
                        properties: {
                          projects: {
                            type: "array",
                            items: {
                              $ref: "#/components/schemas/Project",
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        post: {
          tags: ["Projects"],
          summary: "Create project",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    workspaceId: { type: "string" },
                    name: { type: "string" },
                    description: { type: "string" },
                    template: {
                      type: "string",
                      enum: ["blank", "node"],
                    },
                  },
                  required: ["workspaceId", "name"],
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Created project",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean", const: true },
                      data: {
                        type: "object",
                        properties: {
                          project: {
                            $ref: "#/components/schemas/Project",
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      "/api/projects/{projectId}": {
        get: {
          tags: ["Projects"],
          summary: "Get project",
          parameters: [
            {
              name: "projectId",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: {
            "200": { description: "Project details" },
          },
        },
        patch: {
          tags: ["Projects"],
          summary: "Update project",
          parameters: [
            {
              name: "projectId",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          requestBody: {
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    description: { type: "string" },
                  },
                },
              },
            },
          },
          responses: {
            "200": { description: "Updated project" },
          },
        },
        delete: {
          tags: ["Projects"],
          summary: "Delete project",
          parameters: [
            {
              name: "projectId",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: {
            "200": { description: "Project deleted" },
          },
        },
      },
      "/api/projects/{projectId}/files/tree": {
        get: {
          tags: ["Files"],
          summary: "Get file tree",
          parameters: [
            {
              name: "projectId",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: {
            "200": {
              description: "File tree",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean", const: true },
                      data: {
                        type: "object",
                        properties: {
                          tree: {
                            type: "array",
                            items: {
                              $ref: "#/components/schemas/FileNode",
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      "/api/projects/{projectId}/files/content": {
        get: {
          tags: ["Files"],
          summary: "Get file content",
          parameters: [
            {
              name: "projectId",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
            {
              name: "path",
              in: "query",
              required: true,
              schema: { type: "string" },
              description: "File path relative to project root",
            },
          ],
          responses: {
            "200": {
              description: "File content",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean", const: true },
                      data: {
                        $ref: "#/components/schemas/FileContent",
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      "/api/projects/{projectId}/files": {
        post: {
          tags: ["Files"],
          summary: "Create file or folder",
          parameters: [
            {
              name: "projectId",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    parentPath: { type: "string" },
                    name: { type: "string" },
                    type: { type: "string", enum: ["FILE", "FOLDER"] },
                    content: { type: "string" },
                  },
                  required: ["name", "type"],
                },
              },
            },
          },
          responses: {
            "200": { description: "Created file node" },
          },
        },
        patch: {
          tags: ["Files"],
          summary: "Save file content",
          parameters: [
            {
              name: "projectId",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    path: { type: "string" },
                    content: { type: "string" },
                  },
                  required: ["path", "content"],
                },
              },
            },
          },
          responses: {
            "200": { description: "File saved" },
          },
        },
        delete: {
          tags: ["Files"],
          summary: "Delete file or folder",
          parameters: [
            {
              name: "projectId",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
            {
              name: "path",
              in: "query",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: {
            "200": { description: "File deleted" },
          },
        },
      },
      "/api/projects/{projectId}/files/rename": {
        post: {
          tags: ["Files"],
          summary: "Rename or move file",
          parameters: [
            {
              name: "projectId",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    oldPath: { type: "string" },
                    newPath: { type: "string" },
                  },
                  required: ["oldPath", "newPath"],
                },
              },
            },
          },
          responses: {
            "200": { description: "File renamed" },
          },
        },
      },
      "/api/projects/{projectId}/chat/threads": {
        get: {
          tags: ["Chat"],
          summary: "List chat threads",
          parameters: [
            {
              name: "projectId",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: {
            "200": { description: "List of threads" },
          },
        },
        post: {
          tags: ["Chat"],
          summary: "Create chat thread",
          parameters: [
            {
              name: "projectId",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          requestBody: {
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    title: { type: "string" },
                  },
                },
              },
            },
          },
          responses: {
            "200": { description: "Created thread" },
          },
        },
      },
      "/api/chat/threads/{threadId}/messages": {
        get: {
          tags: ["Chat"],
          summary: "List messages in thread",
          parameters: [
            {
              name: "threadId",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: {
            "200": { description: "List of messages" },
          },
        },
      },
      "/api/ai/chat/stream": {
        post: {
          tags: ["Chat"],
          summary: "Stream AI chat response",
          description:
            "Sends a message and streams the AI response as Server-Sent Events.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    threadId: { type: "string" },
                    message: { type: "string" },
                    projectId: { type: "string" },
                  },
                  required: ["threadId", "message", "projectId"],
                },
              },
            },
          },
          responses: {
            "200": {
              description: "SSE stream of AI response tokens",
              content: {
                "text/event-stream": {
                  schema: { type: "string" },
                },
              },
            },
          },
        },
      },
      "/api/projects/{projectId}/agents": {
        post: {
          tags: ["Agents"],
          summary: "Start agent run",
          parameters: [
            {
              name: "projectId",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    instruction: { type: "string" },
                    model: { type: "string" },
                  },
                  required: ["instruction"],
                },
              },
            },
          },
          responses: {
            "200": { description: "Agent run started" },
          },
        },
        get: {
          tags: ["Agents"],
          summary: "List agent runs",
          parameters: [
            {
              name: "projectId",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: {
            "200": { description: "List of agent runs" },
          },
        },
      },
      "/api/agents/{agentRunId}": {
        get: {
          tags: ["Agents"],
          summary: "Get agent run details",
          parameters: [
            {
              name: "agentRunId",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: {
            "200": { description: "Agent run details" },
          },
        },
      },
      "/api/agents/{agentRunId}/cancel": {
        post: {
          tags: ["Agents"],
          summary: "Cancel agent run",
          parameters: [
            {
              name: "agentRunId",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: {
            "200": { description: "Agent run cancelled" },
          },
        },
      },
      "/api/agents/{agentRunId}/events": {
        get: {
          tags: ["Agents"],
          summary: "Stream agent events",
          description: "SSE stream of agent progress events.",
          parameters: [
            {
              name: "agentRunId",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: {
            "200": {
              description: "SSE stream",
              content: {
                "text/event-stream": {
                  schema: { type: "string" },
                },
              },
            },
          },
        },
      },
      "/api/projects/{projectId}/changesets": {
        get: {
          tags: ["Changesets"],
          summary: "List changesets",
          parameters: [
            {
              name: "projectId",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
            {
              name: "status",
              in: "query",
              schema: { type: "string" },
              description: "Filter by status",
            },
          ],
          responses: {
            "200": { description: "List of changesets" },
          },
        },
      },
      "/api/changesets/{changeSetId}": {
        get: {
          tags: ["Changesets"],
          summary: "Get changeset details",
          parameters: [
            {
              name: "changeSetId",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: {
            "200": { description: "Changeset with file changes" },
          },
        },
      },
      "/api/changesets/{changeSetId}/apply": {
        post: {
          tags: ["Changesets"],
          summary: "Apply changeset",
          parameters: [
            {
              name: "changeSetId",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          requestBody: {
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    applyAll: { type: "boolean" },
                  },
                },
              },
            },
          },
          responses: {
            "200": { description: "Apply result" },
          },
        },
      },
      "/api/changesets/{changeSetId}/reject": {
        post: {
          tags: ["Changesets"],
          summary: "Reject changeset",
          parameters: [
            {
              name: "changeSetId",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: {
            "200": { description: "Changeset rejected" },
          },
        },
      },
      "/api/projects/{projectId}/git/status": {
        get: {
          tags: ["Git"],
          summary: "Get repository status",
          parameters: [
            {
              name: "projectId",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: {
            "200": {
              description: "Git status",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean", const: true },
                      data: {
                        $ref: "#/components/schemas/GitStatus",
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      "/api/projects/{projectId}/git/init": {
        post: {
          tags: ["Git"],
          summary: "Initialize repository",
          parameters: [
            {
              name: "projectId",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: {
            "200": { description: "Repository initialized" },
          },
        },
      },
      "/api/projects/{projectId}/git/stage": {
        post: {
          tags: ["Git"],
          summary: "Stage files",
          parameters: [
            {
              name: "projectId",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    paths: {
                      type: "array",
                      items: { type: "string" },
                    },
                  },
                  required: ["paths"],
                },
              },
            },
          },
          responses: {
            "200": { description: "Updated status" },
          },
        },
      },
      "/api/projects/{projectId}/git/unstage": {
        post: {
          tags: ["Git"],
          summary: "Unstage files",
          parameters: [
            {
              name: "projectId",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    paths: {
                      type: "array",
                      items: { type: "string" },
                    },
                  },
                  required: ["paths"],
                },
              },
            },
          },
          responses: {
            "200": { description: "Updated status" },
          },
        },
      },
      "/api/projects/{projectId}/git/commit": {
        post: {
          tags: ["Git"],
          summary: "Create commit",
          parameters: [
            {
              name: "projectId",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    message: { type: "string" },
                    paths: {
                      type: "array",
                      items: { type: "string" },
                    },
                  },
                  required: ["message"],
                },
              },
            },
          },
          responses: {
            "200": { description: "Commit created" },
          },
        },
      },
      "/api/projects/{projectId}/git/branches": {
        get: {
          tags: ["Git"],
          summary: "List branches",
          parameters: [
            {
              name: "projectId",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: {
            "200": { description: "List of branches" },
          },
        },
      },
      "/api/projects/{projectId}/git/branch": {
        post: {
          tags: ["Git"],
          summary: "Create branch",
          parameters: [
            {
              name: "projectId",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                  },
                  required: ["name"],
                },
              },
            },
          },
          responses: {
            "200": { description: "Branch created" },
          },
        },
      },
      "/api/projects/{projectId}/git/checkout": {
        post: {
          tags: ["Git"],
          summary: "Checkout branch",
          parameters: [
            {
              name: "projectId",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                  },
                  required: ["name"],
                },
              },
            },
          },
          responses: {
            "200": { description: "Branch checked out" },
          },
        },
      },
      "/api/projects/{projectId}/git/log": {
        get: {
          tags: ["Git"],
          summary: "Get commit log",
          parameters: [
            {
              name: "projectId",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
            {
              name: "limit",
              in: "query",
              schema: { type: "integer", default: 50 },
            },
          ],
          responses: {
            "200": { description: "Commit history" },
          },
        },
      },
      "/api/projects/{projectId}/git/diff": {
        get: {
          tags: ["Git"],
          summary: "Get diff",
          parameters: [
            {
              name: "projectId",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
            {
              name: "path",
              in: "query",
              schema: { type: "string" },
            },
            {
              name: "staged",
              in: "query",
              schema: { type: "boolean" },
            },
          ],
          responses: {
            "200": { description: "Diff output" },
          },
        },
      },
      "/api/projects/{projectId}/git/push": {
        post: {
          tags: ["Git"],
          summary: "Push to remote",
          parameters: [
            {
              name: "projectId",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: {
            "200": { description: "Push result" },
          },
        },
      },
      "/api/projects/{projectId}/git/pull": {
        post: {
          tags: ["Git"],
          summary: "Pull from remote",
          parameters: [
            {
              name: "projectId",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: {
            "200": { description: "Pull result" },
          },
        },
      },
      "/api/projects/{projectId}/git/pull-request": {
        get: {
          tags: ["Git"],
          summary: "List pull requests",
          parameters: [
            {
              name: "projectId",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: {
            "200": { description: "List of pull requests" },
          },
        },
        post: {
          tags: ["Git"],
          summary: "Create pull request",
          parameters: [
            {
              name: "projectId",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    title: { type: "string" },
                    body: { type: "string" },
                    head: { type: "string" },
                    base: { type: "string" },
                  },
                  required: ["title", "head", "base"],
                },
              },
            },
          },
          responses: {
            "200": { description: "Pull request created" },
          },
        },
      },
      "/api/projects/{projectId}/git/pull-request/{number}": {
        get: {
          tags: ["Git"],
          summary: "Get pull request details",
          parameters: [
            {
              name: "projectId",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
            {
              name: "number",
              in: "path",
              required: true,
              schema: { type: "integer" },
            },
          ],
          responses: {
            "200": { description: "Pull request details" },
          },
        },
        post: {
          tags: ["Git"],
          summary: "Merge pull request",
          parameters: [
            {
              name: "projectId",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
            {
              name: "number",
              in: "path",
              required: true,
              schema: { type: "integer" },
            },
          ],
          responses: {
            "200": { description: "Pull request merged" },
          },
        },
        patch: {
          tags: ["Git"],
          summary: "Add comment to pull request",
          parameters: [
            {
              name: "projectId",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
            {
              name: "number",
              in: "path",
              required: true,
              schema: { type: "integer" },
            },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    body: { type: "string" },
                  },
                  required: ["body"],
                },
              },
            },
          },
          responses: {
            "200": { description: "Comment added" },
          },
        },
      },
      "/api/projects/{projectId}/search": {
        post: {
          tags: ["Search"],
          summary: "Full-text search",
          parameters: [
            {
              name: "projectId",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    query: { type: "string" },
                    fileTypes: {
                      type: "array",
                      items: { type: "string" },
                    },
                    limit: { type: "integer" },
                  },
                  required: ["query"],
                },
              },
            },
          },
          responses: {
            "200": { description: "Search results" },
          },
        },
      },
      "/api/projects/{projectId}/search/semantic": {
        post: {
          tags: ["Search"],
          summary: "Semantic search",
          parameters: [
            {
              name: "projectId",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    query: { type: "string" },
                    limit: { type: "integer" },
                  },
                  required: ["query"],
                },
              },
            },
          },
          responses: {
            "200": { description: "Semantic search results" },
          },
        },
      },
      "/api/projects/{projectId}/terminal/sessions": {
        post: {
          tags: ["Terminal"],
          summary: "Create terminal session",
          parameters: [
            {
              name: "projectId",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: {
            "200": { description: "Terminal session created" },
          },
        },
      },
      "/api/terminal/{sessionId}": {
        get: {
          tags: ["Terminal"],
          summary: "Get terminal session",
          parameters: [
            {
              name: "sessionId",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: {
            "200": { description: "Terminal session details" },
          },
        },
      },
      "/api/terminal/{sessionId}/run": {
        post: {
          tags: ["Terminal"],
          summary: "Run command",
          parameters: [
            {
              name: "sessionId",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    command: { type: "string" },
                  },
                  required: ["command"],
                },
              },
            },
          },
          responses: {
            "200": { description: "Command output" },
          },
        },
      },
      "/api/terminal/{sessionId}/kill": {
        post: {
          tags: ["Terminal"],
          summary: "Kill terminal session",
          parameters: [
            {
              name: "sessionId",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: {
            "200": { description: "Session killed" },
          },
        },
      },
      "/api/rules": {
        get: {
          tags: ["Rules & Knowledge"],
          summary: "List rules",
          responses: {
            "200": { description: "List of rules" },
          },
        },
        post: {
          tags: ["Rules & Knowledge"],
          summary: "Create rule",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    title: { type: "string" },
                    content: { type: "string" },
                    scope: { type: "string" },
                  },
                  required: ["title", "content"],
                },
              },
            },
          },
          responses: {
            "200": { description: "Rule created" },
          },
        },
      },
      "/api/rules/{ruleId}": {
        get: {
          tags: ["Rules & Knowledge"],
          summary: "Get rule",
          parameters: [
            {
              name: "ruleId",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: {
            "200": { description: "Rule details" },
          },
        },
        patch: {
          tags: ["Rules & Knowledge"],
          summary: "Update rule",
          parameters: [
            {
              name: "ruleId",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: {
            "200": { description: "Rule updated" },
          },
        },
        delete: {
          tags: ["Rules & Knowledge"],
          summary: "Delete rule",
          parameters: [
            {
              name: "ruleId",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: {
            "200": { description: "Rule deleted" },
          },
        },
      },
      "/api/knowledge": {
        get: {
          tags: ["Rules & Knowledge"],
          summary: "List knowledge entries",
          responses: {
            "200": { description: "List of knowledge entries" },
          },
        },
        post: {
          tags: ["Rules & Knowledge"],
          summary: "Create knowledge entry",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    title: { type: "string" },
                    content: { type: "string" },
                    type: { type: "string" },
                  },
                  required: ["title", "content"],
                },
              },
            },
          },
          responses: {
            "200": { description: "Knowledge entry created" },
          },
        },
      },
      "/api/knowledge/search": {
        post: {
          tags: ["Rules & Knowledge"],
          summary: "Search knowledge base",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    query: { type: "string" },
                  },
                  required: ["query"],
                },
              },
            },
          },
          responses: {
            "200": { description: "Search results" },
          },
        },
      },
    },
    tags: [
      { name: "Projects", description: "Project management" },
      { name: "Files", description: "File operations" },
      { name: "Chat", description: "AI chat and threads" },
      { name: "Agents", description: "Autonomous AI agents" },
      { name: "Changesets", description: "Code change review" },
      { name: "Git", description: "Git operations" },
      { name: "Search", description: "Code search" },
      { name: "Terminal", description: "Terminal sessions" },
      { name: "Rules & Knowledge", description: "AI rules and knowledge base" },
    ],
  };

  return NextResponse.json(spec, {
    headers: {
      "Cache-Control": "public, max-age=3600",
    },
  });
}
