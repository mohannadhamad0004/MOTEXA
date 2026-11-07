-- Additive extension of the existing import workflow. Legacy/manual imports remain unchanged.
ALTER TABLE "Vehicle3DImport"
  ADD COLUMN "sourceProvider" TEXT,
  ADD COLUMN "sourceUid" TEXT,
  ADD COLUMN "sourceMetadata" JSONB,
  ADD COLUMN "errorCode" TEXT,
  ADD COLUMN "leaseToken" TEXT,
  ADD COLUMN "leaseUntil" TIMESTAMP(3),
  ADD COLUMN "queuedAt" TIMESTAMP(3),
  ADD COLUMN "finishedAt" TIMESTAMP(3);
CREATE UNIQUE INDEX "Vehicle3DImport_sourceUid_key" ON "Vehicle3DImport"("sourceUid");
CREATE INDEX "Vehicle3DImport_status_leaseUntil_idx" ON "Vehicle3DImport"("status", "leaseUntil");
