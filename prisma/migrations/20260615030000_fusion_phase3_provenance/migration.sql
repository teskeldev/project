-- Fusion Phase 3: attach an optional fusionId to AI surfaces (provenance + config selection).
ALTER TABLE "AgentRun" ADD COLUMN "fusionId" TEXT;
ALTER TABLE "DesignSession" ADD COLUMN "fusionId" TEXT;
ALTER TABLE "Artifact" ADD COLUMN "fusionId" TEXT;
