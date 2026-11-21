-- CreateEnum
CREATE TYPE "PartInquiryStatus" AS ENUM ('OPEN', 'ANSWERED', 'CLOSED');

-- CreateEnum
CREATE TYPE "TowRequestStatus" AS ENUM ('REQUESTED', 'ACCEPTED', 'DECLINED', 'EN_ROUTE', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TowCancelledBy" AS ENUM ('CUSTOMER', 'COMPANY');

-- CreateTable
CREATE TABLE "PartInquiry" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "productId" TEXT,
    "productName" TEXT NOT NULL,
    "productPartNumber" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "status" "PartInquiryStatus" NOT NULL DEFAULT 'OPEN',
    "closedAt" TIMESTAMP(3),
    "closedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartInquiry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartInquiryMessage" (
    "id" TEXT NOT NULL,
    "inquiryId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartInquiryMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TowRequest" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "assignedTruckId" TEXT,
    "assignedTruckType" "TruckType",
    "assignedTruckMake" TEXT,
    "assignedTruckModel" TEXT,
    "assignedTruckYear" INTEGER,
    "pickupAddress" TEXT NOT NULL,
    "dropoffAddress" TEXT NOT NULL,
    "contactPhone" TEXT NOT NULL,
    "vehicleMake" TEXT NOT NULL,
    "vehicleModel" TEXT NOT NULL,
    "vehicleYear" INTEGER,
    "notes" TEXT,
    "status" "TowRequestStatus" NOT NULL DEFAULT 'REQUESTED',
    "declineReason" TEXT,
    "cancelReason" TEXT,
    "cancelledBy" "TowCancelledBy",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMP(3),
    "declinedAt" TIMESTAMP(3),
    "enRouteAt" TIMESTAMP(3),
    "inProgressAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TowRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PartInquiry_customerId_status_idx" ON "PartInquiry"("customerId", "status");

-- CreateIndex
CREATE INDEX "PartInquiry_shopId_status_idx" ON "PartInquiry"("shopId", "status");

-- CreateIndex
CREATE INDEX "PartInquiryMessage_inquiryId_createdAt_idx" ON "PartInquiryMessage"("inquiryId", "createdAt");

-- CreateIndex
CREATE INDEX "TowRequest_customerId_status_idx" ON "TowRequest"("customerId", "status");

-- CreateIndex
CREATE INDEX "TowRequest_companyId_status_idx" ON "TowRequest"("companyId", "status");

-- CreateIndex
CREATE INDEX "TowRequest_assignedTruckId_idx" ON "TowRequest"("assignedTruckId");

-- AddForeignKey
ALTER TABLE "PartInquiry" ADD CONSTRAINT "PartInquiry_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartInquiry" ADD CONSTRAINT "PartInquiry_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "PartsShopProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartInquiry" ADD CONSTRAINT "PartInquiry_productId_fkey" FOREIGN KEY ("productId") REFERENCES "PartsProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartInquiryMessage" ADD CONSTRAINT "PartInquiryMessage_inquiryId_fkey" FOREIGN KEY ("inquiryId") REFERENCES "PartInquiry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartInquiryMessage" ADD CONSTRAINT "PartInquiryMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TowRequest" ADD CONSTRAINT "TowRequest_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TowRequest" ADD CONSTRAINT "TowRequest_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "TowCompanyProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TowRequest" ADD CONSTRAINT "TowRequest_assignedTruckId_fkey" FOREIGN KEY ("assignedTruckId") REFERENCES "Truck"("id") ON DELETE SET NULL ON UPDATE CASCADE;
