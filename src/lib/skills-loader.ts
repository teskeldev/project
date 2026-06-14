/**
 * Loads skill content from the bundled skills directory.
 * Skills are stored as markdown files and loaded on-demand.
 */
import { promises as fs } from "node:fs";
import path from "node:path";

const SKILLS_DIR = path.resolve(process.cwd(), "reference/awesome-claude-skills");

// Strict slug validation: only alphanumerics, dot, underscore, hyphen.
// Rejects path separators, "..", null bytes, and any other metacharacters
// that could be used to escape SKILLS_DIR via path.join.
const SLUG_REGEX = /^[a-zA-Z0-9._-]+$/;
const MAX_SLUG_LENGTH = 200;

function assertValidSlug(slug: string, label = "slug"): void {
  if (typeof slug !== "string" || slug.length === 0 || slug.length > MAX_SLUG_LENGTH) {
    throw new Error(
      `Invalid ${label}: must be a non-empty string up to ${MAX_SLUG_LENGTH} characters`
    );
  }
  if (!SLUG_REGEX.test(slug)) {
    throw new Error(
      `Invalid ${label}: only letters, digits, ".", "_", and "-" are allowed`
    );
  }
}

/**
 * Load the full markdown content of a skill by slug and source.
 * Returns null if the skill file doesn't exist.
 */
export async function loadSkillContent(
  slug: string,
  source: "builtin" | "composio"
): Promise<string | null> {
  // Validate BEFORE any path.join to prevent path traversal (e.g. "../../etc/passwd").
  // The registry-based caller in /api/skills/registry/[slug] is already safe because
  // it only passes slugs that match an entry in SKILLS_REGISTRY, but we validate
  // here as defense in depth.
  assertValidSlug(slug, "slug");

  try {
    let skillPath: string;

    if (source === "composio") {
      skillPath = path.join(SKILLS_DIR, "composio-skills", slug, "SKILL.md");
    } else {
      // Handle document-skills sub-skills
      if (slug.startsWith("document-skills-")) {
        const subType = slug.replace("document-skills-", "");
        // subType must satisfy the same constraints as a top-level slug
        // (and additionally must not be empty, i.e. the prefix must be followed
        // by at least one valid character).
        assertValidSlug(subType, "document-skills sub-type");
        skillPath = path.join(SKILLS_DIR, "document-skills", subType, "SKILL.md");
      } else {
        skillPath = path.join(SKILLS_DIR, slug, "SKILL.md");
      }
    }

    const content = await fs.readFile(skillPath, "utf-8");
    return content;
  } catch (err) {
    // Validation errors are programmer/input errors — surface them so callers
    // can return a 400 rather than silently returning null.
    if (err instanceof Error && err.message.startsWith("Invalid ")) {
      throw err;
    }
    return null;
  }
}

/**
 * Check if a skill's content file exists on disk.
 */
export async function skillContentExists(
  slug: string,
  source: "builtin" | "composio"
): Promise<boolean> {
  const content = await loadSkillContent(slug, source);
  return content !== null;
}
