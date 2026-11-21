import "dotenv/config";
import argon2 from "argon2";
import { createHash } from "node:crypto";
import { prisma } from "../prisma.js";
import { storeFile } from "../uploads/providerFiles.js";

// DEV / DEMO ONLY (same guard as test-accounts.ts). Touches only the two @motexa.test accounts below.
//   tow.apply@motexa.test   tow application SUBMITTED, waiting for review
//   shop.apply@motexa.test  parts shop application NEEDS_CHANGES, with a short thread
// Both use the dev password. The documents are 1x1 placeholder images, not real documents.
if (process.env.NODE_ENV === "production" || process.env.ALLOW_DEV_SEED !== "true") {
  console.error("Refusing to seed demo applications (production, or ALLOW_DEV_SEED !== 'true').");
  process.exit(1);
}

const PASSWORD = "Motexa-Dev-1234!";
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");

async function file(ownerUserId: string, purpose: any, target: Record<string, string>, docKind: string | null, name: string, reviewStatus: "PENDING" | "ACCEPTED" | "REJECTED" = "PENDING", reviewReason: string | null = null) {
  const storageKey = await storeFile({ buffer: PNG, mimeType: "image/png", ext: "png", originalName: name, sha256: createHash("sha256").update(PNG).digest("hex") });
  return prisma.providerFile.create({
    data: {
      ownerUserId,
      purpose,
      visibility: purpose === "TRUCK_PHOTO" ? "PUBLIC" : "PRIVATE",
      ...target,
      label: docKind,
      docKind,
      originalName: name,
      mimeType: "image/png",
      sizeBytes: PNG.length,
      storageKey,
      sha256: createHash("sha256").update(PNG).digest("hex"),
      reviewStatus,
      reviewReason,
      reviewedAt: reviewStatus === "PENDING" ? null : new Date(),
    },
  });
}

async function main() {
  const passwordHash = await argon2.hash(PASSWORD);
  await prisma.user.deleteMany({ where: { email: { in: ["tow.apply@motexa.test", "shop.apply@motexa.test"] } } });
  const admin = await prisma.user.findFirst({ where: { email: "audit.tow@motexa.test" } });
  const adminParts = await prisma.user.findFirst({ where: { email: "audit.parts@motexa.test" } });

  // ---- tow application, SUBMITTED
  const towUser = await prisma.user.create({
    data: {
      fullName: "Demo Tow Owner",
      email: "tow.apply@motexa.test",
      passwordHash,
      role: "TOW_PROVIDER",
      status: "ACTIVE",
      towCompanyProfile: {
        create: {
          companyName: "Demo Highway Towing (demo)",
          companyNameAr: "السحب السريع التجريبي",
          ownerName: "Demo Tow Owner",
          phone: "+970 59 111 0001",
          city: "Ramallah",
          address: "Al-Masyoun, Ramallah",
          serviceCities: ["Ramallah", "Al-Bireh"],
          baseLat: 31.9038,
          baseLng: 35.2034,
          open24h: true,
          workingHours: "24/7",
          truckTypes: ["FLATBED"],
          truckCountClaimed: 1,
          verificationStatus: "PENDING",
          submittedAt: new Date(),
          submissionVersion: 1,
        },
      },
    },
    include: { towCompanyProfile: true },
  });
  const company = towUser.towCompanyProfile!;
  for (const kind of ["COMMERCIAL_REGISTRATION", "OWNER_ID", "DRIVER_LICENCE"]) await file(towUser.id, "TOW_COMPANY_DOCUMENT", { towCompanyId: company.id }, kind, `${kind.toLowerCase()}.png`);
  const truck = await prisma.truck.create({
    data: { companyId: company.id, plateNumber: "99-DEMO-1", make: "Isuzu", model: "NPR", year: 2022, truckType: "FLATBED", verificationStatus: "PENDING", operationalStatus: "OUT_OF_SERVICE" },
  });
  await file(towUser.id, "TRUCK_PHOTO", { truckId: truck.id }, null, "truck-photo.png");
  await file(towUser.id, "TRUCK_REGISTRATION", { truckId: truck.id }, null, "vehicle-licence.png");
  await file(towUser.id, "TRUCK_INSURANCE", { truckId: truck.id }, null, "insurance.png");
  await prisma.providerMessage.create({ data: { towCompanyId: company.id, authorRole: "SYSTEM", body: "The application was submitted for review.||تم إرسال الطلب للمراجعة." } });
  await prisma.auditLog.createMany({
    data: [
      { actorId: towUser.id, action: "PROVIDER_REGISTERED", targetId: company.id, details: { kind: "TOW", demo: true } },
      { actorId: towUser.id, action: "PROVIDER_SUBMITTED", targetId: company.id, details: { kind: "TOW", demo: true } },
    ],
  });

  // ---- parts shop application, NEEDS_CHANGES
  const shopUser = await prisma.user.create({
    data: {
      fullName: "Demo Shop Owner",
      email: "shop.apply@motexa.test",
      passwordHash,
      role: "PARTS_PROVIDER",
      status: "ACTIVE",
      partsShopProfile: {
        create: {
          shopName: "Demo Auto Parts (demo)",
          shopNameAr: "قطع الغيار التجريبية",
          ownerName: "Demo Shop Owner",
          phone: "+970 59 222 0002",
          city: "Nablus",
          address: "Rafidia Street, Nablus",
          baseLat: 32.2211,
          baseLng: 35.2544,
          categories: ["BRAKE_SYSTEM", "FILTERS"],
          brands: ["Bosch", "Mann"],
          workingHours: "Sat-Thu 08:00-19:00",
          verificationStatus: "NEEDS_CHANGES",
          submittedAt: new Date(Date.now() - 86400000),
          submissionVersion: 1,
          flaggedFields: ["doc:TRADE_LICENCE"],
        },
      },
    },
    include: { partsShopProfile: true },
  });
  const shop = shopUser.partsShopProfile!;
  await file(shopUser.id, "PARTS_SHOP_DOCUMENT", { partsShopId: shop.id }, "STOREFRONT_PHOTO", "storefront.png", "ACCEPTED");
  await file(shopUser.id, "PARTS_SHOP_DOCUMENT", { partsShopId: shop.id }, "COMMERCIAL_REGISTRATION", "commercial-registration.png", "ACCEPTED");
  await file(shopUser.id, "PARTS_SHOP_DOCUMENT", { partsShopId: shop.id }, "OWNER_ID", "owner-id.png", "ACCEPTED");
  await file(shopUser.id, "PARTS_SHOP_DOCUMENT", { partsShopId: shop.id }, "TRADE_LICENCE", "trade-licence.png", "REJECTED", "The licence photo is blurry. Please upload a clear copy.");
  const t0 = Date.now() - 3600000;
  await prisma.providerMessage.createMany({
    data: [
      { partsShopId: shop.id, authorRole: "SYSTEM", body: "The application was submitted for review.||تم إرسال الطلب للمراجعة.", createdAt: new Date(t0 - 86400000), readByProviderAt: new Date(t0 - 86000000), readByAdminAt: new Date(t0 - 86000000) },
      { partsShopId: shop.id, authorUserId: adminParts?.id ?? admin?.id ?? null, authorRole: "ADMIN", body: "Your trade licence photo is blurry. Please upload a clear copy and resubmit.", createdAt: new Date(t0), readByAdminAt: new Date(t0) },
      { partsShopId: shop.id, authorRole: "SYSTEM", body: "Changes were requested. Fix the flagged items and resubmit.||طُلبت تعديلات. صحّح العناصر المحددة ثم أعد الإرسال.", createdAt: new Date(t0 + 1000), readByAdminAt: new Date(t0 + 1000) },
    ],
  });
  await prisma.auditLog.createMany({
    data: [
      { actorId: shopUser.id, action: "PROVIDER_REGISTERED", targetId: shop.id, details: { kind: "PARTS", demo: true } },
      { actorId: shopUser.id, action: "PROVIDER_SUBMITTED", targetId: shop.id, details: { kind: "PARTS", demo: true } },
      { actorId: adminParts?.id ?? null, action: "PROVIDER_CHANGES_REQUESTED", targetId: shop.id, details: { kind: "PARTS", documents: ["TRADE_LICENCE"], message: "Your trade licence photo is blurry.", demo: true } },
    ],
  });
  console.log("Demo applications ready: tow.apply@motexa.test (SUBMITTED), shop.apply@motexa.test (NEEDS_CHANGES). Password:", PASSWORD);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
