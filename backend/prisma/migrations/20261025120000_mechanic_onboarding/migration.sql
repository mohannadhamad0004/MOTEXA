-- AlterEnum
ALTER TYPE "MechanicVerificationStatus" ADD VALUE 'DRAFT';

-- AlterTable
ALTER TABLE "MechanicProfile" ADD COLUMN     "city" TEXT,
ADD COLUMN     "coverageAreas" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "experienceSummary" TEXT,
ADD COLUMN     "interviewNotes" TEXT,
ADD COLUMN     "interviewResult" TEXT,
ADD COLUMN     "interviewedAt" TIMESTAMP(3),
ADD COLUMN     "interviewedById" TEXT,
ADD COLUMN     "ministryStatus" TEXT NOT NULL DEFAULT 'NOT_REQUESTED',
ADD COLUMN     "submissionVersion" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "submittedAt" TIMESTAMP(3),
ADD COLUMN     "termsAcceptedAt" TIMESTAMP(3),
ADD COLUMN     "workshopAddress" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "emailVerifiedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "MechanicEmailCheck" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MechanicEmailCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MechanicDocument" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MechanicDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MechanicEmailCheck_userId_createdAt_idx" ON "MechanicEmailCheck"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "MechanicDocument_profileId_kind_key" ON "MechanicDocument"("profileId", "kind");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "MechanicEmailCheck" ADD CONSTRAINT "MechanicEmailCheck_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MechanicDocument" ADD CONSTRAINT "MechanicDocument_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "MechanicProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
