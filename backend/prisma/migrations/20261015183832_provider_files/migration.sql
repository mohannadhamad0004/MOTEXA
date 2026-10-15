-- CreateEnum
CREATE TYPE "ProviderFilePurpose" AS ENUM ('TRUCK_PHOTO', 'TRUCK_REGISTRATION', 'TRUCK_INSURANCE', 'TOW_COMPANY_DOCUMENT', 'PRODUCT_IMAGE', 'PARTS_SHOP_DOCUMENT');

-- CreateEnum
CREATE TYPE "ProviderFileVisibility" AS ENUM ('PUBLIC', 'PRIVATE');

-- CreateTable
CREATE TABLE "ProviderFile" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "purpose" "ProviderFilePurpose" NOT NULL,
    "visibility" "ProviderFileVisibility" NOT NULL,
    "truckId" TEXT,
    "towCompanyId" TEXT,
    "productId" TEXT,
    "partsShopId" TEXT,
    "label" TEXT,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProviderFile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProviderFile_storageKey_key" ON "ProviderFile"("storageKey");

-- CreateIndex
CREATE INDEX "ProviderFile_ownerUserId_idx" ON "ProviderFile"("ownerUserId");

-- CreateIndex
CREATE INDEX "ProviderFile_towCompanyId_idx" ON "ProviderFile"("towCompanyId");

-- CreateIndex
CREATE INDEX "ProviderFile_partsShopId_idx" ON "ProviderFile"("partsShopId");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderFile_truckId_purpose_key" ON "ProviderFile"("truckId", "purpose");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderFile_productId_purpose_key" ON "ProviderFile"("productId", "purpose");

-- AddForeignKey
ALTER TABLE "ProviderFile" ADD CONSTRAINT "ProviderFile_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderFile" ADD CONSTRAINT "ProviderFile_truckId_fkey" FOREIGN KEY ("truckId") REFERENCES "Truck"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderFile" ADD CONSTRAINT "ProviderFile_towCompanyId_fkey" FOREIGN KEY ("towCompanyId") REFERENCES "TowCompanyProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderFile" ADD CONSTRAINT "ProviderFile_productId_fkey" FOREIGN KEY ("productId") REFERENCES "PartsProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderFile" ADD CONSTRAINT "ProviderFile_partsShopId_fkey" FOREIGN KEY ("partsShopId") REFERENCES "PartsShopProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
