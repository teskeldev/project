import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  apiSuccess,
  handleApiError,
  requireUser,
  validateBody,
} from "@/lib/api";

const updatePreferencesSchema = z.object({
  theme: z.enum(["system", "light", "dark"]).optional(),
  fontSize: z.number().int().min(10).max(24).optional(),
  wordWrap: z.boolean().optional(),
  minimap: z.boolean().optional(),
  vim: z.boolean().optional(),
  notifications: z
    .object({
      email: z.boolean().optional(),
      push: z.boolean().optional(),
      weeklyDigest: z.boolean().optional(),
      marketing: z.boolean().optional(),
    })
    .optional(),
});

export async function PATCH(req: Request) {
  try {
    const sessionUser = await requireUser();
    const incoming = await validateBody(req, updatePreferencesSchema);

    const existing = await prisma.user.findUniqueOrThrow({
      where: { id: sessionUser.id },
      select: { preferences: true },
    });

    const current =
      (existing.preferences as Record<string, unknown>) ?? {};

    // Deep merge notifications
    const merged: Record<string, unknown> = { ...current, ...incoming };
    if (incoming.notifications) {
      const existingNotifs =
        (current.notifications as Record<string, unknown>) ?? {};
      merged.notifications = { ...existingNotifs, ...incoming.notifications };
    }

    const user = await prisma.user.update({
      where: { id: sessionUser.id },
      data: { preferences: merged as unknown as Prisma.InputJsonValue },
      select: { id: true, preferences: true },
    });

    return apiSuccess(user);
  } catch (err) {
    return handleApiError(err);
  }
}
