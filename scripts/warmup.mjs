#!/usr/bin/env node
/**
 * Pre-compiles new API routes and pages by making requests immediately after dev server starts.
 * This avoids the ~40s first-compile delay when users navigate to new pages.
 *
 * Runs automatically with `npm run dev` (fired in the background). You can also
 * invoke it manually with `npm run warmup` against an already-running server.
 */

const BASE = process.env.NEXTAUTH_URL ?? "http://127.0.0.1:3000";

// Pages (GET HTML) — triggers page + layout compilation
const PAGES = [
  "/login",
  "/dashboard",
  "/dashboard/chat",
  "/dashboard/agents",
  "/dashboard/editor",
  "/dashboard/composer",
  "/dashboard/terminal",
  "/dashboard/git",
  "/dashboard/extensions",
  "/dashboard/fusion/library",
  "/dashboard/integrations",
  "/dashboard/usage",
  "/dashboard/context",
  "/dashboard/settings",
];

// API routes — triggers route handler compilation (returns 401 without auth, that's expected)
const API_ROUTES = [
  "/api/ai/providers",
  "/api/dashboard/summary?projectId=warmup",
  "/api/projects",
  "/api/workspaces",
  "/api/user/onboarding",
  "/api/extensions/registry",
  "/api/extensions?workspaceId=warmup",
  "/api/commands?workspaceId=warmup",
  "/api/fusion/fusions?workspaceId=warmup",
  "/api/projects/warmup/agents",
  "/api/projects/warmup/chat/threads",
  "/api/usage/stats?workspaceId=warmup&days=7",
  "/api/usage/logs?workspaceId=warmup",
];

async function waitForServer(maxWaitMs = 120_000) {
  const deadline = Date.now() + maxWaitMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BASE}/api/health`, {
        // Beri waktu cukup lama untuk kompilasi rute pertama kali (15 detik)
        signal: AbortSignal.timeout(15000),
      });
      if (res.ok) return true;
    } catch {
      // not ready yet
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  return false;
}

async function warmOne(url, timeoutMs = 120_000) {
  const start = Date.now();
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    return { ok: true, msg: `✓ ${url.replace(BASE, "")} → ${res.status} (${Date.now() - start}ms)` };
  } catch (e) {
    return { ok: false, msg: `✗ ${url.replace(BASE, "")}: ${e.message}` };
  }
}

async function main() {
  console.log("⏳ Warmup: waiting for dev server...");
  const ready = await waitForServer();
  if (!ready) {
    console.log("⚠  Warmup: server not reachable on " + BASE);
    return;
  }

  const allRoutes = [
    ...PAGES.map((p) => BASE + p),
    ...API_ROUTES.map((r) => BASE + r),
  ];

  console.log(`🔥 Warmup: pre-compiling ${allRoutes.length} routes in parallel...`);
  const results = await Promise.allSettled(allRoutes.map(warmOne));
  results.forEach((r) => {
    const v = r.status === "fulfilled" ? r.value : { ok: false, msg: String(r.reason) };
    console.log(v.msg);
  });
  console.log("\n✅ Warmup done — all pages will now load instantly.");
}

main();
