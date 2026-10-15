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
  { email: "tow@motexa.test", fullName: "Test Tow Company", role: "TOW_PROVIDER", status: "ACTIVE" },
  { email: "admin.mechanics@motexa.test", fullName: "Test Admin Mechanics", role: "ADMIN", status: "ACTIVE", permissions: ["MANAGE_MECHANICS"] },
  { email: "admin.tow@motexa.test", fullName: "Test Admin Towing", role: "ADMIN", status: "ACTIVE", permissions: ["MANAGE_TOWING"] },
  { email: "admin.parts@motexa.test", fullName: "Test Admin Parts", role: "ADMIN", status: "ACTIVE", permissions: ["MANAGE_SPARE_PARTS"] },
  { email: "admin.multi@motexa.test", fullName: "Test Admin Multi", role: "ADMIN", status: "ACTIVE", permissions: ["MANAGE_MECHANICS", "MANAGE_TOWING"] },
  { email: "superadmin@motexa.test", fullName: "Test Super Admin", role: "SUPER_ADMIN", status: "ACTIVE" },
];

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
}

main()
  .catch((e) => { console.error("Test seed failed:", e.message); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
