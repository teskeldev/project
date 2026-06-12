import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/auth.config";

// Edge-safe auth instance built only from the base config (no Prisma adapter,
// no bcrypt) so middleware can run on the edge runtime.
const { auth } = NextAuth(authConfig);

const AUTH_PAGES = ["/login", "/signup", "/forgot-password"];

export default auth((req) => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth?.user;
  const { pathname } = nextUrl;

  const isAuthPage = AUTH_PAGES.includes(pathname);
  const isProtected =
    pathname === "/dashboard" || pathname.startsWith("/dashboard/");

  // Authenticated users should not see auth pages.
  if (isLoggedIn && isAuthPage) {
    return NextResponse.redirect(new URL("/dashboard", nextUrl));
  }

  // Unauthenticated users cannot access protected routes.
  if (!isLoggedIn && isProtected) {
    const loginUrl = new URL("/login", nextUrl);
    loginUrl.searchParams.set("callbackUrl", pathname + nextUrl.search);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/dashboard",
    "/login",
    "/signup",
    "/forgot-password",
  ],
};
