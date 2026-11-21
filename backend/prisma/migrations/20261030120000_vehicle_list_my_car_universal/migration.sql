-- AlterTable
ALTER TABLE "PartsProduct" ADD COLUMN     "isUniversal" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "Vehicle" (
    "id" TEXT NOT NULL,
    "make" TEXT NOT NULL,
    "makeAr" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "modelAr" TEXT NOT NULL,
    "makeNormalized" TEXT NOT NULL,
    "modelNormalized" TEXT NOT NULL,
    "yearFrom" INTEGER NOT NULL,
    "yearTo" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerCar" (
    "userId" TEXT NOT NULL,
    "make" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerCar_pkey" PRIMARY KEY ("userId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_makeNormalized_modelNormalized_key" ON "Vehicle"("makeNormalized", "modelNormalized");

-- AddForeignKey
ALTER TABLE "CustomerCar" ADD CONSTRAINT "CustomerCar_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

