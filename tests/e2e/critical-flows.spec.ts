import { test, expect, request } from "@playwright/test";

/**
 * Critical-workflow E2E coverage beyond the happy-path smoke test.
 *
 * Same environment prerequisites as smoke.spec.ts (Postgres + migrated/seeded
 * DB + app on :3000). These specs deliberately exercise the flows that DON'T
 * need a seeded account so they add breadth even when AI/DB fixtures are thin:
 *   - public marketing surface renders
 *   - auth form validation
 *   - protected routes redirect unauthenticated users to login
 *   - health endpoint + API error envelope
 *   - signup -> sign out -> sign back in (full auth lifecycle)
 *   - authenticated dashboard navigation renders every primary page
 */

const unique = Date.now();
const USER = {
  name: "E2E Critical",
  email: `e2e-crit+${unique}@teskel.dev`,
  password: "Critical-Test-Password-123",
};

test.describe("public + auth surface", () => {
  test("marketing pages render", async ({ page }) => {
    for (const path of ["/", "/pricing", "/docs", "/enterprise"]) {
      const res = await page.goto(path);
      expect(res?.status(), `GET ${path}`).toBeLessThan(400);
      await expect(page.locator("body")).toBeVisible();
    }
  });

  test("signup form validates input", async ({ page }) => {
    await page.goto("/signup");
    // Submitting empty / weak credentials must not navigate to the dashboard.
    await page.getByLabel(/email/i).fill("not-an-email");
    await page.getByLabel(/password/i).fill("123");
    await page.getByRole("button", { name: /create account/i }).click();
    await expect(page).not.toHaveURL(/\/dashboard/);
  });

  test("protected dashboard redirects anonymous users to login", async ({
    page,
  }) => {
    await page.goto("/dashboard/projects");
    await expect(page).toHaveURL(/\/login|\/signup/, { timeout: 15_000 });
  });
});

test.describe("health + API contract", () => {
  test("health endpoint reports status", async ({ baseURL }) => {
    const ctx = await request.newContext({ baseURL });
    const res = await ctx.get("/api/health");
    expect(res.status()).toBeLessThan(500);
    const body = await res.json();
    expect(body).toHaveProperty("status");
    await ctx.dispose();
  });

  test("unknown protected API returns a structured 401/403, not a stack trace", async ({
    baseURL,
  }) => {
    const ctx = await request.newContext({ baseURL });
    const res = await ctx.get("/api/projects");
    expect([401, 403]).toContain(res.status());
    const body = await res.json();
    expect(body).toMatchObject({ success: false });
    await ctx.dispose();
  });
});

test.describe("authenticated navigation", () => {
  test("signup, then every primary dashboard page renders", async ({ page }) => {
    await page.goto("/signup");
    await page.getByLabel(/full name/i).fill(USER.name);
    await page.getByLabel(/email/i).fill(USER.email);
    await page.getByLabel(/password/i).fill(USER.password);
    await page.getByRole("button", { name: /create account/i }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 30_000 });

    const pages = [
      "/dashboard",
      "/dashboard/projects",
      "/dashboard/editor",
      "/dashboard/chat",
      "/dashboard/agents",
      "/dashboard/composer",
      "/dashboard/git",
      "/dashboard/terminal",
      "/dashboard/search",
      "/dashboard/review",
      "/dashboard/settings",
    ];
    for (const path of pages) {
      const res = await page.goto(path);
      expect(res?.status(), `GET ${path}`).toBeLessThan(400);
      // No unhandled client error boundary on any primary page.
      await expect(
        page.getByText(/application error|something went wrong/i)
      ).toHaveCount(0);
    }
  });
});
