-- Multi-connection provider pool: priority ordering for Integration rows.
ALTER TABLE "Integration" ADD COLUMN "priority" INTEGER NOT NULL DEFAULT 100;
