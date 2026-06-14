import { NextRequest, NextResponse } from "next/server";
import {
  SKILLS_REGISTRY,
  SKILLS_REGISTRY_COUNT,
  SKILL_CATEGORIES,
  type SkillCategory,
} from "@/data/skills-registry";

/**
 * GET /api/skills/registry
 *
 * Returns paginated skills registry metadata.
 * Query params:
 *   - category: Filter by category (e.g., "development", "integrations")
 *   - source: Filter by source ("builtin" | "composio")
 *   - search: Search query (matches name, description, slug)
 *   - page: Page number (default: 1)
 *   - limit: Items per page (default: 50, max: 200)
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const category = url.searchParams.get("category") as SkillCategory | null;
  const source = url.searchParams.get("source") as "builtin" | "composio" | null;
  const search = url.searchParams.get("search")?.toLowerCase() ?? "";
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10));
  const limit = Math.min(200, Math.max(1, parseInt(url.searchParams.get("limit") ?? "50", 10)));

  let results = SKILLS_REGISTRY;

  // Filter by category
  if (category && category in SKILL_CATEGORIES) {
    results = results.filter((s) => s.category === category);
  }

  // Filter by source
  if (source === "builtin" || source === "composio") {
    results = results.filter((s) => s.source === source);
  }

  // Search
  if (search) {
    results = results.filter(
      (s) =>
        s.name.toLowerCase().includes(search) ||
        s.description.toLowerCase().includes(search) ||
        s.slug.toLowerCase().includes(search)
    );
  }

  const total = results.length;
  const totalPages = Math.ceil(total / limit);
  const offset = (page - 1) * limit;
  const items = results.slice(offset, offset + limit);

  return NextResponse.json({
    success: true,
    data: {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
      categories: SKILL_CATEGORIES,
      totalRegistry: SKILLS_REGISTRY_COUNT,
    },
  });
}
