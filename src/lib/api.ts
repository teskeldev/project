import { ZodError, type ZodSchema } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import type { Role } from "@prisma/client";

/**
 * Standard JSON shapes:
 *   success: { success: true, data }
 *   error:   { success: false, error: { message, code? } }
 */

export class ApiError extends Error {
  status: number;
  code?: string;
  details?: unknown;

  constructor(message: string, status = 400, code?: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function apiSuccess<T>(data: T, init?: { status?: number }): Response {
  return Response.json(
    { success: true, data },
    { status: init?.status ?? 200 }
  );
}

export function apiError(
  message: string,
  status = 400,
  code?: string,
  details?: unknown
): Response {
  const error: {
    message: string;
    code?: string;
    details?: unknown;
  } = { message };

  if (code) {
    error.code = code;
  }

  // Never leak internal details (e.g. validation internals, stacks) in prod.
  if (details !== undefined && process.env.NODE_ENV !== "production") {
    error.details = details;
  }

  return Response.json({ success: false, error }, { status });
}

export type SessionUser = {
  id: string;
  email: string;
  name: string | null;
  image?: string | null;
};

/**
 * Returns the authenticated session user or throws an ApiError(401).
 */
export async function requireUser(): Promise<SessionUser> {
  const session = await auth();

  if (!session?.user?.id) {
    throw new ApiError("Authentication required", 401, "UNAUTHORIZED");
  }

  return {
    id: session.user.id,
    email: session.user.email ?? "",
    name: session.user.name ?? null,
    image: session.user.image ?? null,
  };
}

export type ProjectAccess = {
  user: SessionUser;
  project: Awaited<ReturnType<typeof prisma.project.findUnique>>;
  member: { id: string; role: Role; workspaceId: string; userId: string };
  role: Role;
};

/**
 * Ensures the current user can access the given project (is a member of the
 * project's workspace). Throws ApiError(401/404/403) otherwise.
 */
export async function requireProjectAccess(
  projectId: string
): Promise<ProjectAccess> {
  const user = await requireUser();

  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });

  if (!project) {
    throw new ApiError("Project not found", 404, "NOT_FOUND");
  }

  const member = await prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId: project.workspaceId,
        userId: user.id,
      },
    },
  });

  if (!member) {
    throw new ApiError(
      "You do not have access to this project",
      403,
      "FORBIDDEN"
    );
  }

  return { user, project, member, role: member.role };
}

/**
 * Parses and validates a JSON request body against a Zod schema.
 * Throws ApiError(422) with the zod issues on failure.
 */
export async function validateBody<T>(
  req: Request,
  schema: ZodSchema<T>
): Promise<T> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    throw new ApiError("Invalid JSON body", 400, "INVALID_JSON");
  }

  const result = schema.safeParse(json);
  if (!result.success) {
    throw new ApiError(
      "Validation failed",
      422,
      "VALIDATION_ERROR",
      result.error.flatten()
    );
  }

  return result.data;
}

/**
 * Converts any thrown error into a proper apiError Response.
 *
 * Usage:
 *   export async function POST(req: Request) {
 *     try {
 *       const body = await validateBody(req, schema);
 *       const user = await requireUser();
 *       // ...
 *       return apiSuccess(result);
 *     } catch (err) {
 *       return handleApiError(err);
 *     }
 *   }
 */
export function handleApiError(err: unknown): Response {
  if (err instanceof ApiError) {
    return apiError(err.message, err.status, err.code, err.details);
  }

  if (err instanceof ZodError) {
    return apiError("Validation failed", 422, "VALIDATION_ERROR", err.flatten());
  }

  if (process.env.NODE_ENV !== "production") {
    const message = err instanceof Error ? err.message : "Unknown error";
    return apiError(message, 500, "INTERNAL_ERROR");
  }

  return apiError("Internal server error", 500, "INTERNAL_ERROR");
}

/**
 * Optional wrapper that runs a route handler and converts thrown errors
 * into proper responses.
 *
 * Usage:
 *   export const POST = withApi(async (req) => {
 *     const body = await validateBody(req, schema);
 *     return apiSuccess(body);
 *   });
 */
export function withApi(
  handler: (req: Request, ctx?: unknown) => Promise<Response> | Response
) {
  return async (req: Request, ctx?: unknown): Promise<Response> => {
    try {
      return await handler(req, ctx);
    } catch (err) {
      return handleApiError(err);
    }
  };
}
