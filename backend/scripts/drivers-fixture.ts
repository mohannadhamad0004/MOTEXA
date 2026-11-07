// DEV ONLY fixture for the STEP DRIVERS screenshots: `up` creates a labelled test company / drivers / customer / jobs (password
// Motexa-Dev-1234!) and prints their emails + ids as JSON; `down <tag>` deletes everything of that tag. Never run against production.
//   npx tsx scripts/drivers-fixture.ts up        npx tsx scripts/drivers-fixture.ts down <tag>
import argon2 from "argon2";
import sharp from "sharp";
import { createHash } from "node:crypto";
import { prisma } from "../src/prisma.js";
import { removeStoredFile, storeFile } from "../src/uploads/providerFiles.js";

if (process.env.NODE_ENV === "production") throw new Error("dev only");
const PASS = "Motexa-Dev-1234!";
const mode = process.argv[2];

async function img(seed: number) {
  const w = 320, h = 240, px = Buffer.alloc(w * h * 3);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = (y * w + x) * 3; px[i] = (x + seed * 40) & 255; px[i + 1] = (y * 2 + seed * 20) & 255; px[i + 2] = 140; }
  return sharp(px, { raw: { width: w, height: h, channels: 3 } }).jpeg({ quality: 80 }).toBuffer();
}
async function file(ownerUserId: string, purpose: any, seed: number, rel: Record<string, string>) {
  const buffer = await img(seed);
  const key = await storeFile({ buffer, mimeType: "image/jpeg", ext: "jpg", originalName: "x.jpg", sha256: createHash("sha256").update(buffer).digest("hex") });
  await prisma.providerFile.create({ data: { ownerUserId, purpose, visibility: purpose === "DRIVER_LICENCE" ? "PRIVATE" : "PUBLIC", originalName: "x.jpg", mimeType: "image/jpeg", sizeBytes: buffer.length, storageKey: key, sha256: createHash("sha256").update(buffer).digest("hex"), ...rel } });
}

async function up() {
  const tag = `shot${Date.now().toString(36)}`;
  const hash = await argon2.hash(PASS, { type: argon2.argon2id });
  const mk = (key: string, name: string, role: any) => prisma.user.create({ data: { email: `${tag}.${key}@motexa.test`, fullName: name, role, status: "ACTIVE", passwordHash: hash } });
  const owner = await mk("owner", "Nablus Rescue Owner", "TOW_PROVIDER");
  const cust = await mk("cust", "Layla Haddad", "CUSTOMER");
  const company = await prisma.towCompanyProfile.create({ data: { userId: owner.id, companyName: "Nablus Rescue Tow", phone: "0599000000", city: "Nablus", baseLat: 32.2211, baseLng: 35.2544, verificationStatus: "APPROVED" } });
  const mkDriver = async (key: string, name: string, plate: string, approval: any, seed: number) => {
    const u = await mk(key, name, "TOW_DRIVER");
    const t = await prisma.truck.create({ data: { companyId: company.id, plateNumber: plate, make: "Isuzu", model: "NPR", truckType: "FLATBED", verificationStatus: "APPROVED", operationalStatus: "AVAILABLE", baseLat: 32.2211 + seed / 500, baseLng: 35.2544 } });
    const d = await prisma.towDriver.create({ data: { userId: u.id, companyId: company.id, truckId: t.id, phone: "0599123456", licenceNumber: `LIC-${seed}00${seed}`, approval } });
    await file(owner.id, "DRIVER_PHOTO", seed, { towDriverId: d.id });
    await file(owner.id, "DRIVER_LICENCE", seed + 3, { towDriverId: d.id });
    await file(owner.id, "TRUCK_PHOTO", seed + 6, { truckId: t.id });
    return { u, d, t };
  };
  const a = await mkDriver("drva", "Ahmad Khalil", "55-123-45", "APPROVED", 1);
  const b = await mkDriver("drvb", "Omar Saleh", "71-456-78", "APPROVED", 2);
  const p = await mkDriver("drvc", "Yousef Nasser", "12-345-67", "PENDING", 3);
  const base = { companyId: company.id, pickupAddress: "Rafidia street, Nablus", dropoffAddress: "Al-Najah garage, Nablus", contactPhone: "0599000111", vehicleMake: "Toyota", vehicleModel: "Corolla", vehicleYear: 2018, problemType: "WONT_START" as const, pickupLat: 32.2235, pickupLng: 35.2601, dropoffLat: 32.2290, dropoffLng: 35.2490 };
  const now = new Date();
  const ago = (m: number) => new Date(now.getTime() - m * 60_000);
  // a finished job (rated by nobody yet) and one on its way with a fresh live point
  const done = await prisma.towRequest.create({ data: { ...base, customerId: cust.id, driverId: b.d.id, assignedTruckId: b.t.id, assignedTruckType: "FLATBED", assignedTruckMake: "Isuzu", assignedTruckModel: "NPR", choiceMode: "DRIVER", status: "COMPLETED", createdAt: ago(90), acceptedAt: ago(85), enRouteAt: ago(80), arrivedAt: ago(70), loadingAt: ago(65), inProgressAt: ago(60), deliveredAt: ago(45), completedAt: ago(44) } });
  const cust2 = await mk("cust2", "Sara Mansour", "CUSTOMER");
  const live = await prisma.towRequest.create({ data: { ...base, customerId: cust2.id, driverId: a.d.id, assignedTruckId: a.t.id, assignedTruckType: "FLATBED", assignedTruckMake: "Isuzu", assignedTruckModel: "NPR", choiceMode: "NEAREST", status: "EN_ROUTE", createdAt: ago(12), acceptedAt: ago(10), enRouteAt: ago(8) } });
  await prisma.truck.update({ where: { id: a.t.id }, data: { operationalStatus: "BUSY" } });
  await prisma.towDriver.update({ where: { id: a.d.id }, data: { lastLat: 32.2211, lastLng: 35.2544, lastAt: now } });
  // a request nobody answered in time, and an open customer report on the finished job
  const lost = await prisma.towRequest.create({ data: { ...base, customerId: cust.id, choiceMode: "COMPANY", status: "CANCELLED", cancelledBy: "SYSTEM", cancelReason: "TIMEOUT", createdAt: ago(200), cancelledAt: ago(197) } });
  await prisma.towReport.create({ data: { requestId: done.id, reporterId: cust.id, body: "The driver arrived much later than the estimate." } });
  await prisma.towReview.create({ data: { requestId: done.id, customerId: cust.id, driverId: b.d.id, companyId: company.id, stars: 4, comment: "Polite, a bit late." } });
  const m = await prisma.towRequestMessage.createMany({ data: [{ requestId: live.id, authorUserId: cust2.id, body: "I am next to the pharmacy, white Corolla." }, { requestId: live.id, authorUserId: a.u.id, body: "Great, 5 minutes away." }] });
  void m;
  console.log(JSON.stringify({ tag, owner: owner.email, cust: cust.email, cust2: cust2.email, drvA: a.u.email, drvB: b.u.email, doneId: done.id, lostId: lost.id, liveId: live.id, companyId: company.id, driverA: a.d.id, pendingId: p.d.id }));
}

async function down(tag: string) {
  if (!/^shot[a-z0-9]+$/.test(tag)) throw new Error("bad tag");
  const users = await prisma.user.findMany({ where: { email: { startsWith: `${tag}.` } }, select: { id: true } });
  const ids = users.map((u) => u.id);
  const files = await prisma.providerFile.findMany({ where: { ownerUserId: { in: ids } }, select: { storageKey: true } });
  await Promise.all(files.map((f) => removeStoredFile(f.storageKey)));
  await prisma.notification.deleteMany({ where: { userId: { in: ids } } });
  await prisma.auditLog.deleteMany({ where: { actorId: { in: ids } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
  console.log("removed", ids.length, "users");
}

(mode === "up" ? up() : mode === "down" ? down(process.argv[3] ?? "") : Promise.reject(new Error("up | down <tag>"))).catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
