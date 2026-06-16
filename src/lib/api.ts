import { ZodError, type ZodSchema } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import type { Role } from "@prisma/client";
import { requireCsrf } from "@/lib/security";
import { httpRequestsTotal } from "@/lib/observability/metrics";
import { captureException } from "@/lib/observability/sentry";

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

/**
 * Headers for user-scoped GET responses: prevent shared/intermediate caches
 * from storing or transforming personalized data. Use as the 3rd arg of
 * `apiSuccess(data, { headers: NO_STORE_HEADERS })`.
 */
export const NO_STORE_HEADERS: HeadersInit = {
  "Cache-Control": "private, no-store",
};

export function apiSuccess<T>(
  data: T,
  init?: { status?: number; headers?: HeadersInit }
): Response {
  return Response.json(
    { success: true, data },
    {
      status: init?.status ?? 200,
      headers: init?.headers,
    }
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
  project: NonNullable<Awaited<ReturnType<typeof prisma.project.findUnique>>>;
  member: { id: string; role: Role; workspaceId: string; userId: string };
  role: Role;
};

/**
 * Ensures the current user can access the given project (is a member of the
 * project's workspace). Throws ApiError(401/404/403) otherwise.
 *
 * Uses a single query with include to avoid N+1 (project + member lookup).
 */
export async function requireProjectAccess(
  projectId: string
): Promise<ProjectAccess> {
  const user = await requireUser();

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      workspace: {
        include: {
          members: {
            where: { userId: user.id },
            take: 1,
          },
        },
      },
    },
  });

  if (!project) {
    throw new ApiError("Project not found", 404, "NOT_FOUND");
  }

  const member = project.workspace.members[0];

  if (!member) {
    throw new ApiError(
      "You do not have access to this project",
      403,
      "FORBIDDEN"
    );
  }

  // Strip the workspace include from the returned project to match the
  // original return shape (plain project without nested workspace data).
  const { workspace: _workspace, ...projectData } = project;

  return { user, project: projectData as typeof project, member, role: member.role };
}

/**
 * Ensures the current user is a member of the given workspace. Returns the
 * session user + their membership (role). Throws ApiError(401/403) otherwise.
 */
export async function requireWorkspaceAccess(
  workspaceId: string
): Promise<{ user: SessionUser; member: { role: Role }; role: Role }> {
  const user = await requireUser();
  const member = await prisma.workspaceMember.findFirst({
    where: { workspaceId, userId: user.id },
    select: { role: true },
  });
  if (!member) {
    throw new ApiError("You do not have access to this workspace", 403, "FORBIDDEN");
  }
  return { user, member, role: member.role };
}

/**
 * Workspace role hierarchy, highest privilege first. Used by `requireRole` to
 * gate write operations: anything below MEMBER (i.e. VIEWER) is read-only.
 */
const ROLE_RANK: Record<Role, number> = {
  OWNER: 3,
  ADMIN: 2,
  MEMBER: 1,
  VIEWER: 0,
};

/**
 * Assert the member holds at least `minRole`. `requireProjectAccess` only
 * proves membership; call this on any state-changing route so a VIEWER cannot
 * perform writes. Throws ApiError(403) when the role is insufficient.
 */
export function requireRole(
  member: { role: Role },
  minRole: Role = "MEMBER"
): void {
  if (ROLE_RANK[member.role] < ROLE_RANK[minRole]) {
    throw new ApiError("Insufficient permissions", 403, "FORBIDDEN");
  }
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
    // Count expected client/server errors; only escalate real 5xx to Sentry.
    httpRequestsTotal.inc({ method: "-", route: "-", status: String(err.status) });
    if (err.status >= 500) captureException(err);
    return apiError(err.message, err.status, err.code, err.details);
  }

  if (err instanceof ZodError) {
    httpRequestsTotal.inc({ method: "-", route: "-", status: "422" });
    return apiError("Validation failed", 422, "VALIDATION_ERROR", err.flatten());
  }

  // Unknown error -> 500. Always track these; they're the ones that matter.
  httpRequestsTotal.inc({ method: "-", route: "-", status: "500" });
  captureException(err);

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
 * Options:
 *   csrf: when true, mutating requests (POST/PUT/PATCH/DELETE) must carry a
 *         valid double-submit CSRF token. The check is skipped for safe
 *         methods (GET/HEAD/OPTIONS).
 *
 * Usage:
 *   export const POST = withApi(
 *     async (req) => {
 *       const body = await validateBody(req, schema);
 *       return apiSuccess(body);
 *     },
 *     { csrf: true }
 *   );
 */
export function withApi(
  handler: (req: Request, ctx?: unknown) => Promise<Response> | Response,
  options: { csrf?: boolean } = {}
) {
  return async (req: Request, ctx?: unknown): Promise<Response> => {
    try {
      if (options.csrf) {
        await requireCsrf(req);
      }
      return await handler(req, ctx);
    } catch (err) {
      return handleApiError(err);
    }
  };
}
