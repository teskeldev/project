import { prisma } from "@/lib/db";
import { ApiError, apiSuccess, handleApiError, requireUser } from "@/lib/api";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ keyId: string }> }
) {
  try {
    const user = await requireUser();
    const { keyId } = await params;

    const key = await prisma.apiKey.findUnique({
      where: { id: keyId },
      select: { id: true, userId: true },
    });

    if (!key) {
      throw new ApiError("API key not found", 404, "NOT_FOUND");
    }

    if (key.userId !== user.id) {
      throw new ApiError("Not authorized to revoke this key", 403, "FORBIDDEN");
    }

    await prisma.apiKey.delete({ where: { id: keyId } });

    return apiSuccess({ deleted: true, id: keyId });
  } catch (err) {
    return handleApiError(err);
  }
}
