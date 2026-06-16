-- Simplify Fusion to a lightweight orchestration layer.
-- Drop the over-built hub tables; keep FusionRouting, FusionJudge, FusionRequestLog.

DROP TABLE IF EXISTS "FusionModel" CASCADE;
DROP TABLE IF EXISTS "FusionProvider" CASCADE;
DROP TABLE IF EXISTS "FusionTeam" CASCADE;
DROP TABLE IF EXISTS "FusionMcpServer" CASCADE;
DROP TABLE IF EXISTS "FusionWorkflow" CASCADE;
DROP TABLE IF EXISTS "FusionSettings" CASCADE;
DROP TABLE IF EXISTS "FusionProfile" CASCADE;

-- RequestLog no longer references profiles.
ALTER TABLE "FusionRequestLog" DROP COLUMN IF EXISTS "profileId";
