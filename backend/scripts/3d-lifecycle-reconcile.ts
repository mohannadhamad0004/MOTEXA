// Approved, idempotent local reconciliation. No downloads, provider calls, taxonomy creation, or asset deletion.
import { prisma } from "../src/prisma.js";
import { createVehicleModelService } from "../src/services/vehicle3d-management.js";
try {
  const actor=await prisma.user.findFirst({where:{status:"ACTIVE",OR:[{role:"SUPER_ADMIN"},{role:"ADMIN",adminPermissions:{some:{permission:"MANAGE_SPARE_PARTS"}}}]},select:{id:true}});
  if(!actor)throw Error("An active Parts Admin is required.");
  const result=await createVehicleModelService().initialize(actor.id);
  console.log(JSON.stringify({...result,registeredRevisions:await prisma.vehicle3DRevision.count()}));
} catch {console.error("3D reconciliation failed; no provider request was made.");process.exitCode=1;} finally {await prisma.$disconnect();}
