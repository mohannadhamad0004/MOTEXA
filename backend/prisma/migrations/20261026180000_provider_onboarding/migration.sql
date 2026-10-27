
-- CreateEnum
CREATE TYPE "ProviderDocStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ProviderMessageAuthor" AS ENUM ('PROVIDER', 'ADMIN', 'SYSTEM');

-- AlterEnum
ALTER TYPE "ProviderFilePurpose" ADD VALUE 'MESSAGE_ATTACHMENT';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ProviderVerificationStatus" ADD VALUE 'DRAFT';
ALTER TYPE "ProviderVerificationStatus" ADD VALUE 'NEEDS_CHANGES';

-- AlterTable
ALTER TABLE "PartsShopProfile" ADD COLUMN     "baseLat" DOUBLE PRECISION,
ADD COLUMN     "baseLng" DOUBLE PRECISION,
ADD COLUMN     "brands" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "categories" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "flaggedFields" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "ownerName" TEXT,
ADD COLUMN     "shopNameAr" TEXT,
ADD COLUMN     "submissionVersion" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "submittedAt" TIMESTAMP(3),
ADD COLUMN     "workingHours" TEXT;

-- AlterTable
ALTER TABLE "ProviderFile" ADD COLUMN     "docKind" TEXT,
ADD COLUMN     "messageId" TEXT,
ADD COLUMN     "reviewReason" TEXT,
ADD COLUMN     "reviewStatus" "ProviderDocStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "reviewedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "TowCompanyProfile" ADD COLUMN     "companyNameAr" TEXT,
ADD COLUMN     "flaggedFields" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "open24h" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "ownerName" TEXT,
ADD COLUMN     "submissionVersion" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "submittedAt" TIMESTAMP(3),
ADD COLUMN     "truckCountClaimed" INTEGER,
ADD COLUMN     "truckTypes" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "ProviderMessage" (
    "id" TEXT NOT NULL,
    "towCompanyId" TEXT,
    "partsShopId" TEXT,
    "authorUserId" TEXT,
    "authorRole" "ProviderMessageAuthor" NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readByProviderAt" TIMESTAMP(3),
    "readByAdminAt" TIMESTAMP(3),

    CONSTRAINT "ProviderMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProviderMessage_towCompanyId_createdAt_idx" ON "ProviderMessage"("towCompanyId", "createdAt");

-- CreateIndex
CREATE INDEX "ProviderMessage_partsShopId_createdAt_idx" ON "ProviderMessage"("partsShopId", "createdAt");

-- AddForeignKey
ALTER TABLE "ProviderFile" ADD CONSTRAINT "ProviderFile_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "ProviderMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderMessage" ADD CONSTRAINT "ProviderMessage_towCompanyId_fkey" FOREIGN KEY ("towCompanyId") REFERENCES "TowCompanyProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderMessage" ADD CONSTRAINT "ProviderMessage_partsShopId_fkey" FOREIGN KEY ("partsShopId") REFERENCES "PartsShopProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderMessage" ADD CONSTRAINT "ProviderMessage_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

