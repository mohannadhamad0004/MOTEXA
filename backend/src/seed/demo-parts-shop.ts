import "dotenv/config";
import argon2 from "argon2";
import { createHash, randomUUID } from "node:crypto";
import { copyFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "../prisma.js";
import { PROVIDER_STORAGE_DIR } from "../uploads/providerFiles.js";
import { normText } from "../services/fitment.js";
import { seedVehicles } from "./vehicles.js";

// DEV ONLY demo data: ONE complete approved parts shop "MOTEXA Demo Parts" (marked demo everywhere) with 8 products that exercise the
// catalogue badges: one discounted, one sold out, one with 2 left, one used, the rest normal. Fitment (cars from the vehicle list):
// some fit a 2018 Toyota Corolla, some are shared across 2-3 models (Hyundai/Kia, VW group), two oils are universal and the air
// filter has no fitment data at all (shows "Not sure? Ask the shop", never a fit).
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
const toyotaCabin = [...corolla, { make: "Toyota", model: "Yaris", yearFrom: 2011, yearTo: 2019 }, { make: "Toyota", model: "RAV4", yearFrom: 2013, yearTo: 2018 }];
const hyundaiKia = [{ make: "Hyundai", model: "Elantra", yearFrom: 2016, yearTo: 2020 }, { make: "Kia", model: "Cerato", yearFrom: 2014, yearTo: 2018 }, { make: "Hyundai", model: "i30", yearFrom: 2012, yearTo: 2017 }];
const vwGroup = [{ make: "Volkswagen", model: "Golf", yearFrom: 2013, yearTo: 2020 }, { make: "Skoda", model: "Octavia", yearFrom: 2013, yearTo: 2020 }, { make: "Seat", model: "Leon", yearFrom: 2013, yearTo: 2020 }];

const products = [
  { partNumber: "DEMO-001", name: "Front Brake Pads (Demo)", category: "BRAKE_PADS", brand: "Demo", price: 120, compareAtPrice: 150, stock: 12, fitments: corolla, warrantyMonths: 12, createdAt: days(30) },
  { partNumber: "DEMO-002", name: "Oil Filter (Demo)", category: "OIL_FILTERS", brand: "Demo", price: 25, stock: 0, fitments: hyundaiKia, createdAt: days(40) },
  { partNumber: "DEMO-003", name: "Cabin Air Filter (Demo)", category: "CABIN_FILTERS", brand: "Demo", price: 35, stock: 2, fitments: toyotaCabin, createdAt: days(25) },
  { partNumber: "DEMO-004", name: "Alternator (Demo, used)", category: "ALTERNATORS_STARTERS", brand: "Demo", price: 260, stock: 1, condition: "USED" as const, fitments: [{ make: "Toyota", model: "Corolla", yearFrom: 2014, yearTo: 2018 }], warrantyMonths: 3, createdAt: days(50) },
  { partNumber: "DEMO-005", name: "Engine Oil 10W-40 1L (Demo)", category: "ENGINE_OIL", brand: "Demo", price: 28, stock: 40, isUniversal: true, createdAt: days(5) },
  { partNumber: "DEMO-006", name: "Engine Oil 5W-30 4L (Demo)", category: "ENGINE_OIL", brand: "Demo", price: 95, stock: 20, isUniversal: true, createdAt: days(60) },
  { partNumber: "DEMO-007", name: "Rear Brake Pads (Demo)", category: "BRAKE_PADS", brand: "Demo", price: 95, stock: 15, fitments: vwGroup, createdAt: days(70) },
  { partNumber: "DEMO-008", name: "Air Filter (Demo)", category: "AIR_FILTERS", brand: "Demo", price: 45, stock: 9, createdAt: days(80) },
];

async function main() {
  await seedVehicles(); // the fitment cars below come from the vehicle list
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
    // the owner delivers himself in and around Nablus, flat fee
    deliveryEnabled: true,
    deliveryFee: 10,
    deliveryAreaNote: "Nablus and nearby villages",
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
      isUniversal: p.isUniversal ?? false,
      reservedStock: 0, // the demo orders below reserve what they hold
      isHidden: false,
    };
    const existing = await prisma.partsProduct.findFirst({ where: { shopId: shop.id, partNumber: p.partNumber }, select: { id: true } });
    const product = existing ? await prisma.partsProduct.update({ where: { id: existing.id }, data }) : await prisma.partsProduct.create({ data: { ...data, shopId: shop.id } });
    await prisma.partsFitment.deleteMany({ where: { productId: product.id } });
    if (fitments?.length) {
      await prisma.partsFitment.createMany({
        data: fitments.map((f, position) => ({ productId: product.id, ...f, makeNormalized: normText(f.make), modelNormalized: normText(f.model), position })),
      });
    }
  }
  // Two demo orders from customer@motexa.test (reset on every run): a pickup just PLACED, and a delivery OUT_FOR_DELIVERY
  // (accepted, so its units are reserved). Its live courier point appears only while the owner's delivery screen sends one.
  const customer = await prisma.user.findUnique({ where: { email: "customer@motexa.test" } });
  if (customer) {
    await prisma.partsOrder.deleteMany({ where: { shopId: shop.id, customerId: customer.id } });
    const line = async (partNumber: string, quantity: number) => {
      const p = await prisma.partsProduct.findFirstOrThrow({ where: { shopId: shop.id, partNumber } });
      return { productId: p.id, name: p.name, partNumber: p.partNumber, unitPrice: Number(p.price), quantity };
    };
    const pickup = [await line("DEMO-001", 1), await line("DEMO-003", 1)];
    const delivery = [await line("DEMO-005", 2)];
    const sum = (ls: { unitPrice: number; quantity: number }[]) => ls.reduce((n, l) => n + l.unitPrice * l.quantity, 0);
    const now = Date.now();
    await prisma.partsOrder.create({
      data: {
        customerId: customer.id, shopId: shop.id, fulfilment: "PICKUP", payment: "PAY_AT_SHOP", subtotal: sum(pickup), total: sum(pickup),
        items: { create: pickup }, messages: { create: { senderId: null, body: "Order placed||تم إرسال الطلب" } }, createdAt: new Date(now - 20 * 60_000),
      },
    });
    await prisma.partsOrder.create({
      data: {
        customerId: customer.id, shopId: shop.id, fulfilment: "DELIVERY", payment: "CASH_ON_DELIVERY", status: "OUT_FOR_DELIVERY", stockReserved: true,
        subtotal: sum(delivery), deliveryFee: 10, total: sum(delivery) + 10,
        deliveryLat: 32.2275, deliveryLng: 35.2621, deliveryArea: "Nablus", deliveryNote: "Second floor, next to the bakery. (demo)",
        createdAt: new Date(now - 90 * 60_000), acceptedAt: new Date(now - 80 * 60_000), preparingAt: new Date(now - 60 * 60_000), outAt: new Date(now - 10 * 60_000),
        items: { create: delivery },
        messages: {
          create: [
            { senderId: null, body: "Order placed||تم إرسال الطلب", createdAt: new Date(now - 90 * 60_000) },
            { senderId: null, body: "Order accepted||تم قبول الطلب", createdAt: new Date(now - 80 * 60_000) },
            { senderId: null, body: "Out for delivery||في الطريق إليك", createdAt: new Date(now - 10 * 60_000) },
          ],
        },
      },
    });
    await prisma.partsProduct.update({ where: { id: delivery[0].productId }, data: { reservedStock: delivery[0].quantity } });
  }
  console.log(`MOTEXA Demo Parts shop id: ${shop.id}  (login ${EMAIL} / Motexa-Dev-1234!), ${products.length} demo products, no product photos, ${customer ? 2 : 0} demo orders`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
