CREATE TABLE "ProviderMedia" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "ownerUserId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "towCompanyId" TEXT REFERENCES "TowCompanyProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "truckId" TEXT REFERENCES "Truck"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "partsShopId" TEXT REFERENCES "PartsShopProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "slot" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "storageKey" TEXT NOT NULL UNIQUE,
  "sha256" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProviderMedia_one_target" CHECK (num_nonnulls("towCompanyId", "truckId", "partsShopId") = 1),
  CONSTRAINT "ProviderMedia_slot" CHECK ("slot" IN ('PROFILE', 'COVER', 'GALLERY', 'VIDEO'))
);
CREATE INDEX "ProviderMedia_ownerUserId_idx" ON "ProviderMedia"("ownerUserId");
CREATE INDEX "ProviderMedia_towCompanyId_idx" ON "ProviderMedia"("towCompanyId");
CREATE INDEX "ProviderMedia_truckId_idx" ON "ProviderMedia"("truckId");
CREATE INDEX "ProviderMedia_partsShopId_idx" ON "ProviderMedia"("partsShopId");
