-- Enforce the scoping invariant for Rule and Skill.
--
-- Rule: a rule must be attached to a workspace or project, EXCEPT GLOBAL-scoped
-- rules which intentionally apply everywhere and have neither set. (The previous
-- version omitted the GLOBAL exception, which made the constraint reject valid
-- global rules — it broke the seed and any global-rule creation.)
ALTER TABLE "Rule" ADD CONSTRAINT "Rule_workspace_or_project_required"
  CHECK ("scope" = 'GLOBAL' OR "workspaceId" IS NOT NULL OR "projectId" IS NOT NULL);

-- Skill: always created with a workspaceId (no global skills), so require one.
ALTER TABLE "Skill" ADD CONSTRAINT "Skill_workspace_or_project_required"
  CHECK ("workspaceId" IS NOT NULL OR "projectId" IS NOT NULL);
