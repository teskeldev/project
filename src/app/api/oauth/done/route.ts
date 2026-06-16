/**
 * GET /api/oauth/done?provider=...&error=...
 *
 * Tiny inline HTML page served into the OAuth popup window.
 * Posts a postMessage to the opener (the Teskel integrations page) then closes itself.
 * Handles both success and error cases.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const provider = searchParams.get("provider") ?? "";
  const error = searchParams.get("error") ?? "";

  const payload = error
    ? JSON.stringify({ type: "oauth_error", provider, message: error })
    : JSON.stringify({ type: "oauth_success", provider });

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>${error ? "Authorization failed" : "Connected!"}</title>
<style>
  body { font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #0f1117; color: #e2e8f0; }
  .box { text-align: center; padding: 2rem; }
  .icon { font-size: 3rem; margin-bottom: 1rem; }
  .msg { font-size: 1rem; color: #94a3b8; }
</style>
</head>
<body>
<div class="box">
  <div class="icon">${error ? "⚠️" : "✅"}</div>
  <p class="msg">${error ? "Authorization failed — you can close this window." : "Connected! Closing…"}</p>
</div>
<script>
try {
  if (window.opener && !window.opener.closed) {
    window.opener.postMessage(${payload}, window.location.origin);
  }
} catch (e) {}
${error ? "" : "setTimeout(function() { window.close(); }, 400);"}
</script>
</body>
</html>`;

  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
