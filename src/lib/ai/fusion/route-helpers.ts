/**
 * Thin CRUD route factories for Fusion hub resources. Each resource route file
 * wires its store functions + zod schemas through these to get consistent auth
 * (workspace membership + requireRole on writes), validation and error handling.
 *
 * SERVER-ONLY (used by app/api route modules).
 */
import type { ZodSchema } from "zod";
import {
  apiSuccess,
  handleApiError,
  requireWorkspaceAccess,
  requireRole,
  validateBody,
  ApiError,
} from "@/lib/api";

type WithWorkspace = { workspaceId: string };

export function collectionHandlers<C extends WithWorkspace>(opts: {
  resultKey: string;
  list: (workspaceId: string) => Promise<unknown>;
  create: (workspaceId: string, data: Omit<C, "workspaceId">) => Promise<unknown>;
  createSchema: ZodSchema<C>;
}) {
  return {
    GET: async (req: Request): Promise<Response> => {
      try {
        const workspaceId = new URL(req.url).searchParams.get("workspaceId");
        if (!workspaceId) throw new ApiError("workspaceId is required", 400, "BAD_REQUEST");
        await requireWorkspaceAccess(workspaceId);
        const items = await opts.list(workspaceId);
        return apiSuccess({ [opts.resultKey]: items });
      } catch (err) {
        return handleApiError(err);
      }
    },
    POST: async (req: Request): Promise<Response> => {
      try {
        const body = await validateBody(req, opts.createSchema);
        const { member } = await requireWorkspaceAccess(body.workspaceId);
        requireRole(member);
        const { workspaceId, ...data } = body;
        const created = await opts.create(workspaceId, data as Omit<C, "workspaceId">);
        return apiSuccess({ item: created }, { status: 201 });
      } catch (err) {
        return handleApiError(err);
      }
    },
  };
}

type RouteCtx = { params: Promise<{ id: string }> };

export function itemHandlers<U extends WithWorkspace>(opts: {
  update: (workspaceId: string, id: string, data: Omit<U, "workspaceId">) => Promise<unknown>;
  remove: (workspaceId: string, id: string) => Promise<unknown>;
  updateSchema: ZodSchema<U>;
  deleteSchema: ZodSchema<WithWorkspace>;
}) {
  return {
    PATCH: async (req: Request, ctx: RouteCtx): Promise<Response> => {
      try {
        const { id } = await ctx.params;
        const body = await validateBody(req, opts.updateSchema);
        const { member } = await requireWorkspaceAccess(body.workspaceId);
        requireRole(member);
        const { workspaceId, ...data } = body;
        const updated = await opts.update(workspaceId, id, data as Omit<U, "workspaceId">);
        return apiSuccess({ item: updated });
      } catch (err) {
        return handleApiError(err);
      }
    },
    DELETE: async (req: Request, ctx: RouteCtx): Promise<Response> => {
      try {
        const { id } = await ctx.params;
        const { workspaceId } = await validateBody(req, opts.deleteSchema);
        const { member } = await requireWorkspaceAccess(workspaceId);
        requireRole(member);
        await opts.remove(workspaceId, id);
        return apiSuccess({ deleted: true });
      } catch (err) {
        return handleApiError(err);
      }
    },
  };
}
