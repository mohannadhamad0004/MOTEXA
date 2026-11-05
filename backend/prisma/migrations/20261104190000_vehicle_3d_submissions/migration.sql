CREATE TYPE "Vehicle3DSubmissionStatus" AS ENUM ('DRAFT', 'PROCESSING', 'READY', 'SUBMITTED', 'APPROVED', 'REJECTED', 'FAILED');
CREATE TABLE "Vehicle3DSubmission" (
 "id" TEXT NOT NULL,
 "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "garageCarId" TEXT NOT NULL REFERENCES "CustomerGarageCar"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "make" TEXT NOT NULL, "model" TEXT NOT NULL,
 "generationId" TEXT REFERENCES "VehicleGeneration"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "generationName" TEXT NOT NULL, "year" INTEGER NOT NULL,
 "frontPhotoPath" TEXT, "rearPhotoPath" TEXT, "leftPhotoPath" TEXT, "rightPhotoPath" TEXT,
 "privateModelPath" TEXT,
 "status" "Vehicle3DSubmissionStatus" NOT NULL DEFAULT 'DRAFT',
 "reviewNotes" TEXT, "submittedAt" TIMESTAMP(3), "reviewedAt" TIMESTAMP(3),
 "reviewedByUserId" TEXT REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "approvedModel3dKey" TEXT, "providerTaskId" TEXT, "generationMode" TEXT, "failureReason" TEXT,
 "validation" JSONB, "sourceMetadata" JSONB, "lengthM" DOUBLE PRECISION NOT NULL DEFAULT 4.5,
 "deletedAt" TIMESTAMP(3), "processingStartedAt" TIMESTAMP(3),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "Vehicle3DSubmission_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "Vehicle3DSubmission_length_check" CHECK ("lengthM" BETWEEN 2.5 AND 8),
 CONSTRAINT "Vehicle3DSubmission_year_check" CHECK ("year" BETWEEN 1900 AND 2100)
);
CREATE UNIQUE INDEX "Vehicle3DSubmission_approvedModel3dKey_key" ON "Vehicle3DSubmission"("approvedModel3dKey");
CREATE INDEX "Vehicle3DSubmission_userId_createdAt_idx" ON "Vehicle3DSubmission"("userId", "createdAt");
CREATE INDEX "Vehicle3DSubmission_garageCarId_createdAt_idx" ON "Vehicle3DSubmission"("garageCarId", "createdAt");
CREATE INDEX "Vehicle3DSubmission_status_submittedAt_idx" ON "Vehicle3DSubmission"("status", "submittedAt");
CREATE UNIQUE INDEX "Vehicle3DSubmission_one_open_per_car" ON "Vehicle3DSubmission"("garageCarId") WHERE "deletedAt" IS NULL AND "status" IN ('DRAFT','PROCESSING','READY','SUBMITTED');
