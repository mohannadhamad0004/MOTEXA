-- Additive: sale ("was" price + optional window) and warranty for parts products (nullable columns, no data change).
ALTER TABLE "PartsProduct" ADD COLUMN "compareAtPrice" DECIMAL(12,2),
ADD COLUMN "saleStartsAt" TIMESTAMP(3),
ADD COLUMN "saleEndsAt" TIMESTAMP(3),
ADD COLUMN "warrantyMonths" INTEGER;
