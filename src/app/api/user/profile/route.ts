import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  apiSuccess,
  handleApiError,
  requireUser,
  validateBody,
  NO_STORE_HEADERS,
} from "@/lib/api";

const updateProfileSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  bio: z.string().trim().max(500).nullable().optional(),
  image: z
    .string()
    .url()
    .nullable()
    .refine(
      (url) =>
        url === null ||
        url === "" ||
        /^https:\/\/(avatars\.githubusercontent\.com|gravatar\.com|cdn\.discordapp\.com|api\.dicebear\.com|\S+\.googleusercontent\.com)/.test(url) ||
        /\/api\/user\/avatar\//.test(url),
      { message: "Image URL must be HTTPS from an allowed image host" }
    ),
});

export async function GET() {
  try {
    const sessionUser = await requireUser();

    const user = await prisma.user.findUniqueOrThrow({
      where: { id: sessionUser.id },
      select: {
        id: true,
        name: true,
        email: true,
        bio: true,
        image: true,
        preferences: true,
      },
    });

    return apiSuccess(user, { headers: NO_STORE_HEADERS });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(req: Request) {
  try {
    const sessionUser = await requireUser();
    const validatedData = await validateBody(req, updateProfileSchema);

    const user = await prisma.user.update({
      where: { id: sessionUser.id },
      data: {
        name: validatedData.name,
        bio: validatedData.bio,
        image: validatedData.image,
      },
      select: {
        id: true,
        name: true,
        email: true,
        bio: true,
        image: true,
        preferences: true,
      },
    });

    return apiSuccess(user);
  } catch (err) {
    return handleApiError(err);
  }
}
