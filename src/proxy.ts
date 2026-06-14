import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/auth.config";
import { generateCsrfToken } from "@/lib/security";

// Edge-safe auth instance built only from the base config (no Prisma adapter,
// no bcrypt) so middleware can run on the edge runtime.
const { auth } = NextAuth(authConfig);

const AUTH_PAGES = ["/login", "/signup", "/forgot-password", "/reset-password"];

const CSRF_COOKIE_NAME = "csrf";
const CSRF_COOKIE_MAX_AGE = 60 * 60 * 24; // 1 day

/** Methods that may mutate server state and therefore require a CSRF check. */
const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * API paths that legitimately receive cross-origin mutating requests and are
 * authenticated by their OWN mechanism (not the browser session cookie), so a
 * same-origin check would wrongly reject them:
 *   - Stripe webhook: verified via the Stripe signature header.
 *   - NextAuth routes: ship their own CSRF protection.
 */
function isCsrfExempt(pathname: string): boolean {
  return (
    pathname === "/api/billing/webhook" || pathname.startsWith("/api/auth/")
  );
}

/**
 * Same-origin enforcement (CSRF defense for state-changing API calls).
 *
 * Because every authenticated mutation rides the browser's session cookie, we
 * reject any mutating /api request whose Origin (or Referer) host does not
 * match the request host. Same-origin XHR/fetch from our own UI always carries
 * a matching Origin; a forged cross-site form/fetch cannot set it. This is the
 * OWASP-recommended header-verification pattern and needs no client changes.
 */
function isSameOrigin(req: Request): boolean {
  // Trust the request Host and, behind a reverse proxy, the forwarded host.
  const allowedHosts = new Set(
    [req.headers.get("host"), req.headers.get("x-forwarded-host")].filter(
      (h): h is string => !!h
    )
  );
  if (allowedHosts.size === 0) return false;

  const matches = (value: string | null): boolean => {
    if (!value) return false;
    try {
      return allowedHosts.has(new URL(value).host);
    } catch {
      return false;
    }
  };

  const origin = req.headers.get("origin");
  if (origin) return matches(origin);
  // Some browsers omit Origin on same-origin requests; fall back to Referer.
  const referer = req.headers.get("referer");
  if (referer) return matches(referer);
  // No Origin and no Referer on a mutating request: treat as untrusted.
  return false;
}

/**
 * Applies security-related response headers to every matched request.
 * These supplement the headers defined in next.config.ts (which only apply to
 * static/SSR responses) by also covering middleware-intercepted responses and
 * redirects.
 */
function applySecurityHeaders(response: NextResponse): NextResponse {
  // Prevent MIME-type sniffing
  response.headers.set("X-Content-Type-Options", "nosniff");

  // Deny framing
  response.headers.set("X-Frame-Options", "DENY");

  // Referrer policy
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  // Disable legacy XSS filter (CSP handles this)
  response.headers.set("X-XSS-Protection", "0");

  // HSTS
  response.headers.set(
    "Strict-Transport-Security",
    "max-age=63072000; includeSubDomains; preload"
  );

  // Permissions policy
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), interest-cohort=()"
  );

  // Prevent DNS prefetch to reduce information leakage
  response.headers.set("X-DNS-Prefetch-Control", "off");

  return response;
}

export default auth(async (req) => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth?.user;
  const { pathname } = nextUrl;

  // CSRF: reject cross-origin state-changing API calls up front.
  if (
    pathname.startsWith("/api/") &&
    MUTATING_METHODS.has(req.method.toUpperCase()) &&
    !isCsrfExempt(pathname) &&
    !isSameOrigin(req)
  ) {
    return applySecurityHeaders(
      NextResponse.json(
        {
          success: false,
          error: { message: "Cross-origin request blocked", code: "CSRF_BLOCKED" },
        },
        { status: 403 }
      )
    );
  }

  const isAuthPage = AUTH_PAGES.includes(pathname);
  const isProtected =
    pathname === "/dashboard" || pathname.startsWith("/dashboard/");

  // Propagate a request id (incoming or newly generated) so server logs and
  // downstream services can correlate a single client request across hops.
  const incomingRequestId = req.headers.get("x-request-id");
  const requestId =
    incomingRequestId && incomingRequestId.length <= 128
      ? incomingRequestId
      : crypto.randomUUID();

  // Primary CSRF defense is the same-origin check above. We still issue an
  // HMAC-signed `csrf` cookie so routes can optionally layer the double-submit
  // token check (`requireCsrf`) on top for extra assurance.
  const hasCsrfCookie = (req.headers.get("cookie") ?? "").includes(
    `${CSRF_COOKIE_NAME}=`
  );

  // Authenticated users should not see auth pages.
  if (isLoggedIn && isAuthPage) {
    const response = NextResponse.redirect(new URL("/dashboard", nextUrl));
    if (!hasCsrfCookie) {
      response.cookies.set(CSRF_COOKIE_NAME, await generateCsrfToken(), {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: CSRF_COOKIE_MAX_AGE,
      });
    }
    response.headers.set("x-request-id", requestId);
    return applySecurityHeaders(response);
  }

  // Unauthenticated users cannot access protected routes.
  if (!isLoggedIn && isProtected) {
    const loginUrl = new URL("/login", nextUrl);
    loginUrl.searchParams.set("callbackUrl", pathname + nextUrl.search);
    const response = NextResponse.redirect(loginUrl);
    if (!hasCsrfCookie) {
      response.cookies.set(CSRF_COOKIE_NAME, await generateCsrfToken(), {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: CSRF_COOKIE_MAX_AGE,
      });
    }
    response.headers.set("x-request-id", requestId);
    return applySecurityHeaders(response);
  }

  // Authenticated users must complete onboarding before accessing the dashboard.
  if (isLoggedIn && isProtected) {
    const onboardingCompleted = req.auth?.onboardingCompleted;
    if (!onboardingCompleted && pathname !== "/dashboard/onboarding") {
      const response = NextResponse.redirect(new URL("/dashboard/onboarding", nextUrl));
      if (!hasCsrfCookie) {
        response.cookies.set(CSRF_COOKIE_NAME, await generateCsrfToken(), {
          httpOnly: true,
          sameSite: "lax",
          secure: process.env.NODE_ENV === "production",
          path: "/",
          maxAge: CSRF_COOKIE_MAX_AGE,
        });
      }
      response.headers.set("x-request-id", requestId);
      return applySecurityHeaders(response);
    }
  }

  // Forward the request id to downstream route handlers via a request header.
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-request-id", requestId);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  if (!hasCsrfCookie) {
    response.cookies.set(CSRF_COOKIE_NAME, await generateCsrfToken(), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: CSRF_COOKIE_MAX_AGE,
    });
  }
  response.headers.set("x-request-id", requestId);
  return applySecurityHeaders(response);
});

export const config = {
  matcher: [
    "/api/:path*",
    "/dashboard/:path*",
    "/dashboard",
    "/login",
    "/signup",
    "/forgot-password",
    "/reset-password",
  ],
};
