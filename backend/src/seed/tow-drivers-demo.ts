import "dotenv/config";
import argon2 from "argon2";
import { prisma } from "../prisma.js";

// DEV ONLY: two demo drivers for the test tow company (tow@motexa.test, "Al-Noor"): Khaled is FREE with the company's approved
// truck 10-12345, Samer is BUSY on a demo job (customer@motexa.test, on the way) with a demo truck. Marked "(demo)" everywhere.
// Idempotent: re-running resets both drivers and the demo job.
// Run: ALLOW_DEV_SEED=true npx tsx src/seed/tow-drivers-demo.ts
if (process.env.NODE_ENV === "production" || process.env.ALLOW_DEV_SEED !== "true") {
  console.error("Refusing to seed demo data (production, or ALLOW_DEV_SEED !== 'true').");
  process.exit(1);
}
const PASSWORD = "Motexa-Dev-1234!";
const DEMO_NOTE = "Demo job (demo): car will not start near the roundabout.";

async function driver(email: string, fullName: string, companyId: string, truckId: string, phone: string) {
  const passwordHash = await argon2.hash(PASSWORD, { type: argon2.argon2id });
  const user = await prisma.user.upsert({ where: { email }, update: { fullName, role: "TOW_DRIVER", status: "ACTIVE", passwordHash }, create: { email, fullName, role: "TOW_DRIVER", status: "ACTIVE", passwordHash } });
  return prisma.towDriver.upsert({ where: { userId: user.id }, update: { companyId, truckId, phone, offline: false, approval: "APPROVED" }, create: { userId: user.id, companyId, truckId, phone, licenceNumber: "DEMO-0001", approval: "APPROVED" } });
}

async function main() {
  const owner = await prisma.user.findUniqueOrThrow({ where: { email: "tow@motexa.test" } });
  const company = await prisma.towCompanyProfile.findUniqueOrThrow({ where: { userId: owner.id } });
  const customer = await prisma.user.findUniqueOrThrow({ where: { email: "customer@motexa.test" } });
  const truck1 = await prisma.truck.findUniqueOrThrow({ where: { plateNumber: "10-12345" } });
  const truck2 = await prisma.truck.upsert({
    where: { plateNumber: "DEMO-TOW-2" },
    update: { companyId: company.id, verificationStatus: "APPROVED", operationalStatus: "BUSY", archivedAt: null },
    create: { companyId: company.id, plateNumber: "DEMO-TOW-2", make: "Isuzu", model: "NPR (demo)", year: 2019, truckType: "FLATBED", verificationStatus: "APPROVED", operationalStatus: "BUSY", baseLat: 32.2211, baseLng: 35.2544 },
  });

  // the old demo job goes first (its truck is set again below)
  await prisma.towRequest.deleteMany({ where: { companyId: company.id, notes: DEMO_NOTE } });
  await prisma.truck.update({ where: { id: truck1.id }, data: { operationalStatus: truck1.verificationStatus === "APPROVED" && !truck1.archivedAt ? "AVAILABLE" : truck1.operationalStatus } });
  const khaled = await driver("driver1@motexa.test", "Khaled Haddad (demo driver)", company.id, truck1.id, "+970 599 100 101");
  const samer = await driver("driver2@motexa.test", "Samer Odeh (demo driver)", company.id, truck2.id, "+970 599 100 102");

  const now = Date.now();
  const job = await prisma.towRequest.create({
    data: {
      customerId: customer.id,
      companyId: company.id,
      driverId: samer.id,
      status: "EN_ROUTE",
      pickupAddress: "Nablus, near Al-Shuhada roundabout (demo)",
      dropoffAddress: "Nablus industrial area garage (demo)",
      contactPhone: "+970 599 000 000",
      vehicleMake: "Toyota",
      vehicleModel: "Corolla",
      vehicleYear: 2016,
      problemType: "WONT_START",
      notes: DEMO_NOTE,
      pickupLat: 32.2223,
      pickupLng: 35.2621,
      assignedTruckId: truck2.id,
      assignedTruckType: truck2.truckType,
      assignedTruckMake: truck2.make,
      assignedTruckModel: truck2.model,
      assignedTruckYear: truck2.year,
      createdAt: new Date(now - 25 * 60_000),
      acceptedAt: new Date(now - 20 * 60_000),
      enRouteAt: new Date(now - 12 * 60_000),
    },
  });
  // Samer's last point a few streets away (shown as "last seen" until his job screen sends fresh ones)
  await prisma.towDriver.update({ where: { id: samer.id }, data: { lastLat: 32.2189, lastLng: 35.2489, lastAt: new Date(now - 60_000) } });
  console.log(`Demo drivers for ${company.companyName}: driver1@motexa.test (FREE, ${truck1.plateNumber}), driver2@motexa.test (BUSY, job ${job.id}) / ${PASSWORD}; Khaled ${khaled.id}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
