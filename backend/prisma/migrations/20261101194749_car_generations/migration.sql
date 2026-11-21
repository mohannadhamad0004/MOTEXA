-- AlterTable
ALTER TABLE "CustomerCar" ADD COLUMN     "generationId" TEXT;

-- AlterTable
ALTER TABLE "PartsFitment" ADD COLUMN     "generationId" TEXT;

-- CreateTable
CREATE TABLE "VehicleGeneration" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "yearFrom" INTEGER NOT NULL,
    "yearTo" INTEGER NOT NULL,
    "bodyType" TEXT,
    "photoUrl" TEXT,
    "photoCredit" TEXT,
    "photoLicense" TEXT,
    "photoSourceUrl" TEXT,
    "model3dKey" TEXT,
    "modelSourceUrl" TEXT,
    "modelLicense" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VehicleGeneration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VehicleGeneration_vehicleId_code_key" ON "VehicleGeneration"("vehicleId", "code");

-- AddForeignKey
ALTER TABLE "VehicleGeneration" ADD CONSTRAINT "VehicleGeneration_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
