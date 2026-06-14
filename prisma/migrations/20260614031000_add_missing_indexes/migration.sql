-- CreateIndex
CREATE INDEX "Project_updatedAt_idx" ON "Project"("updatedAt");

-- CreateIndex
CREATE INDEX "AgentStep_agentRunId_createdAt_idx" ON "AgentStep"("agentRunId", "createdAt");

-- CreateIndex
CREATE INDEX "DesignVersion_sessionId_createdAt_idx" ON "DesignVersion"("sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "TerminalCommand_sessionId_createdAt_idx" ON "TerminalCommand"("sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "Embedding_projectId_createdAt_idx" ON "Embedding"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "ApiKey_userId_createdAt_idx" ON "ApiKey"("userId", "createdAt");
