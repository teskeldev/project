# Teskel

> The best coding agent — built to make you extraordinarily productive.

Teskel is a real, full-stack **AI coding workspace**. You create projects, edit
files in a Monaco-backed editor, chat with an AI that understands your codebase,
let it propose structured changesets you review and apply, run safe terminal
commands, work with Git, and feed the AI persistent Rules and Knowledge — all
backed by a real database and an on-disk storage layer.

This is no longer a static dashboard mock. The sections below describe what is
**actually implemented today** and, just as honestly, what is still on the
roadmap.

---

## Architecture

| Layer | Technology | Notes |
|-------|------------|-------|
| Framework | **Next.js 16** (App Router) + **React 19** | Server components + route handlers under `src/app/api/**` |
| Language | **TypeScript** (strict) | `@/*` maps to `./src/*` |
| Styling | **Tailwind CSS 4** | |
| Database | **PostgreSQL** via **Prisma 6** | Schema in `prisma/schema.prisma`; client in `src/lib/db.ts` |
| Auth | **Auth.js (NextAuth v5 beta)** | Credentials provider + Prisma adapter; `src/auth.ts`, edge middleware in `src/middleware.ts` |
| File storage | Custom safe storage layer | `src/lib/storage.ts` — disk is the source of truth for file content |
| AI provider | OpenAI-compatible, SDK-free | `src/lib/ai/provider.ts` — talks to `${OPENAI_BASE_URL}/chat/completions`, supports SSE streaming |
| AI context | Project context builder | `src/lib/ai/context.ts` — injects enabled Rules + Knowledge under a char budget |
| Changesets | Structured change proposals | `src/lib/ai/changeset.ts` (+ `src/lib/diff.ts`) — AI proposes JSON, we validate, diff, persist, then apply on approval |
| Agents | Background-agent runner | `src/lib/agents/runner.ts` — request-driven step engine that proposes a changeset |
| Terminal | Safe command runner | `src/lib/terminal/runner.ts` — blocklist + cwd jail + env scrub + timeout |
| Git | `simple-git` wrapper | `src/lib/git/service.ts` |
| Secrets | AES-256-GCM | `src/lib/crypto.ts` — encrypts integration secrets at rest |
| Search | Keyword/regex engine | `src/lib/search/engine.ts` |
| Rate limiting | In-memory sliding window | `src/lib/rate-limit.ts` |

---

## Prerequisites

- **Node.js 20+**
- **Docker Desktop** (for the local Postgres database)

---

## Setup

Run these steps **in order**.

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Copy the example file and fill in the values:

```bash
cp .env.example .env
```

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | yes | Postgres connection string. Defaults to the docker DB on host port **5433** (`postgresql://teskel:teskel@localhost:5433/teskel?schema=public`). |
| `AUTH_SECRET` | yes | Secret used by Auth.js to sign sessions/JWTs. Generate one with `npx auth secret` or `openssl rand -base64 32`. |
| `NEXTAUTH_SECRET` | yes | Same value as `AUTH_SECRET` (kept for compatibility). Set both to the same string. |
| `NEXTAUTH_URL` | yes | Base URL of the app — `http://localhost:3000` in development. |
| `OPENAI_API_KEY` | for AI | API key for chat, changesets, and agents. Without it, AI features return a clear "AI is not configured" message and the rest of the app still works. |
| `OPENAI_BASE_URL` | no | OpenAI-compatible base URL. Defaults to `https://api.openai.com/v1`. Point this at any compatible gateway. |
| `OPENAI_MODEL` | no | Default chat model. Defaults to `gpt-4o-mini`. |
| `ENCRYPTION_KEY` | yes (for Integrations) | Secret used to derive the AES-256 key that encrypts stored integration secrets. Use **32+ characters**. Generate with `openssl rand -base64 32` (or `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`). |
| `PROJECT_STORAGE_DIR` | no | Root directory for project file storage. Defaults to `./.teskel-storage`. |
| `MAX_FILE_SIZE_MB` | no | Max size for a single saved file. Defaults to `2`. |
| `MAX_TERMINAL_TIMEOUT_SECONDS` | no | Per-command timeout for the terminal runner (clamped 1–300). Defaults to `30`. |

### 3. Start Postgres

```bash
npm run db:up
```

This starts a Postgres 16 container (see `docker-compose.yml`) on host port
**5433**. We deliberately use 5433 (mapped to the container's 5432) so it does
**not** collide with an existing local Postgres already listening on 5432.

### 4. Apply the schema

```bash
npm run db:migrate
```

### 5. Seed demo data

```bash
npm run db:seed
```

This creates a demo workspace, project, files, and rules. Demo login:

```
email:    demo@teskel.dev
password: password
```

### 6. Run the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Sign in with the demo
credentials, or create a new account at `/signup`.

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start the development server |
| `npm run build` | Production build (requires a reachable database) |
| `npm run start` | Start the production server |
| `npm run lint` | Run ESLint |
| `npm run test` | Run the Vitest unit suite (no DB/network needed) |
| `npm run test:watch` | Run Vitest in watch mode |
| `npm run test:e2e` | Run the Playwright e2e smoke test (requires a running app + DB — see Testing) |
| `npm run db:up` | Start the Postgres container (host port 5433) |
| `npm run db:migrate` | Apply Prisma migrations |
| `npm run db:seed` | Seed demo data |
| `npm run db:generate` | Regenerate the Prisma client |
| `npm run db:studio` | Open Prisma Studio |
| `npm run db:push` | Push the schema without a migration |
| `npm run db:reset` | Reset the database (drops + re-migrates) |

---

## Feature status

### Implemented (real)

| Feature | Notes |
|---------|-------|
| **Authentication** | Email/password signup + login (Auth.js Credentials + bcrypt). Middleware protects all `/dashboard` routes. |
| **Workspaces & projects** | Create projects (via the sidebar "New project" modal) under a workspace; project switcher persists the active project. |
| **File tree CRUD + editor** | Create/rename/delete files & folders, Monaco editor, save with Ctrl+S. Content lives on disk via the safe storage layer; metadata mirrors into the DB. |
| **AI chat (streaming)** | Per-project chat threads with SSE token streaming from an OpenAI-compatible provider. |
| **Rules & Knowledge → AI context** | Enabled Rules and Knowledge items are injected into the system prompt by the context builder, under a character budget. |
| **Agent runs** | A background-agent runner plans, gathers context, and **proposes** a changeset for review (never writes files or runs commands directly). |
| **Composer (diff / accept / reject / apply)** | Review proposed file changes as diffs, accept/reject per file, and apply accepted changes to disk + DB with conflict detection. |
| **Terminal (safe runner)** | Real command execution guarded by a blocklist, cwd jail, scrubbed env, output cap, and timeout. |
| **Git (simple-git)** | status, branches, checkout, stage/unstage, commit, log, diff, init, pull/push wrappers. |
| **Search** | Keyword + regex search across project files (filename / code / symbol modes) with ReDoS-conscious caps. |
| **Integrations (encrypted)** | Store provider config/secrets encrypted at rest with AES-256-GCM; connection test endpoint. |
| **Dashboard stats** | Summary endpoint backed by real data. |
| **Command palette** | Ctrl+K navigation. |

### Roadmap / TODO (not yet real)

- **Semantic / vector search** — the `…/search/semantic` endpoint currently
  delegates to the keyword engine and returns `semantic: false`. No embeddings
  or vector store exist yet.
- **Durable agent queue/worker** — agent runs are driven inside an HTTP request
  lifecycle via an in-memory registry. They do **not** survive cold starts or
  restarts. A real queue/worker (e.g. BullMQ + Redis) is needed for production.
- **Docker sandbox for terminal exec** — commands run on the host with
  defense-in-depth guards, **not** a true sandbox (see Security Notes).
- **OAuth providers** — the Google/GitHub buttons on the auth pages are UI
  only; only the Credentials provider is wired.
- **Password-reset email** — the "forgot password" flow is not backed by email.
- **Knowledge ingestion** — real file/binary upload and URL scraping for
  Knowledge items are not implemented (text entry only).
- **Provider config from DB** — `provider.ts` reads `OPENAI_API_KEY` from the
  environment; wiring it to a DB-stored, encrypted OpenAI integration is TODO.
- **Real GitHub / PR integration** — beyond the local `simple-git` wrapper.
- **Redis-backed rate limiting** — the limiter is in-memory and single-instance
  only.
- **MVP / placeholder dashboard pages** — the following are not yet backed by
  real data and still render the original static UI:
  - **Repositories** page (`/dashboard/projects`) — static list; create real
    projects via the sidebar "New project" modal instead.
  - **Artifacts** (`/dashboard/artifacts`)
  - **Canvas** (`/dashboard/canvas`)
  - **Design** (`/dashboard/design`)
  - **Extensions** (`/dashboard/extensions`)
  - **Diff Review** (`/dashboard/review`) — use the **Composer** for real diff
    review/apply
  - **Settings** (`/dashboard/settings`)

The remaining dashboard pages — Editor, Composer, Chat, Terminal, Git,
Agents, Search, Knowledge, Rules, Integrations, and the dashboard home — are
wired to real APIs.

---

## Security notes

Teskel handles real files, real commands, and real secrets. The current
safeguards:

- **Path-traversal guard.** Every client-supplied path passes through
  `resolveSafe()` / `normalizeRelPath()` in `src/lib/storage.ts`. Traversal
  (`..`), null bytes, absolute paths, drive prefixes, and sibling-prefix escapes
  are blocked or re-rooted; the resolved path is verified to stay inside the
  project root.
- **Terminal allow/block policy.** `validateCommand()` blocks destructive and
  exfiltration commands (e.g. `rm -rf /`, `sudo`, `chmod -R 777`, `mkfs`,
  `shutdown`, fork bombs, `curl | sh`, reading `.env`, `printenv`,
  `Remove-Item -Recurse -Force C:\`, `del /s`). Commands also run with a cwd
  jail, a scrubbed allowlisted environment (secrets are never forwarded), an
  output cap, and a timeout. **This is defense-in-depth, NOT a true sandbox** —
  it executes on the host. For production, run each command in a disposable
  Docker container.
- **Secrets at rest.** Integration secrets are encrypted with **AES-256-GCM**
  (`src/lib/crypto.ts`); each record uses a fresh random IV and an auth tag.
- **Secrets are never logged or returned.** The AI key is kept strictly
  server-side and never echoed; decrypt errors never leak key material.
- **No env exposure to the client.** AI/database/encryption secrets live only in
  server code and route handlers.
- **AI context is capped.** The context builder enforces a character budget so
  prompts can't grow unbounded.
- **Rate limiting.** An in-memory sliding-window limiter throttles AI, agent,
  and terminal endpoints. Use Redis for multi-instance production.
- **Auth middleware.** `src/middleware.ts` redirects unauthenticated users away
  from all `/dashboard` routes.

---

## Project layout

```
src/
  app/
    (auth)/            login, signup, forgot-password
    (dashboard)/       dashboard pages (editor, composer, chat, terminal, git, …)
    (marketing)/       public marketing pages
    api/               route handlers — all return { success, data } / { success, error }
      ai/              chat (stream) + generate-changeset
      agents/          agent run lifecycle + SSE events
      changesets/      apply / reject
      projects/[id]/   files, git, search, terminal, chat, changesets, agents
      integrations/    encrypted integration config + test
      knowledge/ rules/ workspaces/ dashboard/
  lib/
    api.ts             API helpers (ApiError, apiSuccess/Error, requireUser, validateBody, handleApiError)
    storage.ts         safe filesystem layer (resolveSafe, read/write/etc.)
    crypto.ts          AES-256-GCM encrypt/decrypt
    diff.ts            diff stats / parse / side-by-side
    rate-limit.ts      in-memory sliding-window limiter
    db.ts              Prisma client
    ai/                provider, context builder, changeset
    agents/            background-agent runner + schemas
    terminal/          safe command runner
    git/               simple-git wrapper
    search/            keyword/regex engine + schema
    integrations/      provider metadata + server helpers
    client/            typed browser API clients
    store/             active-project React context
  components/          marketing + dashboard UI (Sidebar, ProjectProvider, XtermTerminal, …)
prisma/                schema + migrations + seed
tests/
  unit/               Vitest unit tests (pure logic; no DB/network)
  e2e/                Playwright smoke test (requires running app + DB)
```

---

## Testing

### Unit tests (Vitest)

```bash
npm run test
```

Unit tests live in `tests/unit/**` and exercise **pure logic only** — they do
**not** require a database, network, or running server. Coverage includes:

- **Path security** (`storage.test.ts`) — traversal is blocked, absolute/drive
  paths are re-rooted inside the project, valid relative paths are allowed.
- **Terminal validator** (`terminal.test.ts`) — dangerous commands blocked, safe
  dev commands allowed, `git push --force` warns.
- **Crypto** (`crypto.test.ts`) — encrypt/decrypt roundtrip, random IV, tamper
  detection.
- **Diff utils** (`diff.test.ts`) — diff stats, unified-diff parsing,
  side-by-side alignment.
- **Context builder** (`context.test.ts`) — persona, Rules/Knowledge injection,
  and char-budget truncation (Prisma + storage are mocked).
- **API helpers** (`api.test.ts`) — response shapes and error mapping.

### End-to-end smoke test (Playwright)

```bash
npm run test:e2e
```

The smoke spec in `tests/e2e/smoke.spec.ts` walks the happy path: signup →
create project → create file → edit & save → ask AI → generate changeset → open
Composer.

It **cannot run without a fully provisioned environment**. Before running:

1. `npm run db:up` — start Postgres
2. `npm run db:migrate && npm run db:seed` — schema + demo data
3. `npm run dev` — app running on `http://localhost:3000`
4. *(optional)* set `OPENAI_API_KEY` so the AI/changeset steps execute live;
   without it, those steps assert the graceful "AI is not configured" path.

The Playwright `webServer` auto-start is intentionally commented out because it
requires a migrated database first.
