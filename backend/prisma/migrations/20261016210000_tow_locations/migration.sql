-- AlterTable (additive: all new columns are nullable)
ALTER TABLE "TowCompanyProfile" ADD COLUMN "baseLat" DOUBLE PRECISION,
ADD COLUMN "baseLng" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "TowRequest" ADD COLUMN "dropoffLat" DOUBLE PRECISION,
ADD COLUMN "dropoffLng" DOUBLE PRECISION,
ADD COLUMN "pickupLat" DOUBLE PRECISION,
ADD COLUMN "pickupLng" DOUBLE PRECISION;
