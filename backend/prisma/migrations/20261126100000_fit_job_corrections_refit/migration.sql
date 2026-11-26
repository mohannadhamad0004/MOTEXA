-- "Run auto-fit" jobs (additive): a saved manual correction is only reset when the admin explicitly included corrections (confirmed
-- count), and a car-update refit that had to wait for a running job is remembered on that job and runs when it ends.
ALTER TABLE "AccessoryFitJob" ADD COLUMN "includeCorrections" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "AccessoryFitJob" ADD COLUMN "refitAfter" BOOLEAN NOT NULL DEFAULT false;
