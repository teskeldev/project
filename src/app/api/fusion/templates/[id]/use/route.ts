import { prisma } from "@/lib/db";
import { apiSuccess, handleApiError, requireWorkspaceAccess, requireRole, validateBody, ApiError } from "@/lib/api";
import { workspaceOnly } from "@/lib/ai/fusion/schemas";
import { getFusionTemplate } from "@/lib/ai/fusion/templates";
import { listAvailableModels } from "@/lib/ai/fusion/models";
import { createFusion } from "@/lib/ai/fusion/store";

type Ctx = { params: Promise<{ id: string }> };

// POST /api/fusion/templates/:id/use — copy a built-in template into the workspace.
export async function POST(req: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const { workspaceId } = await validateBody(req, workspaceOnly);
    const { user, member } = await requireWorkspaceAccess(workspaceId);
    requireRole(member);

    const tpl = getFusionTemplate(id);
    if (!tpl) throw new ApiError("Template not found", 404, "NOT_FOUND");

    const warnings: string[] = [];

    // Map preferred providers → first available model ref of that provider.
    const available = await listAvailableModels(workspaceId);
    const modelIds: string[] = [];
    for (const provider of tpl.providers) {
      const m = available.find((a) => a.provider === provider);
      if (m) modelIds.push(m.ref);
      else warnings.push(`No connected model for provider "${provider}" — skipped.`);
    }

    // Map skill slugs → workspace skill ids (skip missing).
    const skills = await prisma.skill.findMany({
      where: { workspaceId, slug: { in: tpl.skillSlugs } },
      select: { id: true, slug: true },
    });
    const bySlug = new Map(skills.map((s) => [s.slug, s.id]));
    const skillIds: string[] = [];
    for (const slug of tpl.skillSlugs) {
      const sid = bySlug.get(slug);
      if (sid) skillIds.push(sid);
      else warnings.push(`Skill "${slug}" not installed — skipped.`);
    }

    // Ensure a unique name in the workspace.
    let name = tpl.name;
    for (let i = 2; await prisma.fusion.findFirst({ where: { workspaceId, name } }); i++) {
      name = `${tpl.name} ${i}`;
    }

    const fusion = await createFusion(workspaceId, user.id, {
      name,
      description: tpl.description,
      modelIds,
      skillIds,
      ruleIds: [],
      knowledgeIds: [],
      strategy: tpl.strategy,
      judge: tpl.judge,
      status: "active",
    });

    return apiSuccess({ fusion, warnings }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
