import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  apiSuccess,
  handleApiError,
  requireUser,
  validateBody,
} from "@/lib/api";

const updateProfileSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  bio: z.string().trim().max(500).nullable().optional(),
  image: z.string().url().nullable().optional(),
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

    return apiSuccess(user);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(req: Request) {
  try {
    const sessionUser = await requireUser();
    const data = await validateBody(req, updateProfileSchema);

    const user = await prisma.user.update({
      where: { id: sessionUser.id },
      data,
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
