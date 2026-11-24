-- Bulk "Run auto-fit" for the Parts Admin's fits screen (additive): a resumable background job per accessory.

-- CreateEnum
CREATE TYPE "AccessoryFitJobStatus" AS ENUM ('QUEUED', 'RUNNING', 'DONE', 'CANCELLED', 'FAILED');

-- CreateTable
CREATE TABLE "AccessoryFitJob" (
    "id" TEXT NOT NULL,
    "accessoryId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "status" "AccessoryFitJobStatus" NOT NULL DEFAULT 'QUEUED',
    "targets" JSONB NOT NULL,
    "includeApproved" BOOLEAN NOT NULL DEFAULT false,
    "total" INTEGER NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "done" INTEGER NOT NULL DEFAULT 0,
    "skipped" INTEGER NOT NULL DEFAULT 0,
    "errors" INTEGER NOT NULL DEFAULT 0,
    "workMs" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "leaseToken" TEXT,
    "leaseUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccessoryFitJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AccessoryFitJob_status_leaseUntil_idx" ON "AccessoryFitJob"("status", "leaseUntil");

-- CreateIndex
CREATE INDEX "AccessoryFitJob_accessoryId_createdAt_idx" ON "AccessoryFitJob"("accessoryId", "createdAt");

-- AddForeignKey
ALTER TABLE "AccessoryFitJob" ADD CONSTRAINT "AccessoryFitJob_accessoryId_fkey" FOREIGN KEY ("accessoryId") REFERENCES "ProductAccessory3D"("id") ON DELETE CASCADE ON UPDATE CASCADE;
