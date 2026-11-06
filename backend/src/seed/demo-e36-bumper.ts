import "dotenv/config";
import { createHash, randomUUID } from "node:crypto";
import { copyFile, mkdir, readFile } from "node:fs/promises";
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { prisma } from "../prisma.js";
import { PROVIDER_STORAGE_DIR } from "../uploads/providerFiles.js";
import { PUBLIC_ACCESSORY_DIR } from "../services/accessory3d.js";
import { autoFitAccessory } from "../services/accessory-autofit.js";
import { storePrivate } from "../services/vehicle3d-private-assets.js";
import { normText } from "../services/fitment.js";

// DEV ONLY: "BMW E36 M3 front bumper" in the demo shop (demo.parts@), visible to customers, with a published 3D part.
// Cover photo = a dev test image from docs/3d/bodykit-test (a RENDER, not a photograph): REPLACE BEFORE DEMO (see STATUS.md).
// 3D part = CC BY 4.0 "(FREE) BMW E36 M3 front bumper" by slay (docs/3d/CREDITS.md). Written directly (a CC file has no Meshy task, so the
// normal publish path, which only accepts real generations, does not apply). Idempotent.
// Run: ALLOW_DEV_SEED=true npx tsx src/seed/demo-e36-bumper.ts   (after demo-parts-shop.ts)
if (process.env.NODE_ENV === "production" || process.env.ALLOW_DEV_SEED !== "true") { console.error("Refusing to seed demo data."); process.exit(1); }

const ROOT = path.resolve("..");
const PHOTO = path.join(ROOT, "docs/3d/bodykit-test/e36/c-part-on-front.png");
const GLB = path.join(ROOT, "3d-source/accessory-photos/test/free_bmw_e36_m3_front_bumper.glb");
const PART_NO = "DEMO-E36-FB";

async function main() {
  const shop = await prisma.partsShopProfile.findFirstOrThrow({ where: { user: { email: "demo.parts@motexa.test" } } });
  const gen = await prisma.vehicleGeneration.findFirstOrThrow({ where: { model3dKey: "bmw-3-series-e36" }, include: { vehicle: true } });
  const data = {
    name: "BMW E36 M3 front bumper", category: "BODY", brand: "Demo", price: 950, stock: 3, reservedStock: 0, isHidden: false, isUniversal: false,
    condition: "NEW" as const, description: "Demo product for the MOTEXA catalogue. Not real stock. Fits BMW 3 Series E36 only.",
    partNumber: PART_NO, partNumberNormalized: PART_NO.replace(/[^A-Z0-9]/g, ""),
  };
  const old = await prisma.partsProduct.findFirst({ where: { shopId: shop.id, partNumber: PART_NO }, select: { id: true } });
  const product = old ? await prisma.partsProduct.update({ where: { id: old.id }, data }) : await prisma.partsProduct.create({ data: { ...data, shopId: shop.id } });

  await prisma.partsFitment.deleteMany({ where: { productId: product.id } });
  await prisma.partsFitment.create({ data: { productId: product.id, make: gen.vehicle.make, model: gen.vehicle.model, makeNormalized: normText(gen.vehicle.make),
    modelNormalized: normText(gen.vehicle.model), yearFrom: gen.yearFrom, yearTo: gen.yearTo ?? gen.yearFrom, generationId: gen.id, position: 0 } });

  if (!await prisma.providerFile.findFirst({ where: { productId: product.id, purpose: "PRODUCT_IMAGE" } })) {
    const buf = await readFile(PHOTO), storageKey = `${randomUUID()}.png`;
    await mkdir(PROVIDER_STORAGE_DIR, { recursive: true });
    await copyFile(PHOTO, path.join(PROVIDER_STORAGE_DIR, storageKey));
    await prisma.providerFile.create({ data: { ownerUserId: shop.userId, purpose: "PRODUCT_IMAGE", visibility: "PUBLIC", productId: product.id, partsShopId: shop.id,
      originalName: "e36-bumper-dev-render.png", mimeType: "image/png", sizeBytes: buf.length, storageKey, sha256: createHash("sha256").update(buf).digest("hex"), reviewStatus: "ACCEPTED" } });
  }

  let acc = await prisma.productAccessory3D.findUnique({ where: { productId_kitPart: { productId: product.id, kitPart: "MAIN" } } });
  if (!acc?.privateModelPath) {
    const bytes = await readFile(GLB), file = `acc-${createHash("sha256").update(bytes).digest("hex").slice(0, 16)}`;
    mkdirSync(PUBLIC_ACCESSORY_DIR, { recursive: true });
    if (!existsSync(path.join(PUBLIC_ACCESSORY_DIR, `${file}.glb`))) copyFileSync(GLB, path.join(PUBLIC_ACCESSORY_DIR, `${file}.glb`));
    const fields = { accessoryType: "FRONT_BUMPER" as const, widthMm: 1700, status: "PUBLISHED" as const, privateModelPath: storePrivate(bytes, "glb"), publishedFile: file, publishedAt: new Date(),
      provider: "MANUAL", generationMode: "manual", generationStage: "READY", visualVerifiedAt: new Date(),
      sourceMetadata: { license: "CC BY 4.0", author: "slay", devOnly: true, note: "dev test part, replace before demo" } };
    acc = acc ? await prisma.productAccessory3D.update({ where: { id: acc.id }, data: fields }) : await prisma.productAccessory3D.create({ data: { ...fields, productId: product.id, shopId: shop.id, kitPart: "MAIN" } });
  }
  await prisma.productAccessory3DFit.upsert({ where: { accessoryId_generationId: { accessoryId: acc.id, generationId: gen.id } }, create: { accessoryId: acc.id, generationId: gen.id }, update: {} });
  await autoFitAccessory(acc.id);
  console.log(`E36 bumper product ${product.id}, accessory ${acc.id}, fits ${gen.model3dKey}`);
}
main().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
