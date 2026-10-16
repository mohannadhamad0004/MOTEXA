import "dotenv/config";
import argon2 from "argon2";
import { createHash, randomUUID } from "node:crypto";
import { access, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { deflateSync } from "node:zlib";
import { prisma } from "../prisma.js";
import { PROVIDER_STORAGE_DIR } from "../uploads/providerFiles.js";

// DEV ONLY. Refuses to run in production or without ALLOW_DEV_SEED=true.
// Only ever touches users whose email ends with @motexa.test.
if (process.env.NODE_ENV === "production" || process.env.ALLOW_DEV_SEED !== "true") {
  console.error("Refusing to seed test accounts (production, or ALLOW_DEV_SEED !== 'true').");
  process.exit(1);
}

const DEV_PASSWORD = "Motexa-Dev-1234!";

type Persona = {
  email: string;
  fullName: string;
  role: "SUPER_ADMIN" | "ADMIN" | "CUSTOMER" | "MECHANIC" | "PARTS_PROVIDER" | "TOW_PROVIDER";
  status: "ACTIVE" | "PENDING";
  permissions?: string[];
};

const personas: Persona[] = [
  { email: "customer@motexa.test", fullName: "Test Customer", role: "CUSTOMER", status: "ACTIVE" },
  { email: "mechanic@motexa.test", fullName: "Test Mechanic (Approved)", role: "MECHANIC", status: "ACTIVE" },
  { email: "mechanic.pending@motexa.test", fullName: "Test Mechanic (Pending)", role: "MECHANIC", status: "PENDING" },
  { email: "shop@motexa.test", fullName: "Test Parts Shop", role: "PARTS_PROVIDER", status: "ACTIVE" },
  { email: "shop.pending@motexa.test", fullName: "Test Parts Shop (Pending)", role: "PARTS_PROVIDER", status: "ACTIVE" },
  { email: "tow@motexa.test", fullName: "Test Tow Company", role: "TOW_PROVIDER", status: "ACTIVE" },
  { email: "tow.pending@motexa.test", fullName: "Test Tow Company (Pending)", role: "TOW_PROVIDER", status: "ACTIVE" },
  { email: "admin.mechanics@motexa.test", fullName: "Test Admin Mechanics", role: "ADMIN", status: "ACTIVE", permissions: ["MANAGE_MECHANICS"] },
  { email: "admin.tow@motexa.test", fullName: "Test Admin Towing", role: "ADMIN", status: "ACTIVE", permissions: ["MANAGE_TOWING"] },
  { email: "admin.parts@motexa.test", fullName: "Test Admin Parts", role: "ADMIN", status: "ACTIVE", permissions: ["MANAGE_SPARE_PARTS"] },
  { email: "admin.multi@motexa.test", fullName: "Test Admin Multi", role: "ADMIN", status: "ACTIVE", permissions: ["MANAGE_MECHANICS", "MANAGE_TOWING"] },
  { email: "superadmin@motexa.test", fullName: "Test Super Admin", role: "SUPER_ADMIN", status: "ACTIVE" },
];

// ---- Placeholder files: tiny PNGs generated right here (no downloads, no third-party images) ----

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf: Buffer) => {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const pngChunk = (type: string, data: Buffer) => {
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const out = Buffer.alloc(8 + data.length + 4);
  out.writeUInt32BE(data.length, 0);
  body.copy(out, 4);
  out.writeUInt32BE(crc32(body), 4 + body.length);
  return out;
};
/** A 96x96 solid-colour PNG with a lighter border, so each placeholder is visibly distinct. */
function placeholderPng([r, g, b]: [number, number, number]): Buffer {
  const size = 96;
  const row = Buffer.alloc(1 + size * 3);
  const raw = Buffer.alloc(row.length * size);
  for (let y = 0; y < size; y++) {
    const edge = y < 4 || y >= size - 4;
    raw[y * row.length] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const light = edge || x < 4 || x >= size - 4;
      const o = y * row.length + 1 + x * 3;
      raw[o] = light ? Math.min(255, r + 70) : r;
      raw[o + 1] = light ? Math.min(255, g + 70) : g;
      raw[o + 2] = light ? Math.min(255, b + 70) : b;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(raw)),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

type FileTarget =
  | { truckId: string }
  | { productId: string }
  | { towCompanyId: string }
  | { partsShopId: string };

/** Idempotent: one row per (target, purpose[, label]). Existing rows keep their file; a missing file is rewritten. */
async function seedFile(opts: {
  ownerUserId: string;
  purpose: "TRUCK_PHOTO" | "TRUCK_REGISTRATION" | "TRUCK_INSURANCE" | "TOW_COMPANY_DOCUMENT" | "PRODUCT_IMAGE" | "PARTS_SHOP_DOCUMENT";
  target: FileTarget;
  originalName: string;
  color: [number, number, number];
  label?: string;
  expiresAt?: string | null;
}) {
  const { ownerUserId, purpose, target, originalName, color, label } = opts;
  const expiresAt = opts.expiresAt ? new Date(`${opts.expiresAt}T00:00:00.000Z`) : null;
  const existing = await prisma.providerFile.findFirst({ where: { ...target, purpose, ...(label ? { label } : {}) } });
  const png = placeholderPng(color);
  await mkdir(PROVIDER_STORAGE_DIR, { recursive: true });
  if (existing) {
    const onDisk = await access(path.join(PROVIDER_STORAGE_DIR, existing.storageKey)).then(() => true, () => false);
    if (!onDisk) await writeFile(path.join(PROVIDER_STORAGE_DIR, existing.storageKey), png);
    await prisma.providerFile.update({ where: { id: existing.id }, data: { expiresAt } });
    return;
  }
  const storageKey = `${randomUUID()}.png`;
  await writeFile(path.join(PROVIDER_STORAGE_DIR, storageKey), png);
  await prisma.providerFile.create({
    data: {
      ownerUserId,
      purpose,
      visibility: purpose === "TRUCK_PHOTO" || purpose === "PRODUCT_IMAGE" ? "PUBLIC" : "PRIVATE",
      ...target,
      label: label ?? null,
      originalName,
      mimeType: "image/png",
      sizeBytes: png.length,
      storageKey,
      sha256: createHash("sha256").update(png).digest("hex"),
      expiresAt,
    },
  });
}

// Registration / insurance expiry per truck; the first truck's insurance is deliberately expired.
const TRUCK_EXPIRY: Record<string, { registration: string; insurance: string }> = {
  "10-12345": { registration: "2027-05-01", insurance: "2025-12-31" },
};
const DEFAULT_EXPIRY = { registration: "2027-06-01", insurance: "2027-06-01" };

type TruckSeed = {
  plateNumber: string;
  make: string;
  model: string;
  year: number;
  truckType: "FLATBED" | "HOOK_CHAIN" | "WHEEL_LIFT" | "HEAVY_DUTY";
  verificationStatus: "PENDING" | "APPROVED" | "REJECTED";
  operationalStatus: "AVAILABLE" | "BUSY" | "OUT_OF_SERVICE";
  rejectionReason?: string;
};

const towFleets: {
  email: string;
  company: { companyName: string; phone: string; city: string; verificationStatus: "PENDING" | "APPROVED" };
  trucks: TruckSeed[];
}[] = [
  {
    email: "tow@motexa.test",
    company: { companyName: "Al-Noor Recovery & Towing Services Company", phone: "+962 79 000 0001", city: "Amman", verificationStatus: "APPROVED" },
    trucks: [
      { plateNumber: "10-12345", make: "Isuzu", model: "NPR", year: 2021, truckType: "FLATBED", verificationStatus: "APPROVED", operationalStatus: "AVAILABLE" },
      { plateNumber: "30-11122", make: "Hino", model: "300", year: 2023, truckType: "WHEEL_LIFT", verificationStatus: "PENDING", operationalStatus: "OUT_OF_SERVICE" },
      {
        plateNumber: "50-00001", make: "Ford", model: "F-650", year: 2012, truckType: "FLATBED",
        verificationStatus: "REJECTED", operationalStatus: "OUT_OF_SERVICE",
        rejectionReason: "Registration photo is unreadable. Please upload a clear copy.",
      },
    ],
  },
  {
    email: "tow.pending@motexa.test",
    company: { companyName: "Desert Hook Towing", phone: "+962 79 000 0002", city: "Zarqa", verificationStatus: "PENDING" },
    trucks: [
      { plateNumber: "11-22233", make: "Isuzu", model: "NQR", year: 2020, truckType: "FLATBED", verificationStatus: "PENDING", operationalStatus: "OUT_OF_SERVICE" },
    ],
  },
];

const towCompanyDocs: Record<string, string[]> = {
  "tow@motexa.test": ["Commercial registration", "Operating licence"],
  "tow.pending@motexa.test": ["Commercial registration"],
};
const partsShopDocs: Record<string, string[]> = {
  "shop@motexa.test": ["Commercial registration", "Owner ID"],
  "shop.pending@motexa.test": ["Commercial registration", "Owner ID"],
};

// Idempotent: companies are keyed by owner, trucks by plate; every run resets them to the states above.
async function seedTowFleets() {
  for (const f of towFleets) {
    const user = await prisma.user.findUniqueOrThrow({ where: { email: f.email } });
    const company = await prisma.towCompanyProfile.upsert({
      where: { userId: user.id },
      update: { ...f.company, rejectionReason: null },
      create: { userId: user.id, ...f.company },
    });
    for (const label of towCompanyDocs[f.email] ?? []) {
      await seedFile({ ownerUserId: user.id, purpose: "TOW_COMPANY_DOCUMENT", target: { towCompanyId: company.id }, label, originalName: `${label.toLowerCase().replace(/\W+/g, "-")}.png`, color: [120, 70, 120] });
    }
    for (const t of f.trucks) {
      const data = { ...t, rejectionReason: t.rejectionReason ?? null, companyId: company.id };
      const truck = await prisma.truck.upsert({ where: { plateNumber: t.plateNumber }, update: data, create: data });
      const exp = TRUCK_EXPIRY[t.plateNumber] ?? DEFAULT_EXPIRY;
      const target = { truckId: truck.id };
      await seedFile({ ownerUserId: user.id, purpose: "TRUCK_PHOTO", target, originalName: `${t.plateNumber}-photo.png`, color: [150, 96, 58] });
      await seedFile({ ownerUserId: user.id, purpose: "TRUCK_REGISTRATION", target, originalName: `${t.plateNumber}-registration.png`, color: [58, 96, 150], expiresAt: exp.registration });
      await seedFile({ ownerUserId: user.id, purpose: "TRUCK_INSURANCE", target, originalName: `${t.plateNumber}-insurance.png`, color: [58, 140, 96], expiresAt: exp.insurance });
    }
    console.log(`${f.email.padEnd(32)} tow company "${f.company.companyName}" (${f.company.verificationStatus}), ${f.trucks.length} truck(s)`);
  }
}

type ProductSeed = {
  name: string;
  brand: string;
  partNumber: string;
  description: string;
  price: number;
  stock: number;
  hiddenReason?: string; // set = hidden by MOTEXA
  fitments?: [make: string, model: string, yearFrom: number, yearTo: number, trim?: string][];
};

const partsShops: {
  email: string;
  shop: { shopName: string; phone: string; city: string; address: string; verificationStatus: "PENDING" | "APPROVED" };
  products: ProductSeed[];
}[] = [
  {
    email: "shop@motexa.test",
    shop: {
      shopName: "Al-Mahaba Genuine & Aftermarket Auto Parts Trading Est.", phone: "+962 79 100 0001", city: "Amman",
      address: "Wasfi Al-Tal St., Building 14", verificationStatus: "APPROVED",
    },
    products: [
      { name: "Front Brake Pads Set", brand: "Bosch", partNumber: "BP-0986-424", description: "Ceramic front brake pads, low dust.", price: 32.5, stock: 24, fitments: [["Toyota", "Corolla", 2014, 2019], ["Toyota", "Camry", 2012, 2017, "2.5L"]] },
      { name: "Air Filter", brand: "Mahle", partNumber: "LX-1780", description: "Panel air filter.", price: 9, stock: 12, fitments: [["Hyundai", "Elantra", 2016, 2020]] },
      { name: "Engine Oil Filter", brand: "Mann", partNumber: "W 712/95", description: "Spin-on oil filter.", price: 6.9, stock: 3, fitments: [["Toyota", "Corolla", 2010, 2020], ["Toyota", "Yaris", 2012, 2020]] },
      { name: "Alternator 120A", brand: "Denso", partNumber: "DAN-1211", description: "Remanufactured alternator, 12V 120A.", price: 145, stock: 0, fitments: [["Kia", "Sportage", 2016, 2021]] },
      {
        name: "Universal LED Headlight Bulb Kit (H4/H7/H11 compatible, extra long title for testing)", brand: "NoName",
        partNumber: "LED-UNIV-9999-EXTRA-LONG-PART-NUMBER", description: "Listing under review.", price: 18, stock: 40,
        hiddenReason: "Claims of OEM equivalence cannot be verified. Please provide certification.",
      },
    ],
  },
  {
    email: "shop.pending@motexa.test",
    shop: { shopName: "Speedy Spares", phone: "+962 79 100 0002", city: "Zarqa", address: "Industrial Area, Block 3", verificationStatus: "PENDING" },
    products: [
      { name: "Spark Plug Set", brand: "NGK", partNumber: "04465-02220", description: "Iridium spark plugs, set of 4.", price: 24, stock: 15, fitments: [["Toyota", "Corolla", 2014, 2019]] },
      { name: "Cabin Air Filter", brand: "Bosch", partNumber: "CF-2210", description: "Activated carbon cabin filter.", price: 11.25, stock: 8 },
    ],
  },
];

// Idempotent: shops keyed by owner, products by (shop, part number); every run resets them to the states above.
async function seedPartsShops() {
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: "superadmin@motexa.test" } });
  for (const f of partsShops) {
    const user = await prisma.user.findUniqueOrThrow({ where: { email: f.email } });
    const shop = await prisma.partsShopProfile.upsert({
      where: { userId: user.id },
      update: { ...f.shop, rejectionReason: null },
      create: { userId: user.id, ...f.shop },
    });
    for (const label of partsShopDocs[f.email] ?? []) {
      await seedFile({ ownerUserId: user.id, purpose: "PARTS_SHOP_DOCUMENT", target: { partsShopId: shop.id }, label, originalName: `${label.toLowerCase().replace(/\W+/g, "-")}.png`, color: [90, 90, 150] });
    }
    for (const p of f.products) {
      const { hiddenReason, fitments, ...fields } = p;
      const data = {
        ...fields,
        partNumberNormalized: p.partNumber.toUpperCase().replace(/[^\p{L}\p{N}]/gu, ""),
        isHidden: !!hiddenReason,
        hiddenReason: hiddenReason ?? null,
        hiddenById: hiddenReason ? admin.id : null,
        hiddenAt: hiddenReason ? new Date() : null,
      };
      const existing = await prisma.partsProduct.findFirst({ where: { shopId: shop.id, partNumber: p.partNumber }, select: { id: true } });
      const product = existing
        ? await prisma.partsProduct.update({ where: { id: existing.id }, data })
        : await prisma.partsProduct.create({ data: { ...data, shopId: shop.id } });
      // Fitments are replaced as a set on every run (idempotent).
      await prisma.partsFitment.deleteMany({ where: { productId: product.id } });
      if (fitments?.length) {
        await prisma.partsFitment.createMany({
          data: fitments.map(([make, model, yearFrom, yearTo, trim], position) => ({
            productId: product.id, make, model, makeNormalized: make.toLowerCase(), modelNormalized: model.toLowerCase(), yearFrom, yearTo, trim: trim ?? null, position,
          })),
        });
      }
      await seedFile({ ownerUserId: user.id, purpose: "PRODUCT_IMAGE", target: { productId: product.id }, originalName: `${p.partNumber.replace(/\W+/g, "-")}.png`, color: [200, 140, 70] });
    }
    console.log(`${f.email.padEnd(32)} parts shop "${f.shop.shopName}" (${f.shop.verificationStatus}), ${f.products.length} product(s)`);
  }
}

// Idempotent sample requests from customer@ so the new screens have data. Found by their fixed text and reset in place.
async function seedRequests() {
  const customer = await prisma.user.findUniqueOrThrow({ where: { email: "customer@motexa.test" } });
  const shopUser = await prisma.user.findUniqueOrThrow({ where: { email: "shop@motexa.test" } });
  const shop = await prisma.partsShopProfile.findUniqueOrThrow({ where: { userId: shopUser.id } });

  const inquiries: { partNumber: string; quantity: number; status: "OPEN" | "ANSWERED"; messages: ["C" | "S", string][] }[] = [
    { partNumber: "BP-0986-424", quantity: 2, status: "OPEN", messages: [["C", "Do you have these brake pads in stock for a 2016 Toyota Corolla?"]] },
    {
      partNumber: "W 712/95", quantity: 1, status: "ANSWERED",
      messages: [["C", "Is this oil filter the right one for a 2012 Toyota Yaris?"], ["S", "Yes, it fits the 2012–2020 Yaris. We have it in stock."]],
    },
  ];
  for (const q of inquiries) {
    const product = await prisma.partsProduct.findFirstOrThrow({ where: { shopId: shop.id, partNumber: q.partNumber } });
    const existing = await prisma.partInquiry.findFirst({
      where: { customerId: customer.id, shopId: shop.id, productPartNumber: q.partNumber, messages: { some: { body: q.messages[0][1] } } },
    });
    if (existing) {
      await prisma.partInquiry.update({ where: { id: existing.id }, data: { status: q.status, closedAt: null, closedById: null, productId: product.id } });
      continue;
    }
    const t0 = Date.now() - 3_600_000;
    await prisma.partInquiry.create({
      data: {
        customerId: customer.id, shopId: shop.id, productId: product.id, productName: product.name, productPartNumber: product.partNumber,
        quantity: q.quantity, status: q.status,
        messages: { create: q.messages.map(([who, body], i) => ({ senderId: who === "C" ? customer.id : shopUser.id, body, createdAt: new Date(t0 + i * 600_000) })) },
      },
    });
  }
  console.log(`customer@motexa.test           ${inquiries.length} part inquiries to shop@ (OPEN, ANSWERED)`);

  const towUser = await prisma.user.findUniqueOrThrow({ where: { email: "tow@motexa.test" } });
  const company = await prisma.towCompanyProfile.findUniqueOrThrow({ where: { userId: towUser.id } });
  const marker = "Abdali Boulevard, Amman";
  const reset = {
    status: "REQUESTED" as const, problemType: "WONT_START" as const, assignedTruckId: null, assignedTruckType: null, assignedTruckMake: null, assignedTruckModel: null, assignedTruckYear: null,
    declineReason: null, cancelReason: null, cancelledBy: null,
    acceptedAt: null, declinedAt: null, enRouteAt: null, inProgressAt: null, completedAt: null, cancelledAt: null,
  };
  const req = await prisma.towRequest.findFirst({ where: { customerId: customer.id, companyId: company.id, pickupAddress: marker } });
  if (req) await prisma.towRequest.update({ where: { id: req.id }, data: reset });
  else {
    await prisma.towRequest.create({
      data: {
        customerId: customer.id, companyId: company.id, pickupAddress: marker, dropoffAddress: "Sweileh, near the main roundabout",
        contactPhone: "+962 79 555 0100", vehicleMake: "Toyota", vehicleModel: "Corolla", vehicleYear: 2016,
        problemType: "WONT_START",
        notes: "Car will not start. Parked at the entrance of the building.",
      },
    });
  }
  console.log("customer@motexa.test           1 tow request to Al-Noor (REQUESTED); truck 10-12345 is APPROVED + AVAILABLE");
}

async function main() {
  const passwordHash = await argon2.hash(DEV_PASSWORD, { type: argon2.argon2id });

  for (const p of personas) {
    const user = await prisma.user.upsert({
      where: { email: p.email },
      update: { fullName: p.fullName, role: p.role, status: p.status, passwordHash },
      create: { fullName: p.fullName, email: p.email, role: p.role, status: p.status, passwordHash },
    });

    // reset permissions to exactly the persona's set
    await prisma.adminPermission.deleteMany({ where: { adminId: user.id } });
    if (p.permissions?.length) {
      await prisma.adminPermission.createMany({
        data: p.permissions.map((permission) => ({ adminId: user.id, permission })),
      });
    }
    console.log(`${p.email.padEnd(32)} ${p.role.padEnd(15)} ${p.status.padEnd(8)} ${p.permissions?.join(",") ?? "-"}`);
  }

  await seedTowFleets();
  await seedPartsShops();
  await seedRequests();
}

main()
  .catch((e) => { console.error("Test seed failed:", e.message); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
