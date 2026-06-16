import { prisma } from "@/lib/db";
import {
  apiSuccess,
  handleApiError,
  requireUser,
  validateBody,
  NO_STORE_HEADERS,
} from "@/lib/api";
import { createWorkspaceSchema } from "@/lib/validators";
import { Prisma } from "@prisma/client";
import { randomBytes } from "node:crypto";
import { enforceRateLimit } from "@/lib/rate-limit";

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

// GET /api/workspaces -> workspaces the current user is a member of.
export async function GET() {
  try {
    const user = await requireUser();

    const memberships = await prisma.workspaceMember.findMany({
      where: { userId: user.id },
      include: {
        workspace: {
          include: { _count: { select: { projects: true, members: true } } },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    const workspaces = memberships.map((m) => ({
      id: m.workspace.id,
      name: m.workspace.name,
      slug: m.workspace.slug,
      ownerId: m.workspace.ownerId,
      role: m.role,
      projectCount: m.workspace._count.projects,
      memberCount: m.workspace._count.members,
      createdAt: m.workspace.createdAt,
      updatedAt: m.workspace.updatedAt,
    }));

    return apiSuccess({ workspaces }, { headers: NO_STORE_HEADERS });
  } catch (err) {
    return handleApiError(err);
  }
}

// POST /api/workspaces -> create a workspace, add creator as OWNER.
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    await enforceRateLimit(`workspaces:create:${user.id}`, 10, 60_000);
    const { name } = await validateBody(req, createWorkspaceSchema);

    const baseSlug = slugify(name) || "workspace";

    // The (slug) unique index on Workspace is the source of truth for slug
    // uniqueness. The previous read-then-write loop is racy: two concurrent
    // creates with the same base slug would both pass the findUnique and
    // then one would crash on a unique violation. Instead, we generate a
    // random suffix upfront and catch P2002 as a fallback. Capped at 5
    // retries to avoid an infinite loop.
    const MAX_SLUG_ATTEMPTS = 5;
    let attempt = 0;
    let slug = `${baseSlug}-${randomBytes(6).toString("hex")}`;

    let workspace;
    while (true) {
      try {
        workspace = await prisma.$transaction(async (tx) => {
          const created = await tx.workspace.create({
            data: { name, slug, ownerId: user.id },
          });

          await tx.workspaceMember.create({
            data: { workspaceId: created.id, userId: user.id, role: "OWNER" },
          });

          return created;
        });
        break;
      } catch (err) {
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === "P2002" &&
          attempt < MAX_SLUG_ATTEMPTS
        ) {
          // Slug collided; regenerate with a fresh random suffix and retry.
          attempt += 1;
          slug = `${baseSlug}-${randomBytes(6).toString("hex")}`;
          continue;
        }
        throw err;
      }
    }

    return apiSuccess({ workspace }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
