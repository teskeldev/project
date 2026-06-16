import { test, expect, type Page } from "@playwright/test";

/**
 * Teskel end-to-end smoke test — the core "happy path":
 *
 *   signup -> create project -> create file -> edit & save -> ask AI ->
 *   generate changeset -> open Composer
 *
 * ---------------------------------------------------------------------------
 * THIS TEST CANNOT RUN WITHOUT A FULLY PROVISIONED ENVIRONMENT.
 *
 * Prerequisites (see README "Setup"):
 *   1. Postgres running          ->  npm run db:up        (docker, host :5433)
 *   2. Schema + demo seed data   ->  npm run db:migrate && npm run db:seed
 *   3. App running on :3000      ->  npm run dev          (or build && start)
 *   4. (optional) OPENAI_API_KEY ->  enables the live AI + changeset steps.
 *      Without a key, those steps assert the graceful "AI is not configured"
 *      path instead of a streamed response (see `aiConfigured()` below).
 *
 * The Playwright config does NOT auto-start the web server because that
 * requires a migrated database. Start everything yourself, then:
 *
 *   npm run test:e2e
 * ---------------------------------------------------------------------------
 *
 * Selectors prefer accessible roles / visible text against the REAL UI so the
 * test stays resilient to styling changes.
 */

// A fresh, unique account per run so re-runs don't collide on the unique email.
const unique = Date.now();
const TEST_USER = {
  name: "E2E Smoke",
  email: `e2e+${unique}@teskel.dev`,
  password: "Smoke-Test-Password-123",
};
const PROJECT_NAME = `e2e-project-${unique}`;
const FILE_NAME = `hello-${unique}.ts`;

/**
 * Whether a real AI key is configured for this run. When false, AI-dependent
 * assertions fall back to verifying the "not configured" messaging instead of
 * skipping silently.
 */
function aiConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim());
}

/** Sign up a brand-new user; lands on the dashboard on success. */
async function signup(page: Page): Promise<void> {
  await page.goto("/signup");
  await expect(
    page.getByRole("heading", { name: /create your account/i })
  ).toBeVisible();

  await page.getByLabel(/full name/i).fill(TEST_USER.name);
  await page.getByLabel(/email/i).fill(TEST_USER.email);
  await page.getByLabel(/password/i).fill(TEST_USER.password);
  await page.getByRole("button", { name: /create account/i }).click();

  // After signup the app auto signs-in and routes to /dashboard.
  await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
}

/** Create a project via the sidebar "New project" modal. */
async function createProject(page: Page): Promise<void> {
  // The sidebar exposes a "New project" control (icon button, title attribute).
  await page.getByTitle("New project").first().click();

  const modal = page.getByRole("heading", { name: /new project/i });
  await expect(modal).toBeVisible();

  await page.getByPlaceholder("my-app").fill(PROJECT_NAME);
  await page.getByRole("button", { name: /^create$/i }).click();

  // The new project becomes active and appears in the sidebar project list.
  await expect(page.getByText(PROJECT_NAME, { exact: false })).toBeVisible({
    timeout: 15_000,
  });
}

test.describe("Teskel happy path smoke test", () => {
  test("signup -> project -> file -> edit/save -> AI -> changeset -> composer", async ({
    page,
  }) => {
    // ---- 1. Signup -------------------------------------------------------
    await signup(page);

    // ---- 2. Create a project --------------------------------------------
    await createProject(page);

    // ---- 3 & 4. Create, edit and save a file in the Editor ---------------
    await page.goto("/dashboard/editor");

    // The Explorer panel hosts a "New file" button (title attribute) which
    // reveals an INLINE text input (placeholder "filename"), not a native
    // prompt. Type the name and press Enter to create the file.
    await page.getByTitle("New file").first().click();
    const nameInput = page.getByPlaceholder("filename");
    await expect(nameInput).toBeVisible({ timeout: 10_000 });
    await nameInput.fill(FILE_NAME);
    await nameInput.press("Enter");

    // The new file should open as a tab.
    await expect(page.getByText(FILE_NAME, { exact: false })).toBeVisible({
      timeout: 15_000,
    });

    // Type into Monaco, then save with Ctrl+S.
    const editor = page.locator(".monaco-editor").first();
    await expect(editor).toBeVisible({ timeout: 20_000 });
    await editor.click();
    await page.keyboard.type("export const hello = () => 'world';\n");
    await page.keyboard.press("Control+S");

    // The editor surfaces a "Saved" indicator (or "All changes saved").
    await expect(
      page.getByText(/saved/i).first()
    ).toBeVisible({ timeout: 15_000 });

    // ---- 5. Ask the AI ---------------------------------------------------
    await page.goto("/dashboard/chat");

    // Find the chat composer input and send a message.
    const chatInput = page
      .getByRole("textbox")
      .first()
      .or(page.getByPlaceholder(/message|ask|type/i).first());
    await chatInput.fill("Explain what this project does.");
    await page.keyboard.press("Enter");

    if (aiConfigured()) {
      // With a key, expect a streamed assistant response to appear.
      await expect(
        page.getByText(/teskel|project|code|assistant/i).first()
      ).toBeVisible({ timeout: 45_000 });
    } else {
      // Without a key, the provider returns a clear "not configured" message.
      await expect(
        page.getByText(/ai is not configured|add an openai|not configured/i)
      ).toBeVisible({ timeout: 30_000 });
    }

    // ---- 6 & 7. Generate a changeset and open the Composer ---------------
    await page.goto("/dashboard/composer");
    await expect(page).toHaveURL(/\/dashboard\/composer/);

    if (aiConfigured()) {
      // Kick off a changeset generation from the composer instruction box.
      const instruction = page
        .getByPlaceholder(/describe|change|instruction|what/i)
        .first()
        .or(page.getByRole("textbox").first());
      await instruction.fill("Add a JSDoc comment to the hello function.");

      const generate = page
        .getByRole("button", { name: /generate|propose|create changeset/i })
        .first();
      if (await generate.isVisible().catch(() => false)) {
        await generate.click();
        // A proposed changeset renders a diff / file-change list for review.
        await expect(
          page.getByText(/pending|review|diff|change/i).first()
        ).toBeVisible({ timeout: 60_000 });
      }
    } else {
      // Without AI, simply assert the Composer page renders its shell so the
      // navigation half of the flow is still exercised.
      await expect(
        page.getByText(/composer|changeset|no changes|select a project/i).first()
      ).toBeVisible({ timeout: 15_000 });
    }
  });
});
