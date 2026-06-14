/**
 * Built-in skill templates — pre-authored domain-specific instruction sets.
 *
 * Users can install these as starting points and customize them for their
 * workspace/project needs.
 */

export type SkillTemplate = {
  name: string;
  slug: string;
  description: string;
  content: string;
};

export const SKILL_TEMPLATES: SkillTemplate[] = [
  {
    name: "Next.js App Router",
    slug: "nextjs-app-router",
    description: "Best practices for Next.js 14+ App Router development",
    content: `# Next.js App Router

## Conventions
- Use server components by default; add "use client" only when needed (hooks, event handlers, browser APIs).
- Route handlers go in \`route.ts\` files (not \`api/\` prefix in App Router).
- Use \`loading.tsx\` for streaming/suspense loading states.
- Use \`error.tsx\` for error boundaries per route segment.
- Use \`layout.tsx\` for shared UI that persists across navigations.

## Data Fetching
- Fetch data in server components directly (no useEffect).
- Use \`fetch()\` with Next.js caching: \`{ next: { revalidate: 60 } }\` for ISR.
- For mutations, use Server Actions (\`"use server"\` functions).
- Prefer \`unstable_cache\` or \`cache()\` for expensive computations.

## Routing
- Dynamic routes: \`[param]\` folders, access via \`params\` prop.
- Catch-all: \`[...slug]\`, optional catch-all: \`[[...slug]]\`.
- Route groups: \`(group)\` folders for organization without URL impact.
- Parallel routes: \`@slot\` folders for simultaneous rendering.
- Intercepting routes: \`(.)\`, \`(..)\`, \`(...)\` conventions.

## Performance
- Use \`<Image>\` component for automatic optimization.
- Implement \`generateStaticParams\` for static generation of dynamic routes.
- Use \`Suspense\` boundaries to stream content progressively.
- Minimize client-side JavaScript; keep interactive islands small.

## Metadata
- Export \`metadata\` object or \`generateMetadata\` function from pages/layouts.
- Use the Metadata API for SEO (title, description, openGraph, etc.).
`,
  },
  {
    name: "React Best Practices",
    slug: "react-best-practices",
    description: "Modern React patterns and conventions",
    content: `# React Best Practices

## Component Design
- Prefer function components with hooks over class components.
- Keep components small and focused (single responsibility).
- Extract custom hooks for reusable stateful logic.
- Use composition over inheritance; prefer children/render props.

## State Management
- Start with local state (\`useState\`); lift only when needed.
- Use \`useReducer\` for complex state transitions.
- Context for truly global state (theme, auth, locale).
- Consider external stores (Zustand, Jotai) for complex shared state.

## Performance
- Memoize expensive computations with \`useMemo\`.
- Stabilize callbacks with \`useCallback\` when passed to memoized children.
- Use \`React.memo\` for components that re-render with same props.
- Avoid inline object/array literals in JSX props (causes re-renders).
- Use \`key\` prop correctly to help React reconcile lists.

## Patterns
- Controlled components for forms (value + onChange).
- Compound components for related UI (Tabs, Accordion).
- Render props or hooks for headless logic sharing.
- Error boundaries for graceful failure handling.

## Testing
- Test behavior, not implementation details.
- Use React Testing Library; query by role/label, not test IDs.
- Test user interactions: click, type, submit.
- Mock API calls at the network level (MSW).
`,
  },
  {
    name: "TypeScript Patterns",
    slug: "typescript-patterns",
    description: "TypeScript best practices and advanced type patterns",
    content: `# TypeScript Patterns

## General Principles
- Enable strict mode (\`"strict": true\` in tsconfig).
- Prefer \`type\` for object shapes; use \`interface\` when extending/implementing.
- Avoid \`any\`; use \`unknown\` for truly unknown types, then narrow.
- Use \`as const\` for literal types and readonly tuples.

## Type Utilities
- \`Partial<T>\` — make all properties optional.
- \`Required<T>\` — make all properties required.
- \`Pick<T, K>\` / \`Omit<T, K>\` — select/exclude properties.
- \`Record<K, V>\` — object with known key/value types.
- \`Extract<T, U>\` / \`Exclude<T, U>\` — filter union types.

## Advanced Patterns
- Discriminated unions for state machines and tagged types.
- Template literal types for string manipulation at type level.
- Conditional types (\`T extends U ? X : Y\`) for type-level logic.
- Mapped types for transforming object types systematically.
- \`satisfies\` operator to validate types without widening.

## Function Patterns
- Use overloads sparingly; prefer union params or generics.
- Generic constraints: \`<T extends Base>\` for bounded polymorphism.
- \`infer\` keyword in conditional types to extract nested types.
- Return type annotations for public API functions.

## Error Handling
- Use discriminated unions for Result types: \`{ ok: true; data: T } | { ok: false; error: E }\`.
- Prefer typed errors over thrown exceptions for expected failures.
- Use \`never\` for exhaustive checks in switch statements.
`,
  },
  {
    name: "Prisma & Database",
    slug: "prisma-database",
    description: "Prisma ORM patterns and database best practices",
    content: `# Prisma & Database

## Schema Design
- Use \`cuid()\` or \`uuid()\` for primary keys (not auto-increment for distributed systems).
- Add \`createdAt\` and \`updatedAt\` to all models.
- Use enums for fixed sets of values.
- Add \`@@index\` for frequently queried foreign keys.
- Use \`@@unique\` for natural composite keys.

## Queries
- Use \`select\` to fetch only needed fields (reduces payload).
- Use \`include\` sparingly; prefer explicit \`select\` with nested relations.
- Use \`findUnique\` over \`findFirst\` when querying by unique fields.
- Batch related queries with \`Promise.all\` or Prisma transactions.

## Migrations
- Run \`prisma migrate dev\` for development (creates migration files).
- Run \`prisma migrate deploy\` in CI/production.
- Never edit migration files after they've been applied.
- Use \`prisma db push\` only for prototyping (no migration history).

## Performance
- Add database indexes for columns used in WHERE, ORDER BY, JOIN.
- Use \`take\` and \`skip\` for pagination; prefer cursor-based for large datasets.
- Avoid N+1 queries; use \`include\` or batch fetching.
- Use \`createMany\` / \`updateMany\` for bulk operations.

## Safety
- Always validate input before database operations (Zod schemas).
- Use transactions for multi-step mutations that must be atomic.
- Handle unique constraint violations gracefully (P2002 error code).
- Never expose internal IDs or sensitive fields in API responses without filtering.
`,
  },
  {
    name: "Testing Strategy",
    slug: "testing-strategy",
    description: "Comprehensive testing patterns for web applications",
    content: `# Testing Strategy

## Test Pyramid
- Unit tests (70%): Pure functions, utilities, hooks, reducers.
- Integration tests (20%): Component interactions, API routes, database queries.
- E2E tests (10%): Critical user flows (signup, checkout, etc.).

## Unit Testing
- Test pure logic in isolation (no DOM, no network).
- One assertion per test when possible; descriptive test names.
- Use \`describe\` blocks to group related tests.
- Mock external dependencies at module boundaries.

## Component Testing
- Render components with realistic props and context.
- Test user interactions: clicks, typing, form submissions.
- Assert on visible output (text, roles), not internal state.
- Use \`screen.getByRole\` / \`getByLabelText\` over \`getByTestId\`.

## API Testing
- Test route handlers with real request/response objects.
- Verify status codes, response shapes, and error cases.
- Test authentication and authorization separately.
- Use test database or in-memory store for data layer tests.

## Best Practices
- Tests should be independent (no shared mutable state).
- Use factories/fixtures for test data (avoid hardcoded values).
- Test edge cases: empty inputs, boundary values, error states.
- Keep tests fast: mock slow operations (network, filesystem).
- Run tests in CI on every PR; block merge on failure.
`,
  },
  {
    name: "API Design",
    slug: "api-design",
    description: "RESTful API design conventions and patterns",
    content: `# API Design

## URL Conventions
- Use nouns for resources: \`/api/users\`, \`/api/projects\`.
- Use plural nouns: \`/api/users\` not \`/api/user\`.
- Nest sub-resources: \`/api/projects/:id/files\`.
- Use query params for filtering/pagination: \`?status=active&page=2\`.

## HTTP Methods
- GET: Read (idempotent, cacheable).
- POST: Create (non-idempotent).
- PATCH: Partial update (send only changed fields).
- PUT: Full replace (send entire resource).
- DELETE: Remove (idempotent).

## Response Format
- Consistent envelope: \`{ success: true, data }\` / \`{ success: false, error }\`.
- Include pagination metadata: \`{ data, total, page, pageSize }\`.
- Use HTTP status codes correctly (200, 201, 400, 401, 403, 404, 422, 500).
- Return created/updated resource in response body.

## Error Handling
- Return structured errors: \`{ message, code, details? }\`.
- Use specific error codes: \`VALIDATION_ERROR\`, \`NOT_FOUND\`, \`FORBIDDEN\`.
- Never leak stack traces or internal details in production.
- Validate all input with schemas (Zod); return 422 with field errors.

## Authentication & Authorization
- Use session cookies or Bearer tokens.
- Check authentication before authorization.
- Return 401 for unauthenticated, 403 for unauthorized.
- Scope data access to the authenticated user's permissions.
`,
  },
];
