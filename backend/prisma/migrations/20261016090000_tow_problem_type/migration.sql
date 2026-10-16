-- CreateEnum
CREATE TYPE "TowProblemType" AS ENUM ('WONT_START', 'ACCIDENT', 'FLAT_TIRE', 'OVERHEATING', 'OUT_OF_FUEL', 'OTHER');

-- AlterTable (additive: existing rows get OTHER)
ALTER TABLE "TowRequest" ADD COLUMN "problemType" "TowProblemType" NOT NULL DEFAULT 'OTHER';
