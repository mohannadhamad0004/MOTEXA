-- Additive only: per-car-model part maps for accessory stock-part replacement.
CREATE TABLE "CarPartMap" (
    "model3dKey" TEXT NOT NULL,
    "modelSha256" TEXT NOT NULL,
    "pieces" JSONB NOT NULL,
    "dims" JSONB NOT NULL,
    "proposal" JSONB NOT NULL,
    "map" JSONB,
    "confirmedAt" TIMESTAMP(3),
    "confirmedByUserId" TEXT,
    "segmentedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CarPartMap_pkey" PRIMARY KEY ("model3dKey")
);
