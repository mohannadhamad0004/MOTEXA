-- CreateEnum
CREATE TYPE "PartsOrderStatus" AS ENUM ('PLACED', 'ACCEPTED', 'PREPARING', 'READY_FOR_PICKUP', 'OUT_FOR_DELIVERY', 'PICKED_UP', 'DELIVERED', 'CANCELLED', 'REJECTED');

-- CreateEnum
CREATE TYPE "PartsFulfilment" AS ENUM ('PICKUP', 'DELIVERY');

-- CreateEnum
CREATE TYPE "PartsPayment" AS ENUM ('CASH_ON_DELIVERY', 'PAY_AT_SHOP');

-- AlterTable
ALTER TABLE "PartsProduct" ADD COLUMN     "reservedStock" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "PartsShopProfile" ADD COLUMN     "deliveryAreaNote" TEXT,
ADD COLUMN     "deliveryEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "deliveryFee" DECIMAL(12,2);

-- CreateTable
CREATE TABLE "PartsOrder" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "fulfilment" "PartsFulfilment" NOT NULL,
    "payment" "PartsPayment" NOT NULL,
    "status" "PartsOrderStatus" NOT NULL DEFAULT 'PLACED',
    "subtotal" DECIMAL(12,2) NOT NULL,
    "deliveryFee" DECIMAL(12,2),
    "total" DECIMAL(12,2) NOT NULL,
    "deliveryLat" DOUBLE PRECISION,
    "deliveryLng" DOUBLE PRECISION,
    "deliveryArea" TEXT,
    "deliveryNote" TEXT,
    "rejectReason" TEXT,
    "cancelReason" TEXT,
    "cancelledBy" TEXT,
    "stockReserved" BOOLEAN NOT NULL DEFAULT false,
    "courierLat" DOUBLE PRECISION,
    "courierLng" DOUBLE PRECISION,
    "courierAt" TIMESTAMP(3),
    "customerReadAt" TIMESTAMP(3),
    "shopReadAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMP(3),
    "preparingAt" TIMESTAMP(3),
    "readyAt" TIMESTAMP(3),
    "outAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartsOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartsOrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT,
    "name" TEXT NOT NULL,
    "partNumber" TEXT NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "PartsOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartsOrderMessage" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "senderId" TEXT,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartsOrderMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PartsOrder_customerId_status_idx" ON "PartsOrder"("customerId", "status");

-- CreateIndex
CREATE INDEX "PartsOrder_shopId_status_idx" ON "PartsOrder"("shopId", "status");

-- CreateIndex
CREATE INDEX "PartsOrder_status_idx" ON "PartsOrder"("status");

-- CreateIndex
CREATE INDEX "PartsOrderItem_orderId_idx" ON "PartsOrderItem"("orderId");

-- CreateIndex
CREATE INDEX "PartsOrderItem_productId_idx" ON "PartsOrderItem"("productId");

-- CreateIndex
CREATE INDEX "PartsOrderMessage_orderId_createdAt_idx" ON "PartsOrderMessage"("orderId", "createdAt");

-- AddForeignKey
ALTER TABLE "PartsOrder" ADD CONSTRAINT "PartsOrder_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartsOrder" ADD CONSTRAINT "PartsOrder_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "PartsShopProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartsOrderItem" ADD CONSTRAINT "PartsOrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "PartsOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartsOrderItem" ADD CONSTRAINT "PartsOrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "PartsProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartsOrderMessage" ADD CONSTRAINT "PartsOrderMessage_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "PartsOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartsOrderMessage" ADD CONSTRAINT "PartsOrderMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

