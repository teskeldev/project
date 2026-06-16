-- Fusion as a reusable AI Team Builder: replace Routing/Judge with a single Fusion entity.

DROP TABLE IF EXISTS "FusionRouting" CASCADE;
DROP TABLE IF EXISTS "FusionJudge" CASCADE;

CREATE TABLE "Fusion" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "modelIds" JSONB NOT NULL,
    "skillIds" JSONB NOT NULL,
    "ruleIds" JSONB NOT NULL,
    "knowledgeIds" JSONB NOT NULL,
    "strategy" TEXT NOT NULL DEFAULT 'single',
    "judge" TEXT NOT NULL DEFAULT 'auto',
    "judgeModelId" TEXT,
    "limits" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "isTemplate" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Fusion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Fusion_workspaceId_name_key" ON "Fusion"("workspaceId", "name");
CREATE INDEX "Fusion_workspaceId_idx" ON "Fusion"("workspaceId");

ALTER TABLE "Fusion" ADD CONSTRAINT "Fusion_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
