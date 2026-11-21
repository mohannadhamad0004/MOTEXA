CREATE TABLE "Vehicle3DRevision" (
  "key" TEXT NOT NULL PRIMARY KEY,
  "generationId" TEXT NOT NULL,
  "revision" INTEGER NOT NULL DEFAULT 1,
  "sha256" TEXT NOT NULL,
  "bytes" INTEGER NOT NULL,
  "viewerConfig" JSONB NOT NULL,
  "metadata" JSONB NOT NULL,
  "importId" TEXT,
  "submissionId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Vehicle3DRevision_generationId_fkey" FOREIGN KEY ("generationId") REFERENCES "VehicleGeneration"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "Vehicle3DRevision_generationId_idx" ON "Vehicle3DRevision"("generationId");
ALTER TABLE "ProductAccessory3D" ADD COLUMN "fitmentNotes" TEXT;
ALTER TABLE "ProductAccessory3D" ADD COLUMN "deactivatedAt" TIMESTAMP(3);
