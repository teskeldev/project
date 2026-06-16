import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

/**
 * Vitest configuration for Teskel.
 *
 * Unit tests run in the Node environment (no jsdom) and exercise PURE logic in
 * `src/lib/**` only. They MUST NOT require a database, a network connection, or
 * any running service. Playwright e2e specs under `tests/e2e/**` are excluded
 * here and run via `npm run test:e2e` instead.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    /** Provide a test-only CSRF secret so `src/lib/security.ts` can load. */
    env: {
      CSRF_SECRET: "test-csrf-secret-do-not-use-in-production",
    },
    environment: "node",
    globals: true,
    include: ["tests/unit/**/*.test.ts", "src/**/__tests__/**/*.test.ts"],
    exclude: ["node_modules", ".next", "tests/e2e/**"],
  },
});
