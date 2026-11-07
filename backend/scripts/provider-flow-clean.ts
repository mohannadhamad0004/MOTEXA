// Removes what mobile/tests/e2e/provider-flow.cjs created on the dev company (trucks FLOW-*, drivers flow*@motexa.test) and their stored files.
import { prisma } from "../src/prisma.js";
import { removeStoredFile } from "../src/uploads/providerFiles.js";

const trucks = await prisma.truck.findMany({ where: { plateNumber: { startsWith: "FLOW-" } }, select: { id: true } });
const users = await prisma.user.findMany({ where: { email: { startsWith: "flow", endsWith: "@motexa.test" } }, select: { id: true } });
const drivers = await prisma.towDriver.findMany({ where: { userId: { in: users.map((u) => u.id) } }, select: { id: true } });
const files = await prisma.providerFile.findMany({ where: { OR: [{ truckId: { in: trucks.map((t) => t.id) } }, { towDriverId: { in: drivers.map((d) => d.id) } }] }, select: { storageKey: true } });
await Promise.all(files.map((f) => removeStoredFile(f.storageKey)));
await prisma.auditLog.deleteMany({ where: { targetId: { in: [...trucks.map((t) => t.id), ...drivers.map((d) => d.id)] } } });
await prisma.truck.deleteMany({ where: { id: { in: trucks.map((t) => t.id) } } });
await prisma.notification.deleteMany({ where: { userId: { in: users.map((u) => u.id) } } });
await prisma.user.deleteMany({ where: { id: { in: users.map((u) => u.id) } } });
console.log("removed", trucks.length, "trucks,", users.length, "driver users,", files.length, "files");
await prisma.$disconnect();
