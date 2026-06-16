import { prisma } from "@/lib/db";
import {
  apiSuccess,
  handleApiError,
  requireUser,
} from "@/lib/api";

// GET /api/user/onboarding
// Check if the current user has completed onboarding.
export async function GET() {
  try {
    const user = await requireUser();

    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { preferences: true },
    });

    const preferences = (dbUser?.preferences as Record<string, unknown>) ?? {};
    const completed = preferences.onboardingCompleted === true;

    return apiSuccess({ completed });
  } catch (err) {
    return handleApiError(err);
  }
}

// POST /api/user/onboarding
// Mark onboarding as complete in user preferences.
export async function POST() {
  try {
    const user = await requireUser();

    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { preferences: true },
    });

    const existing = (dbUser?.preferences as Record<string, unknown>) ?? {};

    await prisma.user.update({
      where: { id: user.id },
      data: {
        preferences: {
          ...existing,
          onboardingCompleted: true,
          onboardingCompletedAt: new Date().toISOString(),
        },
      },
    });

    return apiSuccess({ completed: true });
  } catch (err) {
    return handleApiError(err);
  }
}
