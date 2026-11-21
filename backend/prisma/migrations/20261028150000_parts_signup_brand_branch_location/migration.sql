-- Additive only: optional brand / branch labels and the confirmed location's label + source for a parts shop (nullable, existing rows untouched).

-- AlterTable
ALTER TABLE "PartsShopProfile" ADD COLUMN     "brandName" TEXT,
ADD COLUMN     "branchName" TEXT,
ADD COLUMN     "locationAddress" TEXT,
ADD COLUMN     "locationSource" TEXT;
