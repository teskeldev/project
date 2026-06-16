# 🧠 Teskel Agent Guide (CLAUDE.md)

Welcome to the **Teskel** repository. This guide provides essential information for AI agents developer workflow, architectural patterns, database schemas, and codebase guidelines.

---

## 🏗️ Project Overview

**Teskel** is a full-stack, Next.js 16-based AI coding workspace. It includes:
- A browser-based IDE using the **Monaco Editor** and **xterm.js** terminals.
- A sophisticated **Quality Amplification Engine** that routes tasks, assemblies context, runs parallel agents, runs validation checks (lint, types, tests), and scores outputs.
- A robust agent backend running with **BullMQ** + **Redis** queueing.

---

## ⚙️ Tech Stack

- **Framework**: Next.js 16 (App Router, Standalone output) + React 19
- **Styling**: Tailwind CSS 4
- **Database**: PostgreSQL 16 + Prisma 6.19.3
- **Authentication**: Auth.js (NextAuth v5 beta) + credentials & OAuth
- **Queue**: BullMQ + ioredis (agent background loops)
- **Testing**: Vitest (unit/integration) + Playwright (E2E)
- **Linter**: ESLint 9 + eslint-plugin-security

---

## 📁 Key File Map

| Path | Purpose |
|---|---|
| [prisma/schema.prisma](file:///root/project/prisma/schema.prisma) | Core database models |
| [src/auth.ts](file:///root/project/src/auth.ts) | Server-side authentication |
| [src/lib/ai/quality-engine.ts](file:///root/project/src/lib/ai/quality-engine.ts) | Core Quality Amplification Engine orchestrator |
| [src/lib/ai/model-router.ts](file:///root/project/src/lib/ai/model-router.ts) | Model Routing (Frontier, Strong, Medium, Weak tiers) |
| [src/lib/ai/parallel-agents.ts](file:///root/project/src/lib/ai/parallel-agents.ts) | Concurrency & sub-agent execution |
| [src/lib/ai/best-of-n.ts](file:///root/project/src/lib/ai/best-of-n.ts) | Best-of-N selection logic |
| [src/lib/ai/fusion-panel.ts](file:///root/project/src/lib/ai/fusion-panel.ts) | Multi-Model Fusion Panel (Track A & Track B) |
| [src/data/skills-registry.ts](file:///root/project/src/data/skills-registry.ts) | Awesome Claude Skills registry |

---

## 🤖 AI Quality Amplification Pipeline

All AI code generation flows through [quality-engine.ts](file:///root/project/src/lib/ai/quality-engine.ts):

```
User Request ──▶ task-classifier ──▶ complexity-estimator ──▶ model-router
                     │
                     ▼
             smart-context ──▶ execution-plan (pipeline + pattern)
                     │
                     ▼
               execute-plan (agentless | agent_loop | multi_pass | fusion)
                     │
                     ▼
             run-verification (ast-validator + lint-validator + test-runner)
                     │
                     ▼
               score-quality ──▶ Output & Metadata
```

### Pipelines Available:
1. `agentless`: Direct single-file edits.
2. `agent_loop`: Multi-step background agent loop.
3. `multi_pass`: Chain-of-thought refinement.
4. `fusion`: Multi-model panel -> judge synthesis (Track A / B).

---

## 🧪 Testing and Verification Commands

Before committing code, verify it compiles and runs correctly:

```bash
# Run Unit and Integration Tests
npm run test

# Run Watch Mode Tests
npm run test:watch

# Run Typecheck
npm run typecheck

# Run Linter
npm run lint

# Security Audit
npm run lint:security
```

---

## 🔒 Security Best Practices

1. **API Keys**: Keys must always be retrieved using `resolveApiKey` from the database or resolved from edge-safe environments. Never hardcode API keys.
2. **Server-Only Imports**: Keep server-side AI execution modules isolated. Do not import `provider.ts` or `complete.ts` into client-side components.
3. **Database Scoping**: Always filter resources by `workspaceId` and verify user permissions using RBAC (Owner, Admin, Member, Viewer) before executing workspace operations.
