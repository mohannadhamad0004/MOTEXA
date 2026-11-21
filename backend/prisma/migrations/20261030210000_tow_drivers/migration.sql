-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'TOW_DRIVER';

-- AlterTable
ALTER TABLE "TowRequest" ADD COLUMN     "arrivedAt" TIMESTAMP(3),
ADD COLUMN     "driverId" TEXT,
ADD COLUMN     "requestedDriverId" TEXT;

-- CreateTable
CREATE TABLE "TowDriver" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "truckId" TEXT,
    "phone" TEXT NOT NULL,
    "offline" BOOLEAN NOT NULL DEFAULT false,
    "lastLat" DOUBLE PRECISION,
    "lastLng" DOUBLE PRECISION,
    "lastAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TowDriver_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TowDriver_userId_key" ON "TowDriver"("userId");

-- CreateIndex
CREATE INDEX "TowDriver_companyId_idx" ON "TowDriver"("companyId");

-- CreateIndex
CREATE INDEX "TowRequest_driverId_status_idx" ON "TowRequest"("driverId", "status");

-- AddForeignKey
ALTER TABLE "TowDriver" ADD CONSTRAINT "TowDriver_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TowDriver" ADD CONSTRAINT "TowDriver_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "TowCompanyProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TowDriver" ADD CONSTRAINT "TowDriver_truckId_fkey" FOREIGN KEY ("truckId") REFERENCES "Truck"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TowRequest" ADD CONSTRAINT "TowRequest_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "TowDriver"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TowRequest" ADD CONSTRAINT "TowRequest_requestedDriverId_fkey" FOREIGN KEY ("requestedDriverId") REFERENCES "TowDriver"("id") ON DELETE SET NULL ON UPDATE CASCADE;

