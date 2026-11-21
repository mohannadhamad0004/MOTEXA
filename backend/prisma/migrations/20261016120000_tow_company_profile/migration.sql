-- AlterTable (additive)
ALTER TABLE "TowCompanyProfile" ADD COLUMN "description" TEXT,
ADD COLUMN "serviceCities" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "workingHours" TEXT;

-- AlterTable
ALTER TABLE "Truck" ADD COLUMN "maxWeightKg" INTEGER;
