/* eslint-disable */
/**
 * k6 load test for Teskel's hot paths.
 *
 *   k6 run tests/load/k6-load.js
 *
 * Env:
 *   BASE_URL        target origin (default http://localhost:3000)
 *   SESSION_COOKIE  an authenticated session cookie value for the AI/agent
 *                   scenarios, in the form "next-auth.session-token=...". Obtain
 *                   it from a logged-in browser (DevTools > Application > Cookies)
 *                   or a programmatic login. Without it, only the public
 *                   `health` scenario runs.
 *   PROJECT_ID      a project the session user can access (for agent scenario).
 *
 * Scenarios (run concurrently):
 *   - health        : baseline ramp on GET /api/health (liveness under load)
 *   - ai_stream     : POST the chat stream endpoint and read the SSE response,
 *                     measuring time-to-first-byte (perceived AI latency)
 *   - agent_runs    : create an agent run then open its SSE events stream
 *
 * Thresholds gate a pass/fail so this can run in CI against staging.
 */
import http from "k6/http";
import { check, sleep } from "k6";
import { Trend, Rate } from "k6/metrics";

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";
const SESSION_COOKIE = __ENV.SESSION_COOKIE || "";
const PROJECT_ID = __ENV.PROJECT_ID || "";
const authed = SESSION_COOKIE.length > 0;

const aiTTFB = new Trend("ai_stream_ttfb_ms", true);
const aiErrors = new Rate("ai_stream_errors");
const agentCreate = new Trend("agent_create_ms", true);

function authHeaders(extra) {
  const h = { ...(extra || {}) };
  if (SESSION_COOKIE) h["Cookie"] = SESSION_COOKIE;
  return h;
}

export const options = {
  scenarios: {
    health: {
      executor: "ramping-vus",
      exec: "health",
      startVUs: 0,
      stages: [
        { duration: "30s", target: 50 },
        { duration: "1m", target: 50 },
        { duration: "20s", target: 0 },
      ],
    },
    ...(authed
      ? {
          ai_stream: {
            executor: "ramping-vus",
            exec: "aiStream",
            startVUs: 0,
            stages: [
              { duration: "30s", target: 10 },
              { duration: "1m", target: 20 },
              { duration: "20s", target: 0 },
            ],
          },
          agent_runs: {
            executor: "constant-vus",
            exec: "agentRuns",
            vus: 5,
            duration: "1m30s",
          },
        }
      : {}),
  },
  thresholds: {
    http_req_failed: ["rate<0.02"],
    "http_req_duration{scenario:health}": ["p(95)<300"],
    ai_stream_ttfb_ms: ["p(95)<8000"],
    ai_stream_errors: ["rate<0.05"],
  },
};

export function health() {
  const res = http.get(`${BASE_URL}/api/health`);
  check(res, { "health < 500": (r) => r.status < 500 });
  sleep(1);
}

export function aiStream() {
  const payload = JSON.stringify({
    messages: [{ role: "user", content: "Say hello in one short sentence." }],
  });
  // k6's http.post buffers the full SSE body; first-response timing approximates
  // perceived latency. waiting (TTFB) is the most meaningful signal here.
  const res = http.post(`${BASE_URL}/api/ai/chat/stream`, payload, {
    headers: authHeaders({ "Content-Type": "application/json" }),
    timeout: "60s",
  });
  aiTTFB.add(res.timings.waiting);
  const ok = res.status > 0 && res.status < 500;
  aiErrors.add(!ok);
  check(res, { "ai stream not 5xx": () => ok });
  sleep(2);
}

export function agentRuns() {
  if (!PROJECT_ID) return;
  const start = Date.now();
  const create = http.post(
    `${BASE_URL}/api/projects/${PROJECT_ID}/agents`,
    JSON.stringify({ goal: "Add a README section describing setup." }),
    { headers: authHeaders({ "Content-Type": "application/json" }) }
  );
  agentCreate.add(Date.now() - start);
  const created = check(create, {
    "agent run created": (r) => r.status === 201 || r.status === 200,
  });
  if (created) {
    const body = create.json();
    const runId = body && body.data && body.data.run && body.data.run.id;
    if (runId) {
      // Open the SSE events stream briefly to exercise the worker/event bus.
      http.get(`${BASE_URL}/api/agents/${runId}/events`, {
        headers: authHeaders(),
        timeout: "30s",
      });
    }
  }
  sleep(3);
}
