-- Body kits: one product may carry a FRONT and a REAR bumper as two 3D parts.
-- APPROVED EXCEPTION to "additive only" (user, 2026-11-07): the unique key widens from (productId) to (productId, kitPart).
-- Order: add the column (every existing row becomes MAIN), create the new unique index, then drop the old one. No other drops / renames.
CREATE TYPE "AccessoryKitPart" AS ENUM ('MAIN', 'FRONT', 'REAR');
ALTER TABLE "ProductAccessory3D" ADD COLUMN "kitPart" "AccessoryKitPart" NOT NULL DEFAULT 'MAIN';
CREATE UNIQUE INDEX "ProductAccessory3D_productId_kitPart_key" ON "ProductAccessory3D"("productId", "kitPart");
DROP INDEX "ProductAccessory3D_productId_key";
-- a kit's front part is a front bumper, its rear part a rear bumper
ALTER TABLE "ProductAccessory3D" ADD CONSTRAINT "ProductAccessory3D_kitPart_type_check"
  CHECK ("kitPart" = 'MAIN' OR ("kitPart" = 'FRONT' AND "accessoryType" = 'FRONT_BUMPER') OR ("kitPart" = 'REAR' AND "accessoryType" = 'REAR_BUMPER'));
