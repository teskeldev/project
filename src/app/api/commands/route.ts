import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  apiSuccess,
  handleApiError,
  requireUser,
  validateBody,
  ApiError,
  NO_STORE_HEADERS,
  type SessionUser,
} from "@/lib/api";
import { BUILTIN_COMMANDS, type SlashCommandDef } from "@/lib/commands";
import { enforceRateLimit } from "@/lib/rate-limit";
import type { Role } from "@prisma/client";

async function assertWorkspaceMember(
  user: SessionUser,
  workspaceId: string
): Promise<{ role: Role }> {
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
  return { role: member.role };
}

async function userWorkspaceIds(userId: string): Promise<string[]> {
  const memberships = await prisma.workspaceMember.findMany({
    where: { userId },
    select: { workspaceId: true },
  });
  return memberships.map((m) => m.workspaceId);
}

const commandVariableSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  required: z.boolean(),
  defaultValue: z.string().optional(),
});

const createCommandSchema = z.object({
  workspaceId: z.string().min(1, "workspaceId is required"),
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(50)
    .regex(/^[a-z0-9-]+$/, "Name must be lowercase alphanumeric with hyphens"),
  description: z.string().trim().min(1, "Description is required").max(200),
  template: z.string().min(1, "Template is required").max(10000),
  variables: z.array(commandVariableSchema).optional(),
});

// GET /api/commands?workspaceId=
// Returns all commands (built-in + custom) for the workspace.
export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const url = new URL(req.url);
    const workspaceId = url.searchParams.get("workspaceId") ?? undefined;

    let customCommands: SlashCommandDef[] = [];

    if (workspaceId) {
      await assertWorkspaceMember(user, workspaceId);
      const dbCommands = await prisma.slashCommand.findMany({
        where: { workspaceId },
        orderBy: { createdAt: "asc" },
      });
      customCommands = dbCommands.map((cmd) => ({
        id: cmd.id,
        name: cmd.name,
        description: cmd.description,
        template: cmd.template,
        variables: (cmd.variables as z.infer<typeof commandVariableSchema>[]) ?? [],
        builtin: false,
      }));
    } else {
      const wsIds = await userWorkspaceIds(user.id);
      if (wsIds.length > 0) {
        const dbCommands = await prisma.slashCommand.findMany({
          where: { workspaceId: { in: wsIds } },
          orderBy: { createdAt: "asc" },
        });
        customCommands = dbCommands.map((cmd) => ({
          id: cmd.id,
          name: cmd.name,
          description: cmd.description,
          template: cmd.template,
          variables: (cmd.variables as z.infer<typeof commandVariableSchema>[]) ?? [],
          builtin: false,
        }));
      }
    }

    const commands = [...BUILTIN_COMMANDS, ...customCommands];
    return apiSuccess({ commands }, { headers: NO_STORE_HEADERS });
  } catch (err) {
    return handleApiError(err);
  }
}

// POST /api/commands
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = await validateBody(req, createCommandSchema);

    await enforceRateLimit(`commands:create:${body.workspaceId}`, 20, 60_000);

    const { role } = await assertWorkspaceMember(user, body.workspaceId);

    const allowedRoles: Role[] = ["MEMBER", "ADMIN", "OWNER"];
    if (!allowedRoles.includes(role)) {
      throw new ApiError("Insufficient permissions", 403, "FORBIDDEN");
    }

    // Prevent overriding built-in command names
    const isBuiltin = BUILTIN_COMMANDS.some((c) => c.name === body.name);
    if (isBuiltin) {
      throw new ApiError(
        `Command name "${body.name}" is reserved (built-in command)`,
        409,
        "CONFLICT"
      );
    }

    const command = await prisma.slashCommand.create({
      data: {
        workspaceId: body.workspaceId,
        name: body.name,
        description: body.description,
        template: body.template,
        variables: body.variables ?? [],
      },
    });

    return apiSuccess({ command }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
