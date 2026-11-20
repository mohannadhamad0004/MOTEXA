import "dotenv/config";
import argon2 from "argon2";
import { prisma } from "../prisma.js";

// DEV ONLY (same guard as test-accounts.ts). CREATE-ONLY and idempotent: it creates what is missing (users, mechanic profiles, the 2 sample
// requests) and never updates or deletes anything that exists; a second run changes nothing. Audit rows only for what it created.
// `--dry-run` only lists what it would create (no writes, no guard needed). Only touches @motexa.test users.
const DRY = process.argv.includes("--dry-run");
if (!DRY && (process.env.NODE_ENV === "production" || process.env.ALLOW_DEV_SEED !== "true")) {
  console.error("Refusing to seed demo mechanics (production, or ALLOW_DEV_SEED !== 'true').");
  process.exit(1);
}

const DEV_PASSWORD = "Motexa-Dev-1234!";

// One mechanic model: User (role MECHANIC) + MechanicProfile. VERIFIED + ACTIVE = public, with every listed skill.
// The old MechanicApplication rows of these accounts stay in the database untouched (nothing reads them any more).
const mechanics: {
  email: string;
  fullName: string;
  status: "ACTIVE" | "PENDING";
  verificationStatus: "VERIFIED" | "PENDING";
  city: string;
  workshopName: string;
  workshopAddress: string;
  skills: string[];
}[] = [
  { email: "mechanic.nablus@motexa.test", fullName: "Khaled Mansour", status: "ACTIVE", verificationStatus: "VERIFIED", city: "Nablus", workshopName: "Al-Amal Auto Workshop", workshopAddress: "Rafidia Street, Nablus",
    skills: ["Engine", "Brakes", "Diagnostics", "Transmission"] },
  { email: "mechanic.ramallah@motexa.test", fullName: "Samer Haddad", status: "ACTIVE", verificationStatus: "VERIFIED", city: "Ramallah", workshopName: "Al-Manara Garage", workshopAddress: "Al-Masyoun, Ramallah",
    skills: ["Electrical", "Diagnostics", "Air conditioning", "Suspension & steering"] },
  { email: "mechanic.hebron@motexa.test", fullName: "Yousef Qawasmi", status: "ACTIVE", verificationStatus: "VERIFIED", city: "Hebron", workshopName: "Al-Khalil Car Care", workshopAddress: "Ein Sara Street, Hebron",
    skills: ["Bodywork", "Engine", "Suspension & steering"] },
  { email: "mechanic.jenin@motexa.test", fullName: "Omar Zakarneh", status: "ACTIVE", verificationStatus: "VERIFIED", city: "Jenin", workshopName: "Marj Ibn Amer Workshop", workshopAddress: "Al-Jabriyat, Jenin",
    skills: ["Brakes", "Engine", "Air conditioning"] },
  // Incomplete application: active account, profile still PENDING (never public). Per-skill approval no longer exists, so it is no longer a "partially approved" demo.
  { email: "mechanic.partial@motexa.test", fullName: "Nabil Shreim", status: "ACTIVE", verificationStatus: "PENDING", city: "Tulkarm", workshopName: "Shreim Motors", workshopAddress: "Main Street, Tulkarm",
    skills: ["Engine"] },
  // Still pending: must stay hidden everywhere.
  { email: "mechanic.review@motexa.test", fullName: "Waleed Jaber", status: "PENDING", verificationStatus: "PENDING", city: "Jericho", workshopName: "Jaber Auto Repair", workshopAddress: "Station Street, Jericho",
    skills: ["Engine", "Brakes"] },
];

async function main() {
  const say = (verb: string, what: string) => console.log(`${DRY ? "WOULD CREATE" : "created     "} ${verb.padEnd(16)} ${what}`);
  const keep = (what: string) => console.log(`exists (kept) ${what}`);
  const ids: Record<string, string> = {};
  let passwordHash: string | null = null;

  for (const [i, m] of mechanics.entries()) {
    const existing = await prisma.user.findUnique({ where: { email: m.email }, select: { id: true, mechanicProfile: { select: { id: true } } } });
    if (existing) { ids[m.email] = existing.id; keep(`user ${m.email}`); }
    else {
      say("user", `${m.email} (${m.status})`);
      if (!DRY) {
        passwordHash ??= await argon2.hash(DEV_PASSWORD, { type: argon2.argon2id });
        ids[m.email] = (await prisma.user.create({ data: { email: m.email, fullName: m.fullName, role: "MECHANIC", status: m.status, passwordHash }, select: { id: true } })).id;
      }
    }
    if (existing?.mechanicProfile) { keep(`profile ${m.email}`); continue; }
    say("mechanic profile", `${m.email} ${m.verificationStatus} ${m.city} skills: ${m.skills.join(", ")}`);
    if (DRY) continue;
    const verified = m.verificationStatus === "VERIFIED";
    await prisma.mechanicProfile.create({
      data: {
        userId: ids[m.email], phoneNumber: `+970 59 700 00${String(i + 1).padStart(2, "0")}`, city: m.city, specializations: m.skills,
        experienceSummary: "Dev seed demo mechanic.", offersWorkshop: true, workshopName: m.workshopName, workshopAddress: m.workshopAddress,
        termsAcceptedAt: new Date(), verificationStatus: m.verificationStatus, submittedAt: new Date(), submissionVersion: 1,
        interviewResult: verified ? "PASSED" : null, reviewNotes: verified ? "Dev seed: approved without documents." : null, reviewedAt: verified ? new Date() : null,
      },
    });
  }

  // Two sample requests from the test customer, only if not there yet.
  const customer = await prisma.user.findUnique({ where: { email: "customer@motexa.test" }, select: { id: true } });
  if (!customer) {
    console.log("customer@motexa.test not found: run `npm run seed:test` first, then this seed again. Requests skipped.");
    return;
  }
  const ago = (min: number) => new Date(Date.now() - min * 60_000);
  const samples = [
    { mech: "mechanic.nablus@motexa.test", label: "Nablus (REQUESTED)", data: { skill: "Brakes", carMake: "Toyota", carModel: "Corolla", carYear: 2016,
      problemDescription: "The brake pedal feels soft and there is a squeal when I stop. Please check the front pads.", preferredTime: "Tomorrow after 4 pm",
      locationText: "Rafidia Street, Nablus", locationLat: 32.2236, locationLng: 35.2381, requestedAt: ago(120) } },
    { mech: "mechanic.ramallah@motexa.test", label: "Ramallah (ACCEPTED)", data: { skill: "Air conditioning", carMake: "Hyundai", carModel: "Elantra", carYear: 2019,
      problemDescription: "The air conditioning blows warm air since last week, and the compressor clicks on and off.", locationText: "Al-Masyoun, Ramallah",
      status: "ACCEPTED" as const, requestedAt: ago(240), acceptedAt: ago(200) } },
  ];
  for (const s of samples) {
    if (await prisma.mechanicRequest.findFirst({ where: { customerId: customer.id, problemDescription: s.data.problemDescription }, select: { id: true } })) { keep(`request ${s.label}`); continue; }
    say("request", s.label);
    if (DRY) continue;
    if (!ids[s.mech]) { console.log(`  skipped: ${s.mech} missing`); continue; }
    const r = await prisma.mechanicRequest.create({ data: { customerId: customer.id, mechanicUserId: ids[s.mech], ...s.data } });
    await prisma.auditLog.createMany({ data: [
      { actorId: customer.id, action: "MECHANIC_REQUEST_CREATED", targetId: r.id, details: { seed: true } },
      ...(s.data.status === "ACCEPTED" ? [{ actorId: ids[s.mech], action: "MECHANIC_REQUEST_ACCEPTED", targetId: r.id, details: { seed: true } }] : []),
    ] });
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
