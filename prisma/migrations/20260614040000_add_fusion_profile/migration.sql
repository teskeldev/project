-- CreateTable
CREATE TABLE "FusionProfile" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "panelSlug" TEXT NOT NULL DEFAULT 'auto',
    "panelists" JSONB NOT NULL,
    "judge" JSONB NOT NULL,
    "skillSlugs" JSONB NOT NULL,
    "trackAVerification" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FusionProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FusionProfile_workspaceId_idx" ON "FusionProfile"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "FusionProfile_workspaceId_name_key" ON "FusionProfile"("workspaceId", "name");

-- AddForeignKey
ALTER TABLE "FusionProfile" ADD CONSTRAINT "FusionProfile_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
