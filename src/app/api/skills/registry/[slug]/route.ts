import { NextRequest, NextResponse } from "next/server";
import { SKILLS_REGISTRY } from "@/data/skills-registry";
import { loadSkillContent } from "@/lib/skills-loader";
import { requireUser } from "@/lib/api";

/**
 * GET /api/skills/registry/[slug]
 *
 * Returns the full content of a specific skill from the registry.
 * Loads the SKILL.md content from the filesystem on-demand.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  await requireUser();
  const { slug } = await params;

  // Find the skill in the registry
  const entry = SKILLS_REGISTRY.find((s) => s.slug === slug);
  if (!entry) {
    return NextResponse.json(
      { success: false, error: { message: "Skill not found", code: "NOT_FOUND" } },
      { status: 404 }
    );
  }

  // Load content from filesystem
  const content = await loadSkillContent(entry.slug, entry.source);
  if (!content) {
    return NextResponse.json(
      {
        success: false,
        error: { message: "Skill content not available", code: "CONTENT_NOT_FOUND" },
      },
      { status: 404 }
    );
  }

  return NextResponse.json({
    success: true,
    data: {
      ...entry,
      content,
    },
  });
}
