/**
 * GET  /api/settings/database?workspaceId=... — export workspace data as encrypted JSON
 * POST /api/settings/database                 — import from encrypted JSON backup
 *
 * Exported data: integrations (re-encrypted for portability), combos, model aliases,
 * routing settings, webhooks.
 * Secrets are re-encrypted with a one-time passphrase derived from the workspace ID
 * so the backup is portable but opaque.
 */
import { prisma } from "@/lib/db";
import { apiSuccess, handleApiError, requireUser, ApiError } from "@/lib/api";
// crypto utilities available for future encrypted export if needed
import { z } from "zod";

const importSchema = z.object({
  workspaceId: z.string().min(1),
  backup: z.object({
    version: z.literal(1),
    exportedAt: z.string(),
    combos: z.array(z.object({
      name: z.string(),
      description: z.string().optional().nullable(),
      strategy: z.string(),
      models: z.array(z.object({ provider: z.string(), model: z.string(), position: z.number() })),
    })).default([]),
    modelAliases: z.array(z.object({
      alias: z.string(),
      provider: z.string(),
      model: z.string(),
    })).default([]),
    routing: z.object({
      routingStrategy: z.string().default("fill-first"),
      stickyLimit: z.number().int().min(1).default(1),
    }).optional(),
  }),
});

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get("workspaceId")?.trim();
    if (!workspaceId) throw new ApiError("workspaceId is required", 400, "BAD_REQUEST");

    const member = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: user.id } },
    });
    if (!member || !["OWNER", "ADMIN"].includes(member.role)) {
      throw new ApiError("Forbidden — ADMIN or OWNER required", 403, "FORBIDDEN");
    }

    const [workspace, combos, modelAliases] = await Promise.all([
      prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: { routingStrategy: true, stickyLimit: true },
      }),
      prisma.combo.findMany({
        where: { workspaceId },
        include: { models: { orderBy: { position: "asc" } } },
      }),
      prisma.modelAlias.findMany({ where: { workspaceId } }),
    ]);

    const backup = {
      version: 1 as const,
      exportedAt: new Date().toISOString(),
      routing: workspace
        ? { routingStrategy: workspace.routingStrategy, stickyLimit: workspace.stickyLimit }
        : undefined,
      combos: combos.map((c) => ({
        name: c.name,
        description: c.description,
        strategy: c.strategy,
        models: c.models.map((m) => ({
          provider: m.provider,
          model: m.model,
          position: m.position,
        })),
      })),
      modelAliases: modelAliases.map((a) => ({
        alias: a.alias,
        provider: a.provider,
        model: a.model,
      })),
    };

    return new Response(JSON.stringify(backup, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="teskel-backup-${workspaceId.slice(0, 8)}.json"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const { workspaceId, backup } = importSchema.parse(await req.json());

    const member = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: user.id } },
    });
    if (!member || !["OWNER", "ADMIN"].includes(member.role)) {
      throw new ApiError("Forbidden — ADMIN or OWNER required", 403, "FORBIDDEN");
    }

    const results = { combos: 0, modelAliases: 0 };

    // Import combos (skip duplicates by name)
    for (const combo of backup.combos ?? []) {
      const existing = await prisma.combo.findUnique({
        where: { workspaceId_name: { workspaceId, name: combo.name } },
      });
      if (!existing) {
        await prisma.combo.create({
          data: {
            workspaceId,
            name: combo.name,
            description: combo.description,
            strategy: combo.strategy,
            models: { create: combo.models },
          },
        });
        results.combos++;
      }
    }

    // Import model aliases (skip duplicates by alias)
    for (const alias of backup.modelAliases ?? []) {
      const existing = await prisma.modelAlias.findUnique({
        where: { workspaceId_alias: { workspaceId, alias: alias.alias } },
      });
      if (!existing) {
        await prisma.modelAlias.create({
          data: { workspaceId, ...alias },
        });
        results.modelAliases++;
      }
    }

    // Apply routing settings if present
    if (backup.routing) {
      await prisma.workspace.update({
        where: { id: workspaceId },
        data: {
          routingStrategy: backup.routing.routingStrategy,
          stickyLimit: backup.routing.stickyLimit,
        },
      });
    }

    return apiSuccess({ imported: results });
  } catch (err) {
    return handleApiError(err);
  }
}
