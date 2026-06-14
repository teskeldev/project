import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe base config. Contains NO database adapter and NO Node-only
 * dependencies (Prisma, bcrypt), so it can be imported into middleware which
 * runs on the edge runtime. The Prisma adapter and Credentials provider are
 * added in `src/auth.ts` (Node runtime only).
 */
export const authConfig = {
  session: { strategy: "jwt" },
  // Trust the Host / X-Forwarded-Host set by the reverse proxy / load balancer.
  // REQUIRED for self-hosted (non-Vercel) deploys: without it NextAuth v5
  // rejects every /api/auth/* request in production with `UntrustedHost`,
  // breaking login entirely behind a proxy. Equivalent to AUTH_TRUST_HOST=true.
  trustHost: true,
  secret: (() => {
    const s = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
    if (!s && process.env.NODE_ENV === "production") {
      throw new Error("AUTH_SECRET or NEXTAUTH_SECRET must be set in production");
    }
    return s ?? "dev-only-insecure-secret-do-not-use-in-production";
  })(),
  pages: {
    signIn: "/login",
  },
  providers: [],
  callbacks: {
    jwt: async ({ token, user }) => {
      if (user) {
        token.id = user.id;
        token.sub = user.id;
      }
      return token;
    },
    session: async ({ session, token }) => {
      if (session.user) {
        session.user.id = (token.id as string | undefined) ?? token.sub ?? "";
      }
      if (token.tokenVersion !== undefined) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (session as any).tokenVersion = token.tokenVersion;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
