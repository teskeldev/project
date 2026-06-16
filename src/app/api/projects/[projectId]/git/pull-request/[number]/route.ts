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
  getPullRequest,
  mergePullRequest,
  addComment,
  listComments,
  GitHubError,
} from "@/lib/github";

type RouteContext = {
  params: Promise<{ projectId: string; number: string }>;
};

const commentSchema = z.object({
  body: z.string().trim().min(1, "Comment body is required").max(65536),
});

/**
 * Resolve the GitHub token and owner/repo for a project's workspace.
 */
async function resolveGitHub(projectId: string) {
  const { project } = await requireProjectAccess(projectId);

  if (!project) {
    throw new ApiError("Project not found", 404, "NOT_FOUND");
  }

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

  const repoInfo = parseRepoInfo(project.storageKey);

  return { token: config.token, ...repoInfo, project };
}

function parseRepoInfo(storageKey: string): { owner: string; repo: string } {
  if (storageKey.startsWith("github:")) {
    const parts = storageKey.slice(7).split("/");
    if (parts.length >= 2) {
      return { owner: parts[0], repo: parts[1] };
    }
  }

  const slashParts = storageKey.split("/");
  if (
    slashParts.length === 2 &&
    slashParts[0].length > 0 &&
    slashParts[1].length > 0
  ) {
    return { owner: slashParts[0], repo: slashParts[1] };
  }

  throw new ApiError(
    "Cannot determine GitHub repository. Ensure the project is linked to a GitHub repo.",
    400,
    "REPO_NOT_CONFIGURED"
  );
}

// GET /api/projects/:projectId/git/pull-request/:number - Get PR details
export async function GET(_req: Request, ctx: RouteContext) {
  try {
    const { projectId, number: numStr } = await ctx.params;
    const prNumber = parseInt(numStr, 10);
    if (isNaN(prNumber) || prNumber < 1) {
      throw new ApiError("Invalid PR number", 400, "INVALID_PR_NUMBER");
    }

    const { token, owner, repo } = await resolveGitHub(projectId);
    const pullRequest = await getPullRequest(token, owner, repo, prNumber);
    const comments = await listComments(token, owner, repo, prNumber);

    return apiSuccess({ pullRequest, comments });
  } catch (err) {
    if (err instanceof GitHubError) {
      return handleApiError(
        new ApiError(err.message, err.status >= 500 ? 502 : err.status, "GITHUB_ERROR")
      );
    }
    return handleApiError(err);
  }
}

// POST /api/projects/:projectId/git/pull-request/:number - Merge PR
export async function POST(_req: Request, ctx: RouteContext) {
  try {
    const { projectId, number: numStr } = await ctx.params;
    const prNumber = parseInt(numStr, 10);
    if (isNaN(prNumber) || prNumber < 1) {
      throw new ApiError("Invalid PR number", 400, "INVALID_PR_NUMBER");
    }

    const { token, owner, repo } = await resolveGitHub(projectId);
    const result = await mergePullRequest(token, owner, repo, prNumber);

    return apiSuccess({ merged: result.merged, message: result.message, sha: result.sha });
  } catch (err) {
    if (err instanceof GitHubError) {
      return handleApiError(
        new ApiError(err.message, err.status >= 500 ? 502 : err.status, "GITHUB_ERROR")
      );
    }
    return handleApiError(err);
  }
}

// PATCH /api/projects/:projectId/git/pull-request/:number - Add comment
export async function PATCH(req: Request, ctx: RouteContext) {
  try {
    const { projectId, number: numStr } = await ctx.params;
    const prNumber = parseInt(numStr, 10);
    if (isNaN(prNumber) || prNumber < 1) {
      throw new ApiError("Invalid PR number", 400, "INVALID_PR_NUMBER");
    }

    const { token, owner, repo } = await resolveGitHub(projectId);
    const { body } = await validateBody(req, commentSchema);
    const comment = await addComment(token, owner, repo, prNumber, body);

    return apiSuccess({ comment });
  } catch (err) {
    if (err instanceof GitHubError) {
      return handleApiError(
        new ApiError(err.message, err.status >= 500 ? 502 : err.status, "GITHUB_ERROR")
      );
    }
    return handleApiError(err);
  }
}
