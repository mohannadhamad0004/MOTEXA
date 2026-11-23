ALTER TABLE "CustomerVehicle" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT FALSE,
 ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0,
 ADD COLUMN "archivedAt" TIMESTAMP(3),
 ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
WITH ranked AS (SELECT "id", ROW_NUMBER() OVER (PARTITION BY "customerId" ORDER BY "createdAt", "id") AS n FROM "CustomerVehicle")
UPDATE "CustomerVehicle" v SET "isActive"=TRUE FROM ranked r WHERE v."id"=r."id" AND r.n=1;
CREATE UNIQUE INDEX "CustomerVehicle_one_active_per_owner" ON "CustomerVehicle"("customerId") WHERE "isActive"=TRUE AND "archivedAt" IS NULL;
ALTER TABLE "ServiceRequest" ADD COLUMN "vehicleId" TEXT;
ALTER TABLE "ServiceRequest" ADD CONSTRAINT "ServiceRequest_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "CustomerVehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;
