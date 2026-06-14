import { z } from "zod";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";
import { apiSuccess, handleApiError, validateBody } from "@/lib/api";
import { enforceRateLimit } from "@/lib/rate-limit";
import { sendPasswordResetEmail } from "@/lib/email";

const forgotPasswordSchema = z.object({
  email: z.string().trim().email(),
});

export async function POST(req: Request) {
  try {
    const { email } = await validateBody(req, forgotPasswordSchema);
    const normalizedEmail = email.toLowerCase();

    // Rate limit: 3 per email per 5 minutes
    await enforceRateLimit(`auth:forgot:${normalizedEmail}`, 3, 300_000);

    // Always return success to avoid leaking whether an email exists
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (user) {
      // Generate a secure random token
      const token = randomBytes(32).toString("hex");
      const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      // Atomically replace any existing reset tokens for this email.
      // Delete + create is wrapped in a transaction so a concurrent request
      // can't observe a window with no row (race with reset-password) or two
      // rows (race with another forgot-password). The (identifier, token)
      // unique index in the schema enforces uniqueness at the DB level.
      await prisma.$transaction(async (tx) => {
        await tx.verificationToken.deleteMany({
          where: { identifier: normalizedEmail },
        });

        await tx.verificationToken.create({
          data: {
            identifier: normalizedEmail,
            token,
            expires,
          },
        });
      });

      // Send reset email after the transaction commits; if it fails the
      // token remains valid and the user can re-request.
      await sendPasswordResetEmail(normalizedEmail, token);
    }

    return apiSuccess({
      message:
        "If an account with that email exists, we've sent a password reset link.",
    });
  } catch (err) {
    return handleApiError(err);
  }
}
