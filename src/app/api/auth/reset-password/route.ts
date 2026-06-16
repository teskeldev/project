import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { apiSuccess, handleApiError, validateBody, ApiError } from "@/lib/api";
import { enforceRateLimit } from "@/lib/rate-limit";

const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export async function POST(req: Request) {
  try {
    const { token, password } = await validateBody(req, resetPasswordSchema);

    // Rate limit by IP address to prevent brute-force attacks.
    // Previously keyed by token (attacker-controlled), now keyed by client IP.
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    await enforceRateLimit(`auth:reset:${ip}`, 5, 60_000);

    // Find the verification token
    const verificationToken = await prisma.verificationToken.findUnique({
      where: { token },
    });

    if (!verificationToken) {
      throw new ApiError(
        "Invalid or expired reset token",
        400,
        "INVALID_TOKEN"
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

      throw new ApiError(
        "Reset token has expired. Please request a new one.",
        400,
        "TOKEN_EXPIRED"
      );
    }

    // Hash the new password
    const passwordHash = await bcrypt.hash(password, 12);

    // Atomically rotate the password + tokenVersion AND consume the reset
    // token. The tokenVersion bump (already +1) invalidates every active
    // session, forcing a re-sign-in. Wrapping user.update + token.delete in
    // a transaction prevents a window where the password is changed but the
    // token is still usable for replay.
    await prisma.$transaction(async (tx) => {
      // Update user's password and increment tokenVersion to invalidate
      // existing sessions.
      await tx.user.update({
        where: { email: verificationToken.identifier },
        data: {
          passwordHash,
          tokenVersion: { increment: 1 },
        },
      });

      // Delete the used token inside the same transaction.
      await tx.verificationToken.delete({
        where: {
          identifier_token: {
            identifier: verificationToken.identifier,
            token: verificationToken.token,
          },
        },
      });
    });

    return apiSuccess({
      message: "Password has been reset successfully. You can now sign in.",
    });
  } catch (err) {
    return handleApiError(err);
  }
}
