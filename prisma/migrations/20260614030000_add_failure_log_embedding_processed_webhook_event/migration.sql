-- CreateTable: FailureLog
CREATE TABLE "FailureLog" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "taskType" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "errorType" TEXT NOT NULL,
    "errorMessage" TEXT NOT NULL,
    "context" TEXT NOT NULL,
    "resolution" TEXT,
    "preventionHint" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FailureLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Embedding
CREATE TABLE "Embedding" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "chunkType" TEXT NOT NULL,
    "chunkName" TEXT,
    "startLine" INTEGER NOT NULL,
    "endLine" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "vector" BYTEA NOT NULL,
    "model" TEXT NOT NULL DEFAULT 'text-embedding-3-small',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Embedding_pkey" PRIMARY KEY ("id")
);

-- CreateTable: ProcessedWebhookEvent
CREATE TABLE "ProcessedWebhookEvent" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProcessedWebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FailureLog_taskType_modelId_idx" ON "FailureLog"("taskType", "modelId");

-- CreateIndex
CREATE INDEX "FailureLog_errorType_idx" ON "FailureLog"("errorType");

-- CreateIndex
CREATE INDEX "FailureLog_createdAt_idx" ON "FailureLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Embedding_projectId_filePath_startLine_key" ON "Embedding"("projectId", "filePath", "startLine");

-- CreateIndex
CREATE INDEX "Embedding_projectId_chunkType_idx" ON "Embedding"("projectId", "chunkType");

-- CreateIndex
CREATE INDEX "Embedding_projectId_filePath_idx" ON "Embedding"("projectId", "filePath");

-- CreateIndex
CREATE UNIQUE INDEX "ProcessedWebhookEvent_eventId_key" ON "ProcessedWebhookEvent"("eventId");

-- CreateIndex
CREATE INDEX "ProcessedWebhookEvent_source_idx" ON "ProcessedWebhookEvent"("source");

-- AddForeignKey
ALTER TABLE "Embedding" ADD CONSTRAINT "Embedding_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
