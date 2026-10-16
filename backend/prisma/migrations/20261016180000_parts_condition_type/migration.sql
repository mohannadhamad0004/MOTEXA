-- CreateEnum
CREATE TYPE "PartCondition" AS ENUM ('NEW', 'USED', 'REFURBISHED');

-- CreateEnum
CREATE TYPE "PartType" AS ENUM ('OEM', 'AFTERMARKET');

-- AlterTable (additive: existing products become NEW with no type)
ALTER TABLE "PartsProduct" ADD COLUMN "condition" "PartCondition" NOT NULL DEFAULT 'NEW',
ADD COLUMN "partType" "PartType";

-- CreateIndex
CREATE INDEX "PartsProduct_condition_idx" ON "PartsProduct"("condition");
