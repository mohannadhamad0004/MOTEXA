import "dotenv/config";
import argon2 from "argon2";
import { prisma } from "../prisma.js";

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

// Idempotent: companies are keyed by owner, trucks by plate; every run resets them to the states above.
async function seedTowFleets() {
  for (const f of towFleets) {
    const user = await prisma.user.findUniqueOrThrow({ where: { email: f.email } });
    const company = await prisma.towCompanyProfile.upsert({
      where: { userId: user.id },
      update: { ...f.company, rejectionReason: null },
      create: { userId: user.id, ...f.company },
    });
    for (const t of f.trucks) {
      const data = { ...t, rejectionReason: t.rejectionReason ?? null, companyId: company.id };
      await prisma.truck.upsert({ where: { plateNumber: t.plateNumber }, update: data, create: data });
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
      { name: "Front Brake Pads Set", brand: "Bosch", partNumber: "BP-0986-424", description: "Ceramic front brake pads, low dust.", price: 32.5, stock: 24 },
      { name: "Air Filter", brand: "Mahle", partNumber: "LX-1780", description: "Panel air filter.", price: 9, stock: 12 },
      { name: "Engine Oil Filter", brand: "Mann", partNumber: "W 712/95", description: "Spin-on oil filter.", price: 6.9, stock: 3 },
      { name: "Alternator 120A", brand: "Denso", partNumber: "DAN-1211", description: "Remanufactured alternator, 12V 120A.", price: 145, stock: 0 },
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
      { name: "Spark Plug Set", brand: "NGK", partNumber: "04465-02220", description: "Iridium spark plugs, set of 4.", price: 24, stock: 15 },
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
    for (const p of f.products) {
      const { hiddenReason, ...fields } = p;
      const data = {
        ...fields,
        partNumberNormalized: p.partNumber.toUpperCase().replace(/[^\p{L}\p{N}]/gu, ""),
        isHidden: !!hiddenReason,
        hiddenReason: hiddenReason ?? null,
        hiddenById: hiddenReason ? admin.id : null,
        hiddenAt: hiddenReason ? new Date() : null,
      };
      const existing = await prisma.partsProduct.findFirst({ where: { shopId: shop.id, partNumber: p.partNumber }, select: { id: true } });
      if (existing) await prisma.partsProduct.update({ where: { id: existing.id }, data });
      else await prisma.partsProduct.create({ data: { ...data, shopId: shop.id } });
    }
    console.log(`${f.email.padEnd(32)} parts shop "${f.shop.shopName}" (${f.shop.verificationStatus}), ${f.products.length} product(s)`);
  }
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
}

main()
  .catch((e) => { console.error("Test seed failed:", e.message); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
