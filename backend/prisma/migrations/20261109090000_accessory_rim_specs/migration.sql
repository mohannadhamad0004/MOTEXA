-- Rims: optional specs shown on the product page and the shop's finish (used by the 3D rim). Additive only.
CREATE TYPE "RimFinish" AS ENUM ('SILVER', 'BLACK', 'GUNMETAL', 'CHROME');
ALTER TABLE "ProductAccessory3D" ADD COLUMN "rimWidthIn" DOUBLE PRECISION;
ALTER TABLE "ProductAccessory3D" ADD COLUMN "rimPcd" TEXT;
ALTER TABLE "ProductAccessory3D" ADD COLUMN "rimOffsetMm" INTEGER;
ALTER TABLE "ProductAccessory3D" ADD COLUMN "rimFinish" "RimFinish";
