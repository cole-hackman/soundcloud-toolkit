-- AlterTable
-- Adds the OperationLog diagnostic columns introduced in schema.prisma
-- (soundcloudId, durationMs, errorCode, errorMessage, clientInfo) that were
-- never shipped as a migration, leaving production's operation_logs table on
-- the original schema. Any query touching these columns (GET /api/admin/stats,
-- GET /api/admin/operations) fails with "column does not exist" until this
-- runs against the target database.
ALTER TABLE "operation_logs"
  ADD COLUMN IF NOT EXISTS "soundcloudId" INTEGER,
  ADD COLUMN IF NOT EXISTS "durationMs" INTEGER,
  ADD COLUMN IF NOT EXISTS "errorCode" TEXT,
  ADD COLUMN IF NOT EXISTS "errorMessage" TEXT,
  ADD COLUMN IF NOT EXISTS "clientInfo" JSONB;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "operation_logs_soundcloudId_idx" ON "operation_logs"("soundcloudId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "operation_logs_status_idx" ON "operation_logs"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "operation_logs_soundcloudId_createdAt_idx" ON "operation_logs"("soundcloudId", "createdAt");
