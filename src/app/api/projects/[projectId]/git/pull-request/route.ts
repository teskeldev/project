import { z } from "zod";
import {
  apiSuccess,
  handleApiError,
  requireProjectAccess,
  validateBody,
  ApiError,
} from "@/lib/api";
import { prisma } from "@/lib/db";
import { decryptJson } from "@/lib/crypto";
import {
  createPullRequest,
  listPullRequests,
  GitHubError,
} from "@/lib/github";

type RouteContext = { params: Promise<{ projectId: string }> };

const createPrSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(256),
  body: z.string().max(65536).optional(),
  head: z.string().trim().min(1, "Head branch is required"),
  base: z.string().trim().min(1, "Base branch is required"),
});

/**
 * Resolve the GitHub token and owner/repo for a project's workspace.
 * Looks for a "github" integration in the workspace.
 */
async function resolveGitHub(projectId: string) {
  const { project } = await requireProjectAccess(projectId);

  if (!project) {
    throw new ApiError("Project not found", 404, "NOT_FOUND");
  }

  // Find GitHub integration for this workspace
  const integration = await prisma.integration.findFirst({
    where: {
      workspaceId: project.workspaceId,
      provider: "github",
      enabled: true,
    },
  });

  if (!integration) {
    throw new ApiError(
      "No GitHub integration configured. Add a GitHub token in Integrations settings.",
      400,
      "NO_GITHUB_INTEGRATION"
    );
  }

  const config = decryptJson<{ token: string }>(integration.encryptedConfig);
  if (!config.token) {
    throw new ApiError(
      "GitHub integration token is missing.",
      400,
      "INVALID_GITHUB_CONFIG"
    );
  }

  // Determine owner/repo from project metadata or git remote
  // For now we look at the project's storageKey or a dedicated field
  // Convention: storageKey may contain "owner/repo" or we parse from git remote
  const repoInfo = parseRepoInfo(project.storageKey);

  return { token: config.token, ...repoInfo, project };
}

/**
 * Parse owner/repo from storageKey or project name.
 * StorageKey format might be "github:owner/repo" or just a path.
 * Falls back to checking if storageKey looks like "owner/repo".
 */
function parseRepoInfo(
  storageKey: string,
): { owner: string; repo: string } {
  // Try "github:owner/repo" format
  if (storageKey.startsWith("github:")) {
    const parts = storageKey.slice(7).split("/");
    if (parts.length >= 2) {
      return { owner: parts[0], repo: parts[1] };
    }
  }

  // Try "owner/repo" format
  const slashParts = storageKey.split("/");
  if (
    slashParts.length === 2 &&
    slashParts[0].length > 0 &&
    slashParts[1].length > 0
  ) {
    return { owner: slashParts[0], repo: slashParts[1] };
  }

  // Fallback: use project name as repo (user must configure properly)
  throw new ApiError(
    "Cannot determine GitHub repository. Ensure the project is linked to a GitHub repo.",
    400,
    "REPO_NOT_CONFIGURED"
  );
}

// POST /api/projects/:projectId/git/pull-request - Create a PR
export async function POST(req: Request, ctx: RouteContext) {
  try {
    const { projectId } = await ctx.params;
    const { token, owner, repo } = await resolveGitHub(projectId);
    const { title, body, head, base } = await validateBody(req, createPrSchema);

    const pr = await createPullRequest(token, owner, repo, head, base, title, body);
    return apiSuccess({ pullRequest: pr });
  } catch (err) {
    if (err instanceof GitHubError) {
      return handleApiError(
        new ApiError(err.message, err.status >= 500 ? 502 : err.status, "GITHUB_ERROR")
      );
    }
    return handleApiError(err);
  }
}

// GET /api/projects/:projectId/git/pull-request - List PRs
export async function GET(_req: Request, ctx: RouteContext) {
  try {
    const { projectId } = await ctx.params;
    const { token, owner, repo } = await resolveGitHub(projectId);

    const pullRequests = await listPullRequests(token, owner, repo);
    return apiSuccess({ pullRequests });
  } catch (err) {
    if (err instanceof GitHubError) {
      return handleApiError(
        new ApiError(err.message, err.status >= 500 ? 502 : err.status, "GITHUB_ERROR")
      );
    }
    return handleApiError(err);
  }
}
