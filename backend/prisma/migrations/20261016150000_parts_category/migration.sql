-- AlterTable (additive: existing products keep a NULL category)
ALTER TABLE "PartsProduct" ADD COLUMN "category" TEXT;

-- CreateIndex
CREATE INDEX "PartsProduct_category_idx" ON "PartsProduct"("category");
