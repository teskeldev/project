import { prisma } from "@/lib/db";
import {
  apiSuccess,
  handleApiError,
  requireUser,
  validateBody,
  ApiError,
  NO_STORE_HEADERS,
} from "@/lib/api";
import { createProjectSchema } from "@/lib/validators";
import {
  ensureProjectDir,
  writeFile,
  detectLanguage,
} from "@/lib/storage";
import { Prisma, type FileType, type Role } from "@prisma/client";
import { randomBytes } from "node:crypto";
import { enforceRateLimit } from "@/lib/rate-limit";

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

type SeedFile = { path: string; content: string };

function seedFilesFor(template: string, name: string): SeedFile[] {
  const readme = `# ${name}\n\nCreated with Teskel.\n`;

  if (template === "node") {
    const pkgSlug = slugify(name) || "app";
    const pkg =
      JSON.stringify(
        {
          name: pkgSlug,
          version: "0.1.0",
          private: true,
          type: "module",
          scripts: { start: "node src/index.ts" },
        },
        null,
        2
      ) + "\n";
    return [
      { path: "package.json", content: pkg },
      {
        path: "src/index.ts",
        content: `console.log("Hello from ${name}");\n`,
      },
      { path: "README.md", content: readme },
    ];
  }

  // blank (default)
  return [{ path: "README.md", content: readme }];
}

// GET /api/projects?workspaceId= -> projects across the user's workspaces.
export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const url = new URL(req.url);
    const workspaceId = url.searchParams.get("workspaceId") ?? undefined;

    const memberships = await prisma.workspaceMember.findMany({
      where: { userId: user.id },
      select: { workspaceId: true },
    });
    const workspaceIds = memberships.map((m) => m.workspaceId);

    if (workspaceId && !workspaceIds.includes(workspaceId)) {
      throw new ApiError(
        "You do not have access to this workspace",
        403,
        "FORBIDDEN"
      );
    }

    const projects = await prisma.project.findMany({
      where: {
        workspaceId: workspaceId ? workspaceId : { in: workspaceIds },
      },
      orderBy: { updatedAt: "desc" },
    });

    return apiSuccess({ projects }, { headers: NO_STORE_HEADERS });
  } catch (err) {
    return handleApiError(err);
  }
}

// POST /api/projects -> create a project, seed files on disk + DB.
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    await enforceRateLimit(`projects:create:${user.id}`, 20, 60_000);
    const { workspaceId, name, description, template } = await validateBody(
      req,
      createProjectSchema
    );

    const member = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: user.id } },
    });
    if (!member) {
      throw new ApiError(
        "You do not have access to this workspace",
        403,
        "FORBIDDEN"
      );
    }

    const allowedRoles: Role[] = ["MEMBER", "ADMIN", "OWNER"];
    if (!allowedRoles.includes(member.role)) {
      throw new ApiError("Insufficient permissions", 403, "FORBIDDEN");
    }

    // Derive a base slug (final uniqueness is enforced by the DB unique index
    // on (workspaceId, slug); we retry on a P2002 unique-constraint violation
    // to avoid the read-then-write race that a check-loop would have).
    const baseSlug = slugify(name) || "project";

    const storageKey = `${baseSlug}-${randomBytes(6).toString("hex")}`;
    const seeds = seedFilesFor(template ?? "blank", name);

    // Write files to disk first; if this fails we never create the DB row.
    await ensureProjectDir(storageKey);
    for (const seed of seeds) {
       
      await writeFile(storageKey, seed.path, seed.content);
    }

    // Create the project + seed FileNodes in a single transaction. The
    // (workspaceId, slug) unique index is the source of truth for slug
    // uniqueness; on a P2002 violation (concurrent project create with the
    // same slug) we regenerate the slug and retry. Capped at 5 attempts.
    const MAX_SLUG_ATTEMPTS = 5;
    let slug = baseSlug;
    let attempt = 0;
    let project;

    while (true) {
      try {
        project = await prisma.$transaction(
          async (tx: Prisma.TransactionClient) => {
            const created = await tx.project.create({
              data: {
                workspaceId,
                name,
                slug,
                description: description ?? null,
                storageKey,
              },
            });

            // Build FileNode rows: create folders first (to resolve parentIds),
            // then files.
            const folderIds = new Map<string, string>(); // relPath -> id

            const ensureFolder = async (
              folderPath: string
            ): Promise<string | null> => {
              if (!folderPath) return null;
              if (folderIds.has(folderPath)) return folderIds.get(folderPath)!;

              const segments = folderPath.split("/");
              let parentId: string | null = null;
              let current = "";
              for (const seg of segments) {
                current = current ? `${current}/${seg}` : seg;
                if (folderIds.has(current)) {
                  parentId = folderIds.get(current)!;
                  continue;
                }
                 
                const folder: { id: string } = await tx.fileNode.create({
                  data: {
                    projectId: created.id,
                    parentId,
                    type: "FOLDER" as FileType,
                    name: seg,
                    path: current,
                    size: 0,
                  },
                  select: { id: true },
                });
                folderIds.set(current, folder.id);
                parentId = folder.id;
              }
              return parentId;
            };

            for (const seed of seeds) {
              const idx = seed.path.lastIndexOf("/");
              const dir = idx >= 0 ? seed.path.slice(0, idx) : "";
              const fileName = idx >= 0 ? seed.path.slice(idx + 1) : seed.path;
               
              const parentId = await ensureFolder(dir);

               
              await tx.fileNode.create({
                data: {
                  projectId: created.id,
                  parentId,
                  type: "FILE" as FileType,
                  name: fileName,
                  path: seed.path,
                  language: detectLanguage(fileName),
                  content: seed.content,
                  size: Buffer.byteLength(seed.content, "utf8"),
                },
              });
            }

            return created;
          }
        );
        break;
      } catch (err) {
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === "P2002" &&
          attempt < MAX_SLUG_ATTEMPTS
        ) {
          // Slug collided with a concurrent project create. Regenerate and
          // retry the whole project + FileNode transaction.
          attempt += 1;
          slug = `${baseSlug}-${randomBytes(3).toString("hex")}`;
          continue;
        }
        throw err;
      }
    }

    return apiSuccess({ project }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
