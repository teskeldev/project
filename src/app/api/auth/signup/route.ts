import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { apiSuccess, handleApiError, validateBody, ApiError } from "@/lib/api";

const signupSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  email: z.string().trim().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function randomSuffix(length = 6): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

export async function POST(req: Request) {
  try {
    const { name, email, password } = await validateBody(req, signupSchema);
    const normalizedEmail = email.toLowerCase();

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
    const displayName = name?.trim() || emailPrefix;
    const workspaceName = `${displayName}'s Workspace`;
    const baseSlug = slugify(emailPrefix) || "workspace";

    const user = await prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          name: name?.trim() || null,
          email: normalizedEmail,
          passwordHash,
        },
      });

      // Derive a unique slug; retry on the rare collision.
      let slug = `${baseSlug}-${randomSuffix()}`;
       
      while (await tx.workspace.findUnique({ where: { slug } })) {
        slug = `${baseSlug}-${randomSuffix()}`;
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
