# Teskel Competitive Analysis & Feature Gap Implementation Plan

**Generated:** 2026-06-13  
**Objective:** Identify every feature that would make Teskel MORE PRO than Cursor, Windsurf, Codex CLI, Claude Code, and Kilocode.

---

## Executive Summary

Teskel already has a surprisingly strong foundation. It covers **~60%** of competitor features in some form. The critical gaps are:

1. **No real-time inline completions** (ghost text / tab completion) — table stakes
2. **No vector/semantic search** — needed for codebase-wide context
3. **No sandboxed execution** — commands run on host
4. **No extended thinking / reasoning display** — competitors show chain-of-thought
5. **No undo/redo for AI changes** — Windsurf's killer UX feature
6. **No parallel agent execution** — Codex CLI and Kilocode both have this
7. **No headless/CI mode** — Claude Code's enterprise differentiator

---

## Feature-by-Feature Competitive Matrix

### Legend
- ✅ = Teskel has it (fully implemented)
- ⚠️ = Teskel has partial/basic version
- ❌ = Teskel does NOT have it
- Effort: L=Low (1-3 days), M=Medium (1-2 weeks), H=High (3+ weeks)
- Impact: 🔴=Critical, 🟠=High, 🟡=Medium, ⚪=Low

---

## 1. CURSOR Features

| Feature | Teskel Status | Effort | Impact | Notes |
|---------|:---:|:---:|:---:|-------|
| Tab completion (ghost text) | ⚠️ | M | 🔴 | `src/lib/ai/complete.ts` exists but is API-call-based, not real-time ghost text in editor. No debounced inline display. |
| Cmd+K inline editing | ❌ | M | 🟠 | No select-code-then-describe-change flow. Teskel has Composer but it's a separate page, not inline. |
| Composer (multi-file AI editing) | ✅ | — | — | `src/lib/ai/changeset.ts` + Composer page with diff review/accept/reject/apply. |
| @-mentions (@file, @folder, @web, @docs, @codebase) | ❌ | M | 🟠 | Chat has no @-mention system for referencing context. Context is injected automatically but not user-directed. |
| .cursorrules file | ✅ | — | — | Teskel has Rules system (scoped: global/workspace/project/file) stored in DB. More powerful than .cursorrules. |
| Shadow workspace (background indexing) | ❌ | H | 🟡 | No background indexing. File tree is DB-mirrored but no embeddings/AST index. |
| Bug finder | ❌ | M | 🟡 | No proactive bug detection. Could be built as an agent task. |
| Notepads (persistent context) | ✅ | — | — | Knowledge items serve this purpose. Persistent, per-project/workspace. |
| Privacy mode (zero data retention) | ❌ | L | 🟡 | No toggle to disable logging/storage of AI conversations. |
| Codebase-wide context (embeddings) | ❌ | H | 🔴 | `semantic` search endpoint is a stub. No vector store, no embeddings pipeline. |

---

## 2. WINDSURF Features

| Feature | Teskel Status | Effort | Impact | Notes |
|---------|:---:|:---:|:---:|-------|
| Cascade (agentic flow) | ✅ | — | — | Agent runner (`src/lib/agents/runner.ts`) does plan→search→read→generate→review. |
| Flows (multi-step autonomous actions) | ⚠️ | M | 🟠 | Agent has fixed step sequence. No user-configurable multi-step flows or looping. |
| Memories (persistent project context) | ✅ | — | — | Rules + Knowledge + Skills = persistent context injected into AI. |
| Supercomplete (multi-line with recent edit awareness) | ❌ | M | 🔴 | Completion endpoint exists but doesn't track recent edits or provide multi-line ghost text. |
| Command mode (terminal AI) | ❌ | L | 🟠 | Terminal exists but no "AI suggests commands" mode. |
| Preview mode (see changes before applying) | ✅ | — | — | Composer shows diffs before apply. |
| Undo/redo for AI changes | ❌ | M | 🟠 | No changeset rollback. Once applied, only git revert is available. |

---

## 3. CODEX CLI Features

| Feature | Teskel Status | Effort | Impact | Notes |
|---------|:---:|:---:|:---:|-------|
| Full autonomy modes (suggest/auto-edit/full-auto) | ⚠️ | L | 🟠 | Permission system exists (`src/lib/ai/permissions.ts`) with ALLOW/ASK/DENY but no "full auto" mode that chains actions. |
| Sandboxed execution (Docker) | ❌ | H | 🔴 | Terminal runs on host with blocklist. README explicitly marks Docker sandbox as TODO. |
| Multi-file editing with git-based rollback | ⚠️ | M | 🟠 | Multi-file changesets exist. Git rollback is manual (no automatic snapshot before apply). |
| Parallel task execution | ❌ | H | 🟠 | Agent runner is single-threaded per run. No parallel agent spawning. |
| GitHub integration (PR creation, issue reading) | ⚠️ | L | 🟠 | `src/lib/github.ts` has full PR CRUD but no issue reading, no auto-PR-from-changeset flow. |
| Streaming reasoning display | ⚠️ | L | 🟡 | Chat streams tokens. Agent emits step events. But no "thinking" display like extended thinking. |

---

## 4. CLAUDE CODE Features

| Feature | Teskel Status | Effort | Impact | Notes |
|---------|:---:|:---:|:---:|-------|
| Extended thinking (visible reasoning) | ❌ | M | 🟠 | No reasoning/thinking token display. Provider doesn't request `thinking` blocks. |
| /compact command (context management) | ✅ | — | — | `src/lib/ai/compaction.ts` — auto-compacts threads over 30 messages, force-compact available. |
| Memory files (.claude/CLAUDE.md) | ✅ | — | — | Rules + Knowledge system is the equivalent (and more powerful — scoped, DB-backed). |
| Sub-agents (parallel task delegation) | ❌ | H | 🟠 | No sub-agent spawning. Single agent per run. |
| Permission system (allow/deny per tool) | ✅ | — | — | `src/lib/ai/permissions.ts` — full ALLOW/ASK/DENY per tool with glob patterns. |
| Git-aware (auto-commit, branch management) | ⚠️ | L | 🟡 | Git service exists. AI commit message generation exists. But no auto-commit-after-apply or auto-branch-creation. |
| Headless mode (CI/CD integration) | ❌ | M | 🔴 | No headless/API-only mode. CLI exists but is minimal (login/status/chat). No CI runner. |
| Custom slash commands | ✅ | — | — | `src/lib/commands.ts` + `SlashCommand` model. Built-in + custom per workspace. |
| MCP (Model Context Protocol) support | ❌ | H | 🟠 | No MCP server or client implementation. |

---

## 5. KILOCODE Features

| Feature | Teskel Status | Effort | Impact | Notes |
|---------|:---:|:---:|:---:|-------|
| Agent Manager (worktree parallelism) | ❌ | H | 🟠 | No git worktree management, no parallel agent branches. |
| Skills system | ✅ | — | — | `src/lib/skills.ts` + `Skill` model. Loadable, per-workspace/project, injected into context. |
| Modes (Architect/Coder/Debugger) | ❌ | L | 🟡 | No mode switching. Single AI persona. Could be implemented as skill presets. |
| 500+ models via gateway | ⚠️ | L | 🟡 | 4 providers (OpenAI, Anthropic, Groq, Ollama). Supports any OpenAI-compatible endpoint via env var. |
| MCP marketplace | ❌ | H | 🟡 | Extension system exists but is JSON-config only, not MCP. |
| Session forking/revert | ❌ | M | 🟠 | No conversation forking. Thread compaction exists but no branching. |
| Organization-level config | ✅ | — | — | Workspace model with members, roles, shared rules/knowledge/integrations. |

---

## Summary Scorecard

| Competitor | Features Analyzed | Teskel Has (✅) | Partial (⚠️) | Missing (❌) |
|-----------|:-:|:-:|:-:|:-:|
| **Cursor** | 10 | 3 | 1 | 6 |
| **Windsurf** | 7 | 4 | 1 | 2 |
| **Codex CLI** | 6 | 0 | 4 | 2 |
| **Claude Code** | 9 | 4 | 2 | 3 |
| **Kilocode** | 7 | 3 | 1 | 3 |
| **TOTAL** | 39 | 14 (36%) | 9 (23%) | 16 (41%) |

---

## PRIORITIZED IMPLEMENTATION PLAN

### Tier 1: TABLE STAKES (Must-Have — Multiple Competitors Have These)

These features are present in 3+ competitors. Without them, Teskel looks incomplete.

---

#### 1.1 Real-Time Inline Completions (Ghost Text / Tab Complete)
**Impact:** 🔴 Critical | **Effort:** Medium (1-2 weeks) | **Competitors:** Cursor, Windsurf

**Current state:** `src/lib/ai/complete.ts` exists with a completion endpoint, but it's a request-response API. No real-time ghost text in the Monaco editor.

**Implementation plan:**
```
Files to create/modify:
- src/components/editor/InlineCompletion.tsx (new)
- src/components/editor/useCompletionProvider.ts (new)
- src/lib/ai/complete.ts (enhance)
- src/app/api/ai/complete/route.ts (enhance)

Technical approach:
1. Monaco InlineCompletionProvider registration
   - Register a custom InlineCompletionsProvider with Monaco
   - Debounce triggers (300ms after last keystroke)
   - Cancel in-flight requests on new keystrokes
   
2. Context-aware completion
   - Send surrounding 50 lines + cursor position
   - Include recent edit history (last 5 edits in session) for Supercomplete-like awareness
   - Language-specific prompt tuning
   
3. Multi-line ghost text rendering
   - Use Monaco's inline decorations API for ghost text
   - Tab to accept, Escape to dismiss
   - Partial accept (word-by-word with Ctrl+Right)
   
4. Performance optimizations
   - Client-side LRU cache (50 entries, keyed by content hash + position)
   - Speculative pre-fetch on cursor movement
   - Use fastest available model (gpt-4o-mini or Groq for speed)
   
5. Rate limiting
   - Already have 60/min limit; may need to increase to 120/min
   - Add client-side throttle to avoid wasted requests
```

**Estimated LOC:** ~400 new, ~100 modified

---

#### 1.2 Sandboxed Terminal Execution (Docker)
**Impact:** 🔴 Critical | **Effort:** High (2-3 weeks) | **Competitors:** Codex CLI, (Cursor shadow workspace)

**Current state:** Terminal runner uses blocklist + cwd jail + env scrub. README explicitly marks Docker sandbox as TODO.

**Implementation plan:**
```
Files to create/modify:
- src/lib/terminal/sandbox.ts (new)
- src/lib/terminal/docker-manager.ts (new)
- src/lib/terminal/runner.ts (modify — add sandbox mode)
- docker/sandbox/Dockerfile (new)
- docker/sandbox/entrypoint.sh (new)

Technical approach:
1. Sandbox container image
   - Minimal Debian image with Node, Python, Go, Rust toolchains
   - Read-only root filesystem
   - Network disabled by default (--network=none)
   - Configurable network access per workspace setting
   
2. Container lifecycle
   - Pool of warm containers (pre-created, 2-3 per workspace)
   - Mount project storage as read-write volume
   - 30s timeout (configurable)
   - Auto-cleanup on session end
   
3. Execution model
   - Spawn command inside container via Docker exec
   - Stream stdout/stderr back via WebSocket
   - Capture exit code
   - Resource limits: 512MB RAM, 1 CPU, no swap
   
4. Fallback mode
   - If Docker unavailable, fall back to current host execution with blocklist
   - Admin setting to enforce sandbox-only mode
   
5. Security enhancements
   - No privileged mode
   - Drop all capabilities except NET_BIND_SERVICE (when network enabled)
   - Seccomp profile to block dangerous syscalls
   - tmpfs for /tmp (no disk persistence outside project mount)
```

**Estimated LOC:** ~600 new, ~100 modified

---

#### 1.3 Codebase-Wide Semantic Search (Embeddings)
**Impact:** 🔴 Critical | **Effort:** High (2-3 weeks) | **Competitors:** Cursor, (Claude Code via codebase awareness)

**Current state:** `semantic` search endpoint delegates to keyword engine. No embeddings.

**Implementation plan:**
```
Files to create/modify:
- src/lib/search/embeddings.ts (new)
- src/lib/search/vector-store.ts (new)
- src/lib/search/indexer.ts (new)
- src/app/api/projects/[projectId]/search/semantic/route.ts (rewrite)
- prisma/schema.prisma (add Embedding model)
- docker-compose.yml (add pgvector or qdrant)

Technical approach:
1. Embedding generation
   - Use OpenAI text-embedding-3-small (1536 dims) or local model
   - Chunk files by function/class (AST-aware for TS/JS/Python)
   - Fallback: sliding window (512 tokens, 128 overlap)
   
2. Vector storage
   - Option A: pgvector extension (keeps everything in Postgres)
   - Option B: Qdrant sidecar container (better for scale)
   - Recommend pgvector for simplicity (single DB)
   
3. Indexing pipeline
   - Background job on file save (debounced 5s)
   - Full re-index on project import or git pull
   - Incremental: only re-embed changed files
   - Track file content hash to skip unchanged
   
4. Query flow
   - Embed user query → cosine similarity search → top-K chunks
   - Hybrid: combine vector results with keyword results (RRF fusion)
   - Return file paths + relevant snippets
   
5. Context injection
   - Modify `buildProjectContext()` to include semantic search results
   - When user asks a question, auto-search codebase for relevant context
   - Budget: up to 4000 chars of semantic context
```

**Estimated LOC:** ~800 new, ~150 modified

---

#### 1.4 Headless / CI Mode
**Impact:** 🔴 Critical | **Effort:** Medium (1-2 weeks) | **Competitors:** Claude Code, Codex CLI

**Current state:** CLI exists (`cli/src/`) with login/status/chat commands. No headless execution.

**Implementation plan:**
```
Files to create/modify:
- cli/src/commands/run.ts (new)
- cli/src/commands/agent.ts (new)
- cli/src/commands/apply.ts (new)
- src/app/api/headless/route.ts (new)
- src/app/api/headless/[runId]/route.ts (new)

Technical approach:
1. CLI agent command
   - `teskel agent "fix all TypeScript errors"` — runs agent headlessly
   - `teskel agent --auto-apply` — applies changes without review
   - `teskel agent --branch feature/fix` — creates branch first
   - Outputs structured JSON or human-readable progress
   
2. API key authentication
   - Already have ApiKey model in schema
   - Add `X-API-Key` header auth to headless endpoints
   - Bypass session-based auth for CI use
   
3. GitHub Actions integration
   - Publish `teskel-action` GitHub Action
   - Inputs: goal, auto-apply, model, branch
   - Outputs: changeset-id, files-changed, PR-url
   
4. Webhook triggers
   - On push/PR events, trigger agent runs via webhook
   - Use existing webhook infrastructure
   
5. Exit codes & output
   - 0 = success (changes applied or no changes needed)
   - 1 = failure (agent error)
   - 2 = pending review (changes proposed but not auto-applied)
   - JSON output mode for machine parsing
```

**Estimated LOC:** ~500 new CLI, ~300 new API

---

### Tier 2: HIGH IMPACT + LOW/MEDIUM EFFORT (Quick Wins)

---

#### 2.1 @-Mentions in Chat
**Impact:** 🟠 High | **Effort:** Low (3-5 days) | **Competitors:** Cursor

**Implementation plan:**
```
Files to create/modify:
- src/components/chat/MentionInput.tsx (new)
- src/lib/ai/mentions.ts (new)
- src/app/api/ai/chat/stream/route.ts (modify)

Technical approach:
1. Parse @-mentions from user message before sending to AI
   - @file:path/to/file → inject file content
   - @folder:src/lib → inject file tree of folder
   - @search:query → run search and inject results
   - @git:diff → inject current git diff
   - @web:url → fetch URL content (already have web_fetch permission)
   
2. UI autocomplete
   - Trigger on @ character in chat input
   - Show dropdown with file tree, recent files, folders
   - Keyboard navigation (arrow keys + enter)
   
3. Context injection
   - Resolve mentions before building AI messages
   - Inject as additional context blocks with clear labels
   - Respect character budget
```

**Estimated LOC:** ~350 new, ~50 modified

---

#### 2.2 Undo/Redo for AI Changes (Changeset Snapshots)
**Impact:** 🟠 High | **Effort:** Medium (1 week) | **Competitors:** Windsurf

**Implementation plan:**
```
Files to create/modify:
- src/lib/changeset-history.ts (new)
- src/app/api/changesets/[id]/revert/route.ts (new)
- prisma/schema.prisma (add FileSnapshot model)

Technical approach:
1. Pre-apply snapshot
   - Before applying a changeset, snapshot all affected files
   - Store in FileSnapshot table: { changeSetId, filePath, content, createdAt }
   
2. Revert endpoint
   - POST /api/changesets/:id/revert
   - Reads snapshots, writes original content back to disk + DB
   - Creates a new "revert" changeset for audit trail
   
3. UI integration
   - "Undo" button on applied changesets in Composer
   - Confirmation dialog showing what will be reverted
   - History timeline showing apply/revert events
   
4. Git integration
   - Optionally auto-commit before apply (checkpoint)
   - Revert creates a revert commit
```

**Estimated LOC:** ~300 new, ~80 modified

---

#### 2.3 Extended Thinking / Reasoning Display
**Impact:** 🟠 High | **Effort:** Low-Medium (3-5 days) | **Competitors:** Claude Code, Codex CLI

**Implementation plan:**
```
Files to create/modify:
- src/lib/ai/provider.ts (modify — support thinking blocks)
- src/app/api/ai/chat/stream/route.ts (modify — stream thinking)
- src/components/chat/ThinkingBlock.tsx (new)

Technical approach:
1. Provider support
   - For Anthropic: add `thinking` parameter to request
   - For OpenAI o1/o3: parse reasoning_content from response
   - Stream thinking tokens separately from content tokens
   
2. SSE protocol extension
   - New event type: `thinking` (separate from `delta`)
   - Client distinguishes thinking vs content tokens
   
3. UI rendering
   - Collapsible "Thinking..." block above the response
   - Shows reasoning in a muted, monospace font
   - Auto-collapsed after response completes
   - Toggle to show/hide thinking for any message
```

**Estimated LOC:** ~200 new, ~100 modified

---

#### 2.4 Autonomy Modes (Suggest / Auto-Edit / Full-Auto)
**Impact:** 🟠 High | **Effort:** Low (2-3 days) | **Competitors:** Codex CLI

**Current state:** Permission system exists with ALLOW/ASK/DENY. Missing is a global "mode" toggle.

**Implementation plan:**
```
Files to create/modify:
- src/lib/ai/autonomy.ts (new)
- src/app/api/workspace/[id]/autonomy/route.ts (new)
- prisma/schema.prisma (add autonomyMode to Workspace)

Technical approach:
1. Three modes
   - SUGGEST: AI proposes changes, never applies (current default)
   - AUTO_EDIT: AI applies file changes automatically, asks for terminal/git
   - FULL_AUTO: AI applies all changes, runs commands, commits (sandbox required)
   
2. Mode enforcement
   - Check mode in changeset apply flow
   - In AUTO_EDIT/FULL_AUTO, skip the Composer review step
   - In FULL_AUTO, auto-approve terminal commands (requires sandbox)
   
3. Safety rails
   - FULL_AUTO requires Docker sandbox to be enabled
   - Always create git checkpoint before auto-apply
   - Rate limit: max 10 auto-applies per minute
   - Notification on every auto-apply action
```

**Estimated LOC:** ~150 new, ~80 modified

---

#### 2.5 AI Command Mode (Terminal AI)
**Impact:** 🟠 High | **Effort:** Low (2-3 days) | **Competitors:** Windsurf

**Implementation plan:**
```
Files to create/modify:
- src/lib/terminal/ai-suggest.ts (new)
- src/app/api/terminal/suggest/route.ts (new)
- src/components/terminal/AISuggest.tsx (new)

Technical approach:
1. Natural language → command translation
   - User types in natural language in terminal
   - AI suggests the shell command
   - User confirms with Enter or edits
   
2. Context-aware suggestions
   - Include current directory, recent commands, OS info
   - Include project type (package.json scripts, Makefile targets)
   
3. UI integration
   - Special input mode triggered by `?` prefix or Ctrl+I
   - Shows suggested command with explanation
   - Tab to accept, Escape to cancel
```

**Estimated LOC:** ~200 new

---

#### 2.6 Auto-Commit After Apply + Branch Management
**Impact:** 🟡 Medium | **Effort:** Low (1-2 days) | **Competitors:** Claude Code, Codex CLI

**Implementation plan:**
```
Files to modify:
- src/app/api/changesets/[id]/apply/route.ts (modify)
- src/lib/git/service.ts (add createBranch helper)

Technical approach:
1. Post-apply hook
   - After successful changeset apply, optionally auto-commit
   - Use AI-generated commit message (already have this)
   - Workspace setting: autoCommitAfterApply (boolean)
   
2. Branch creation
   - Agent runs can specify a branch name
   - Auto-create branch before applying changes
   - Option to auto-push after commit
```

**Estimated LOC:** ~100 modified

---

#### 2.7 Cmd+K Inline Editing
**Impact:** 🟠 High | **Effort:** Medium (1 week) | **Competitors:** Cursor

**Implementation plan:**
```
Files to create/modify:
- src/components/editor/InlineEdit.tsx (new)
- src/components/editor/InlineEditDialog.tsx (new)
- src/app/api/ai/inline-edit/route.ts (new)
- src/lib/ai/inline-edit.ts (new)

Technical approach:
1. Selection-based editing
   - User selects code in Monaco → presses Cmd+K
   - Floating input appears above selection
   - User describes desired change in natural language
   
2. AI generates replacement
   - Send: selected code + surrounding context + instruction
   - AI returns new code for the selection
   - Show inline diff (red/green) in editor
   
3. Accept/reject
   - Enter to accept replacement
   - Escape to reject and restore original
   - Ctrl+Z to undo after accept
```

**Estimated LOC:** ~400 new

---

### Tier 3: UNIQUE DIFFERENTIATORS (Things NO Competitor Has)

These would make Teskel stand out from ALL competitors:

---

#### 3.1 Visual Changeset Timeline (Git + AI History Fusion)
**Impact:** 🟠 High | **Effort:** Medium | **Competitors:** None

**Concept:** A visual timeline showing the interleaved history of git commits AND AI changesets, with the ability to revert to any point. Like git log + AI audit trail merged into one navigable UI.

```
Technical approach:
- Merge git log entries with ChangeSet records by timestamp
- Visual timeline component (vertical, scrollable)
- Each node shows: commit/changeset, author (human/AI), files changed
- Click any node to see the diff
- "Restore to this point" button (git checkout + revert changesets)
- Branch visualization showing where AI diverged
```

---

#### 3.2 AI Code Review with Inline Annotations
**Impact:** 🟠 High | **Effort:** Low-Medium (already partially built) | **Competitors:** None have this as a first-class feature

**Current state:** `src/app/api/ai/review/route.ts` exists and creates ReviewComment rows. But no inline annotation UI in the editor.

```
Technical approach:
- Monaco editor decorations showing AI review comments inline
- Gutter icons (💡⚠️🐛) at commented lines
- Hover to see AI suggestion
- One-click "Apply suggestion" that creates a mini-changeset
- Severity levels: info, warning, error, security
```

---

#### 3.3 Live Collaboration on AI Sessions (Multiplayer AI)
**Impact:** 🟠 High | **Effort:** High | **Competitors:** None

**Concept:** Multiple team members can watch and interact with the same AI agent session in real-time. One person starts an agent, others can observe, provide feedback, or take over.

```
Technical approach:
- WebSocket room per agent run
- Real-time event broadcast to all connected clients
- "Suggest" button for observers to inject guidance
- Cursor presence (who's watching)
- Chat sidebar within agent view for team discussion
```

---

#### 3.4 AI-Powered Dependency Analysis & Upgrade Assistant
**Impact:** 🟡 Medium | **Effort:** Medium | **Competitors:** None as integrated feature

**Concept:** Automatically analyze project dependencies, identify outdated/vulnerable packages, and generate upgrade changesets with migration code.

```
Technical approach:
- Parse package.json/requirements.txt/Cargo.toml
- Check npm registry / PyPI for latest versions
- AI generates migration changeset for breaking changes
- Security advisory integration (npm audit / GitHub advisories)
- One-click "Upgrade all safe dependencies" button
```

---

#### 3.5 Project Templates with AI Customization
**Impact:** 🟡 Medium | **Effort:** Low | **Competitors:** None with AI customization

**Concept:** Start a new project from a template, then describe customizations in natural language. AI modifies the template to match your needs.

```
Technical approach:
- Template gallery (Next.js, Express, FastAPI, etc.)
- After selecting template, chat interface for customization
- "Add authentication", "Use PostgreSQL instead of MongoDB"
- AI generates changeset against template files
- Apply and you have a customized starter
```

---

#### 3.6 Smart Context Window (Auto @-mention)
**Impact:** 🟠 High | **Effort:** Medium | **Competitors:** None do this automatically

**Concept:** When the user asks a question, Teskel automatically determines which files are relevant (using semantic search + import graph analysis) and includes them — without the user needing to @-mention anything.

```
Technical approach:
- On each chat message, run semantic search against codebase
- Analyze import/require graph from currently open file
- Auto-include: open file, its imports, test file, related config
- Show "Context used: [file1, file2, ...]" badge on AI response
- User can click to expand/collapse context view
- Learns from user corrections ("that file wasn't relevant")
```

---

### Tier 4: NICE-TO-HAVE (Lower Priority)

| Feature | Effort | Impact | Notes |
|---------|:---:|:---:|-------|
| Privacy mode toggle | L | ⚪ | Add workspace setting to disable conversation persistence |
| AI modes (Architect/Coder/Debugger) | L | ⚪ | Implement as skill presets that swap the system prompt |
| Session forking | M | 🟡 | Clone a chat thread at any message to explore alternatives |
| Bug finder (proactive) | M | 🟡 | Scheduled agent that scans for common issues |
| MCP support | H | 🟡 | Implement MCP client to connect to external tool servers |
| Parallel agents | H | 🟡 | Spawn multiple agent runs on different branches simultaneously |
| More model providers | L | ⚪ | Add Mistral, Cohere, Together AI to provider registry |

---

## IMPLEMENTATION ROADMAP

### Phase 1: Foundation (Weeks 1-2) — "Table Stakes"
| Priority | Feature | Days |
|:---:|---------|:---:|
| P0 | 1.1 Real-time inline completions | 8 |
| P0 | 2.1 @-mentions in chat | 4 |
| P0 | 2.4 Autonomy modes | 2 |
| P0 | 2.5 AI command mode (terminal) | 2 |
| P0 | 2.6 Auto-commit + branch management | 2 |

**Outcome:** Teskel matches Cursor's core UX and Codex CLI's autonomy.

### Phase 2: Power Features (Weeks 3-4) — "Pro Level"
| Priority | Feature | Days |
|:---:|---------|:---:|
| P1 | 2.2 Undo/redo for AI changes | 5 |
| P1 | 2.3 Extended thinking display | 4 |
| P1 | 2.7 Cmd+K inline editing | 5 |
| P1 | 1.4 Headless/CI mode | 8 |

**Outcome:** Teskel surpasses Windsurf and matches Claude Code's enterprise story.

### Phase 3: Differentiation (Weeks 5-8) — "Beyond Competition"
| Priority | Feature | Days |
|:---:|---------|:---:|
| P2 | 1.3 Semantic search (embeddings) | 12 |
| P2 | 1.2 Docker sandbox | 12 |
| P2 | 3.1 Visual changeset timeline | 8 |
| P2 | 3.2 AI code review with inline annotations | 5 |
| P2 | 3.6 Smart auto-context | 8 |

**Outcome:** Teskel has unique features no competitor offers.

### Phase 4: Scale (Weeks 9-12) — "Enterprise Ready"
| Priority | Feature | Days |
|:---:|---------|:---:|
| P3 | 3.3 Live collaboration on AI sessions | 15 |
| P3 | Parallel agent execution | 10 |
| P3 | MCP support | 12 |
| P3 | Durable agent queue (BullMQ + Redis) | 8 |

**Outcome:** Teskel is enterprise-grade with team features no competitor has.

---

## WHAT TESKEL ALREADY DOES BETTER

Features where Teskel is **already ahead** of competitors:

| Feature | Teskel Advantage |
|---------|-----------------|
| **Scoped Rules** | More powerful than .cursorrules — supports GLOBAL/WORKSPACE/PROJECT/FILE scopes with glob patterns |
| **Skills system** | More structured than Claude Code's CLAUDE.md — named, versioned, toggleable |
| **Permission system** | More granular than any competitor — per-tool, per-pattern, ALLOW/ASK/DENY |
| **Custom slash commands** | With template variables — more powerful than Claude Code's static commands |
| **Changeset review flow** | Full diff viewer with per-file accept/reject — better than Cursor's all-or-nothing |
| **Extension system** | JSON-configured hooks (commands, status bar, file icons, editor actions) |
| **Webhook system** | HMAC-signed webhook delivery with retry — enterprise-grade event system |
| **Multi-provider AI** | OpenAI + Anthropic + Groq + Ollama with DB-stored encrypted keys |
| **AI code review** | Automated review comments on changesets — unique feature |
| **Billing/usage tracking** | Built-in subscription + usage metering — ready for SaaS |
| **Notifications** | In-app notification system for agent events — no competitor has this in-product |

---

## QUICK WIN SUMMARY (Highest ROI)

If you can only do 5 things, do these:

1. **@-mentions in chat** (3-4 days) — Instantly makes the AI 10x more useful
2. **Autonomy modes** (2-3 days) — Matches Codex CLI with minimal code
3. **AI terminal suggestions** (2-3 days) — Matches Windsurf Command mode
4. **Extended thinking display** (3-4 days) — Makes AI feel smarter
5. **Auto-commit after apply** (1-2 days) — Matches Claude Code's git-awareness

**Total: ~2 weeks for 5 high-impact features that close the gap with ALL competitors.**

---

## TECHNICAL DEBT TO ADDRESS

Before scaling features, fix these:

| Issue | Priority | Notes |
|-------|:---:|-------|
| Durable agent queue | P1 | Agents die on cold start. Need BullMQ + Redis. |
| Redis rate limiting | P2 | Current in-memory limiter doesn't work multi-instance. |
| Real OAuth providers | P2 | Google/GitHub login buttons are non-functional. |
| Provider config from DB | P1 | Currently env-only. Integration page stores keys but provider.ts doesn't always use them. |
| Proper WebSocket for terminal | P2 | Currently SSE; WebSocket would be better for bidirectional terminal. |

---

*End of competitive analysis.*
