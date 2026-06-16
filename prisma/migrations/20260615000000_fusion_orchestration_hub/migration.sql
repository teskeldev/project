-- AlterTable: extend FusionProfile with Orchestration Hub bindings
ALTER TABLE "FusionProfile"
  ADD COLUMN "systemPrompt" TEXT,
  ADD COLUMN "teamId" TEXT,
  ADD COLUMN "routingId" TEXT,
  ADD COLUMN "judgeId" TEXT,
  ADD COLUMN "mcpServerIds" JSONB,
  ADD COLUMN "memory" JSONB;

-- CreateTable
CREATE TABLE "FusionProvider" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "baseUrl" TEXT,
    "integrationId" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastStatus" TEXT,
    "lastLatencyMs" INTEGER,
    "lastCheckedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FusionProvider_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FusionModel" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "contextWindow" INTEGER NOT NULL DEFAULT 0,
    "pricing" JSONB NOT NULL,
    "capabilities" JSONB NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FusionModel_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FusionTeam" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "modelIds" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FusionTeam_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FusionRouting" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "strategy" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FusionRouting_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FusionJudge" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "judgeModelId" TEXT,
    "mode" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FusionJudge_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FusionMcpServer" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "url" TEXT,
    "command" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastStatus" TEXT,
    "lastCheckedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FusionMcpServer_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FusionWorkflow" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "graph" JSONB NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FusionWorkflow_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FusionRequestLog" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "profileId" TEXT,
    "modelId" TEXT,
    "provider" TEXT NOT NULL,
    "tokensIn" INTEGER NOT NULL DEFAULT 0,
    "tokensOut" INTEGER NOT NULL DEFAULT 0,
    "costUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "latencyMs" INTEGER NOT NULL DEFAULT 0,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FusionRequestLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FusionSettings" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "defaults" JSONB NOT NULL,
    "featureFlags" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FusionSettings_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE UNIQUE INDEX "FusionProvider_workspaceId_name_key" ON "FusionProvider"("workspaceId", "name");
CREATE INDEX "FusionProvider_workspaceId_idx" ON "FusionProvider"("workspaceId");
CREATE INDEX "FusionModel_workspaceId_idx" ON "FusionModel"("workspaceId");
CREATE INDEX "FusionModel_providerId_idx" ON "FusionModel"("providerId");
CREATE UNIQUE INDEX "FusionTeam_workspaceId_name_key" ON "FusionTeam"("workspaceId", "name");
CREATE INDEX "FusionTeam_workspaceId_idx" ON "FusionTeam"("workspaceId");
CREATE UNIQUE INDEX "FusionRouting_workspaceId_name_key" ON "FusionRouting"("workspaceId", "name");
CREATE INDEX "FusionRouting_workspaceId_idx" ON "FusionRouting"("workspaceId");
CREATE UNIQUE INDEX "FusionJudge_workspaceId_name_key" ON "FusionJudge"("workspaceId", "name");
CREATE INDEX "FusionJudge_workspaceId_idx" ON "FusionJudge"("workspaceId");
CREATE UNIQUE INDEX "FusionMcpServer_workspaceId_name_key" ON "FusionMcpServer"("workspaceId", "name");
CREATE INDEX "FusionMcpServer_workspaceId_idx" ON "FusionMcpServer"("workspaceId");
CREATE UNIQUE INDEX "FusionWorkflow_workspaceId_name_key" ON "FusionWorkflow"("workspaceId", "name");
CREATE INDEX "FusionWorkflow_workspaceId_idx" ON "FusionWorkflow"("workspaceId");
CREATE INDEX "FusionRequestLog_workspaceId_createdAt_idx" ON "FusionRequestLog"("workspaceId", "createdAt");
CREATE UNIQUE INDEX "FusionSettings_workspaceId_key" ON "FusionSettings"("workspaceId");

-- Foreign keys
ALTER TABLE "FusionProvider" ADD CONSTRAINT "FusionProvider_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FusionModel" ADD CONSTRAINT "FusionModel_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FusionModel" ADD CONSTRAINT "FusionModel_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "FusionProvider"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FusionTeam" ADD CONSTRAINT "FusionTeam_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FusionRouting" ADD CONSTRAINT "FusionRouting_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FusionJudge" ADD CONSTRAINT "FusionJudge_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FusionMcpServer" ADD CONSTRAINT "FusionMcpServer_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FusionWorkflow" ADD CONSTRAINT "FusionWorkflow_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FusionRequestLog" ADD CONSTRAINT "FusionRequestLog_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FusionSettings" ADD CONSTRAINT "FusionSettings_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
