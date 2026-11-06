-- Feature 2: shop accessories in 3D on the customer's car. Additive only: new enums/tables, one new column with a default.
-- CreateEnum
CREATE TYPE "AccessoryType" AS ENUM ('FRONT_BUMPER', 'REAR_BUMPER', 'SIDE_SKIRTS', 'FRONT_LIP', 'REAR_DIFFUSER', 'FENDER_FLARES', 'WING', 'SPOILER', 'ROOF_RACK', 'RIMS', 'MIRROR_COVERS');

-- CreateEnum
CREATE TYPE "Accessory3DStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'APPROVED_FOR_GENERATION', 'GENERATING', 'READY_FOR_FINAL_REVIEW', 'PUBLISHED', 'REJECTED');

ALTER TABLE "PartsShopProfile" ADD COLUMN     "accessory3dMonthlyCredits" INTEGER NOT NULL DEFAULT 5;




-- CreateTable
CREATE TABLE "ProductAccessory3D" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "accessoryType" "AccessoryType" NOT NULL,
    "widthMm" INTEGER,
    "heightMm" INTEGER,
    "depthMm" INTEGER,
    "lengthMm" INTEGER,
    "rimInches" DOUBLE PRECISION,
    "installedGenerationId" TEXT,
    "installed360" BOOLEAN NOT NULL DEFAULT false,
    "installedApprovedAt" TIMESTAMP(3),
    "status" "Accessory3DStatus" NOT NULL DEFAULT 'DRAFT',
    "revision" INTEGER NOT NULL DEFAULT 0,
    "creditsUsed" INTEGER NOT NULL DEFAULT 0,
    "submittedAt" TIMESTAMP(3),
    "reviewNotes" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewedByUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "approvedByUserId" TEXT,
    "provider" TEXT,
    "providerTaskId" TEXT,
    "providerState" TEXT,
    "providerProgress" INTEGER,
    "generationMode" TEXT,
    "generationStage" TEXT NOT NULL DEFAULT 'UPLOAD',
    "generationErrorCode" TEXT,
    "failureReason" TEXT,
    "leaseToken" TEXT,
    "leaseUntil" TIMESTAMP(3),
    "nextPollAt" TIMESTAMP(3),
    "liveAuthorizedAt" TIMESTAMP(3),
    "processingStartedAt" TIMESTAMP(3),
    "rawModelPath" TEXT,
    "privateModelPath" TEXT,
    "validation" JSONB,
    "preview" JSONB,
    "sourceMetadata" JSONB,
    "generationHistory" JSONB,
    "visualVerifiedAt" TIMESTAMP(3),
    "publishedFile" TEXT,
    "publishedAt" TIMESTAMP(3),
    "publishedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductAccessory3D_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductAccessory3DFit" (
    "accessoryId" TEXT NOT NULL,
    "generationId" TEXT NOT NULL,

    CONSTRAINT "ProductAccessory3DFit_pkey" PRIMARY KEY ("accessoryId","generationId")
);

-- CreateTable
CREATE TABLE "ProductAccessory3DPhoto" (
    "id" TEXT NOT NULL,
    "accessoryId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductAccessory3DPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccessoryFitZone" (
    "model3dKey" TEXT NOT NULL,
    "accessoryType" "AccessoryType" NOT NULL,
    "zone" JSONB NOT NULL,
    "updatedByUserId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccessoryFitZone_pkey" PRIMARY KEY ("model3dKey","accessoryType")
);

-- CreateTable
CREATE TABLE "AccessoryFitAdjust" (
    "userId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "adj" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccessoryFitAdjust_pkey" PRIMARY KEY ("userId","productId")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProductAccessory3D_productId_key" ON "ProductAccessory3D"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductAccessory3D_publishedFile_key" ON "ProductAccessory3D"("publishedFile");

-- CreateIndex
CREATE INDEX "ProductAccessory3D_shopId_idx" ON "ProductAccessory3D"("shopId");

-- CreateIndex
CREATE INDEX "ProductAccessory3D_job_due_idx" ON "ProductAccessory3D"("status", "nextPollAt", "leaseUntil");

-- CreateIndex
CREATE INDEX "ProductAccessory3DFit_generationId_idx" ON "ProductAccessory3DFit"("generationId");

-- CreateIndex
CREATE INDEX "ProductAccessory3DPhoto_accessoryId_kind_sortOrder_idx" ON "ProductAccessory3DPhoto"("accessoryId", "kind", "sortOrder");

-- AddForeignKey
ALTER TABLE "ProductAccessory3D" ADD CONSTRAINT "ProductAccessory3D_productId_fkey" FOREIGN KEY ("productId") REFERENCES "PartsProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductAccessory3DFit" ADD CONSTRAINT "ProductAccessory3DFit_accessoryId_fkey" FOREIGN KEY ("accessoryId") REFERENCES "ProductAccessory3D"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductAccessory3DFit" ADD CONSTRAINT "ProductAccessory3DFit_generationId_fkey" FOREIGN KEY ("generationId") REFERENCES "VehicleGeneration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductAccessory3DPhoto" ADD CONSTRAINT "ProductAccessory3DPhoto_accessoryId_fkey" FOREIGN KEY ("accessoryId") REFERENCES "ProductAccessory3D"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessoryFitAdjust" ADD CONSTRAINT "AccessoryFitAdjust_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessoryFitAdjust" ADD CONSTRAINT "AccessoryFitAdjust_productId_fkey" FOREIGN KEY ("productId") REFERENCES "PartsProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Photo kinds are a closed set.
ALTER TABLE "ProductAccessory3DPhoto" ADD CONSTRAINT "ProductAccessory3DPhoto_kind" CHECK ("kind" IN ('PART','INSTALLED'));

-- The front-bumper zone tuned in the body-kit fit test (docs/3d/bodykit-test/e36/VERDICT.md); admins can change it in /dept.
INSERT INTO "AccessoryFitZone" ("model3dKey","accessoryType","zone","updatedAt")
VALUES ('bmw-3-series-e36','FRONT_BUMPER','{"box":{"x":[0,1],"y":[0,0.34],"z":[0.905,1]}}',CURRENT_TIMESTAMP)
ON CONFLICT DO NOTHING;
