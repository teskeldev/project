import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe base config. Contains NO database adapter and NO Node-only
 * dependencies (Prisma, bcrypt), so it can be imported into middleware which
 * runs on the edge runtime. The Prisma adapter and Credentials provider are
 * added in `src/auth.ts` (Node runtime only).
 */
export const authConfig = {
  session: { strategy: "jwt" },
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
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
      return session;
    },
  },
} satisfies NextAuthConfig;
