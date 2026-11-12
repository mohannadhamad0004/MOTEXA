import "dotenv/config";
import { createHash, randomUUID } from "node:crypto";
import { copyFile, mkdir, readFile } from "node:fs/promises";
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { prisma } from "../prisma.js";
import { PROVIDER_STORAGE_DIR } from "../uploads/providerFiles.js";
import { PUBLIC_ACCESSORY_DIR } from "../services/accessory3d.js";
import { autoFitAccessory } from "../services/accessory-autofit.js";
import { prepareManualAccessory } from "../services/accessory3d.js";
import { storePrivate } from "../services/vehicle3d-private-assets.js";

// DEV ONLY: "Mesh rims 17″ (set of 4)" in the demo shop (demo.parts@), Wheels, Universal by size, with a published 3D rim.
// Cover photo = a dev RENDER of the rim on the E36 (docs/3d/bodykit-test/rims-fit), not a photograph: REPLACE BEFORE DEMO (see STATUS.md).
// 3D part = CC BY 4.0 "BBS RS16 Tuner Car Wheel" by Martin Trafas (docs/3d/CREDITS.md), optimised with scripts/optimize-accessory.mjs
// (tyre, logo decal and the invisible display backdrop dropped). Written directly (a CC file has no Meshy task). Idempotent.
// Run: ALLOW_DEV_SEED=true npx tsx src/seed/demo-rims.ts   (after demo-parts-shop.ts). The auto-fit on every 3D car runs after it.
if (process.env.NODE_ENV === "production" || process.env.ALLOW_DEV_SEED !== "true") { console.error("Refusing to seed demo data."); process.exit(1); }

const ROOT = path.resolve("..");
const PHOTO = path.join(ROOT, "docs/3d/bodykit-test/rims-fit/bmw-3-series-e36/on-wheel-closeup.png");
const GLB = path.join(ROOT, "3d-source/rims/bbs-rs16/rim.glb");
const PART_NO = "DEMO-RIM-17";

async function main() {
  const shop = await prisma.partsShopProfile.findFirstOrThrow({ where: { user: { email: "demo.parts@motexa.test" } } });
  const data = {
    name: "Mesh rims 17″ (set of 4)", category: "WHEELS", brand: "Demo", price: 2400, stock: 2, reservedStock: 0, isHidden: false, isUniversal: true,
    condition: "NEW" as const, description: "Demo product for the MOTEXA catalogue. Not real stock. Universal by size: check PCD/offset with the shop before buying.",
    partNumber: PART_NO, partNumberNormalized: PART_NO.replace(/[^A-Z0-9]/g, ""),
  };
  const old = await prisma.partsProduct.findFirst({ where: { shopId: shop.id, partNumber: PART_NO }, select: { id: true } });
  const product = old ? await prisma.partsProduct.update({ where: { id: old.id }, data }) : await prisma.partsProduct.create({ data: { ...data, shopId: shop.id } });
  await prisma.partsFitment.deleteMany({ where: { productId: product.id } }); // Universal: no fitment rows

  if (!await prisma.providerFile.findFirst({ where: { productId: product.id, purpose: "PRODUCT_IMAGE" } })) {
    const buf = await readFile(PHOTO), storageKey = `${randomUUID()}.png`;
    await mkdir(PROVIDER_STORAGE_DIR, { recursive: true });
    await copyFile(PHOTO, path.join(PROVIDER_STORAGE_DIR, storageKey));
    await prisma.providerFile.create({ data: { ownerUserId: shop.userId, purpose: "PRODUCT_IMAGE", visibility: "PUBLIC", productId: product.id, partsShopId: shop.id,
      originalName: "mesh-rim-dev-render.png", mimeType: "image/png", sizeBytes: buf.length, storageKey, sha256: createHash("sha256").update(buf).digest("hex"), reviewStatus: "ACCEPTED" } });
  }

  const bytes = await readFile(GLB), file = `acc-${createHash("sha256").update(bytes).digest("hex").slice(0, 16)}`;
  let acc = await prisma.productAccessory3D.findUnique({ where: { productId_kitPart: { productId: product.id, kitPart: "MAIN" } } });
  const specs = { accessoryType: "RIMS" as const, rimInches: 17, rimWidthIn: 8, rimPcd: "5x112", rimOffsetMm: 35, rimFinish: "SILVER" as const };
  if (!acc?.privateModelPath) {
    mkdirSync(PUBLIC_ACCESSORY_DIR, { recursive: true });
    if (!existsSync(path.join(PUBLIC_ACCESSORY_DIR, `${file}.glb`))) copyFileSync(GLB, path.join(PUBLIC_ACCESSORY_DIR, `${file}.glb`));
    const fields = { ...specs, status: "PUBLISHED" as const, privateModelPath: storePrivate(bytes, "glb"), publishedFile: file, publishedAt: new Date(),
      provider: "MANUAL", generationMode: "manual", generationStage: "READY", visualVerifiedAt: new Date(),
      sourceMetadata: { license: "CC BY 4.0", author: "Martin Trafas", source: "https://sketchfab.com/3d-models/bbs-rs16-tuner-car-wheel-4e50d45e5ff04d00927a50c150e088c1", devOnly: true, note: "dev test part, replace before demo" } };
    acc = acc ? await prisma.productAccessory3D.update({ where: { id: acc.id }, data: fields }) : await prisma.productAccessory3D.create({ data: { ...fields, productId: product.id, shopId: shop.id, kitPart: "MAIN" } });
  } else acc = await prisma.productAccessory3D.update({ where: { id: acc.id }, data: specs });
  await prisma.productAccessory3DFit.deleteMany({ where: { accessoryId: acc.id } }); // Universal by size: no generation list
  console.log(`Rims product ${product.id}, accessory ${acc.id}: fitting on every published 3D car…`);
  if ((acc.validation as { valid?: boolean } | null)?.valid !== true) await prepareManualAccessory(acc.id, null); // same optimise + validation as a generated model
  await autoFitAccessory(acc.id);
  const fits = await prisma.accessoryAutoFit.findMany({ where: { accessoryId: acc.id }, select: { model3dKey: true, fit: true } });
  console.log(fits.map(f => `${f.model3dKey}: ${(f.fit as { failed?: string }).failed ? "does not fit (" + (f.fit as { failed: string }).failed + ")" : "fits"}`).join("\n"));
}
main().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
