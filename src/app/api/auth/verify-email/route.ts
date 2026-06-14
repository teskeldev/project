import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { enforceRateLimit } from "@/lib/rate-limit";

export async function GET(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";

  await enforceRateLimit(`auth:verify-email:ip:${ip}`, 10, 60_000);

  const token = req.nextUrl.searchParams.get("token");

  if (!token) {
    return Response.redirect(
      new URL("/login?error=missing_token", req.nextUrl.origin)
    );
  }

  try {
    // Find the verification token
    const verificationToken = await prisma.verificationToken.findUnique({
      where: { token },
    });

    if (!verificationToken) {
      return Response.redirect(
        new URL("/login?error=invalid_token", req.nextUrl.origin)
      );
    }

    // Check if token has expired
    if (verificationToken.expires < new Date()) {
      // Clean up expired token
      await prisma.verificationToken.delete({
        where: {
          identifier_token: {
            identifier: verificationToken.identifier,
            token: verificationToken.token,
          },
        },
      });

      return Response.redirect(
        new URL("/login?error=token_expired", req.nextUrl.origin)
      );
    }

    // Mark user's email as verified
    await prisma.user.update({
      where: { email: verificationToken.identifier },
      data: { emailVerified: new Date() },
    });

    // Delete the used token
    await prisma.verificationToken.delete({
      where: {
        identifier_token: {
          identifier: verificationToken.identifier,
          token: verificationToken.token,
        },
      },
    });

    return Response.redirect(
      new URL("/login?verified=true", req.nextUrl.origin)
    );
  } catch (error) {
    console.error("[verify-email] Error:", error);
    return Response.redirect(
      new URL("/login?error=verification_failed", req.nextUrl.origin)
    );
  }
}
