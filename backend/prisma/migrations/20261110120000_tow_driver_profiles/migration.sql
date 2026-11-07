-- Additive only.
ALTER TYPE "ProviderFilePurpose" ADD VALUE 'DRIVER_PHOTO';
ALTER TYPE "ProviderFilePurpose" ADD VALUE 'DRIVER_LICENCE';

CREATE TYPE "TowDriverApproval" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED');
CREATE TYPE "TowChoice" AS ENUM ('NEAREST', 'COMPANY', 'DRIVER');

ALTER TABLE "ProviderFile" ADD COLUMN "towDriverId" TEXT;
ALTER TABLE "TowDriver" ADD COLUMN "licenceNumber" TEXT,
ADD COLUMN "approval" "TowDriverApproval" NOT NULL DEFAULT 'PENDING',
ADD COLUMN "approvalReason" TEXT,
ADD COLUMN "reviewedById" TEXT,
ADD COLUMN "reviewedAt" TIMESTAMP(3);
-- drivers that existed before this review step keep working
UPDATE "TowDriver" SET "approval" = 'APPROVED';

ALTER TABLE "TowRequest" ADD COLUMN "loadingAt" TIMESTAMP(3),
ADD COLUMN "deliveredAt" TIMESTAMP(3),
ADD COLUMN "choiceMode" "TowChoice";

CREATE TABLE "TowReview" (
  "id" TEXT NOT NULL, "requestId" TEXT NOT NULL, "customerId" TEXT NOT NULL, "driverId" TEXT NOT NULL, "companyId" TEXT NOT NULL,
  "stars" INTEGER NOT NULL, "comment" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TowReview_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "TowReview_requestId_key" ON "TowReview"("requestId");
CREATE INDEX "TowReview_driverId_idx" ON "TowReview"("driverId");
CREATE INDEX "TowReview_companyId_idx" ON "TowReview"("companyId");

CREATE TABLE "TowRequestMessage" (
  "id" TEXT NOT NULL, "requestId" TEXT NOT NULL, "authorUserId" TEXT NOT NULL, "body" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TowRequestMessage_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "TowRequestMessage_requestId_createdAt_idx" ON "TowRequestMessage"("requestId", "createdAt");

CREATE TABLE "TowReport" (
  "id" TEXT NOT NULL, "requestId" TEXT NOT NULL, "reporterId" TEXT NOT NULL, "body" TEXT NOT NULL,
  "closedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TowReport_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "TowReport_requestId_idx" ON "TowReport"("requestId");

ALTER TABLE "ProviderFile" ADD CONSTRAINT "ProviderFile_towDriverId_fkey" FOREIGN KEY ("towDriverId") REFERENCES "TowDriver"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TowReview" ADD CONSTRAINT "TowReview_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "TowRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TowReview" ADD CONSTRAINT "TowReview_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "TowDriver"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TowRequestMessage" ADD CONSTRAINT "TowRequestMessage_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "TowRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TowReport" ADD CONSTRAINT "TowReport_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "TowRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
