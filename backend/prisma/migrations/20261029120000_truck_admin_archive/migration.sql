-- Additive: admin archive state for a truck (nullable columns, no data change).
ALTER TABLE "Truck" ADD COLUMN "archivedAt" TIMESTAMP(3),
ADD COLUMN "archivedById" TEXT,
ADD COLUMN "archiveReason" TEXT;
