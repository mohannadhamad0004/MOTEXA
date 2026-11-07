// DEV ONLY: copies the stuck "Rear bumper" draft (W203) into a throw-away product of the same shop so the submit flow can be exercised
// without touching the real draft.   npx tsx scripts/a3d-clone.ts up   |   npx tsx scripts/a3d-clone.ts down <productId>
import { randomUUID } from "node:crypto";
import { prisma } from "../src/prisma.js";

const [mode, arg] = process.argv.slice(2);
if (mode === "up") {
  const src = await prisma.productAccessory3D.findFirstOrThrow({ where: { accessoryType: { in: ["FRONT_BUMPER", "REAR_BUMPER"] }, product: { name: "Rear bumper" } }, include: { photos: true, fits: true, product: { include: { shop: { include: { user: { select: { email: true } } } } } } } });
  const { product } = src;
  const pid = randomUUID();
  await prisma.partsProduct.create({ data: { id: pid, shopId: product.shopId, name: "Rear bumper (flow test)", brand: product.brand, partNumber: `TEST-${pid.slice(0, 6)}`, partNumberNormalized: `TEST${pid.slice(0, 6)}`, price: product.price, category: product.category, isUniversal: false } });
  const { id: _i, productId: _p, photos, fits, product: _pr, ...rest } = src as any;
  // always a clean, valid DRAFT (the original may be submitted already): width in range, installed car set, nothing reviewed yet
  const acc = await prisma.productAccessory3D.create({ data: { ...rest, productId: pid, status: "DRAFT", widthMm: 1650, installedGenerationId: fits[0]?.generationId ?? null, submittedAt: null, reviewNotes: null, reviewedAt: null, reviewedByUserId: null,
    approvedAt: null, approvedByUserId: null, installedApprovedAt: null, sourceMetadata: undefined } });
  for (const ph of photos) await prisma.productAccessory3DPhoto.create({ data: { accessoryId: acc.id, kind: ph.kind, path: ph.path, sortOrder: ph.sortOrder } });
  for (const f of fits) await prisma.productAccessory3DFit.create({ data: { accessoryId: acc.id, generationId: f.generationId } });
  console.log(JSON.stringify({ productId: pid, accessoryId: acc.id, email: product.shop.user.email, type: acc.accessoryType, widthMm: acc.widthMm, installedGenerationId: acc.installedGenerationId, photos: photos.length, fits: fits.length }));
} else if (mode === "down" && arg) {
  const acc = await prisma.productAccessory3D.findMany({ where: { productId: arg }, select: { id: true } });
  await prisma.auditLog.deleteMany({ where: { targetId: { in: [arg, ...acc.map((a) => a.id)] } } });
  await prisma.notification.deleteMany({ where: { body: { startsWith: "Rear bumper (flow test)" } } }); // what the flow test told the shop
  await prisma.partsProduct.delete({ where: { id: arg } }); // cascades its accessory rows; the shared photo files are untouched (no file removal here)
  console.log("removed", arg);
}
await prisma.$disconnect();
