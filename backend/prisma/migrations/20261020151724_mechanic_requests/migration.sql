-- CreateEnum
CREATE TYPE "MechanicRequestStatus" AS ENUM ('REQUESTED', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'DECLINED', 'CANCELLED');

-- CreateTable
CREATE TABLE "MechanicRequest" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "mechanicUserId" TEXT NOT NULL,
    "skill" TEXT,
    "carMake" TEXT NOT NULL,
    "carModel" TEXT NOT NULL,
    "carYear" INTEGER,
    "problemDescription" TEXT NOT NULL,
    "preferredTime" TEXT,
    "locationText" TEXT NOT NULL,
    "locationLat" DOUBLE PRECISION,
    "locationLng" DOUBLE PRECISION,
    "contactPhone" TEXT,
    "status" "MechanicRequestStatus" NOT NULL DEFAULT 'REQUESTED',
    "declineReason" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMP(3),
    "declinedAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MechanicRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MechanicRequest_customerId_status_idx" ON "MechanicRequest"("customerId", "status");

-- CreateIndex
CREATE INDEX "MechanicRequest_mechanicUserId_status_idx" ON "MechanicRequest"("mechanicUserId", "status");

-- AddForeignKey
ALTER TABLE "MechanicRequest" ADD CONSTRAINT "MechanicRequest_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MechanicRequest" ADD CONSTRAINT "MechanicRequest_mechanicUserId_fkey" FOREIGN KEY ("mechanicUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
