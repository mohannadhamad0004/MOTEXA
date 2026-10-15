-- CreateTable
CREATE TABLE "PartsFitment" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "make" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "makeNormalized" TEXT NOT NULL,
    "modelNormalized" TEXT NOT NULL,
    "yearFrom" INTEGER NOT NULL,
    "yearTo" INTEGER NOT NULL,
    "trim" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartsFitment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PartsFitment_makeNormalized_modelNormalized_idx" ON "PartsFitment"("makeNormalized", "modelNormalized");

-- CreateIndex
CREATE INDEX "PartsFitment_productId_idx" ON "PartsFitment"("productId");

-- AddForeignKey
ALTER TABLE "PartsFitment" ADD CONSTRAINT "PartsFitment_productId_fkey" FOREIGN KEY ("productId") REFERENCES "PartsProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;
