import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

// Content-Security-Policy directives
// TODO(security): Replace the static `'unsafe-inline'` source with a per-request
// nonce generated in `src/middleware.ts` and forwarded via the `x-nonce` request
// header (Next.js exposes `headers().get('x-nonce')` in server components).
// A production-grade CSP looks like:
//   script-src 'self' 'nonce-${NONCE}' 'strict-dynamic' blob: https://js.stripe.com https://cdn.jsdelivr.net
//   style-src  'self' 'nonce-${NONCE}' https://cdn.jsdelivr.net
// For now we keep `'unsafe-inline'` so the inline theme-detection script in the
// root layout (and Tailwind's runtime styles) continue to work, and we only add
// `'unsafe-eval'` in dev to support Next.js HMR / Turbopack.
const cspDirectives = [
  // Default: only self
  "default-src 'self'",

  // Scripts: self, Monaco workers (blob:), Stripe, unsafe-eval in dev for Next.js HMR
  `script-src 'self' 'unsafe-inline' blob: https://js.stripe.com https://cdn.jsdelivr.net${isDev ? " 'unsafe-eval'" : ""}`,

  // Styles: self, unsafe-inline for Tailwind/runtime styles, CDN for Monaco themes
  "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",

  // Images: self, data URIs, blob for generated content, common OAuth providers
  "img-src 'self' data: blob: https://*.googleusercontent.com https://*.githubusercontent.com",

  // Fonts: self, CDN for Monaco
  "font-src 'self' data: https://cdn.jsdelivr.net",

  // Connect: self, OpenAI API, Stripe, WebSocket for dev HMR and xterm
  `connect-src 'self' https://api.openai.com https://api.stripe.com wss://*.stripe.com${isDev ? " ws://localhost:* ws://127.0.0.1:* http://localhost:*" : ""}`,

  // Workers: self and blob for Monaco editor web workers
  "worker-src 'self' blob:",

  // Child/frame: Stripe iframe for payment elements
  "frame-src 'self' https://js.stripe.com https://hooks.stripe.com",

  // Form actions: self and OAuth providers
  "form-action 'self' https://accounts.google.com https://github.com",

  // Base URI restriction
  "base-uri 'self'",

  // Object: none (no plugins)
  "object-src 'none'",

  // Frame ancestors: none (equivalent to X-Frame-Options DENY)
  "frame-ancestors 'none'",
];

const ContentSecurityPolicy = cspDirectives.join("; ");

const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: ContentSecurityPolicy,
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "X-XSS-Protection",
    value: "0",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig: NextConfig = {
  // Enable standalone output for Docker deployments
  output: "standalone",

  // Allow remote dev origin used by your server access path.
  // Add additional hosts here when developing over SSH tunnel / reverse proxy.
  allowedDevOrigins: ["104.207.77.174"],

  // Hide X-Powered-By header for security
  poweredByHeader: false,

  // Pin the workspace root so Turbopack does not infer the parent directory
  // (which contains an unrelated lockfile) as the project root.
  turbopack: {
    root: __dirname,
  },

  // Exclude the local "reference/" folder (third-party repos used as
  // reference material, not bundled code) from the standalone file trace.
  // Without this, dynamic path resolution in src/lib/storage.ts and
  // src/lib/skills-loader.ts pulls every file under reference/ into the
  // standalone copy and the build fails to assemble a runnable bundle.
  outputFileTracingExcludes: {
    "*": ["./reference/**", "./reference/**/*"],
  },

  async headers() {
    return [
      {
        // Apply security headers to all routes
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
