-- CreateTable
CREATE TABLE "PartsShopProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "shopName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "address" TEXT,
    "licenceNumber" TEXT,
    "verificationStatus" "ProviderVerificationStatus" NOT NULL DEFAULT 'PENDING',
    "rejectionReason" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartsShopProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartsProduct" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "partNumber" TEXT NOT NULL,
    "partNumberNormalized" TEXT NOT NULL,
    "description" TEXT,
    "price" DECIMAL(12,2) NOT NULL,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "isHidden" BOOLEAN NOT NULL DEFAULT false,
    "hiddenReason" TEXT,
    "hiddenById" TEXT,
    "hiddenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartsProduct_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PartsShopProfile_userId_key" ON "PartsShopProfile"("userId");

-- CreateIndex
CREATE INDEX "PartsProduct_shopId_idx" ON "PartsProduct"("shopId");

-- CreateIndex
CREATE INDEX "PartsProduct_partNumberNormalized_idx" ON "PartsProduct"("partNumberNormalized");

-- AddForeignKey
ALTER TABLE "PartsShopProfile" ADD CONSTRAINT "PartsShopProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartsProduct" ADD CONSTRAINT "PartsProduct_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "PartsShopProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
