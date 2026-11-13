-- Additive: cut mode per bumper label (8-point hull drawn by the Parts Admin when the bumper is merged into the body).
ALTER TABLE "CarPartMap" ADD COLUMN "cuts" JSONB;
