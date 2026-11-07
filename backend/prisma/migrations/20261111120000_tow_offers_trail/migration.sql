-- Additive only.
ALTER TYPE "TowCancelledBy" ADD VALUE 'SYSTEM';
ALTER TYPE "TowCancelledBy" ADD VALUE 'ADMIN';
ALTER TABLE "TowRequest" ADD COLUMN "offerExpiresAt" TIMESTAMP(3),
ADD COLUMN "triedDriverIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "distanceMeters" INTEGER;
CREATE TABLE "TowJobTrail" ("id" TEXT NOT NULL, "requestId" TEXT NOT NULL, "lat" DOUBLE PRECISION NOT NULL, "lng" DOUBLE PRECISION NOT NULL, "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "TowJobTrail_pkey" PRIMARY KEY ("id"));
CREATE INDEX "TowJobTrail_requestId_at_idx" ON "TowJobTrail"("requestId", "at");
ALTER TABLE "TowJobTrail" ADD CONSTRAINT "TowJobTrail_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "TowRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
