-- Mechanics like tow (additive): garages (GARAGE_OWNER, GarageProfile, GarageMechanic), on-site steps EN_ROUTE / ARRIVED, the request's
-- service mode, the mechanic's live point + job trail, garage links on ProviderFile / ProviderMessage. The one constraint change was
-- approved: MechanicRequest.mechanicUserId becomes nullable (a request to a garage waits for the owner to assign a mechanic).
-- CreateEnum
CREATE TYPE "MechanicServiceMode" AS ENUM ('ON_SITE', 'WORKSHOP');

-- CreateEnum
CREATE TYPE "GarageMechanicApproval" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "MechanicRequestStatus" ADD VALUE 'EN_ROUTE';
ALTER TYPE "MechanicRequestStatus" ADD VALUE 'ARRIVED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ProviderFilePurpose" ADD VALUE 'GARAGE_DOCUMENT';
ALTER TYPE "ProviderFilePurpose" ADD VALUE 'GARAGE_MECHANIC_PHOTO';
ALTER TYPE "ProviderFilePurpose" ADD VALUE 'GARAGE_MECHANIC_ID';

-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'GARAGE_OWNER';

-- AlterTable
ALTER TABLE "MechanicRequest" ADD COLUMN     "arrivedAt" TIMESTAMP(3),
ADD COLUMN     "assignedAt" TIMESTAMP(3),
ADD COLUMN     "enRouteAt" TIMESTAMP(3),
ADD COLUMN     "garageId" TEXT,
ADD COLUMN     "liveAt" TIMESTAMP(3),
ADD COLUMN     "liveLat" DOUBLE PRECISION,
ADD COLUMN     "liveLng" DOUBLE PRECISION,
ADD COLUMN     "serviceMode" "MechanicServiceMode",
ALTER COLUMN "mechanicUserId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "ProviderFile" ADD COLUMN     "garageId" TEXT,
ADD COLUMN     "garageMechanicId" TEXT;

-- AlterTable
ALTER TABLE "ProviderMessage" ADD COLUMN     "garageId" TEXT;

-- CreateTable
CREATE TABLE "MechanicJobTrail" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MechanicJobTrail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GarageProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "garageName" TEXT NOT NULL,
    "garageNameAr" TEXT,
    "ownerName" TEXT,
    "phone" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "address" TEXT,
    "description" TEXT,
    "workingHours" TEXT,
    "open24h" BOOLEAN NOT NULL DEFAULT false,
    "services" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "baseLat" DOUBLE PRECISION,
    "baseLng" DOUBLE PRECISION,
    "verificationStatus" "ProviderVerificationStatus" NOT NULL DEFAULT 'PENDING',
    "rejectionReason" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "submissionVersion" INTEGER NOT NULL DEFAULT 0,
    "flaggedFields" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GarageProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GarageMechanic" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "garageId" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "skills" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "offline" BOOLEAN NOT NULL DEFAULT true,
    "approval" "GarageMechanicApproval" NOT NULL DEFAULT 'PENDING',
    "approvalReason" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "lastLat" DOUBLE PRECISION,
    "lastLng" DOUBLE PRECISION,
    "lastAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GarageMechanic_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MechanicJobTrail_requestId_at_idx" ON "MechanicJobTrail"("requestId", "at");

-- CreateIndex
CREATE UNIQUE INDEX "GarageProfile_userId_key" ON "GarageProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "GarageMechanic_userId_key" ON "GarageMechanic"("userId");

-- CreateIndex
CREATE INDEX "GarageMechanic_garageId_idx" ON "GarageMechanic"("garageId");

-- CreateIndex
CREATE INDEX "MechanicRequest_garageId_status_idx" ON "MechanicRequest"("garageId", "status");

-- CreateIndex
CREATE INDEX "ProviderFile_garageId_idx" ON "ProviderFile"("garageId");

-- CreateIndex
CREATE INDEX "ProviderMessage_garageId_createdAt_idx" ON "ProviderMessage"("garageId", "createdAt");

-- AddForeignKey
ALTER TABLE "ProviderFile" ADD CONSTRAINT "ProviderFile_garageId_fkey" FOREIGN KEY ("garageId") REFERENCES "GarageProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderFile" ADD CONSTRAINT "ProviderFile_garageMechanicId_fkey" FOREIGN KEY ("garageMechanicId") REFERENCES "GarageMechanic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderMessage" ADD CONSTRAINT "ProviderMessage_garageId_fkey" FOREIGN KEY ("garageId") REFERENCES "GarageProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MechanicRequest" ADD CONSTRAINT "MechanicRequest_garageId_fkey" FOREIGN KEY ("garageId") REFERENCES "GarageProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MechanicJobTrail" ADD CONSTRAINT "MechanicJobTrail_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "MechanicRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GarageProfile" ADD CONSTRAINT "GarageProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GarageMechanic" ADD CONSTRAINT "GarageMechanic_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GarageMechanic" ADD CONSTRAINT "GarageMechanic_garageId_fkey" FOREIGN KEY ("garageId") REFERENCES "GarageProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

