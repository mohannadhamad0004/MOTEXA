-- Additive only: the computed auto-fit of an accessory on a vehicle generation (+ the Parts Admin's correction / approval).
CREATE TABLE "AccessoryAutoFit" (
    "accessoryId" TEXT NOT NULL,
    "generationId" TEXT NOT NULL,
    "model3dKey" TEXT NOT NULL,
    "carRevision" TEXT NOT NULL,
    "partRevision" TEXT NOT NULL,
    "fitVersion" INTEGER NOT NULL,
    "fit" JSONB NOT NULL,
    "adj" JSONB,
    "approvedAt" TIMESTAMP(3),
    "approvedByUserId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccessoryAutoFit_pkey" PRIMARY KEY ("accessoryId","generationId")
);
CREATE INDEX "AccessoryAutoFit_model3dKey_idx" ON "AccessoryAutoFit"("model3dKey");
ALTER TABLE "AccessoryAutoFit" ADD CONSTRAINT "AccessoryAutoFit_accessoryId_fkey" FOREIGN KEY ("accessoryId") REFERENCES "ProductAccessory3D"("id") ON DELETE CASCADE ON UPDATE CASCADE;
