-- Additive only: a new truck document purpose and per-truck location columns (all nullable, so existing rows are untouched).

-- AlterEnum
ALTER TYPE "ProviderFilePurpose" ADD VALUE 'TRUCK_OPERATING_LICENSE';

-- AlterTable
ALTER TABLE "Truck" ADD COLUMN     "baseLat" DOUBLE PRECISION,
ADD COLUMN     "baseLng" DOUBLE PRECISION,
ADD COLUMN     "locationAddress" TEXT,
ADD COLUMN     "locationSource" TEXT;
