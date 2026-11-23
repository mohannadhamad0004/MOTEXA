ALTER TABLE "MechanicProfile" ADD COLUMN "workshopLatitude" DOUBLE PRECISION, ADD COLUMN "workshopLongitude" DOUBLE PRECISION;
ALTER TABLE "MechanicProfile" ADD CONSTRAINT "workshop_coordinates_valid" CHECK (("workshopLatitude" IS NULL AND "workshopLongitude" IS NULL) OR ("workshopLatitude" IS NOT NULL AND "workshopLongitude" IS NOT NULL AND "workshopLatitude" BETWEEN -90 AND 90 AND "workshopLongitude" BETWEEN -180 AND 180));
CREATE TABLE "WorkshopJourney" (
 "requestId" TEXT PRIMARY KEY REFERENCES "ServiceRequest"("id") ON DELETE CASCADE,
 "destinationLatitude" DOUBLE PRECISION NOT NULL CHECK ("destinationLatitude" BETWEEN -90 AND 90),
 "destinationLongitude" DOUBLE PRECISION NOT NULL CHECK ("destinationLongitude" BETWEEN -180 AND 180),
 "state" TEXT NOT NULL DEFAULT 'EN_ROUTE' CHECK ("state" IN ('EN_ROUTE','STOPPED','ARRIVED')),
 "sharing" BOOLEAN NOT NULL DEFAULT false,
 "session" TEXT, "sequence" INTEGER NOT NULL DEFAULT 0 CHECK ("sequence">=0),
 "latitude" DOUBLE PRECISION, "longitude" DOUBLE PRECISION, "accuracy" DOUBLE PRECISION,
 "positionAt" TIMESTAMP(3), "arrivedAt" TIMESTAMP(3), "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "journey_position_valid" CHECK (("latitude" IS NULL AND "longitude" IS NULL AND "accuracy" IS NULL AND "positionAt" IS NULL) OR ("latitude" IS NOT NULL AND "longitude" IS NOT NULL AND "accuracy" IS NOT NULL AND "positionAt" IS NOT NULL AND "latitude" BETWEEN -90 AND 90 AND "longitude" BETWEEN -180 AND 180 AND "accuracy" BETWEEN 0 AND 100))
);
