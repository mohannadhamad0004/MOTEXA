CREATE TABLE "CustomerVehicle" (
 "id" TEXT NOT NULL, "customerId" TEXT NOT NULL, "clientVehicleId" TEXT NOT NULL,
 "make" TEXT NOT NULL, "model" TEXT NOT NULL, "year" INTEGER NOT NULL, "fuel" TEXT NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "CustomerVehicle_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "CustomerVehicle_year_check" CHECK ("year" BETWEEN 1950 AND 2200),
 CONSTRAINT "CustomerVehicle_fuel_check" CHECK ("fuel" IN ('PETROL','DIESEL','HYBRID','ELECTRIC')),
 CONSTRAINT "CustomerVehicle_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "CustomerVehicle_customerId_clientVehicleId_key" ON "CustomerVehicle"("customerId", "clientVehicleId");
CREATE INDEX "CustomerVehicle_customerId_createdAt_idx" ON "CustomerVehicle"("customerId", "createdAt");
