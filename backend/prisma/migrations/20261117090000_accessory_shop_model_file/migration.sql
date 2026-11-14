-- "I have a 3D file": the shop's own .glb is a ProductAccessory3DPhoto row of kind SHOP_MODEL (additive: the allowed kinds only grow).
ALTER TABLE "ProductAccessory3DPhoto" DROP CONSTRAINT "ProductAccessory3DPhoto_kind";
ALTER TABLE "ProductAccessory3DPhoto" ADD CONSTRAINT "ProductAccessory3DPhoto_kind" CHECK ("kind" IN ('PART','INSTALLED','SHOP_MODEL'));
