import { prisma } from "@/lib/db";
import {
  apiSuccess,
  handleApiError,
  requireUser,
  validateBody,
} from "@/lib/api";
import { createWorkspaceSchema } from "@/lib/validators";

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

    return apiSuccess({ workspaces });
  } catch (err) {
    return handleApiError(err);
  }
}

// POST /api/workspaces -> create a workspace, add creator as OWNER.
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const { name } = await validateBody(req, createWorkspaceSchema);

    const baseSlug = slugify(name) || "workspace";

    const workspace = await prisma.$transaction(async (tx) => {
      let slug = `${baseSlug}-${randomSuffix()}`;
       
      while (await tx.workspace.findUnique({ where: { slug } })) {
        slug = `${baseSlug}-${randomSuffix()}`;
      }

      const created = await tx.workspace.create({
        data: { name, slug, ownerId: user.id },
      });

      await tx.workspaceMember.create({
        data: { workspaceId: created.id, userId: user.id, role: "OWNER" },
      });

      return created;
    });

    return apiSuccess({ workspace }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
