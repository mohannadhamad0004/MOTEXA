-- Retain the original Vehicle3DImport_status CHECK unchanged.
ALTER TABLE "Vehicle3DImport" ADD COLUMN "importStage" TEXT;
CREATE INDEX "Vehicle3DImport_importStage_leaseUntil_idx" ON "Vehicle3DImport"("importStage", "leaseUntil");
