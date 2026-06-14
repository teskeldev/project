# Load & performance testing

Load tests use [k6](https://k6.io). Install: `brew install k6` / `apt-get install k6` / Docker `grafana/k6`.

## Run

```bash
# Public baseline only (no auth needed)
BASE_URL=https://staging.example.com k6 run tests/load/k6-load.js

# Full suite incl. AI streaming + agent execution
BASE_URL=https://staging.example.com \
SESSION_COOKIE='next-auth.session-token=<value-from-logged-in-browser>' \
PROJECT_ID=<accessible-project-id> \
k6 run tests/load/k6-load.js
```

## Scenarios & thresholds

| Scenario     | Target                                   | Threshold (pass/fail)         |
|--------------|------------------------------------------|-------------------------------|
| `health`     | `GET /api/health` ramp to 50 VUs         | p95 latency < 300 ms          |
| `ai_stream`  | `POST /api/ai/chat/stream` (SSE) to 20 VUs | TTFB p95 < 8 s, errors < 5 %  |
| `agent_runs` | create run + open events SSE, 5 VUs       | global `http_req_failed` < 2 %|

The run exits non-zero if any threshold is breached, so it can gate a CI/CD
stage against a staging environment.

## Notes

- The agent scenario exercises the **BullMQ worker + Redis event bus** end to
  end: a created run is enqueued, a worker claims it (atomic `QUEUED→RUNNING`),
  and the SSE stream replays events published over Redis. Run with at least one
  `npm run worker` process and `REDIS_URL` set, or runs will sit `QUEUED`.
- Prometheus metrics (`/api/metrics`) expose `agent_queue_depth`,
  `agent_run_duration_seconds`, and `http_request_duration_seconds` so you can
  correlate k6 client-side numbers with server-side series during a run.
- WebSocket/terminal load: the terminal uses HTTP POST `run` + SSE rather than a
  raw WebSocket; add a scenario hitting `/api/terminal/:id/run` with a
  whitelisted command (e.g. `echo hi`) the same way as `agent_runs` if you need
  to load-test that path.
