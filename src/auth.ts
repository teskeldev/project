import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import GitHub from "next-auth/providers/github";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { authConfig } from "@/auth.config";
import { enforceRateLimit } from "@/lib/rate-limit";
import type { Provider } from "next-auth/providers";

// Lazy-initialized bcrypt hash used to keep `bcrypt.compare` running on the
// "user not found / no password set" path. Without this, an attacker can
// distinguish "unknown email" from "known email, wrong password" by timing
// the response (the missing email path returns immediately, the wrong-
// password path waits ~100ms for bcrypt). Hashing a constant dummy password
// equalizes the two paths.
let dummyHashPromise: Promise<string> | null = null;
function getDummyHash(): Promise<string> {
  if (!dummyHashPromise) {
    dummyHashPromise = bcrypt.hash("timing-attack-mitigation", 10);
  }
  return dummyHashPromise;
}

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(128),
});

/**
 * Build the providers array. OAuth providers are only active when their
 * respective env vars are configured.
 */
function buildProviders(): Provider[] {
  const providers: Provider[] = [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (raw, request) => {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) {
          return null;
        }

        const { email, password } = parsed.data;

        // Rate limit by email: 5 attempts per 5 minutes
        await enforceRateLimit(`auth:credentials:email:${email.toLowerCase()}`, 5, 5 * 60_000);

        // Rate limit by IP: 10 attempts per 5 minutes
        const ip =
          request?.headers?.get?.("x-forwarded-for")?.split(",")[0]?.trim() ||
          request?.headers?.get?.("x-real-ip") ||
          "unknown";
        await enforceRateLimit(`auth:credentials:ip:${ip}`, 10, 5 * 60_000);

        const user = await prisma.user.findUnique({
          where: { email: email.toLowerCase() },
        });

        if (!user || !user.passwordHash) {
          // Constant-time: run bcrypt against a dummy hash so the response
          // timing matches the "user exists, wrong password" path. This
          // prevents email enumeration via timing analysis.
          await getDummyHash().then((h) => bcrypt.compare(password, h));
          return null;
        }

        const isValid = await bcrypt.compare(password, user.passwordHash);
        if (!isValid) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        };
      },
    }),
  ];

  // Google OAuth – only active when env vars are set
  if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) {
    providers.push(
      Google({
        clientId: process.env.AUTH_GOOGLE_ID,
        clientSecret: process.env.AUTH_GOOGLE_SECRET,
      })
    );
  }

  // GitHub OAuth – only active when env vars are set
  if (process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET) {
    providers.push(
      GitHub({
        clientId: process.env.AUTH_GITHUB_ID,
        clientSecret: process.env.AUTH_GITHUB_SECRET,
      })
    );
  }

  return providers;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  providers: buildProviders(),
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id;
        token.sub = user.id;
        // Fetch tokenVersion on initial sign-in
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: { tokenVersion: true },
        });
        token.tokenVersion = dbUser?.tokenVersion ?? 0;
      }

      // Validate tokenVersion on token refresh
      if (trigger === "update" && token.id) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { tokenVersion: true },
        });
        if (dbUser && dbUser.tokenVersion !== token.tokenVersion) {
          // Token version mismatch — session has been invalidated
          throw new Error("Token version mismatch. Session invalidated.");
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = (token.id as string | undefined) ?? token.sub ?? "";
      }
      if (token.tokenVersion !== undefined) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (session as any).tokenVersion = token.tokenVersion;
      }
      return session;
    },
    async signIn({ user, account, profile }) {
      // Allow credentials sign-in without additional checks
      if (account?.provider === "credentials") {
        return true;
      }

      // For OAuth providers, verify the email is confirmed by the provider
      const email = user.email?.toLowerCase();
      if (!email) {
        return false;
      }

      // Check that the OAuth provider has verified the email
      const emailVerified =
        profile?.email_verified === true ||
        profile?.verified_email === true;

      if (!emailVerified) {
        return false;
      }

      // Check if an existing account with this email was created via credentials
      const existingUser = await prisma.user.findUnique({
        where: { email },
        include: { accounts: true },
      });

      if (existingUser) {
        // If the user has a password hash but no linked OAuth account for this
        // provider, deny sign-in to prevent account takeover. The user should
        // link accounts manually from their settings page.
        const hasCredentials = !!existingUser.passwordHash;
        const hasLinkedAccount = existingUser.accounts.some(
          (a) => a.provider === account?.provider
        );

        if (hasCredentials && !hasLinkedAccount) {
          return "/auth/error?error=OAuthAccountNotLinked";
        }
      }

      return true;
    },
  },
});
