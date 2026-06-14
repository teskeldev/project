import { z } from "zod";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { apiSuccess, handleApiError, validateBody, ApiError } from "@/lib/api";
import { enforceRateLimit } from "@/lib/rate-limit";
import { sanitizeInput } from "@/lib/security";
import { sendVerificationEmail, sendWelcomeEmail } from "@/lib/email";
import { logger } from "@/lib/logger";

const signupSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  email: z.string().trim().email(),
  password: z.string().min(8, "Password must be at least 8 characters").max(128),
});

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export async function POST(req: Request) {
  try {
    const { name, email, password } = await validateBody(req, signupSchema);
    const normalizedEmail = email.toLowerCase();

    // Rate limit: 5 signups per email per minute
    await enforceRateLimit(`auth:signup:${normalizedEmail}`, 5, 60_000);

    // Rate limit: 10 signups per IP per minute (in addition to email limit)
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      req.headers.get("x-real-ip") ??
      "unknown";
    await enforceRateLimit(`auth:signup:ip:${ip}`, 10, 60_000);

    // Sanitize user-provided name to prevent XSS
    const sanitizedName = name ? sanitizeInput(name, { maxLength: 100 }) : null;

    const existing = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (existing) {
      throw new ApiError(
        "An account with this email already exists",
        409,
        "EMAIL_TAKEN"
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const emailPrefix = normalizedEmail.split("@")[0] ?? "user";
    const displayName = sanitizedName || emailPrefix;
    const workspaceName = `${displayName}'s Workspace`;
    const baseSlug = slugify(emailPrefix) || "workspace";

    const user = await prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          name: sanitizedName,
          email: normalizedEmail,
          passwordHash,
        },
      });

      // Derive a unique slug; retry on the rare collision.
      let slug = `${baseSlug}-${randomBytes(6).toString("hex")}`;

      while (await tx.workspace.findUnique({ where: { slug } })) {
        slug = `${baseSlug}-${randomBytes(6).toString("hex")}`;
      }

      const workspace = await tx.workspace.create({
        data: {
          name: workspaceName,
          slug,
          ownerId: createdUser.id,
        },
      });

      await tx.workspaceMember.create({
        data: {
          workspaceId: workspace.id,
          userId: createdUser.id,
          role: "OWNER",
        },
      });

      return createdUser;
    });

    // Generate verification token and send verification email
    const verificationToken = randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await prisma.verificationToken.create({
      data: {
        identifier: normalizedEmail,
        token: verificationToken,
        expires,
      },
    });

    // Send emails (non-blocking – don't fail signup if email fails)
    sendVerificationEmail(normalizedEmail, verificationToken).catch((err) => {
      logger.error("Failed to send verification email", { email: normalizedEmail, err: String(err) });
    });

    sendWelcomeEmail(normalizedEmail, sanitizedName).catch((err) => {
      logger.error("Failed to send welcome email", { email: normalizedEmail, err: String(err) });
    });

    return apiSuccess(
      {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
        },
      },
      { status: 201 }
    );
  } catch (err) {
    return handleApiError(err);
  }
}
