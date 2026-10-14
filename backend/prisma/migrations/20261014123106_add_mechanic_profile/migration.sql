-- CreateEnum
CREATE TYPE "MechanicVerificationStatus" AS ENUM ('PENDING', 'NEEDS_COMPLETION', 'VERIFIED', 'REJECTED', 'SUSPENDED');

-- CreateTable
CREATE TABLE "MechanicProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "phoneNumber" TEXT,
    "nationalId" TEXT,
    "nationalIdDocumentUrl" TEXT,
    "licenseDocumentUrl" TEXT,
    "certificateUrl" TEXT,
    "yearsOfExperience" INTEGER,
    "workshopName" TEXT,
    "specializations" TEXT[],
    "offersOnSite" BOOLEAN NOT NULL DEFAULT false,
    "offersWorkshop" BOOLEAN NOT NULL DEFAULT false,
    "offersOnline" BOOLEAN NOT NULL DEFAULT false,
    "verificationStatus" "MechanicVerificationStatus" NOT NULL DEFAULT 'PENDING',
    "reviewNotes" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MechanicProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MechanicProfile_userId_key" ON "MechanicProfile"("userId");

-- CreateIndex
CREATE INDEX "MechanicProfile_verificationStatus_idx" ON "MechanicProfile"("verificationStatus");

-- AddForeignKey
ALTER TABLE "MechanicProfile" ADD CONSTRAINT "MechanicProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
