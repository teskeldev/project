/**
 * Few-Shot Example Bank for AI code generation quality amplification.
 *
 * Provides task-specific examples that dramatically improve output quality,
 * especially for weaker models. Examples are categorized by task type and
 * language, and dynamically selected based on relevance.
 */

export type TaskType =
  | 'bug_fix'
  | 'feature_implementation'
  | 'refactoring'
  | 'test_writing'
  | 'code_review'
  | 'api_endpoint'
  | 'component_creation'
  | 'error_handling'
  | 'type_definition'
  | 'database_query'
  | 'validation'
  | 'utility_function';

export type FewShotExample = {
  id: string;
  taskType: TaskType;
  language: string;
  title: string;
  task: string;
  context?: string;
  solution: string;
  explanation?: string;
  tags: string[];
};

export type ExampleSelectionOptions = {
  taskType?: TaskType;
  language?: string;
  tags?: string[];
  maxExamples?: number;
  maxChars?: number;
  query?: string;
};

// ─── Example Bank ────────────────────────────────────────────────────────────

const EXAMPLES: FewShotExample[] = [
  // ═══════════════════════════════════════════════════════════════════════════
  // BUG FIX EXAMPLES
  // ═══════════════════════════════════════════════════════════════════════════

  {
    id: 'bug-fix-null-ref',
    taskType: 'bug_fix',
    language: 'typescript',
    title: 'Fix null reference error in TypeScript',
    task: 'Fix the null reference error when accessing nested user profile data that may not exist.',
    context: `function getUserDisplayName(user: User): string {
  return user.profile.displayName.trim();
}`,
    solution: `function getUserDisplayName(user: User): string {
  if (!user.profile?.displayName) {
    return user.email ?? 'Anonymous';
  }
  return user.profile.displayName.trim();
}`,
    explanation: 'Uses optional chaining and nullish coalescing to safely access nested properties, with a meaningful fallback chain.',
    tags: ['typescript', 'null-safety', 'optional-chaining'],
  },

  {
    id: 'bug-fix-off-by-one',
    taskType: 'bug_fix',
    language: 'typescript',
    title: 'Fix off-by-one error in array processing',
    task: 'Fix the off-by-one error in the pagination function that skips the first item on each page.',
    context: `function paginate<T>(items: T[], page: number, pageSize: number): T[] {
  const start = page * pageSize + 1;
  const end = start + pageSize;
  return items.slice(start, end);
}`,
    solution: `function paginate<T>(items: T[], page: number, pageSize: number): T[] {
  if (page < 1 || pageSize < 1) {
    return [];
  }
  const start = (page - 1) * pageSize;
  const end = start + pageSize;
  return items.slice(start, end);
}`,
    explanation: 'Fixed the start index calculation: for 1-based pages, start = (page - 1) * pageSize. Added input validation to handle invalid page/pageSize values.',
    tags: ['typescript', 'pagination', 'array'],
  },

  {
    id: 'bug-fix-race-condition',
    taskType: 'bug_fix',
    language: 'typescript',
    title: 'Fix race condition in async code',
    task: 'Fix the race condition where stale search results can overwrite newer results when the user types quickly.',
    context: `let currentResults: SearchResult[] = [];

async function handleSearch(query: string) {
  const results = await searchAPI(query);
  currentResults = results;
  renderResults(currentResults);
}`,
    solution: `let currentRequestId = 0;

async function handleSearch(query: string) {
  const requestId = ++currentRequestId;
  const results = await searchAPI(query);

  // Only update if this is still the most recent request
  if (requestId === currentRequestId) {
    renderResults(results);
  }
}`,
    explanation: 'Uses a monotonically increasing request ID to track the latest request. Stale responses are discarded by comparing the request ID at resolution time.',
    tags: ['typescript', 'async', 'race-condition', 'search'],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // FEATURE IMPLEMENTATION EXAMPLES
  // ═══════════════════════════════════════════════════════════════════════════

  {
    id: 'feature-pagination',
    taskType: 'feature_implementation',
    language: 'typescript',
    title: 'Add pagination to an API endpoint',
    task: 'Add cursor-based pagination to the list users endpoint with proper response metadata.',
    solution: `import { z } from 'zod';

const PaginationSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
});

type PaginatedResponse<T> = {
  data: T[];
  nextCursor: string | null;
  hasMore: boolean;
  total: number;
};

async function listUsers(params: z.infer<typeof PaginationSchema>): Promise<PaginatedResponse<User>> {
  const { cursor, limit } = PaginationSchema.parse(params);

  const where = cursor ? { id: { gt: cursor } } : {};
  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      take: limit + 1,
      orderBy: { id: 'asc' },
    }),
    prisma.user.count({ where: {} }),
  ]);

  const hasMore = users.length > limit;
  const data = hasMore ? users.slice(0, limit) : users;
  const nextCursor = hasMore ? data[data.length - 1].id : null;

  return { data, nextCursor, hasMore, total };
}`,
    explanation: 'Cursor-based pagination is more performant than offset-based for large datasets. Fetches limit+1 to determine if more pages exist without an extra count query.',
    tags: ['typescript', 'pagination', 'api', 'prisma', 'cursor'],
  },

  {
    id: 'feature-debounced-search',
    taskType: 'feature_implementation',
    language: 'typescript',
    title: 'Implement a debounced search input',
    task: 'Create a debounced search hook that cancels pending requests and shows loading state.',
    solution: `import { useState, useEffect, useRef, useCallback } from 'react';

type UseSearchOptions<T> = {
  searchFn: (query: string) => Promise<T[]>;
  debounceMs?: number;
  minLength?: number;
};

function useSearch<T>({ searchFn, debounceMs = 300, minLength = 2 }: UseSearchOptions<T>) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (query.length < minLength) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      abortRef.current?.abort();
      abortRef.current = new AbortController();

      setIsLoading(true);
      setError(null);

      try {
        const data = await searchFn(query);
        if (!abortRef.current.signal.aborted) {
          setResults(data);
        }
      } catch (err) {
        if (err instanceof Error && err.name !== 'AbortError') {
          setError(err);
        }
      } finally {
        setIsLoading(false);
      }
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [query, searchFn, debounceMs, minLength]);

  return { query, setQuery, results, isLoading, error };
}`,
    explanation: 'Combines debouncing with AbortController for proper request cancellation. Handles minimum length, loading state, and error state cleanly.',
    tags: ['typescript', 'react', 'hooks', 'debounce', 'search', 'async'],
  },

  {
    id: 'feature-retry-backoff',
    taskType: 'feature_implementation',
    language: 'typescript',
    title: 'Add retry logic with exponential backoff',
    task: 'Implement a retry wrapper with exponential backoff, jitter, and configurable retry conditions.',
    solution: `type RetryOptions = {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  jitter?: boolean;
  retryOn?: (error: unknown) => boolean;
  onRetry?: (error: unknown, attempt: number) => void;
};

async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    baseDelayMs = 1000,
    maxDelayMs = 30000,
    jitter = true,
    retryOn = () => true,
    onRetry,
  } = options;

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt === maxRetries || !retryOn(error)) {
        throw error;
      }

      const exponentialDelay = baseDelayMs * Math.pow(2, attempt);
      const delay = Math.min(exponentialDelay, maxDelayMs);
      const finalDelay = jitter ? delay * (0.5 + Math.random() * 0.5) : delay;

      onRetry?.(error, attempt + 1);
      await new Promise((resolve) => setTimeout(resolve, finalDelay));
    }
  }

  throw lastError;
}`,
    explanation: 'Exponential backoff with jitter prevents thundering herd problems. The retryOn predicate allows selective retry (e.g., only on 5xx errors). The onRetry callback enables logging.',
    tags: ['typescript', 'retry', 'backoff', 'resilience', 'async'],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // REFACTORING EXAMPLES
  // ═══════════════════════════════════════════════════════════════════════════

  {
    id: 'refactor-strategy-pattern',
    taskType: 'refactoring',
    language: 'typescript',
    title: 'Extract complex conditional into strategy pattern',
    task: 'Refactor the pricing calculation that uses a large switch statement into a strategy pattern.',
    context: `function calculatePrice(plan: string, usage: number): number {
  switch (plan) {
    case 'free': return 0;
    case 'basic': return usage <= 1000 ? 9.99 : 9.99 + (usage - 1000) * 0.01;
    case 'pro': return usage <= 10000 ? 29.99 : 29.99 + (usage - 10000) * 0.005;
    case 'enterprise': return usage <= 100000 ? 99.99 : 99.99 + (usage - 100000) * 0.001;
    default: throw new Error('Unknown plan');
  }
}`,
    solution: `type PricingStrategy = {
  basePrice: number;
  includedUsage: number;
  overageRate: number;
};

const PRICING_STRATEGIES: Record<string, PricingStrategy> = {
  free: { basePrice: 0, includedUsage: Infinity, overageRate: 0 },
  basic: { basePrice: 9.99, includedUsage: 1000, overageRate: 0.01 },
  pro: { basePrice: 29.99, includedUsage: 10000, overageRate: 0.005 },
  enterprise: { basePrice: 99.99, includedUsage: 100000, overageRate: 0.001 },
};

function calculatePrice(plan: string, usage: number): number {
  const strategy = PRICING_STRATEGIES[plan];
  if (!strategy) {
    throw new Error(\`Unknown plan: \${plan}\`);
  }

  const overage = Math.max(0, usage - strategy.includedUsage);
  return strategy.basePrice + overage * strategy.overageRate;
}`,
    explanation: 'The strategy pattern replaces branching logic with data. Adding a new plan requires only adding an entry to the strategies object, not modifying the calculation logic.',
    tags: ['typescript', 'strategy-pattern', 'design-patterns', 'pricing'],
  },

  {
    id: 'refactor-callbacks-to-async',
    taskType: 'refactoring',
    language: 'typescript',
    title: 'Convert callback-based code to async/await',
    task: 'Refactor the nested callback file processing code to use async/await.',
    context: `function processFiles(dir: string, callback: (err: Error | null, results?: string[]) => void) {
  fs.readdir(dir, (err, files) => {
    if (err) return callback(err);
    const results: string[] = [];
    let pending = files.length;
    if (!pending) return callback(null, results);
    files.forEach((file) => {
      fs.readFile(path.join(dir, file), 'utf8', (err, content) => {
        if (err) return callback(err);
        results.push(content);
        if (--pending === 0) callback(null, results);
      });
    });
  });
}`,
    solution: `import { readdir, readFile } from 'fs/promises';
import path from 'path';

async function processFiles(dir: string): Promise<string[]> {
  const files = await readdir(dir);

  const results = await Promise.all(
    files.map((file) => readFile(path.join(dir, file), 'utf8'))
  );

  return results;
}`,
    explanation: 'Using fs/promises and Promise.all eliminates callback hell, makes error handling automatic via try/catch, and processes files concurrently for better performance.',
    tags: ['typescript', 'async', 'refactoring', 'node', 'filesystem'],
  },

  {
    id: 'refactor-split-function',
    taskType: 'refactoring',
    language: 'typescript',
    title: 'Split a large function into smaller composable functions',
    task: 'Break down the monolithic user registration function into smaller, testable pieces.',
    context: `async function registerUser(data: any) {
  // validate, hash password, create user, send email, log event - all in one 80-line function
}`,
    solution: `type RegistrationInput = {
  email: string;
  password: string;
  name: string;
};

function validateRegistration(input: unknown): RegistrationInput {
  const schema = z.object({
    email: z.string().email(),
    password: z.string().min(8).regex(/[A-Z]/).regex(/[0-9]/),
    name: z.string().min(1).max(100),
  });
  return schema.parse(input);
}

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

async function createUserRecord(data: RegistrationInput, hashedPassword: string): Promise<User> {
  return prisma.user.create({
    data: { email: data.email, name: data.name, passwordHash: hashedPassword },
  });
}

async function sendWelcomeEmail(user: User): Promise<void> {
  await emailService.send({
    to: user.email,
    template: 'welcome',
    data: { name: user.name },
  });
}

async function registerUser(input: unknown): Promise<User> {
  const data = validateRegistration(input);
  const hashedPassword = await hashPassword(data.password);
  const user = await createUserRecord(data, hashedPassword);
  await sendWelcomeEmail(user).catch((err) => logger.warn('Welcome email failed', { err, userId: user.id }));
  logger.info('User registered', { userId: user.id });
  return user;
}`,
    explanation: 'Each function has a single responsibility and is independently testable. The orchestrator function reads like a high-level description of the process. Non-critical operations (email) use .catch() to avoid blocking.',
    tags: ['typescript', 'refactoring', 'single-responsibility', 'composition'],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // TEST WRITING EXAMPLES
  // ═══════════════════════════════════════════════════════════════════════════

  {
    id: 'test-validation-edge-cases',
    taskType: 'test_writing',
    language: 'typescript',
    title: 'Unit test for a validation function with edge cases',
    task: 'Write comprehensive tests for an email validation function covering edge cases.',
    solution: `import { describe, it, expect } from 'vitest';
import { validateEmail } from './validators';

describe('validateEmail', () => {
  it('accepts valid email addresses', () => {
    const validEmails = [
      'user@example.com',
      'user.name@domain.co.uk',
      'user+tag@example.org',
      'firstname.lastname@company.com',
    ];
    validEmails.forEach((email) => {
      expect(validateEmail(email)).toEqual({ valid: true, normalized: email.toLowerCase() });
    });
  });

  it('rejects invalid email formats', () => {
    const invalidEmails = ['', 'not-an-email', '@domain.com', 'user@', 'user @domain.com', 'user@.com'];
    invalidEmails.forEach((email) => {
      expect(validateEmail(email).valid).toBe(false);
    });
  });

  it('provides specific error messages', () => {
    expect(validateEmail('')).toEqual({ valid: false, error: 'Email is required' });
    expect(validateEmail('no-at-sign')).toEqual({ valid: false, error: 'Invalid email format' });
    expect(validateEmail('a'.repeat(255) + '@test.com')).toEqual({ valid: false, error: 'Email exceeds maximum length' });
  });

  it('normalizes email to lowercase', () => {
    const result = validateEmail('User@EXAMPLE.COM');
    expect(result).toEqual({ valid: true, normalized: 'user@example.com' });
  });

  it('trims whitespace before validation', () => {
    const result = validateEmail('  user@example.com  ');
    expect(result).toEqual({ valid: true, normalized: 'user@example.com' });
  });
});`,
    explanation: 'Tests are organized by behavior, cover valid inputs, invalid inputs, edge cases, and error messages. Uses data-driven patterns for multiple similar assertions.',
    tags: ['typescript', 'testing', 'vitest', 'validation', 'unit-test'],
  },

  {
    id: 'test-api-integration',
    taskType: 'test_writing',
    language: 'typescript',
    title: 'Integration test for an API endpoint',
    task: 'Write an integration test for a POST /api/users endpoint with authentication and validation.',
    solution: `import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../app';
import { prisma } from '../db';
import { createTestUser, generateAuthToken } from './helpers';

describe('POST /api/users', () => {
  let adminToken: string;

  beforeAll(async () => {
    const admin = await createTestUser({ role: 'admin' });
    adminToken = generateAuthToken(admin);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { contains: '@test.example' } } });
  });

  it('creates a user with valid data and admin auth', async () => {
    const response = await request(app)
      .post('/api/users')
      .set('Authorization', \`Bearer \${adminToken}\`)
      .send({ email: 'new@test.example', name: 'Test User', role: 'member' });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      id: expect.any(String),
      email: 'new@test.example',
      name: 'Test User',
      role: 'member',
    });
    expect(response.body).not.toHaveProperty('passwordHash');
  });

  it('returns 401 without authentication', async () => {
    const response = await request(app)
      .post('/api/users')
      .send({ email: 'test@test.example', name: 'Test' });

    expect(response.status).toBe(401);
    expect(response.body.error).toBe('Authentication required');
  });

  it('returns 422 with invalid email', async () => {
    const response = await request(app)
      .post('/api/users')
      .set('Authorization', \`Bearer \${adminToken}\`)
      .send({ email: 'invalid', name: 'Test' });

    expect(response.status).toBe(422);
    expect(response.body.errors).toContainEqual(
      expect.objectContaining({ field: 'email', message: expect.any(String) })
    );
  });

  it('returns 409 for duplicate email', async () => {
    await request(app)
      .post('/api/users')
      .set('Authorization', \`Bearer \${adminToken}\`)
      .send({ email: 'dup@test.example', name: 'First' });

    const response = await request(app)
      .post('/api/users')
      .set('Authorization', \`Bearer \${adminToken}\`)
      .send({ email: 'dup@test.example', name: 'Second' });

    expect(response.status).toBe(409);
  });
});`,
    explanation: 'Integration tests cover the happy path, authentication, validation errors, and conflict handling. Uses proper setup/teardown and test helpers.',
    tags: ['typescript', 'testing', 'integration', 'api', 'supertest'],
  },

  {
    id: 'test-async-error-handling',
    taskType: 'test_writing',
    language: 'typescript',
    title: 'Test for async error handling',
    task: 'Write tests verifying that async operations properly handle and propagate errors.',
    solution: `import { describe, it, expect, vi } from 'vitest';
import { fetchUserData } from './user-service';
import { apiClient } from './api-client';

vi.mock('./api-client');

describe('fetchUserData error handling', () => {
  it('throws a typed error on network failure', async () => {
    vi.mocked(apiClient.get).mockRejectedValue(new Error('Network error'));

    await expect(fetchUserData('user-1')).rejects.toThrow('Failed to fetch user data');
    await expect(fetchUserData('user-1')).rejects.toMatchObject({
      code: 'NETWORK_ERROR',
      cause: expect.any(Error),
    });
  });

  it('throws NotFoundError for 404 responses', async () => {
    vi.mocked(apiClient.get).mockRejectedValue(
      Object.assign(new Error('Not found'), { status: 404 })
    );

    await expect(fetchUserData('nonexistent')).rejects.toMatchObject({
      code: 'USER_NOT_FOUND',
      userId: 'nonexistent',
    });
  });

  it('retries on transient errors before failing', async () => {
    vi.mocked(apiClient.get)
      .mockRejectedValueOnce(Object.assign(new Error('Timeout'), { status: 503 }))
      .mockRejectedValueOnce(Object.assign(new Error('Timeout'), { status: 503 }))
      .mockResolvedValueOnce({ data: { id: 'user-1', name: 'Test' } });

    const result = await fetchUserData('user-1');
    expect(result).toEqual({ id: 'user-1', name: 'Test' });
    expect(apiClient.get).toHaveBeenCalledTimes(3);
  });

  it('does not retry on non-transient errors', async () => {
    vi.mocked(apiClient.get).mockRejectedValue(
      Object.assign(new Error('Forbidden'), { status: 403 })
    );

    await expect(fetchUserData('user-1')).rejects.toThrow();
    expect(apiClient.get).toHaveBeenCalledTimes(1);
  });
});`,
    explanation: 'Tests verify error typing, error wrapping with cause, retry behavior for transient errors, and non-retry for permanent errors. Uses vi.mock for isolation.',
    tags: ['typescript', 'testing', 'async', 'error-handling', 'vitest', 'mocking'],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // CODE REVIEW EXAMPLES
  // ═══════════════════════════════════════════════════════════════════════════

  {
    id: 'review-sql-injection',
    taskType: 'code_review',
    language: 'typescript',
    title: 'Review identifying a security vulnerability (SQL injection)',
    task: 'Review this database query code for security issues.',
    context: `app.get('/api/users', async (req, res) => {
  const { search } = req.query;
  const users = await db.query(\`SELECT * FROM users WHERE name LIKE '%\${search}%'\`);
  res.json(users);
});`,
    solution: `// SECURITY ISSUE: SQL Injection vulnerability
// The \`search\` parameter is interpolated directly into the SQL string,
// allowing an attacker to execute arbitrary SQL.
//
// Attack example: search = "'; DROP TABLE users; --"
//
// FIX: Use parameterized queries:

app.get('/api/users', async (req, res) => {
  const search = typeof req.query.search === 'string' ? req.query.search : '';
  const users = await db.query(
    'SELECT id, name, email FROM users WHERE name LIKE $1',
    [\`%\${search}%\`]
  );
  res.json(users);
});

// Additional improvements:
// 1. Validate and sanitize input type
// 2. Select specific columns instead of SELECT *
// 3. Add pagination to prevent large result sets
// 4. Add rate limiting to prevent enumeration attacks`,
    explanation: 'SQL injection is a critical vulnerability. Always use parameterized queries. Additionally, selecting only needed columns reduces data exposure.',
    tags: ['typescript', 'security', 'sql-injection', 'code-review', 'express'],
  },

  {
    id: 'review-n-plus-one',
    taskType: 'code_review',
    language: 'typescript',
    title: 'Review identifying a performance issue (N+1 query)',
    task: 'Review this data fetching code for performance issues.',
    context: `async function getOrdersWithProducts(userId: string) {
  const orders = await prisma.order.findMany({ where: { userId } });

  const result = [];
  for (const order of orders) {
    const products = await prisma.product.findMany({
      where: { id: { in: order.productIds } },
    });
    result.push({ ...order, products });
  }

  return result;
}`,
    solution: `// PERFORMANCE ISSUE: N+1 Query Problem
// For N orders, this executes N+1 database queries (1 for orders + N for products).
// With 100 orders, that's 101 database round-trips.
//
// FIX: Use a single query with includes/joins:

async function getOrdersWithProducts(userId: string) {
  return prisma.order.findMany({
    where: { userId },
    include: {
      products: {
        select: { id: true, name: true, price: true, imageUrl: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

// If the relation isn't set up, batch the product fetch:
async function getOrdersWithProductsBatched(userId: string) {
  const orders = await prisma.order.findMany({ where: { userId } });

  const allProductIds = [...new Set(orders.flatMap((o) => o.productIds))];
  const products = await prisma.product.findMany({
    where: { id: { in: allProductIds } },
  });
  const productMap = new Map(products.map((p) => [p.id, p]));

  return orders.map((order) => ({
    ...order,
    products: order.productIds.map((id) => productMap.get(id)).filter(Boolean),
  }));
}`,
    explanation: 'N+1 queries are one of the most common performance issues. Use eager loading (include/join) or batch fetching with a lookup map to reduce database round-trips.',
    tags: ['typescript', 'performance', 'n-plus-one', 'prisma', 'database', 'code-review'],
  },

  {
    id: 'review-missing-error-handling',
    taskType: 'code_review',
    language: 'typescript',
    title: 'Review identifying missing error handling',
    task: 'Review this payment processing code for error handling issues.',
    context: `async function processPayment(orderId: string, amount: number) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  const charge = await stripe.charges.create({
    amount: amount * 100,
    currency: 'usd',
    source: order.paymentMethodId,
  });
  await prisma.order.update({
    where: { id: orderId },
    data: { status: 'paid', chargeId: charge.id },
  });
  await emailService.sendReceipt(order.userEmail, charge);
}`,
    solution: `// ISSUES: Multiple missing error handling scenarios
// 1. order could be null (findUnique returns null if not found)
// 2. No validation that amount matches order total (charge manipulation)
// 3. If stripe succeeds but DB update fails, payment is taken but order not marked
// 4. No idempotency - retrying could double-charge
// 5. Email failure could throw and mask success
//
// FIX:

async function processPayment(orderId: string): Promise<PaymentResult> {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) {
    throw new NotFoundError(\`Order \${orderId} not found\`);
  }
  if (order.status === 'paid') {
    return { status: 'already_paid', chargeId: order.chargeId! };
  }

  const amount = order.totalAmount; // Use order's amount, not user-provided

  let charge: Stripe.Charge;
  try {
    charge = await stripe.charges.create({
      amount: Math.round(amount * 100),
      currency: 'usd',
      source: order.paymentMethodId,
      idempotencyKey: \`order-\${orderId}\`,
    });
  } catch (err) {
    await prisma.order.update({ where: { id: orderId }, data: { status: 'payment_failed' } });
    throw new PaymentError('Charge failed', { cause: err });
  }

  await prisma.order.update({
    where: { id: orderId },
    data: { status: 'paid', chargeId: charge.id },
  });

  // Non-critical: don't fail payment if email fails
  await emailService.sendReceipt(order.userEmail, charge).catch((err) => {
    logger.error('Receipt email failed', { orderId, err });
  });

  return { status: 'success', chargeId: charge.id };
}`,
    explanation: 'Payment processing requires idempotency, null checks, amount validation from trusted source, proper error states, and non-critical operations should not block success.',
    tags: ['typescript', 'error-handling', 'payments', 'stripe', 'code-review'],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // API ENDPOINT EXAMPLES
  // ═══════════════════════════════════════════════════════════════════════════

  {
    id: 'api-rest-endpoint',
    taskType: 'api_endpoint',
    language: 'typescript',
    title: 'REST endpoint with validation, auth, and error handling',
    task: 'Create a POST endpoint for creating a project with proper validation, authentication, and error handling.',
    solution: `import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { prisma } from '../db';
import { AppError } from '../errors';

const createProjectSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(100).trim(),
    description: z.string().max(500).optional(),
    visibility: z.enum(['public', 'private']).default('private'),
    teamId: z.string().uuid().optional(),
  }),
});

const router = Router();

router.post(
  '/projects',
  authenticate,
  validate(createProjectSchema),
  async (req, res, next) => {
    try {
      const { name, description, visibility, teamId } = req.body;
      const userId = req.user!.id;

      if (teamId) {
        const membership = await prisma.teamMember.findUnique({
          where: { teamId_userId: { teamId, userId } },
        });
        if (!membership) {
          throw new AppError(403, 'You are not a member of this team');
        }
      }

      const project = await prisma.project.create({
        data: { name, description, visibility, ownerId: userId, teamId },
        select: { id: true, name: true, description: true, visibility: true, createdAt: true },
      });

      res.status(201).json({ data: project });
    } catch (error) {
      next(error);
    }
  }
);

export { router as projectRouter };`,
    explanation: 'Separates concerns: validation middleware, auth middleware, authorization check, and business logic. Uses select to control response shape. Proper HTTP status codes.',
    tags: ['typescript', 'express', 'rest', 'api', 'validation', 'auth', 'prisma'],
  },

  {
    id: 'api-pagination-filtering',
    taskType: 'api_endpoint',
    language: 'typescript',
    title: 'Endpoint with pagination and filtering',
    task: 'Create a GET endpoint for listing items with cursor pagination, sorting, and filtering.',
    solution: `import { z } from 'zod';

const listItemsSchema = z.object({
  query: z.object({
    cursor: z.string().optional(),
    limit: z.coerce.number().min(1).max(100).default(25),
    sort: z.enum(['createdAt', 'name', 'updatedAt']).default('createdAt'),
    order: z.enum(['asc', 'desc']).default('desc'),
    status: z.enum(['active', 'archived', 'draft']).optional(),
    search: z.string().max(100).optional(),
  }),
});

router.get('/items', authenticate, validate(listItemsSchema), async (req, res, next) => {
  try {
    const { cursor, limit, sort, order, status, search } = req.query;
    const userId = req.user!.id;

    const where: Prisma.ItemWhereInput = {
      ownerId: userId,
      ...(status && { status }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [items, total] = await Promise.all([
      prisma.item.findMany({
        where,
        take: limit + 1,
        ...(cursor && { cursor: { id: cursor }, skip: 1 }),
        orderBy: { [sort]: order },
        select: { id: true, name: true, status: true, createdAt: true, updatedAt: true },
      }),
      prisma.item.count({ where }),
    ]);

    const hasMore = items.length > limit;
    const data = hasMore ? items.slice(0, limit) : items;
    const nextCursor = hasMore ? data[data.length - 1].id : null;

    res.json({
      data,
      pagination: { nextCursor, hasMore, total },
    });
  } catch (error) {
    next(error);
  }
});`,
    explanation: 'Combines cursor pagination with filtering and sorting. Uses Prisma conditional spreading for optional filters. Returns pagination metadata for client-side navigation.',
    tags: ['typescript', 'express', 'api', 'pagination', 'filtering', 'prisma'],
  },

  {
    id: 'api-file-upload',
    taskType: 'api_endpoint',
    language: 'typescript',
    title: 'File upload endpoint with size/type validation',
    task: 'Create a file upload endpoint that validates file size, type, and stores metadata.',
    solution: `import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import { AppError } from '../errors';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const storage = multer.diskStorage({
  destination: './uploads',
  filename: (_req, file, cb) => {
    const uniqueName = \`\${crypto.randomUUID()}\${path.extname(file.originalname)}\`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_TYPES.includes(file.mimetype)) {
      cb(new AppError(422, \`Invalid file type: \${file.mimetype}. Allowed: \${ALLOWED_TYPES.join(', ')}\`));
      return;
    }
    cb(null, true);
  },
});

router.post('/files', authenticate, upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      throw new AppError(400, 'No file provided');
    }

    const fileRecord = await prisma.file.create({
      data: {
        filename: req.file.filename,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
        path: req.file.path,
        uploadedBy: req.user!.id,
      },
      select: { id: true, originalName: true, mimeType: true, size: true, createdAt: true },
    });

    res.status(201).json({ data: fileRecord });
  } catch (error) {
    // Clean up uploaded file on error
    if (req.file) {
      await fs.unlink(req.file.path).catch(() => {});
    }
    next(error);
  }
});`,
    explanation: 'Validates file type via MIME type whitelist and enforces size limits. Uses random filenames to prevent path traversal. Cleans up files on error. Stores metadata in database.',
    tags: ['typescript', 'express', 'file-upload', 'multer', 'validation'],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // COMPONENT CREATION EXAMPLES
  // ═══════════════════════════════════════════════════════════════════════════

  {
    id: 'component-typed-props',
    taskType: 'component_creation',
    language: 'typescript',
    title: 'React component with proper TypeScript props',
    task: 'Create a reusable Button component with variants, sizes, loading state, and proper TypeScript types.',
    solution: `import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
};

const variantStyles: Record<ButtonVariant, string> = {
  primary: 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500',
  secondary: 'bg-gray-200 text-gray-900 hover:bg-gray-300 focus:ring-gray-500',
  ghost: 'bg-transparent text-gray-700 hover:bg-gray-100 focus:ring-gray-500',
  danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-base',
  lg: 'px-6 py-3 text-lg',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', isLoading, leftIcon, rightIcon, className, children, disabled, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none',
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? <Spinner className="mr-2 h-4 w-4" /> : leftIcon && <span className="mr-2">{leftIcon}</span>}
      {children}
      {rightIcon && <span className="ml-2">{rightIcon}</span>}
    </button>
  )
);

Button.displayName = 'Button';`,
    explanation: 'Uses forwardRef for ref forwarding, extends native button props, separates variant/size styles into records for maintainability, and handles loading state accessibly.',
    tags: ['typescript', 'react', 'component', 'tailwind', 'accessibility'],
  },

  {
    id: 'component-form-validation',
    taskType: 'component_creation',
    language: 'typescript',
    title: 'Form component with validation',
    task: 'Create a registration form with client-side validation using react-hook-form and zod.',
    solution: `import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useState } from 'react';

const registrationSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Must contain an uppercase letter')
    .regex(/[0-9]/, 'Must contain a number'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

type RegistrationForm = z.infer<typeof registrationSchema>;

export function RegistrationForm({ onSubmit }: { onSubmit: (data: RegistrationForm) => Promise<void> }) {
  const [serverError, setServerError] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<RegistrationForm>({
    resolver: zodResolver(registrationSchema),
  });

  const handleFormSubmit = async (data: RegistrationForm) => {
    setServerError(null);
    try {
      await onSubmit(data);
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Registration failed');
    }
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} noValidate>
      {serverError && <div role="alert" className="text-red-600 mb-4">{serverError}</div>}

      <Field label="Name" error={errors.name?.message}>
        <input {...register('name')} aria-invalid={!!errors.name} />
      </Field>

      <Field label="Email" error={errors.email?.message}>
        <input type="email" {...register('email')} aria-invalid={!!errors.email} />
      </Field>

      <Field label="Password" error={errors.password?.message}>
        <input type="password" {...register('password')} aria-invalid={!!errors.password} />
      </Field>

      <Field label="Confirm Password" error={errors.confirmPassword?.message}>
        <input type="password" {...register('confirmPassword')} aria-invalid={!!errors.confirmPassword} />
      </Field>

      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Creating account...' : 'Create Account'}
      </button>
    </form>
  );
}`,
    explanation: 'Combines zod for schema validation with react-hook-form for form state. Uses refinements for cross-field validation. Handles both client and server errors with proper ARIA attributes.',
    tags: ['typescript', 'react', 'form', 'validation', 'zod', 'react-hook-form'],
  },

  {
    id: 'component-data-table',
    taskType: 'component_creation',
    language: 'typescript',
    title: 'Data table with sorting and filtering',
    task: 'Create a reusable data table component with column sorting, text filtering, and type-safe column definitions.',
    solution: `import { useState, useMemo, type ReactNode } from 'react';

type SortDirection = 'asc' | 'desc' | null;

type Column<T> = {
  key: keyof T & string;
  header: string;
  sortable?: boolean;
  render?: (value: T[keyof T], row: T) => ReactNode;
};

type DataTableProps<T extends Record<string, unknown>> = {
  data: T[];
  columns: Column<T>[];
  filterableColumns?: (keyof T & string)[];
  emptyMessage?: string;
};

export function DataTable<T extends Record<string, unknown>>({
  data,
  columns,
  filterableColumns = [],
  emptyMessage = 'No data found',
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<keyof T | null>(null);
  const [sortDir, setSortDir] = useState<SortDirection>(null);
  const [filter, setFilter] = useState('');

  const handleSort = (key: keyof T) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : prev === 'desc' ? null : 'asc'));
      if (sortDir === 'desc') setSortKey(null);
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const processedData = useMemo(() => {
    let result = [...data];

    if (filter && filterableColumns.length > 0) {
      const lowerFilter = filter.toLowerCase();
      result = result.filter((row) =>
        filterableColumns.some((col) => String(row[col]).toLowerCase().includes(lowerFilter))
      );
    }

    if (sortKey && sortDir) {
      result.sort((a, b) => {
        const aVal = a[sortKey], bVal = b[sortKey];
        const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
        return sortDir === 'asc' ? cmp : -cmp;
      });
    }

    return result;
  }, [data, filter, filterableColumns, sortKey, sortDir]);

  return (
    <div>
      {filterableColumns.length > 0 && (
        <input
          type="search"
          placeholder="Filter..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="mb-4 px-3 py-2 border rounded"
        />
      )}
      <table className="w-full border-collapse">
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                onClick={col.sortable ? () => handleSort(col.key) : undefined}
                className={col.sortable ? 'cursor-pointer select-none' : ''}
              >
                {col.header}
                {sortKey === col.key && (sortDir === 'asc' ? ' ↑' : ' ↓')}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {processedData.length === 0 ? (
            <tr><td colSpan={columns.length} className="text-center py-8">{emptyMessage}</td></tr>
          ) : (
            processedData.map((row, i) => (
              <tr key={i}>
                {columns.map((col) => (
                  <td key={col.key}>{col.render ? col.render(row[col.key], row) : String(row[col.key] ?? '')}</td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}`,
    explanation: 'Generic component with type-safe column definitions. Supports custom cell renderers, tri-state sorting, and text filtering. Uses useMemo for performance with large datasets.',
    tags: ['typescript', 'react', 'component', 'table', 'sorting', 'filtering', 'generics'],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ERROR HANDLING EXAMPLES
  // ═══════════════════════════════════════════════════════════════════════════

  {
    id: 'error-class-hierarchy',
    taskType: 'error_handling',
    language: 'typescript',
    title: 'Custom error class hierarchy',
    task: 'Create a structured error class hierarchy for an application with proper serialization.',
    solution: `export class AppError extends Error {
  readonly code: string;
  readonly statusCode: number;
  readonly isOperational: boolean;

  constructor(message: string, options: { code: string; statusCode?: number; cause?: unknown; isOperational?: boolean }) {
    super(message, { cause: options.cause });
    this.name = this.constructor.name;
    this.code = options.code;
    this.statusCode = options.statusCode ?? 500;
    this.isOperational = options.isOperational ?? true;
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      error: { code: this.code, message: this.message, ...(process.env.NODE_ENV === 'development' && { stack: this.stack }) },
    };
  }
}

export class ValidationError extends AppError {
  readonly fields: Record<string, string[]>;

  constructor(fields: Record<string, string[]>) {
    super('Validation failed', { code: 'VALIDATION_ERROR', statusCode: 422 });
    this.fields = fields;
  }

  toJSON() {
    return { error: { code: this.code, message: this.message, fields: this.fields } };
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id: string) {
    super(\`\${resource} with id '\${id}' not found\`, { code: 'NOT_FOUND', statusCode: 404 });
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required') {
    super(message, { code: 'UNAUTHORIZED', statusCode: 401 });
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Insufficient permissions') {
    super(message, { code: 'FORBIDDEN', statusCode: 403 });
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, { code: 'CONFLICT', statusCode: 409 });
  }
}`,
    explanation: 'Structured error hierarchy with HTTP status codes, machine-readable error codes, and proper serialization. The isOperational flag distinguishes expected errors from bugs.',
    tags: ['typescript', 'error-handling', 'classes', 'http', 'api'],
  },

  {
    id: 'error-boundary-recovery',
    taskType: 'error_handling',
    language: 'typescript',
    title: 'Global error boundary with recovery',
    task: 'Create a React error boundary that catches errors, reports them, and offers recovery options.',
    solution: `import { Component, type ErrorInfo, type ReactNode } from 'react';

type ErrorBoundaryProps = {
  children: ReactNode;
  fallback?: (props: { error: Error; reset: () => void }) => ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
};

type ErrorBoundaryState = {
  error: Error | null;
};

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.props.onError?.(error, errorInfo);
    console.error('[ErrorBoundary]', error, errorInfo.componentStack);
  }

  reset = () => {
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback({ error: this.state.error, reset: this.reset });
      }
      return (
        <div role="alert" className="p-6 rounded-lg border border-red-200 bg-red-50">
          <h2 className="text-lg font-semibold text-red-800">Something went wrong</h2>
          <p className="mt-2 text-red-600">{this.state.error.message}</p>
          <button onClick={this.reset} className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700">
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}`,
    explanation: 'Error boundaries catch render errors in the component tree. Provides a reset mechanism, custom fallback support, and error reporting callback for monitoring services.',
    tags: ['typescript', 'react', 'error-boundary', 'error-handling', 'component'],
  },

  {
    id: 'error-api-standardization',
    taskType: 'error_handling',
    language: 'typescript',
    title: 'API error response standardization',
    task: 'Create middleware that standardizes all API error responses into a consistent format.',
    solution: `import { type Request, type Response, type NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from './errors';

type ErrorResponse = {
  error: {
    code: string;
    message: string;
    details?: unknown;
    requestId?: string;
  };
};

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  const requestId = req.headers['x-request-id'] as string | undefined;

  // Known operational errors
  if (err instanceof AppError) {
    const response: ErrorResponse = { error: { code: err.code, message: err.message, requestId } };
    if (err instanceof ValidationError) {
      response.error.details = err.fields;
    }
    return res.status(err.statusCode).json(response);
  }

  // Zod validation errors
  if (err instanceof ZodError) {
    const fields: Record<string, string[]> = {};
    err.errors.forEach((e) => {
      const path = e.path.join('.');
      fields[path] = fields[path] || [];
      fields[path].push(e.message);
    });
    return res.status(422).json({
      error: { code: 'VALIDATION_ERROR', message: 'Invalid request data', details: fields, requestId },
    });
  }

  // Unexpected errors - don't leak internals
  logger.error('Unhandled error', { err, requestId, path: req.path, method: req.method });

  res.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred', requestId },
  });
}`,
    explanation: 'Centralizes error formatting for consistent API responses. Handles known errors with details, Zod errors with field-level messages, and unknown errors without leaking internals.',
    tags: ['typescript', 'express', 'error-handling', 'middleware', 'api'],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // TYPE DEFINITION EXAMPLES
  // ═══════════════════════════════════════════════════════════════════════════

  {
    id: 'type-complex-generic',
    taskType: 'type_definition',
    language: 'typescript',
    title: 'Complex generic type with constraints',
    task: 'Create a type-safe event emitter with typed event maps and listener signatures.',
    solution: `type EventMap = Record<string, unknown[]>;

type Listener<Args extends unknown[]> = (...args: Args) => void;

interface TypedEmitter<Events extends EventMap> {
  on<K extends keyof Events>(event: K, listener: Listener<Events[K]>): () => void;
  off<K extends keyof Events>(event: K, listener: Listener<Events[K]>): void;
  emit<K extends keyof Events>(event: K, ...args: Events[K]): void;
  once<K extends keyof Events>(event: K, listener: Listener<Events[K]>): () => void;
}

// Usage example:
type AppEvents = {
  'user:login': [user: { id: string; email: string }];
  'user:logout': [userId: string];
  'error': [error: Error, context?: string];
  'data:sync': [collection: string, count: number];
};

function createEmitter<Events extends EventMap>(): TypedEmitter<Events> {
  const listeners = new Map<keyof Events, Set<Function>>();

  return {
    on(event, listener) {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event)!.add(listener);
      return () => this.off(event, listener);
    },
    off(event, listener) {
      listeners.get(event)?.delete(listener);
    },
    emit(event, ...args) {
      listeners.get(event)?.forEach((fn) => fn(...args));
    },
    once(event, listener) {
      const unsubscribe = this.on(event, ((...args: unknown[]) => {
        unsubscribe();
        (listener as Function)(...args);
      }) as Listener<Events[typeof event]>);
      return unsubscribe;
    },
  };
}`,
    explanation: 'Uses mapped types and generic constraints to ensure type safety between event names and their argument types. The on() method returns an unsubscribe function for easy cleanup.',
    tags: ['typescript', 'generics', 'events', 'type-safety', 'design-patterns'],
  },

  {
    id: 'type-discriminated-union',
    taskType: 'type_definition',
    language: 'typescript',
    title: 'Discriminated union for state management',
    task: 'Create discriminated union types for async data loading states with exhaustive handling.',
    solution: `// Discriminated union for async state
type AsyncState<T, E = Error> =
  | { status: 'idle' }
  | { status: 'loading'; previousData?: T }
  | { status: 'success'; data: T; updatedAt: number }
  | { status: 'error'; error: E; previousData?: T };

// Helper to create states
const AsyncState = {
  idle: <T>(): AsyncState<T> => ({ status: 'idle' }),
  loading: <T>(previousData?: T): AsyncState<T> => ({ status: 'loading', previousData }),
  success: <T>(data: T): AsyncState<T> => ({ status: 'success', data, updatedAt: Date.now() }),
  error: <T, E = Error>(error: E, previousData?: T): AsyncState<T, E> => ({ status: 'error', error, previousData }),
};

// Exhaustive pattern matching helper
function matchState<T, E, R>(
  state: AsyncState<T, E>,
  handlers: {
    idle: () => R;
    loading: (previousData?: T) => R;
    success: (data: T) => R;
    error: (error: E, previousData?: T) => R;
  }
): R {
  switch (state.status) {
    case 'idle': return handlers.idle();
    case 'loading': return handlers.loading(state.previousData);
    case 'success': return handlers.success(state.data);
    case 'error': return handlers.error(state.error, state.previousData);
  }
}

// Usage:
function renderUserProfile(state: AsyncState<User>) {
  return matchState(state, {
    idle: () => null,
    loading: (prev) => prev ? <StaleProfile user={prev} /> : <Skeleton />,
    success: (user) => <Profile user={user} />,
    error: (err, prev) => <ErrorWithRetry error={err} staleData={prev} />,
  });
}`,
    explanation: 'Discriminated unions with a status field enable exhaustive type narrowing. The matchState helper ensures all cases are handled at compile time. Previous data support enables optimistic UI.',
    tags: ['typescript', 'discriminated-union', 'state-management', 'pattern-matching'],
  },

  {
    id: 'type-api-response',
    taskType: 'type_definition',
    language: 'typescript',
    title: 'Utility types for API response typing',
    task: 'Create utility types for typing API responses with pagination, error handling, and resource relationships.',
    solution: `// Base API response wrapper
type ApiResponse<T> = {
  data: T;
  meta?: Record<string, unknown>;
};

// Paginated response
type PaginatedResponse<T> = ApiResponse<T[]> & {
  pagination: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
};

// Error response
type ApiError = {
  error: {
    code: string;
    message: string;
    details?: Record<string, string[]>;
  };
};

// Make selected fields of T required
type WithRequired<T, K extends keyof T> = T & Required<Pick<T, K>>;

// Pick only the fields needed for list views vs detail views
type ResourceList<T, K extends keyof T> = Pick<T, K | 'id'>;

// Include related resources
type WithRelations<T, Relations extends Record<string, unknown>> = T & {
  [K in keyof Relations]: Relations[K];
};

// Infer the response type from an API function
type InferResponse<T extends (...args: any[]) => Promise<any>> =
  Awaited<ReturnType<T>> extends ApiResponse<infer D> ? D : never;

// Usage examples:
type User = { id: string; name: string; email: string; avatar: string; bio: string; createdAt: string };
type UserListItem = ResourceList<User, 'name' | 'email' | 'avatar'>;
type UserWithPosts = WithRelations<User, { posts: Post[]; followers: { count: number } }>;
type UserListResponse = PaginatedResponse<UserListItem>;
type UserDetailResponse = ApiResponse<UserWithPosts>;`,
    explanation: 'Utility types reduce boilerplate and enforce consistent API response shapes. ResourceList creates lightweight list representations. WithRelations adds type-safe eager-loaded data.',
    tags: ['typescript', 'utility-types', 'api', 'generics', 'response-types'],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // DATABASE QUERY EXAMPLES
  // ═══════════════════════════════════════════════════════════════════════════

  {
    id: 'db-prisma-relations',
    taskType: 'database_query',
    language: 'typescript',
    title: 'Prisma query with relations and filtering',
    task: 'Write a Prisma query to fetch a user\'s active projects with their latest tasks and team members.',
    solution: `async function getUserProjectsDashboard(userId: string) {
  const projects = await prisma.project.findMany({
    where: {
      members: { some: { userId } },
      status: 'active',
      deletedAt: null,
    },
    select: {
      id: true,
      name: true,
      description: true,
      updatedAt: true,
      _count: { select: { tasks: true } },
      tasks: {
        where: { status: { not: 'done' } },
        orderBy: { priority: 'desc' },
        take: 5,
        select: {
          id: true,
          title: true,
          status: true,
          priority: true,
          assignee: { select: { id: true, name: true, avatar: true } },
          dueDate: true,
        },
      },
      members: {
        take: 5,
        select: {
          user: { select: { id: true, name: true, avatar: true } },
          role: true,
        },
      },
    },
    orderBy: { updatedAt: 'desc' },
    take: 10,
  });

  return projects.map((project) => ({
    ...project,
    taskCount: project._count.tasks,
    _count: undefined,
  }));
}`,
    explanation: 'Uses select to fetch only needed fields, reducing payload size. Nested relations are limited with take. The _count aggregation avoids fetching all tasks just to count them.',
    tags: ['typescript', 'prisma', 'database', 'relations', 'query-optimization'],
  },

  {
    id: 'db-transaction-rollback',
    taskType: 'database_query',
    language: 'typescript',
    title: 'Transaction with rollback on failure',
    task: 'Implement a money transfer between accounts using a database transaction with proper rollback.',
    solution: `import { Prisma } from '@prisma/client';

type TransferResult = {
  transactionId: string;
  fromBalance: number;
  toBalance: number;
};

async function transferFunds(
  fromAccountId: string,
  toAccountId: string,
  amount: number
): Promise<TransferResult> {
  if (amount <= 0) {
    throw new ValidationError({ amount: ['Amount must be positive'] });
  }

  return prisma.$transaction(async (tx) => {
    // Lock the source account row to prevent concurrent modifications
    const fromAccount = await tx.account.findUnique({
      where: { id: fromAccountId },
    });

    if (!fromAccount) {
      throw new NotFoundError('Account', fromAccountId);
    }
    if (fromAccount.balance < amount) {
      throw new AppError('Insufficient funds', { code: 'INSUFFICIENT_FUNDS', statusCode: 422 });
    }

    const toAccount = await tx.account.findUnique({
      where: { id: toAccountId },
    });
    if (!toAccount) {
      throw new NotFoundError('Account', toAccountId);
    }

    // Perform the transfer
    const [updatedFrom, updatedTo] = await Promise.all([
      tx.account.update({
        where: { id: fromAccountId },
        data: { balance: { decrement: amount } },
      }),
      tx.account.update({
        where: { id: toAccountId },
        data: { balance: { increment: amount } },
      }),
    ]);

    // Record the transaction
    const record = await tx.transaction.create({
      data: {
        fromAccountId,
        toAccountId,
        amount,
        type: 'transfer',
        status: 'completed',
      },
    });

    return {
      transactionId: record.id,
      fromBalance: updatedFrom.balance,
      toBalance: updatedTo.balance,
    };
  }, {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    timeout: 10000,
  });
}`,
    explanation: 'Uses Prisma interactive transactions with Serializable isolation to prevent race conditions. Validates before mutating. If any step throws, the entire transaction rolls back automatically.',
    tags: ['typescript', 'prisma', 'transaction', 'database', 'financial'],
  },

  {
    id: 'db-optimized-pagination',
    taskType: 'database_query',
    language: 'typescript',
    title: 'Optimized query with select and pagination',
    task: 'Write an optimized search query with full-text search, pagination, and minimal data transfer.',
    solution: `type SearchParams = {
  query: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  cursor?: string;
  limit?: number;
};

type SearchResult = {
  items: ProductListItem[];
  nextCursor: string | null;
  total: number;
  facets: { category: string; count: number }[];
};

async function searchProducts(params: SearchParams): Promise<SearchResult> {
  const { query, category, minPrice, maxPrice, cursor, limit = 20 } = params;

  const where: Prisma.ProductWhereInput = {
    status: 'published',
    ...(query && {
      OR: [
        { name: { contains: query, mode: 'insensitive' } },
        { description: { contains: query, mode: 'insensitive' } },
        { tags: { hasSome: query.split(' ') } },
      ],
    }),
    ...(category && { categoryId: category }),
    ...(minPrice !== undefined && { price: { gte: minPrice } }),
    ...(maxPrice !== undefined && { price: { ...( minPrice !== undefined ? { gte: minPrice } : {}), lte: maxPrice } }),
  };

  const [items, total, facets] = await Promise.all([
    prisma.product.findMany({
      where,
      select: {
        id: true,
        name: true,
        price: true,
        imageUrl: true,
        rating: true,
        reviewCount: true,
        category: { select: { id: true, name: true } },
      },
      orderBy: [{ rating: 'desc' }, { reviewCount: 'desc' }],
      take: limit + 1,
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
    }),
    prisma.product.count({ where }),
    prisma.product.groupBy({
      by: ['categoryId'],
      where: { status: 'published', ...(query && { OR: [{ name: { contains: query, mode: 'insensitive' } }] }) },
      _count: true,
      orderBy: { _count: { id: 'desc' } },
      take: 10,
    }),
  ]);

  const hasMore = items.length > limit;
  const resultItems = hasMore ? items.slice(0, limit) : items;

  return {
    items: resultItems,
    nextCursor: hasMore ? resultItems[resultItems.length - 1].id : null,
    total,
    facets: facets.map((f) => ({ category: f.categoryId, count: f._count })),
  };
}`,
    explanation: 'Runs count, items, and facets in parallel. Uses cursor pagination for consistent performance. Select minimizes data transfer. Conditional spreading keeps the query builder clean.',
    tags: ['typescript', 'prisma', 'database', 'search', 'pagination', 'optimization'],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // VALIDATION EXAMPLES
  // ═══════════════════════════════════════════════════════════════════════════

  {
    id: 'validation-zod-nested',
    taskType: 'validation',
    language: 'typescript',
    title: 'Zod schema for complex nested object',
    task: 'Create a Zod schema for validating a complex order with nested items, shipping address, and payment info.',
    solution: `import { z } from 'zod';

const addressSchema = z.object({
  street: z.string().min(1, 'Street is required').max(200),
  city: z.string().min(1, 'City is required').max(100),
  state: z.string().length(2, 'Use 2-letter state code'),
  zipCode: z.string().regex(/^\d{5}(-\d{4})?$/, 'Invalid ZIP code'),
  country: z.string().length(2, 'Use ISO country code').default('US'),
});

const orderItemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().min(1).max(99),
  priceAtOrder: z.number().positive(),
  options: z.record(z.string()).optional(),
});

const paymentSchema = z.discriminatedUnion('method', [
  z.object({
    method: z.literal('card'),
    cardToken: z.string().min(1),
    saveCard: z.boolean().default(false),
  }),
  z.object({
    method: z.literal('paypal'),
    paypalOrderId: z.string().min(1),
  }),
  z.object({
    method: z.literal('bank_transfer'),
    accountLast4: z.string().length(4),
  }),
]);

export const createOrderSchema = z.object({
  items: z.array(orderItemSchema).min(1, 'Order must have at least one item').max(50),
  shippingAddress: addressSchema,
  billingAddress: addressSchema.optional(),
  payment: paymentSchema,
  notes: z.string().max(500).optional(),
  couponCode: z.string().regex(/^[A-Z0-9]{4,20}$/).optional(),
}).refine(
  (data) => {
    const total = data.items.reduce((sum, item) => sum + item.priceAtOrder * item.quantity, 0);
    return total > 0 && total < 100000;
  },
  { message: 'Order total must be between $0 and $100,000', path: ['items'] }
);

export type CreateOrderInput = z.infer<typeof createOrderSchema>;`,
    explanation: 'Uses discriminated unions for payment methods, nested object schemas, regex validation, and a custom refinement for business logic validation. Type inference eliminates manual type definitions.',
    tags: ['typescript', 'zod', 'validation', 'schema', 'nested', 'discriminated-union'],
  },

  {
    id: 'validation-custom-messages',
    taskType: 'validation',
    language: 'typescript',
    title: 'Custom validator with meaningful error messages',
    task: 'Create a password strength validator that provides specific, actionable feedback.',
    solution: `type PasswordStrength = 'weak' | 'fair' | 'strong' | 'very_strong';

type PasswordValidationResult = {
  isValid: boolean;
  strength: PasswordStrength;
  score: number;
  errors: string[];
  suggestions: string[];
};

const COMMON_PASSWORDS = new Set(['password', '123456', 'qwerty', 'admin', 'letmein']);

export function validatePassword(password: string, userInputs: string[] = []): PasswordValidationResult {
  const errors: string[] = [];
  const suggestions: string[] = [];
  let score = 0;

  // Length checks
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters');
  } else if (password.length >= 12) {
    score += 2;
  } else {
    score += 1;
    suggestions.push('Use 12+ characters for a stronger password');
  }

  // Character variety
  if (!/[a-z]/.test(password)) errors.push('Include at least one lowercase letter');
  else score += 1;

  if (!/[A-Z]/.test(password)) errors.push('Include at least one uppercase letter');
  else score += 1;

  if (!/[0-9]/.test(password)) errors.push('Include at least one number');
  else score += 1;

  if (!/[^a-zA-Z0-9]/.test(password)) suggestions.push('Add a special character for extra security');
  else score += 2;

  // Pattern checks
  if (/(.)\\1{2,}/.test(password)) {
    errors.push('Avoid repeating characters (e.g., "aaa")');
    score -= 1;
  }
  if (/^(abc|123|qwe)/i.test(password)) {
    errors.push('Avoid sequential patterns');
    score -= 1;
  }

  // Common password check
  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    errors.push('This is a commonly used password');
    score = 0;
  }

  // User input similarity check
  const lowerPassword = password.toLowerCase();
  for (const input of userInputs) {
    if (input && lowerPassword.includes(input.toLowerCase())) {
      errors.push('Password should not contain your personal information');
      score -= 1;
      break;
    }
  }

  const strength: PasswordStrength = score <= 2 ? 'weak' : score <= 4 ? 'fair' : score <= 6 ? 'strong' : 'very_strong';

  return { isValid: errors.length === 0, strength, score: Math.max(0, score), errors, suggestions };
}`,
    explanation: 'Provides specific, actionable error messages instead of generic "invalid password". Checks for common passwords, sequential patterns, and personal information. Returns both errors and suggestions.',
    tags: ['typescript', 'validation', 'password', 'security', 'user-experience'],
  },

  {
    id: 'validation-input-sanitization',
    taskType: 'validation',
    language: 'typescript',
    title: 'Input sanitization for user-provided content',
    task: 'Create a sanitization utility that cleans user input for safe storage and display.',
    solution: `type SanitizeOptions = {
  maxLength?: number;
  allowHtml?: boolean;
  allowedTags?: string[];
  trimWhitespace?: boolean;
  normalizeWhitespace?: boolean;
  removeNullBytes?: boolean;
};

const HTML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
};

export function sanitizeInput(input: unknown, options: SanitizeOptions = {}): string {
  const {
    maxLength = 10000,
    allowHtml = false,
    allowedTags = [],
    trimWhitespace = true,
    normalizeWhitespace = true,
    removeNullBytes = true,
  } = options;

  if (typeof input !== 'string') {
    return '';
  }

  let result = input;

  // Remove null bytes (can bypass security filters)
  if (removeNullBytes) {
    result = result.replace(/\0/g, '');
  }

  // Normalize unicode to prevent homograph attacks
  result = result.normalize('NFC');

  // Trim and normalize whitespace
  if (trimWhitespace) {
    result = result.trim();
  }
  if (normalizeWhitespace) {
    result = result.replace(/[\t\r]+/g, ' ').replace(/ {2,}/g, ' ');
  }

  // HTML handling
  if (!allowHtml) {
    result = result.replace(/[&<>"']/g, (char) => HTML_ENTITIES[char] || char);
  } else if (allowedTags.length > 0) {
    const tagPattern = new RegExp(
      \`<(?!\\/?(\${allowedTags.join('|')})\\b)[^>]*>\`,
      'gi'
    );
    result = result.replace(tagPattern, '');
    // Remove event handlers from allowed tags
    result = result.replace(/\s+on\w+\s*=\s*["'][^"']*["']/gi, '');
  }

  // Enforce max length (after processing to avoid truncating entities)
  if (result.length > maxLength) {
    result = result.slice(0, maxLength);
  }

  return result;
}

// Convenience functions
export const sanitize = {
  text: (input: unknown) => sanitizeInput(input, { allowHtml: false }),
  html: (input: unknown, tags: string[] = ['b', 'i', 'em', 'strong', 'a', 'p', 'br']) =>
    sanitizeInput(input, { allowHtml: true, allowedTags: tags }),
  slug: (input: unknown) =>
    sanitizeInput(input, { maxLength: 100 })
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, ''),
};`,
    explanation: 'Defense-in-depth sanitization: removes null bytes, normalizes unicode, escapes HTML entities, strips disallowed tags, and removes event handlers. Convenience functions for common use cases.',
    tags: ['typescript', 'sanitization', 'security', 'xss', 'input-validation'],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // UTILITY FUNCTION EXAMPLES
  // ═══════════════════════════════════════════════════════════════════════════

  {
    id: 'util-deep-merge',
    taskType: 'utility_function',
    language: 'typescript',
    title: 'Type-safe deep merge function',
    task: 'Create a type-safe deep merge utility that properly handles nested objects, arrays, and edge cases.',
    solution: `type DeepPartial<T> = T extends object
  ? { [K in keyof T]?: DeepPartial<T[K]> }
  : T;

type Primitive = string | number | boolean | null | undefined | symbol | bigint;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype;
}

export function deepMerge<T extends Record<string, unknown>>(
  target: T,
  ...sources: DeepPartial<T>[]
): T {
  const result = { ...target };

  for (const source of sources) {
    if (!isPlainObject(source)) continue;

    for (const key of Object.keys(source) as (keyof T)[]) {
      const sourceValue = source[key as string];
      const targetValue = result[key];

      if (sourceValue === undefined) {
        continue; // Don't overwrite with undefined
      }

      if (isPlainObject(sourceValue) && isPlainObject(targetValue)) {
        (result as any)[key] = deepMerge(
          targetValue as Record<string, unknown>,
          sourceValue as Record<string, unknown>
        );
      } else {
        (result as any)[key] = sourceValue;
      }
    }
  }

  return result;
}

// Usage:
// const config = deepMerge(defaultConfig, envConfig, userConfig);`,
    explanation: 'Handles nested objects recursively, skips undefined values, checks for plain objects to avoid merging class instances or arrays incorrectly. Supports multiple sources with left-to-right precedence.',
    tags: ['typescript', 'utility', 'deep-merge', 'generics', 'type-safety'],
  },

  {
    id: 'util-retry-wrapper',
    taskType: 'utility_function',
    language: 'typescript',
    title: 'Retry wrapper with configurable options',
    task: 'Create a configurable retry wrapper that supports different backoff strategies and abort signals.',
    solution: `type BackoffStrategy = 'exponential' | 'linear' | 'fixed';

type RetryConfig = {
  maxAttempts: number;
  backoff: BackoffStrategy;
  baseDelay: number;
  maxDelay: number;
  jitter: boolean;
  signal?: AbortSignal;
  shouldRetry?: (error: unknown, attempt: number) => boolean;
  onRetry?: (error: unknown, attempt: number, delay: number) => void;
};

const DEFAULT_CONFIG: RetryConfig = {
  maxAttempts: 3,
  backoff: 'exponential',
  baseDelay: 1000,
  maxDelay: 30000,
  jitter: true,
  shouldRetry: () => true,
};

function calculateDelay(attempt: number, config: RetryConfig): number {
  let delay: number;
  switch (config.backoff) {
    case 'exponential':
      delay = config.baseDelay * Math.pow(2, attempt - 1);
      break;
    case 'linear':
      delay = config.baseDelay * attempt;
      break;
    case 'fixed':
      delay = config.baseDelay;
      break;
  }

  delay = Math.min(delay, config.maxDelay);

  if (config.jitter) {
    delay = delay * (0.5 + Math.random() * 0.5);
  }

  return Math.round(delay);
}

export function createRetry(userConfig: Partial<RetryConfig> = {}) {
  const config = { ...DEFAULT_CONFIG, ...userConfig };

  return async function retry<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
      if (config.signal?.aborted) {
        throw new Error('Retry aborted');
      }

      try {
        return await fn();
      } catch (error) {
        lastError = error;

        if (attempt === config.maxAttempts || !config.shouldRetry!(error, attempt)) {
          throw error;
        }

        const delay = calculateDelay(attempt, config);
        config.onRetry?.(error, attempt, delay);

        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(resolve, delay);
          config.signal?.addEventListener('abort', () => {
            clearTimeout(timer);
            reject(new Error('Retry aborted'));
          }, { once: true });
        });
      }
    }

    throw lastError;
  };
}

// Usage:
// const retryFetch = createRetry({ maxAttempts: 5, shouldRetry: (err) => err.status >= 500 });
// const data = await retryFetch(() => fetch('/api/data'));`,
    explanation: 'Factory pattern creates reusable retry instances. Supports AbortSignal for cancellation, multiple backoff strategies, and configurable retry conditions. The delay respects abort signals.',
    tags: ['typescript', 'utility', 'retry', 'backoff', 'abort-signal', 'resilience'],
  },

  {
    id: 'util-rate-limiter',
    taskType: 'utility_function',
    language: 'typescript',
    title: 'Rate limiter implementation',
    task: 'Create a token bucket rate limiter for controlling API request rates.',
    solution: `type RateLimiterOptions = {
  maxTokens: number;       // Maximum burst capacity
  refillRate: number;      // Tokens added per interval
  refillInterval: number;  // Interval in ms (default 1000 = per second)
};

type RateLimitResult = {
  allowed: boolean;
  remainingTokens: number;
  retryAfterMs: number | null;
};

export class RateLimiter {
  private tokens: number;
  private readonly maxTokens: number;
  private readonly refillRate: number;
  private readonly refillInterval: number;
  private lastRefill: number;

  constructor(options: RateLimiterOptions) {
    this.maxTokens = options.maxTokens;
    this.tokens = options.maxTokens;
    this.refillRate = options.refillRate;
    this.refillInterval = options.refillInterval ?? 1000;
    this.lastRefill = Date.now();
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    const tokensToAdd = Math.floor(elapsed / this.refillInterval) * this.refillRate;

    if (tokensToAdd > 0) {
      this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd);
      this.lastRefill = now;
    }
  }

  tryConsume(tokens = 1): RateLimitResult {
    this.refill();

    if (this.tokens >= tokens) {
      this.tokens -= tokens;
      return { allowed: true, remainingTokens: this.tokens, retryAfterMs: null };
    }

    const tokensNeeded = tokens - this.tokens;
    const retryAfterMs = Math.ceil(tokensNeeded / this.refillRate) * this.refillInterval;

    return { allowed: false, remainingTokens: this.tokens, retryAfterMs };
  }

  async waitForToken(tokens = 1): Promise<void> {
    const result = this.tryConsume(tokens);
    if (result.allowed) return;

    await new Promise((resolve) => setTimeout(resolve, result.retryAfterMs!));
    return this.waitForToken(tokens);
  }

  reset(): void {
    this.tokens = this.maxTokens;
    this.lastRefill = Date.now();
  }
}

// Usage:
// const limiter = new RateLimiter({ maxTokens: 10, refillRate: 2, refillInterval: 1000 });
// const result = limiter.tryConsume();
// if (!result.allowed) { res.set('Retry-After', String(result.retryAfterMs / 1000)); }`,
    explanation: 'Token bucket algorithm allows bursts up to maxTokens while maintaining a steady refill rate. tryConsume is non-blocking for middleware use. waitForToken provides a blocking alternative for client-side rate limiting.',
    tags: ['typescript', 'utility', 'rate-limiter', 'token-bucket', 'api'],
  },
];

// ─── Selection & Formatting Functions ────────────────────────────────────────

/**
 * Tokenize a string into lowercase keywords for matching.
 */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2);
}

/**
 * Calculate relevance score between a query and an example.
 */
function calculateRelevance(example: FewShotExample, options: ExampleSelectionOptions): number {
  let score = 0;

  // Exact task type match is highest priority
  if (options.taskType && example.taskType === options.taskType) {
    score += 100;
  }

  // Language match
  if (options.language && example.language === options.language) {
    score += 50;
  }

  // Tag overlap
  if (options.tags && options.tags.length > 0) {
    const matchingTags = options.tags.filter((tag) =>
      example.tags.includes(tag.toLowerCase())
    );
    score += matchingTags.length * 20;
  }

  // Query keyword matching
  if (options.query) {
    const queryTokens = tokenize(options.query);
    const exampleTokens = new Set([
      ...tokenize(example.title),
      ...tokenize(example.task),
      ...example.tags,
    ]);

    const matches = queryTokens.filter((token) => exampleTokens.has(token));
    score += matches.length * 10;
  }

  return score;
}

/**
 * Select the most relevant few-shot examples for a given task.
 */
export function selectExamples(options: ExampleSelectionOptions): FewShotExample[] {
  const { maxExamples = 2, maxChars = 3000 } = options;

  // Score and sort all examples
  const scored = EXAMPLES.map((example) => ({
    example,
    score: calculateRelevance(example, options),
  }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  // Select top examples within character budget
  const selected: FewShotExample[] = [];
  let totalChars = 0;

  for (const { example } of scored) {
    if (selected.length >= maxExamples) break;

    const exampleChars = example.task.length + example.solution.length + (example.context?.length ?? 0);
    if (totalChars + exampleChars > maxChars) continue;

    selected.push(example);
    totalChars += exampleChars;
  }

  return selected;
}

/**
 * Format selected examples into a prompt-ready string.
 */
export function formatExamplesForPrompt(
  examples: FewShotExample[],
  format: 'xml' | 'markdown' | 'plain' = 'xml'
): string {
  if (examples.length === 0) return '';

  switch (format) {
    case 'xml':
      return formatXml(examples);
    case 'markdown':
      return formatMarkdown(examples);
    case 'plain':
      return formatPlain(examples);
  }
}

function formatXml(examples: FewShotExample[]): string {
  const parts = examples.map((ex) => {
    const contextBlock = ex.context ? `\n  <context>\n${ex.context}\n  </context>` : '';
    const explanationBlock = ex.explanation ? `\n  <explanation>${ex.explanation}</explanation>` : '';
    return `<example>
  <title>${ex.title}</title>
  <task>${ex.task}</task>${contextBlock}
  <solution>
${ex.solution}
  </solution>${explanationBlock}
</example>`;
  });

  return `<examples>\n${parts.join('\n\n')}\n</examples>`;
}

function formatMarkdown(examples: FewShotExample[]): string {
  const parts = examples.map((ex) => {
    const contextBlock = ex.context
      ? `\n**Existing Code:**\n\`\`\`${ex.language}\n${ex.context}\n\`\`\`\n`
      : '';
    const explanationBlock = ex.explanation ? `\n> ${ex.explanation}\n` : '';
    return `### Example: ${ex.title}

**Task:** ${ex.task}
${contextBlock}
**Solution:**
\`\`\`${ex.language}
${ex.solution}
\`\`\`
${explanationBlock}`;
  });

  return parts.join('\n---\n\n');
}

function formatPlain(examples: FewShotExample[]): string {
  const parts = examples.map((ex, i) => {
    const contextBlock = ex.context ? `\nExisting Code:\n${ex.context}\n` : '';
    return `=== Example ${i + 1}: ${ex.title} ===

Task: ${ex.task}
${contextBlock}
Solution:
${ex.solution}
`;
  });

  return parts.join('\n' + '─'.repeat(60) + '\n\n');
}

/**
 * Get all available task types.
 */
export function getTaskTypes(): TaskType[] {
  return [
    'bug_fix',
    'feature_implementation',
    'refactoring',
    'test_writing',
    'code_review',
    'api_endpoint',
    'component_creation',
    'error_handling',
    'type_definition',
    'database_query',
    'validation',
    'utility_function',
  ];
}

/**
 * Get example count by task type.
 */
export function getExampleStats(): Record<TaskType, number> {
  const stats = {} as Record<TaskType, number>;
  for (const taskType of getTaskTypes()) {
    stats[taskType] = 0;
  }
  for (const example of EXAMPLES) {
    stats[example.taskType]++;
  }
  return stats;
}

/**
 * Get all examples (for testing or inspection).
 */
export function getAllExamples(): FewShotExample[] {
  return [...EXAMPLES];
}
