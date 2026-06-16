# Teskel Architecture

A high-level map of the Teskel codebase. For end-user docs see
[README.md](./README.md); for a deeper security/code-quality audit see the
historical `AUDIT_FINAL.md` (if present in the repo history).

## Overview

Teskel is a full-stack AI coding workspace built on Next.js 16 (App Router)
with a PostgreSQL backend. It is a single deployable app — the marketing site,
the authenticated dashboard, the API surface, and the editor all live in the
same Next.js process.

```
+-------------------------------------------------------------+
|                        Browser                              |
|   marketing pages  |  dashboard / editor  |  realtime SSE  |
+----------+-----------------+-----------------+-------------+
           |                 |                 |
+----------v-----------------v-----------------v-------------+
|                     Next.js (App Router)                    |
|                                                              |
|  / (marketing)        /dashboard/*          /api/*          |
|  RSC + minimal JS     auth-gated RSC        route handlers  |
+--+-------------------+-------------------+------------------+
   |                   |                   |
   |   src/middleware.ts (edge)            |
   |   - auth gating                       |
   |   - CSRF cookie issuance              |
   |   - security headers (XFO, HSTS, ...) |
   |                                       |
+--v----------------+   +-----------------v----------------+
|  Auth.js v5       |   |  Server libraries                 |
|  (NextAuth)       |   |  src/lib/*                        |
|  - credentials    |   |  - db (Prisma)                    |
|  - Prisma adapter |   |  - ai (provider, context,         |
|  - edge config    |   |            changeset, agents)    |
+-------------------+   |  - storage (safe file I/O)        |
                        |  - git (simple-git wrapper)       |
                        |  - terminal (allowlisted runner)  |
                        |  - crypto (AES-256-GCM secrets)   |
                        |  - search, rate-limit, security   |
                        +-----------------+------------------+
                                          |
                                +---------v--------+
                                |   PostgreSQL    |
                                |   (via Prisma)  |
                                +-----------------+
```

## Layers

### 1. Edge / middleware — `src/middleware.ts`

Runs on the edge runtime. Responsibilities:

- Auth gating for `/dashboard/*` (redirect to `/login` if not signed in).
- Redirect signed-in users away from `/login`, `/signup`, `/forgot-password`.
- Issue an HMAC-signed `csrf` cookie (double-submit pattern) to every browser.
- Apply baseline security headers (`X-Frame-Options`, `HSTS`, `Referrer-Policy`,
  `Permissions-Policy`, etc.). The full CSP is applied by `next.config.ts`.

The middleware uses `auth.config.ts` (no Prisma, no bcrypt) so it stays
edge-compatible.

### 2. Routing & rendering — `src/app/`

The App Router is partitioned by route group:

| Group | Purpose | Auth |
|---|---|---|
| `(auth)/` | Login, signup, forgot/reset password | Public |
| `(dashboard)/` | Authenticated workspace, editor, settings | Required |
| `(marketing)/` | `/`, `/pricing`, `/docs`, `/blog`, `/changelog`, `/download`, `/enterprise`, `/privacy`, `/terms` | Public |
| `api/` | Route handlers for AI, git, terminal, billing, webhooks, etc. | Mixed |

**Server vs. client components.** Pages default to server components so they
can export `Metadata` for SEO. When a page needs interactivity (state, effects,
animations), the client body is extracted to a sibling `<page>-client.tsx`
file and `page.tsx` becomes a thin server wrapper that exports `metadata` and
renders the client component.

### 3. Server libraries — `src/lib/`

| Module | Responsibility |
|---|---|
| `db.ts` | Prisma client singleton |
| `ai/provider.ts` | OpenAI-compatible chat/completions client (SSE streaming) |
| `ai/context.ts` | Builds the per-request prompt from project files + enabled Rules/Knowledge under a char budget |
| `ai/changeset.ts` | Parses, validates, and persists AI-proposed changesets |
| `ai/agent.ts` | Step-driven background agent runner |
| `storage.ts` | Disk-backed file storage with path-traversal protection (disk is the source of truth for file content) |
| `git/service.ts` | `simple-git` wrapper with command allowlisting |
| `terminal/runner.ts` | Shell command runner: blocklist + cwd jail + env scrub + timeout |
| `crypto.ts` | AES-256-GCM encryption for integration secrets at rest |
| `search/engine.ts` | Keyword/regex code search |
| `rate-limit.ts` | In-memory sliding-window rate limiter |
| `security.ts` | HMAC-signed CSRF tokens, constant-time comparison helpers |

### 4. Database — `prisma/`

- **PostgreSQL 16** in dev (via `docker-compose.yml`); managed Postgres in prod.
- Schema lives in `prisma/schema.prisma`; migrations in `prisma/migrations/`.
- Migrations are applied with `npx prisma migrate deploy` in production.

### 5. Auth — `src/auth.ts` + `src/auth.config.ts`

- NextAuth (Auth.js) v5 in **beta** mode.
- Credentials provider with bcrypt password hashing.
- Prisma adapter for session/account persistence.
- Edge-safe config split so middleware can run on the edge.

### 6. Frontend

- **Next.js 16 App Router** with React 19.
- **Tailwind CSS 4** for styling.
- **shadcn-style primitives** in `src/components/ui/`.
- **Framer Motion** for marketing-page animations.
- **Monaco** is the editor (lazy-loaded; `worker-src 'self' blob:` in CSP).
- **Tip: keep the client-component surface small** — most logic should live
  in server components or route handlers.

### 7. Security headers — `next.config.ts`

A baseline CSP (with `'unsafe-inline'` for now) is applied to every response
via `next.config.ts → headers()`. A TODO is in place to swap in a per-request
nonce generated in middleware. Other headers: `X-Frame-Options: DENY`,
`Strict-Transport-Security`, `Referrer-Policy: strict-origin-when-cross-origin`,
`Permissions-Policy`, `X-Content-Type-Options: nosniff`.

### 8. SEO infrastructure

- `src/app/sitemap.ts` — Next.js sitemap (all static marketing routes).
- `public/robots.txt` — crawls allowed everywhere except `/dashboard` and
  `/api/`.
- `src/app/layout.tsx` — `metadataBase` + `title.template` so every page can
  export a bare `title` and inherit the ` · Teskel` suffix.

### 9. Tooling

- **TypeScript** strict, `@/*` alias to `./src/*`.
- **ESLint** (`eslint.config.mjs`).
- **Vitest** for unit tests (`tests/unit/**`).
- **Playwright** for end-to-end tests (`tests/e2e/**`).

## Data model (abridged)

```
User ─┬─ Session
      ├─ Account (OAuth)
      ├─ Project ─┬─ File (metadata; content on disk)
      │           ├─ Chat ── Message
      │           ├─ Changeset ── Change
      │           ├─ Knowledge
      │           ├─ Rule
      │           └─ AgentRun
      └─ ApiKey
```

Disk is the source of truth for file content; the database holds metadata,
chat history, changesets, rules, and knowledge.

## Deployment

- **Container:** multi-stage `Dockerfile` produces a `standalone` Next.js
  output that runs as a non-root user.
- **Migrations:** run separately before app start (`npx prisma migrate deploy`).
- **Reverse proxy / TLS:** terminated upstream (e.g. Caddy, nginx, Fly.io,
  Cloudflare). HSTS is set with `preload` so be sure to submit to the HSTS
  preload list only when ready.
