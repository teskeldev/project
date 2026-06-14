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

  // Ensure every browser gets a `csrf` cookie so the double-submit pattern
  // works for the very first mutating request. The token is HMAC-signed and
  // verified server-side in `requireCsrf`.
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
    "/dashboard/:path*",
    "/dashboard",
    "/login",
    "/signup",
    "/forgot-password",
    "/reset-password",
  ],
};
