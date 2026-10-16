import "dotenv/config";
import argon2 from "argon2";
import { createHash, randomUUID } from "node:crypto";
import { access, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { deflateSync } from "node:zlib";
import { prisma } from "../prisma.js";
import { CATALOG_GROUPS } from "../catalogCategories.js";
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
  { email: "shop.ramallah@motexa.test", fullName: "Test Parts Shop (Ramallah)", role: "PARTS_PROVIDER", status: "ACTIVE" },
  { email: "shop.hebron@motexa.test", fullName: "Test Parts Shop (Hebron)", role: "PARTS_PROVIDER", status: "ACTIVE" },
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
// 5x7 font, one byte per column (bit 0 = top row). Only used for the product placeholder tiles.
const GLYPHS: Record<string, number[]> = {
  "0": [0x3e, 0x51, 0x49, 0x45, 0x3e], "1": [0x00, 0x42, 0x7f, 0x40, 0x00], "2": [0x42, 0x61, 0x51, 0x49, 0x46], "3": [0x21, 0x41, 0x45, 0x4b, 0x31],
  "4": [0x18, 0x14, 0x12, 0x7f, 0x10], "5": [0x27, 0x45, 0x45, 0x45, 0x39], "6": [0x3c, 0x4a, 0x49, 0x49, 0x30], "7": [0x01, 0x71, 0x09, 0x05, 0x03],
  "8": [0x36, 0x49, 0x49, 0x49, 0x36], "9": [0x06, 0x49, 0x49, 0x29, 0x1e],
  A: [0x7e, 0x11, 0x11, 0x11, 0x7e], B: [0x7f, 0x49, 0x49, 0x49, 0x36], C: [0x3e, 0x41, 0x41, 0x41, 0x22], D: [0x7f, 0x41, 0x41, 0x22, 0x1c],
  E: [0x7f, 0x49, 0x49, 0x49, 0x41], F: [0x7f, 0x09, 0x09, 0x09, 0x01], G: [0x3e, 0x41, 0x49, 0x49, 0x7a], H: [0x7f, 0x08, 0x08, 0x08, 0x7f],
  I: [0x00, 0x41, 0x7f, 0x41, 0x00], J: [0x20, 0x40, 0x41, 0x3f, 0x01], K: [0x7f, 0x08, 0x14, 0x22, 0x41], L: [0x7f, 0x40, 0x40, 0x40, 0x40],
  M: [0x7f, 0x02, 0x0c, 0x02, 0x7f], N: [0x7f, 0x04, 0x08, 0x10, 0x7f], O: [0x3e, 0x41, 0x41, 0x41, 0x3e], P: [0x7f, 0x09, 0x09, 0x09, 0x06],
  Q: [0x3e, 0x41, 0x51, 0x21, 0x5e], R: [0x7f, 0x09, 0x19, 0x29, 0x46], S: [0x46, 0x49, 0x49, 0x49, 0x31], T: [0x01, 0x01, 0x7f, 0x01, 0x01],
  U: [0x3f, 0x40, 0x40, 0x40, 0x3f], V: [0x1f, 0x20, 0x40, 0x20, 0x1f], W: [0x3f, 0x40, 0x38, 0x40, 0x3f], X: [0x63, 0x14, 0x08, 0x14, 0x63],
  Y: [0x07, 0x08, 0x70, 0x08, 0x07], Z: [0x61, 0x51, 0x49, 0x45, 0x43],
};

/** A 96x96 solid-colour PNG with a lighter border, so each placeholder is visibly distinct. `initial` adds a big letter. */
function placeholderPng([r, g, b]: [number, number, number], initial?: string): Buffer {
  const glyph = initial ? GLYPHS[initial.toUpperCase()] : undefined;
  const size = 96;
  const row = Buffer.alloc(1 + size * 3);
  const raw = Buffer.alloc(row.length * size);
  for (let y = 0; y < size; y++) {
    const edge = y < 4 || y >= size - 4;
    raw[y * row.length] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const light = edge || x < 4 || x >= size - 4;
      const o = y * row.length + 1 + x * 3;
      // the letter: 5x7 cells drawn 8 pixels big, centred
      const gx = Math.floor((x - 28) / 8);
      const gy = Math.floor((y - 20) / 8);
      const ink = !!glyph && gx >= 0 && gx < 5 && gy >= 0 && gy < 7 && (glyph[gx] >> gy) & 1;
      if (ink) {
        raw[o] = raw[o + 1] = raw[o + 2] = 245;
        continue;
      }
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
  initial?: string; // product placeholders: the first letter of the name
}) {
  const { ownerUserId, purpose, target, originalName, color, label } = opts;
  const expiresAt = opts.expiresAt ? new Date(`${opts.expiresAt}T00:00:00.000Z`) : null;
  const existing = await prisma.providerFile.findFirst({ where: { ...target, purpose, ...(label ? { label } : {}) } });
  const png = placeholderPng(color, opts.initial);
  await mkdir(PROVIDER_STORAGE_DIR, { recursive: true });
  if (existing) {
    const onDisk = await access(path.join(PROVIDER_STORAGE_DIR, existing.storageKey)).then(() => true, () => false);
    if (!onDisk || opts.initial) await writeFile(path.join(PROVIDER_STORAGE_DIR, existing.storageKey), png);
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
  maxWeightKg: number;
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
  company: { companyName: string; phone: string; city: string; verificationStatus: "PENDING" | "APPROVED"; address?: string; description?: string; serviceCities?: string[]; workingHours?: string };
  trucks: TruckSeed[];
}[] = [
  {
    email: "tow@motexa.test",
    company: { companyName: "Al-Noor Recovery & Towing Services Company", phone: "+962 79 000 0001", city: "Nablus", verificationStatus: "APPROVED",
      address: "Industrial Zone, Nablus",
      description: "Recovery and towing day and night. Flatbed and wheel-lift trucks for cars, vans and light commercial vehicles.",
      serviceCities: ["Ramallah", "Al-Bireh", "Jenin"],
      workingHours: "24/7",
    },
    trucks: [
      { plateNumber: "10-12345", maxWeightKg: 3500, make: "Isuzu", model: "NPR", year: 2021, truckType: "FLATBED", verificationStatus: "APPROVED", operationalStatus: "AVAILABLE" },
      { plateNumber: "30-11122", maxWeightKg: 2500, make: "Hino", model: "300", year: 2023, truckType: "WHEEL_LIFT", verificationStatus: "PENDING", operationalStatus: "OUT_OF_SERVICE" },
      {
        plateNumber: "50-00001", maxWeightKg: 6000, make: "Ford", model: "F-650", year: 2012, truckType: "FLATBED",
        verificationStatus: "REJECTED", operationalStatus: "OUT_OF_SERVICE",
        rejectionReason: "Registration photo is unreadable. Please upload a clear copy.",
      },
    ],
  },
  {
    email: "tow.pending@motexa.test",
    company: { companyName: "Desert Hook Towing", phone: "+962 79 000 0002", city: "Tulkarm", verificationStatus: "PENDING" },
    trucks: [
      { plateNumber: "11-22233", maxWeightKg: 3500, make: "Isuzu", model: "NQR", year: 2020, truckType: "FLATBED", verificationStatus: "PENDING", operationalStatus: "OUT_OF_SERVICE" },
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
  "shop.ramallah@motexa.test": ["Commercial registration", "Owner ID"],
  "shop.hebron@motexa.test": ["Commercial registration", "Owner ID"],
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
  category: string; // key from catalogCategories.ts
  condition?: "NEW" | "USED" | "REFURBISHED"; // default NEW
  partType?: "OEM" | "AFTERMARKET"; // default: not specified
  daysAgo?: number; // createdAt = now - daysAgo days, so "Recently added" has a real order
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
      shopName: "Al-Mahaba Genuine & Aftermarket Auto Parts Trading Est.", phone: "+962 79 100 0001", city: "Ramallah",
      address: "Main St., Building 14", verificationStatus: "APPROVED",
    },
    products: [
      { name: "Front Brake Pads Set", category: "BRAKE_SYSTEM", partType: "AFTERMARKET", brand: "Bosch", partNumber: "BP-0986-424", daysAgo: 40, description: "Ceramic front brake pads, low dust.", price: 32.5, stock: 24, fitments: [["Toyota", "Corolla", 2014, 2019], ["Toyota", "Camry", 2012, 2017, "2.5L"]] },
      { name: "Air Filter", category: "FILTERS", partType: "AFTERMARKET", brand: "Mahle", partNumber: "LX-1780", daysAgo: 38, description: "Panel air filter.", price: 9, stock: 12, fitments: [["Hyundai", "Elantra", 2016, 2020]] },
      { name: "Engine Oil Filter", category: "FILTERS", brand: "Mann", partNumber: "W 712/95", daysAgo: 37, description: "Spin-on oil filter.", price: 6.9, stock: 3, fitments: [["Toyota", "Corolla", 2010, 2020], ["Toyota", "Yaris", 2012, 2020]] },
      { name: "Alternator 120A", category: "ELECTRICAL", condition: "REFURBISHED", partType: "AFTERMARKET", brand: "Denso", partNumber: "DAN-1211", daysAgo: 35, description: "Remanufactured alternator, 12V 120A.", price: 145, stock: 0, fitments: [["Kia", "Sportage", 2016, 2021]] },
      { name: "Brake Disc Front (Genuine)", category: "BRAKE_SYSTEM", partType: "OEM", brand: "Toyota", partNumber: "43512-02220", daysAgo: 33, description: "Genuine front brake disc.", price: 55, stock: 6, fitments: [["Toyota", "Corolla", 2014, 2019]] },
      { name: 'Alloy Wheel 16" (Used)', category: "WHEELS", condition: "USED", brand: "OZ", partNumber: "OZ-16-USED-01", daysAgo: 30, description: "Used 16-inch alloy wheel, good condition.", price: 80, stock: 2 },
      { name: "Roof Rack Cross Bars", category: "EXTERIOR_ACCESSORIES", partType: "AFTERMARKET", brand: "Thule", partNumber: "TH-711200", description: "Aluminium roof bars with locks.", price: 520, stock: 3, daysAgo: 17 },
      { name: "Dash Camera Full HD", category: "CAR_ELECTRONICS", brand: "70mai", partNumber: "70MAI-A400", description: "Full HD dash camera with night mode.", price: 189, stock: 11, daysAgo: 2 },
      { name: "Socket Wrench Set 46 pcs", category: "HAND_TOOLS", brand: "Stanley", partNumber: "STMT74393", description: "Metric socket and ratchet set in a case.", price: 120, stock: 0, daysAgo: 22 },
      { name: "Hydraulic Floor Jack 2T (Used)", category: "JACKS_STANDS", condition: "USED", brand: "Sealey", partNumber: "SEAL-1050CX-U", description: "Used 2-tonne trolley jack, works well.", price: 95, stock: 1, daysAgo: 24 },
      { name: "OBD2 Diagnostic Scanner", category: "DIAGNOSTICS", brand: "Launch", partNumber: "CRP123", description: "OBD2 scanner for engine, ABS and airbag codes.", price: 260, stock: 6, daysAgo: 5 },
      {
        category: "LIGHTING", partType: "AFTERMARKET", name: "Universal LED Headlight Bulb Kit (H4/H7/H11 compatible, extra long title for testing)", brand: "NoName",
        partNumber: "LED-UNIV-9999-EXTRA-LONG-PART-NUMBER", description: "Listing under review.", price: 18, stock: 40,
        hiddenReason: "Claims of OEM equivalence cannot be verified. Please provide certification.",
      },
    ],
  },
  {
    email: "shop.ramallah@motexa.test",
    shop: { shopName: "Ramallah Auto Parts", phone: "+970 59 100 0003", city: "Ramallah", address: "Al-Masyoun, Main Road", verificationStatus: "APPROVED" },
    products: [
      { name: "Iridium Spark Plug Set (4 pcs)", category: "ENGINE", partType: "OEM", brand: "NGK", partNumber: "ILKAR7B11-4", description: "Laser iridium spark plugs, set of 4.", price: 96, stock: 18, daysAgo: 4, fitments: [["Hyundai", "Elantra", 2016, 2020], ["Hyundai", "Tucson", 2016, 2020], ["Kia", "Sportage", 2016, 2021]] },
      { name: "Timing Belt Kit with Water Pump", category: "ENGINE", partType: "AFTERMARKET", brand: "Gates", partNumber: "KP15578XS", description: "Timing belt, tensioner and water pump kit.", price: 210, stock: 4, daysAgo: 13, fitments: [["Volkswagen", "Golf", 2012, 2018], ["Skoda", "Octavia", 2013, 2019]] },
      { name: "Front Shock Absorber", category: "SUSPENSION_STEERING", partType: "AFTERMARKET", brand: "Monroe", partNumber: "G16453", description: "Gas-charged front shock absorber, sold each.", price: 135, stock: 8, daysAgo: 10, fitments: [["Toyota", "Corolla", 2014, 2019]] },
      { name: "Steering Rack (Remanufactured)", category: "SUSPENSION_STEERING", condition: "REFURBISHED", partType: "AFTERMARKET", brand: "TRW", partNumber: "JRP1034", description: "Remanufactured power steering rack, tested.", price: 450, stock: 3, daysAgo: 21, fitments: [["Hyundai", "Accent", 2012, 2017]] },
      { name: "Car Battery 60Ah", category: "ELECTRICAL", partType: "OEM", brand: "Varta", partNumber: "E24-560409", description: "12V 60Ah maintenance-free battery.", price: 310, stock: 6, daysAgo: 1, fitments: [["Toyota", "Yaris", 2012, 2020], ["Kia", "Picanto", 2012, 2022]] },
      { name: "Headlight Assembly Left (Used)", category: "LIGHTING", condition: "USED", partType: "OEM", brand: "Valeo", partNumber: "VAL-W205-HL-L", description: "Used left headlight assembly, no cracks.", price: 420, stock: 2, daysAgo: 14, fitments: [["Mercedes", "C-Class", 2014, 2021]] },
      { name: "H7 Halogen Bulbs 12V 55W (pair)", category: "LIGHTING", partType: "OEM", brand: "Philips", partNumber: "12972PRC2", description: "Vision halogen bulbs, pair.", price: 29, stock: 40, daysAgo: 8 },
      { name: "Front Bumper Cover (Used)", category: "BODY", condition: "USED", partType: "AFTERMARKET", brand: "Depo", partNumber: "DEPO-YAR-FB-U", description: "Used front bumper cover, unpainted.", price: 140, stock: 1, daysAgo: 20, fitments: [["Toyota", "Yaris", 2012, 2019]] },
      { name: "Radiator", category: "COOLING", partType: "OEM", brand: "Valeo", partNumber: "VAL-735041", description: "Aluminium core radiator.", price: 360, stock: 3, daysAgo: 16, fitments: [["Peugeot", "301", 2013, 2020], ["Peugeot", "208", 2012, 2019]] },
      { name: "Clutch Kit 3-piece", category: "TRANSMISSION", partType: "OEM", brand: "Sachs", partNumber: "3000950936", description: "Clutch disc, pressure plate and release bearing.", price: 480, stock: 0, daysAgo: 26, fitments: [["Volkswagen", "Golf", 2009, 2013], ["Skoda", "Octavia", 2009, 2013]] },
    ],
  },
  {
    email: "shop.hebron@motexa.test",
    shop: { shopName: "Hebron Spare Parts Center", phone: "+970 59 100 0004", city: "Hebron", address: "Wadi Al-Tuffah Street", verificationStatus: "APPROVED" },
    products: [
      { name: "Edge 5W-30 Engine Oil 4L", category: "ENGINE_OIL", brand: "Castrol", partNumber: "EDGE-5W30-4L", description: "Fully synthetic engine oil, 4 litres.", price: 135, stock: 30, daysAgo: 3 },
      { name: "Quartz 7000 10W-40 Engine Oil 5L", category: "ENGINE_OIL", partType: "AFTERMARKET", brand: "Total", partNumber: "QUARTZ7000-10W40-5L", description: "Semi-synthetic engine oil, 5 litres.", price: 110, stock: 14, daysAgo: 23 },
      { name: "ATF Dexron III Transmission Fluid 1L", category: "TRANSMISSION_FLUID", partType: "OEM", brand: "Mobil", partNumber: "ATF-220-1L", description: "Automatic transmission fluid, 1 litre.", price: 42, stock: 5, daysAgo: 9 },
      { name: "Coolant Antifreeze 5L", category: "COOLANT", brand: "Total", partNumber: "COOLELF-5L", description: "Ready-to-use long-life coolant, 5 litres.", price: 48, stock: 0, daysAgo: 19 },
      { name: "Brake Fluid DOT 4 (500 ml)", category: "BRAKE_FLUID", partType: "AFTERMARKET", brand: "Bosch", partNumber: "1987479107", description: "DOT 4 brake fluid, 500 ml.", price: 19, stock: 2, daysAgo: 15 },
      { name: "Tire 195/65 R15 Energy Saver", category: "TIRES", partType: "OEM", brand: "Michelin", partNumber: "ENERGY-195-65-R15", description: "Summer tire 195/65 R15 91H.", price: 285, stock: 12, daysAgo: 6, fitments: [["Toyota", "Corolla", 2010, 2018]] },
      { name: "Tire 205/55 R16 Turanza", category: "TIRES", partType: "AFTERMARKET", brand: "Bridgestone", partNumber: "TURANZA-205-55-R16", description: "Summer tire 205/55 R16 91V.", price: 340, stock: 8, daysAgo: 12 },
      { name: "Alloy Wheel 15-inch (Refurbished)", category: "WHEELS", condition: "REFURBISHED", partType: "AFTERMARKET", brand: "Enkei", partNumber: "ENK-15-4X100-RF", description: "Refurbished 15-inch alloy wheel, 4x100.", price: 120, stock: 4, daysAgo: 11 },
      { name: "Front Brake Discs (pair)", category: "BRAKE_SYSTEM", partType: "OEM", brand: "Brembo", partNumber: "09A72711", description: "Coated front brake discs, pair.", price: 260, stock: 5, daysAgo: 7, fitments: [["Volkswagen", "Golf", 2012, 2018], ["Skoda", "Octavia", 2013, 2019]] },
      { name: "Rubber Floor Mats (4 pcs)", category: "INTERIOR_ACCESSORIES", brand: "Petex", partNumber: "PTX-MAT-4", description: "Universal rubber floor mat set.", price: 55, stock: 15, daysAgo: 18 },
    ],
  },
  {
    email: "shop.pending@motexa.test",
    shop: { shopName: "Speedy Spares", phone: "+962 79 100 0002", city: "Hebron", address: "Industrial Area, Block 3", verificationStatus: "PENDING" },
    products: [
      { name: "Spark Plug Set", category: "ENGINE", partType: "OEM", brand: "NGK", partNumber: "04465-02220", description: "Iridium spark plugs, set of 4.", price: 24, stock: 15, fitments: [["Toyota", "Corolla", 2014, 2019]] },
      { name: "Cabin Air Filter", category: "FILTERS", brand: "Bosch", partNumber: "CF-2210", description: "Activated carbon cabin filter.", price: 11.25, stock: 8 },
    ],
  },
];

// Placeholder tile colour per catalogue group (matches backend/src/catalogCategories.ts).
const GROUP_COLOR: Record<string, [number, number, number]> = {
  CAR_PARTS: [176, 112, 64], OILS_FLUIDS: [60, 110, 150], TIRES_WHEELS: [96, 96, 106], ACCESSORIES: [120, 84, 150], TOOLS: [70, 130, 90],
};
const groupOf = (category: string) => CATALOG_GROUPS.find((g) => (g.categories as readonly string[]).includes(category))?.key ?? "CAR_PARTS";

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
      const { hiddenReason, fitments, daysAgo, ...fields } = p;
      const data = {
        ...fields,
        condition: p.condition ?? ("NEW" as const),
        partType: p.partType ?? null,
        partNumberNormalized: p.partNumber.toUpperCase().replace(/[^\p{L}\p{N}]/gu, ""),
        // reset on every run so the order of "Recently added" stays the same
        ...(daysAgo !== undefined ? { createdAt: new Date(Date.now() - daysAgo * 86_400_000) } : {}),
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
      await seedFile({ ownerUserId: user.id, purpose: "PRODUCT_IMAGE", target: { productId: product.id }, originalName: `${p.partNumber.replace(/\W+/g, "-")}.png`, color: GROUP_COLOR[groupOf(p.category)], initial: p.name[0] });
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
