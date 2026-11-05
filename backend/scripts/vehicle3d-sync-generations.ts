// Idempotent, scoped cleanup of stale 3D pointers. Does not reseed vehicle data.
import { prisma } from "../src/prisma.js";
import { activeModels } from "../src/services/vehicle3d-catalog.js";
try {
  const keys = activeModels().map(m => m.key);
  const count = await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(762493031)`;
    const stale = await tx.vehicleGeneration.findMany({ where: { model3dKey: { not: null, notIn: keys } }, select: { id: true, model3dKey: true } });
    for (const row of stale) {
      await tx.vehicleGeneration.update({ where: { id: row.id }, data: { model3dKey: null, modelSourceUrl: null, modelLicense: null } });
      await tx.auditLog.create({ data: { action: "VEHICLE3D_LIBRARY_REMOVE", targetId: row.id, details: { previousKey: row.model3dKey } } });
    }
    return stale.length;
  });
  console.log(`Cleared ${count} stale generation 3D references; generations preserved.`);
} finally { await prisma.$disconnect(); }
