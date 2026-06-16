-- NOTE: The "ProcessedWebhookEvent" TABLE is already created by the earlier
-- migration 20260614030000_add_failure_log_embedding_processed_webhook_event.
-- That migration did NOT create this table's indexes, so this migration adds
-- them. The previous version of this file re-issued `CREATE TABLE`, which made
-- `prisma migrate deploy` fail on a fresh database ("relation already exists").
-- The statements below are idempotent so deploy succeeds regardless of order.

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ProcessedWebhookEvent_source_eventId_key" ON "ProcessedWebhookEvent"("source", "eventId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ProcessedWebhookEvent_createdAt_idx" ON "ProcessedWebhookEvent"("createdAt");
