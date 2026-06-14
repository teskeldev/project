import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  apiSuccess,
  handleApiError,
  requireUser,
  validateBody,
  ApiError,
  type SessionUser,
} from "@/lib/api";
import type { Role } from "@prisma/client";

type RouteContext = { params: Promise<{ id: string }> };

const commandVariableSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  required: z.boolean(),
  defaultValue: z.string().optional(),
});

const updateCommandSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1)
      .max(50)
      .regex(/^[a-z0-9-]+$/, "Name must be lowercase alphanumeric with hyphens")
      .optional(),
    description: z.string().trim().min(1).max(200).optional(),
    template: z.string().min(1).max(10000).optional(),
    variables: z.array(commandVariableSchema).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: "No fields to update",
  });

async function loadManageableCommand(user: SessionUser, commandId: string) {
  const command = await prisma.slashCommand.findUnique({
    where: { id: commandId },
  });

  if (!command) {
    throw new ApiError("Command not found", 404, "NOT_FOUND");
  }

  const member = await prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId: command.workspaceId,
        userId: user.id,
      },
    },
  });
  if (!member) {
    throw new ApiError("You cannot manage this command", 403, "FORBIDDEN");
  }

  const allowedRoles: Role[] = ["ADMIN", "OWNER"];
  if (!allowedRoles.includes(member.role)) {
    throw new ApiError("Insufficient permissions", 403, "FORBIDDEN");
  }

  return command;
}

// PATCH /api/commands/:id
export async function PATCH(req: Request, ctx: RouteContext) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    const body = await validateBody(req, updateCommandSchema);

    await loadManageableCommand(user, id);

    const command = await prisma.slashCommand.update({
      where: { id },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
        ...(body.template !== undefined ? { template: body.template } : {}),
        ...(body.variables !== undefined ? { variables: body.variables } : {}),
      },
    });

    return apiSuccess({ command });
  } catch (err) {
    return handleApiError(err);
  }
}

// DELETE /api/commands/:id
export async function DELETE(_req: Request, ctx: RouteContext) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;

    await loadManageableCommand(user, id);
    await prisma.slashCommand.delete({ where: { id } });

    return apiSuccess({ deleted: true, id });
  } catch (err) {
    return handleApiError(err);
  }
}
