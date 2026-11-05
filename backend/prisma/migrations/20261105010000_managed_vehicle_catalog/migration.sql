CREATE TABLE "VehicleBrand" (
 "id" TEXT PRIMARY KEY, "name" TEXT NOT NULL, "nameAr" TEXT NOT NULL,
 "normalizedName" TEXT NOT NULL UNIQUE, "aliases" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
 "isActive" BOOLEAN NOT NULL DEFAULT true, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE "Vehicle" ADD COLUMN "brandId" TEXT, ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true, ADD COLUMN "catalogNormalizedName" TEXT;
ALTER TABLE "VehicleGeneration" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true, ADD COLUMN "isPublished" BOOLEAN NOT NULL DEFAULT false, ADD COLUMN "catalogNormalizedCode" TEXT;
INSERT INTO "VehicleBrand" ("id","name","nameAr","normalizedName","aliases")
 SELECT 'brand-'||md5("makeNormalized"), CASE WHEN "makeNormalized"='mercedes' THEN 'Mercedes-Benz' ELSE min("make") END,
 min("makeAr"), regexp_replace("makeNormalized",'[^a-z0-9]','','g'),
 CASE WHEN "makeNormalized"='mercedes' THEN ARRAY['mercedes','mercedesbenz'] ELSE ARRAY[regexp_replace("makeNormalized",'[^a-z0-9]','','g')] END
 FROM "Vehicle" GROUP BY "makeNormalized";
UPDATE "Vehicle" SET "brandId"='brand-'||md5("makeNormalized"), "catalogNormalizedName"=regexp_replace(lower("model"),'[^a-z0-9]','','g');
UPDATE "VehicleGeneration" SET "catalogNormalizedCode"=regexp_replace(lower("code"),'[^a-z0-9]','','g'), "isPublished"=("model3dKey" IS NOT NULL);
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "VehicleBrand"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE UNIQUE INDEX "Vehicle_brandId_catalogNormalizedName_key" ON "Vehicle"("brandId","catalogNormalizedName");
CREATE UNIQUE INDEX "VehicleGeneration_vehicleId_catalogNormalizedCode_key" ON "VehicleGeneration"("vehicleId","catalogNormalizedCode");
ALTER TABLE "Vehicle3DSubmission" ADD COLUMN "initialApprovedAt" TIMESTAMP(3), ADD COLUMN "initialApprovedByUserId" TEXT;
CREATE TABLE "VehicleCatalogRequest" (
 "id" TEXT PRIMARY KEY, "submissionId" TEXT NOT NULL UNIQUE REFERENCES "Vehicle3DSubmission"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "requestedMake" TEXT NOT NULL,"requestedModel" TEXT NOT NULL,"requestedYear" INTEGER NOT NULL,"requestedGeneration" TEXT,"trim" TEXT,"notes" TEXT,
 "reviewState" TEXT NOT NULL DEFAULT 'DRAFT',"reviewNotes" TEXT,"reviewedByUserId" TEXT,"reviewedAt" TIMESTAMP(3),"submittedAt" TIMESTAMP(3),"consentAt" TIMESTAMP(3),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "VehicleCatalogRequest_review_state" CHECK ("reviewState" IN ('DRAFT','PENDING_REVIEW','APPROVED','REJECTED'))
);
CREATE INDEX "VehicleCatalogRequest_reviewState_submittedAt_idx" ON "VehicleCatalogRequest"("reviewState","submittedAt");
CREATE TABLE "Vehicle3DImport" (
 "id" TEXT PRIMARY KEY,"generationId" TEXT NOT NULL REFERENCES "VehicleGeneration"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "uploadedByUserId" TEXT NOT NULL,"status" TEXT NOT NULL DEFAULT 'DRAFT',"rawModelPath" TEXT NOT NULL,"privateModelPath" TEXT,"viewerConfig" JSONB,"validation" JSONB,
 "source" TEXT NOT NULL,"author" TEXT NOT NULL,"license" TEXT NOT NULL,"sourceUrl" TEXT,"reviewNotes" TEXT,"publishedModel3dKey" TEXT UNIQUE,"visuallyVerifiedAt" TIMESTAMP(3),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "Vehicle3DImport_status" CHECK ("status" IN ('DRAFT','READY','FAILED','PUBLISHED'))
);
