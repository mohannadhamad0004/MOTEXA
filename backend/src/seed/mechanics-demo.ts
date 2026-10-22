import "dotenv/config";
import argon2 from "argon2";
import { prisma } from "../prisma.js";

// DEV ONLY (same guard as test-accounts.ts). Idempotent: run it as often as you like.
// Adds demo mechanics + two sample requests next to the existing test accounts; it never changes them.
// Only ever touches users whose email ends with @motexa.test.
if (process.env.NODE_ENV === "production" || process.env.ALLOW_DEV_SEED !== "true") {
  console.error("Refusing to seed demo mechanics (production, or ALLOW_DEV_SEED !== 'true').");
  process.exit(1);
}

const DEV_PASSWORD = "Motexa-Dev-1234!";
type SkillState = "APPROVED" | "PENDING" | "REJECTED";

const mechanics: {
  email: string;
  fullName: string;
  status: "ACTIVE" | "PENDING";
  reviewStatus: "READY_FOR_AUTHORITY" | "PENDING_REVIEW";
  city: string;
  workshopName: string;
  workshopAddress: string;
  skills: Partial<Record<string, SkillState>>;
}[] = [
  { email: "mechanic.nablus@motexa.test", fullName: "Khaled Mansour", status: "ACTIVE", reviewStatus: "READY_FOR_AUTHORITY", city: "Nablus", workshopName: "Al-Amal Auto Workshop", workshopAddress: "Rafidia Street, Nablus",
    skills: { Engine: "APPROVED", Brakes: "APPROVED", Diagnostics: "APPROVED", Transmission: "APPROVED" } },
  { email: "mechanic.ramallah@motexa.test", fullName: "Samer Haddad", status: "ACTIVE", reviewStatus: "READY_FOR_AUTHORITY", city: "Ramallah", workshopName: "Al-Manara Garage", workshopAddress: "Al-Masyoun, Ramallah",
    skills: { Electrical: "APPROVED", Diagnostics: "APPROVED", "Air conditioning": "APPROVED", "Suspension & steering": "APPROVED" } },
  { email: "mechanic.hebron@motexa.test", fullName: "Yousef Qawasmi", status: "ACTIVE", reviewStatus: "READY_FOR_AUTHORITY", city: "Hebron", workshopName: "Al-Khalil Car Care", workshopAddress: "Ein Sara Street, Hebron",
    skills: { Bodywork: "APPROVED", Engine: "APPROVED", "Suspension & steering": "APPROVED" } },
  { email: "mechanic.jenin@motexa.test", fullName: "Omar Zakarneh", status: "ACTIVE", reviewStatus: "READY_FOR_AUTHORITY", city: "Jenin", workshopName: "Marj Ibn Amer Workshop", workshopAddress: "Al-Jabriyat, Jenin",
    skills: { Brakes: "APPROVED", Engine: "APPROVED", "Air conditioning": "APPROVED" } },
  // Partially approved: customers must see only "Engine".
  { email: "mechanic.partial@motexa.test", fullName: "Nabil Shreim", status: "ACTIVE", reviewStatus: "READY_FOR_AUTHORITY", city: "Tulkarm", workshopName: "Shreim Motors", workshopAddress: "Main Street, Tulkarm",
    skills: { Engine: "APPROVED", Bodywork: "PENDING", Electrical: "REJECTED" } },
  // Still pending: must stay hidden everywhere.
  { email: "mechanic.review@motexa.test", fullName: "Waleed Jaber", status: "PENDING", reviewStatus: "PENDING_REVIEW", city: "Jericho", workshopName: "Jaber Auto Repair", workshopAddress: "Station Street, Jericho",
    skills: { Engine: "PENDING", Brakes: "PENDING" } },
];

async function main() {
  const passwordHash = await argon2.hash(DEV_PASSWORD, { type: argon2.argon2id });
  const ids: Record<string, string> = {};

  for (const [i, m] of mechanics.entries()) {
    const user = await prisma.user.upsert({
      where: { email: m.email },
      update: { fullName: m.fullName, role: "MECHANIC", status: m.status, passwordHash },
      create: { email: m.email, fullName: m.fullName, role: "MECHANIC", status: m.status, passwordHash },
    });
    ids[m.email] = user.id;
    const data = {
      phone: `+970 59 700 00${String(i + 1).padStart(2, "0")}`,
      city: m.city,
      workshopName: m.workshopName,
      workshopAddress: m.workshopAddress,
      licenceNumber: `DEV-LIC-${String(i + 1).padStart(3, "0")}`,
      licenceHolderName: m.fullName,
      issuingAuthority: "Dev seed (not a real authority)",
      authorizationAccepted: true,
      authorizationAcceptedAt: new Date(),
      reviewStatus: m.reviewStatus,
    };
    const app = await prisma.mechanicApplication.upsert({ where: { userId: user.id }, update: data, create: { userId: user.id, ...data } });
    for (const [name, status] of Object.entries(m.skills)) {
      const skill = { status: status!, rejectionReason: status === "REJECTED" ? "Dev seed: example of a rejected skill" : null };
      await prisma.mechanicSkillApplication.upsert({ where: { applicationId_name: { applicationId: app.id, name } }, update: skill, create: { applicationId: app.id, name, ...skill } });
    }
    const approved = Object.entries(m.skills).filter(([, s]) => s === "APPROVED").map(([n]) => n);
    console.log(`${m.email.padEnd(34)} ${m.status.padEnd(8)} ${m.city.padEnd(9)} approved: ${approved.join(", ") || "-"}`);
  }

  // Two sample requests from the test customer (replaced on every run).
  const customer = await prisma.user.findUnique({ where: { email: "customer@motexa.test" }, select: { id: true } });
  if (!customer) {
    console.log("customer@motexa.test not found: run `npm run seed:test` first, then this seed again. Requests skipped.");
    return;
  }
  const problems = {
    requested: "The brake pedal feels soft and there is a squeal when I stop. Please check the front pads.",
    accepted: "The air conditioning blows warm air since last week, and the compressor clicks on and off.",
  };
  await prisma.mechanicRequest.deleteMany({ where: { customerId: customer.id, problemDescription: { in: Object.values(problems) } } });
  const ago = (min: number) => new Date(Date.now() - min * 60_000);
  const nablus = await prisma.mechanicRequest.create({
    data: {
      customerId: customer.id, mechanicUserId: ids["mechanic.nablus@motexa.test"], skill: "Brakes", carMake: "Toyota", carModel: "Corolla", carYear: 2016,
      problemDescription: problems.requested, preferredTime: "Tomorrow after 4 pm", locationText: "Rafidia Street, Nablus", locationLat: 32.2236, locationLng: 35.2381,
      requestedAt: ago(120),
    },
  });
  const ramallah = await prisma.mechanicRequest.create({
    data: {
      customerId: customer.id, mechanicUserId: ids["mechanic.ramallah@motexa.test"], skill: "Air conditioning", carMake: "Hyundai", carModel: "Elantra", carYear: 2019,
      problemDescription: problems.accepted, locationText: "Al-Masyoun, Ramallah", status: "ACCEPTED", requestedAt: ago(240), acceptedAt: ago(200),
    },
  });
  await prisma.auditLog.createMany({
    data: [
      { actorId: customer.id, action: "MECHANIC_REQUEST_CREATED", targetId: nablus.id, details: { seed: true } },
      { actorId: customer.id, action: "MECHANIC_REQUEST_CREATED", targetId: ramallah.id, details: { seed: true } },
      { actorId: ids["mechanic.ramallah@motexa.test"], action: "MECHANIC_REQUEST_ACCEPTED", targetId: ramallah.id, details: { seed: true } },
    ],
  });
  console.log("customer@motexa.test               2 mechanic requests: Nablus (REQUESTED), Ramallah (ACCEPTED)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
