import "dotenv/config";
import argon2 from "argon2";
import { createHash, randomUUID } from "node:crypto";
import { copyFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "../prisma.js";
import { PROVIDER_STORAGE_DIR } from "../uploads/providerFiles.js";

// DEV ONLY demo data: ONE complete approved parts shop "MOTEXA Demo Parts" (marked demo everywhere) with 8 products that exercise the
// catalogue badges: one discounted, one sold out, one with 2 left, one used, the rest normal; some fit a 2018 Toyota Corolla.
// Products get NO photo: no legitimate product photos are in the repo, and a fake product photo is worse than none. They stay hidden
// from customers until a real photo is uploaded (provider or Parts Admin -> "Add product photo").
// Run: ALLOW_DEV_SEED=true npx tsx src/seed/demo-parts-shop.ts   (idempotent: re-running resets the demo shop to this state)
if (process.env.NODE_ENV === "production" || process.env.ALLOW_DEV_SEED !== "true") {
  console.error("Refusing to seed demo data (production, or ALLOW_DEV_SEED !== 'true').");
  process.exit(1);
}

const EMAIL = "demo.parts@motexa.test";
const STOREFRONT = path.resolve("../mobile/assets/images/motexa-workspace-garage.png"); // existing repo image, demo only
const days = (n: number) => new Date(Date.now() - n * 86_400_000);
const corolla = [{ make: "Toyota", model: "Corolla", yearFrom: 2014, yearTo: 2019 }];

const products = [
  { partNumber: "DEMO-001", name: "Front Brake Pads (Demo)", category: "BRAKE_SYSTEM", brand: "Demo", price: 120, compareAtPrice: 150, stock: 12, fitments: corolla, warrantyMonths: 12, createdAt: days(30) },
  { partNumber: "DEMO-002", name: "Oil Filter (Demo)", category: "FILTERS", brand: "Demo", price: 25, stock: 0, fitments: corolla, createdAt: days(40) },
  { partNumber: "DEMO-003", name: "Cabin Air Filter (Demo)", category: "FILTERS", brand: "Demo", price: 35, stock: 2, fitments: corolla, createdAt: days(25) },
  { partNumber: "DEMO-004", name: "Alternator (Demo, used)", category: "ELECTRICAL", brand: "Demo", price: 260, stock: 1, condition: "USED" as const, fitments: corolla, warrantyMonths: 3, createdAt: days(50) },
  { partNumber: "DEMO-005", name: "Engine Oil 10W-40 1L (Demo)", category: "ENGINE_OIL", brand: "Demo", price: 28, stock: 40, createdAt: days(5) },
  { partNumber: "DEMO-006", name: "Engine Oil 5W-30 4L (Demo)", category: "ENGINE_OIL", brand: "Demo", price: 95, stock: 20, createdAt: days(60) },
  { partNumber: "DEMO-007", name: "Rear Brake Pads (Demo)", category: "BRAKE_SYSTEM", brand: "Demo", price: 95, stock: 15, createdAt: days(70) },
  { partNumber: "DEMO-008", name: "Air Filter (Demo)", category: "FILTERS", brand: "Demo", price: 45, stock: 9, createdAt: days(80) },
];

async function main() {
  const passwordHash = await argon2.hash("Motexa-Dev-1234!", { type: argon2.argon2id });
  const user = await prisma.user.upsert({
    where: { email: EMAIL },
    update: { fullName: "MOTEXA Demo Parts (demo)", role: "PARTS_PROVIDER", status: "ACTIVE", passwordHash },
    create: { email: EMAIL, fullName: "MOTEXA Demo Parts (demo)", role: "PARTS_PROVIDER", status: "ACTIVE", passwordHash },
  });
  const shopData = {
    shopName: "MOTEXA Demo Parts",
    shopNameAr: "قطع موتكسا التجريبية",
    phone: "+970 59 100 0099",
    city: "Nablus",
    address: "Demo shop, Rafidia Street",
    ownerName: "Demo owner",
    verificationStatus: "APPROVED" as const,
    rejectionReason: null,
    reviewedAt: new Date(),
    baseLat: 32.2211,
    baseLng: 35.2544,
    locationSource: "manual",
    locationAddress: "Rafidia, Nablus (demo)",
    categories: ["BRAKE_SYSTEM", "FILTERS", "ENGINE_OIL"],
    workingHours: "Sat–Thu 08:00–18:00",
  };
  const shop = await prisma.partsShopProfile.upsert({ where: { userId: user.id }, update: shopData, create: { userId: user.id, ...shopData } });

  // storefront photo: a private shop document, written once
  const hasFront = await prisma.providerFile.findFirst({ where: { partsShopId: shop.id, docKind: "STOREFRONT_PHOTO" } });
  if (!hasFront) {
    const buf = await readFile(STOREFRONT);
    const storageKey = `${randomUUID()}.png`;
    await mkdir(PROVIDER_STORAGE_DIR, { recursive: true });
    await copyFile(STOREFRONT, path.join(PROVIDER_STORAGE_DIR, storageKey));
    await prisma.providerFile.create({
      data: {
        ownerUserId: user.id, purpose: "PARTS_SHOP_DOCUMENT", visibility: "PRIVATE", partsShopId: shop.id, label: "STOREFRONT_PHOTO", docKind: "STOREFRONT_PHOTO",
        originalName: "demo-storefront.png", mimeType: "image/png", sizeBytes: buf.length, storageKey, sha256: createHash("sha256").update(buf).digest("hex"), reviewStatus: "ACCEPTED",
      },
    });
  }

  for (const p of products) {
    const { fitments, ...fields } = p;
    const data = {
      ...fields,
      description: "Demo product for the MOTEXA catalogue. Not real stock.",
      condition: p.condition ?? ("NEW" as const),
      partNumberNormalized: p.partNumber.replace(/[^A-Z0-9]/gi, "").toUpperCase(),
      compareAtPrice: p.compareAtPrice ?? null,
      warrantyMonths: p.warrantyMonths ?? null,
      isHidden: false,
    };
    const existing = await prisma.partsProduct.findFirst({ where: { shopId: shop.id, partNumber: p.partNumber }, select: { id: true } });
    const product = existing ? await prisma.partsProduct.update({ where: { id: existing.id }, data }) : await prisma.partsProduct.create({ data: { ...data, shopId: shop.id } });
    await prisma.partsFitment.deleteMany({ where: { productId: product.id } });
    if (fitments?.length) {
      await prisma.partsFitment.createMany({
        data: fitments.map((f, position) => ({ productId: product.id, ...f, makeNormalized: f.make.toLowerCase(), modelNormalized: f.model.toLowerCase(), position })),
      });
    }
  }
  console.log(`MOTEXA Demo Parts shop id: ${shop.id}  (login ${EMAIL} / Motexa-Dev-1234!), ${products.length} demo products, no product photos`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
