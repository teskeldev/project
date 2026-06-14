import { z } from "zod";
import { randomBytes, createHash } from "node:crypto";
import { prisma } from "@/lib/db";
import {
  apiSuccess,
  handleApiError,
  requireUser,
  validateBody,
  NO_STORE_HEADERS,
} from "@/lib/api";
import { enforceRateLimit } from "@/lib/rate-limit";

const createKeySchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  workspaceId: z.string().optional(),
});

export async function GET() {
  try {
    const user = await requireUser();

    const keys = await prisma.apiKey.findMany({
      where: { userId: user.id },
      select: {
        id: true,
        name: true,
        hashedKey: true,
        lastUsedAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    // Return only last 4 chars of the hash as a mask identifier
    const masked = keys.map((k) => ({
      id: k.id,
      name: k.name,
      maskedKey: `tsk_live_****...${k.hashedKey.slice(-4)}`,
      lastUsedAt: k.lastUsedAt,
      createdAt: k.createdAt,
    }));

    return apiSuccess({ keys: masked }, { headers: NO_STORE_HEADERS });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    await enforceRateLimit(`keys:create:${user.id}`, 5, 60_000);
    const { name, workspaceId } = await validateBody(req, createKeySchema);

    // Generate a random 32-byte hex key with prefix
    const rawKey = `tsk_live_${randomBytes(32).toString("hex")}`;

    // Hash with SHA-256 for storage
    const hashedKey = createHash("sha256").update(rawKey).digest("hex");

    const apiKey = await prisma.apiKey.create({
      data: {
        userId: user.id,
        workspaceId: workspaceId ?? null,
        name,
        hashedKey,
      },
      select: { id: true, name: true, createdAt: true },
    });

    // Return the full key ONCE - user must copy it now
    return apiSuccess(
      { key: rawKey, id: apiKey.id, name: apiKey.name, createdAt: apiKey.createdAt },
      { status: 201 }
    );
  } catch (err) {
    return handleApiError(err);
  }
}
