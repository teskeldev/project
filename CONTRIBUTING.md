# Contributing to Teskel

Thanks for your interest in contributing to Teskel. This guide covers the
basics of local development, code style, and the pull-request process.

## Prerequisites

- **Node.js 20+**
- **Docker Desktop** (for the local Postgres database)
- **Git**

## Local setup

```bash
# 1. Install dependencies
npm install

# 2. Copy environment template and fill in secrets
cp .env.example .env

# 3. Start Postgres
docker compose up -d postgres

# 4. Run Prisma migrations
npx prisma migrate dev

# 5. Start the dev server
npm run dev
```

The app is now running at <http://localhost:3000>.

## Project layout

```
src/
  app/                Next.js App Router (server + client components)
    (auth)/           Login, signup, forgot/reset password
    (dashboard)/      Authenticated workspace
    (marketing)/      Public marketing pages
    api/              Route handlers
  components/         Reusable React components (UI, editor, etc.)
  lib/                Server-side libraries (db, ai, storage, git, ...)
  auth.ts             NextAuth entry point
  auth.config.ts      Edge-safe auth config (used by middleware)
  middleware.ts       Edge middleware (auth gating, security headers, CSRF)
prisma/               Prisma schema, migrations, seed
tests/                Vitest unit tests + Playwright e2e tests
public/               Static assets served at the site root
```

See [ARCHITECTURE.md](./ARCHITECTURE.md) for a deeper walkthrough of the
codebase.

## Code style

- **TypeScript strict mode** — avoid `any`, prefer narrow types.
- **ESLint + Prettier** — `npm run lint` and `npm run format` before pushing.
- **Tailwind CSS 4** — utility classes only; no inline styles unless dynamic.
- **Server components by default** — only add `"use client"` when you need
  state, effects, or browser APIs.
- **Co-locate client components** — when a page needs to be a client component,
  extract the client body into a `<page>-client.tsx` sibling and let
  `page.tsx` remain a server component that exports `metadata`.

## Branch & commit conventions

- Branch from `main` using a prefix: `feat/`, `fix/`, `chore/`, `docs/`.
- Commit messages use [Conventional Commits](https://www.conventionalcommits.org/):
  `feat(editor): add inline diff preview`.

## Pull requests

1. Make sure `npm run lint`, `npm run typecheck`, and `npm test` all pass.
2. Add or update tests for any behavior change.
3. Update [README.md](./README.md) / [ARCHITECTURE.md](./ARCHITECTURE.md) if
   your change is user-visible or architecturally significant.
4. Open a PR against `main` and fill in the template.
5. At least one approving review is required before merge.

## Security

Please **do not** open a public GitHub issue for security vulnerabilities.
Email `security@teskel.dev` instead. See the security policy for the full
disclosure process.

## License

By contributing, you agree that your contributions will be licensed under the
project's [MIT License](./LICENSE).
