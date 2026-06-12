import { prisma } from "@/lib/db";
import { apiSuccess, handleApiError, requireProjectAccess } from "@/lib/api";
import type { FileType } from "@prisma/client";

type RouteContext = { params: Promise<{ projectId: string }> };

type TreeNode = {
  id: string;
  name: string;
  path: string;
  type: FileType;
  language: string | null;
  size: number;
  parentId: string | null;
  updatedAt: Date;
  children?: TreeNode[];
};

// GET /api/projects/:projectId/files/tree -> nested FileNode tree.
export async function GET(_req: Request, ctx: RouteContext) {
  try {
    const { projectId } = await ctx.params;
    await requireProjectAccess(projectId);

    const rows = await prisma.fileNode.findMany({
      where: { projectId },
      select: {
        id: true,
        name: true,
        path: true,
        type: true,
        language: true,
        size: true,
        parentId: true,
        updatedAt: true,
      },
    });

    // Build map of node -> TreeNode, attach children to parents.
    const byId = new Map<string, TreeNode>();
    for (const r of rows) {
      byId.set(r.id, { ...r, children: r.type === "FOLDER" ? [] : undefined });
    }

    const roots: TreeNode[] = [];
    for (const node of byId.values()) {
      if (node.parentId && byId.has(node.parentId)) {
        const parent = byId.get(node.parentId)!;
        parent.children = parent.children ?? [];
        parent.children.push(node);
      } else {
        roots.push(node);
      }
    }

    // Sort: folders first, then by name (case-insensitive), recursively.
    const sortNodes = (nodes: TreeNode[]) => {
      nodes.sort((a, b) => {
        if (a.type !== b.type) return a.type === "FOLDER" ? -1 : 1;
        return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
      });
      for (const n of nodes) {
        if (n.children) sortNodes(n.children);
      }
    };
    sortNodes(roots);

    return apiSuccess({ tree: roots });
  } catch (err) {
    return handleApiError(err);
  }
}
