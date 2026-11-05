// Seeds the Vehicle list from src/vehicleCatalog.ts, with each model's body type from vehicle-body-types.csv (picks the 3D
// model). Idempotent: upsert by (make, model); rows are never deleted (a car a customer already chose keeps resolving).
// Run: npm run seed:vehicles
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { prisma } from "../prisma.js";
import { VEHICLE_CATALOG, normVehicle } from "../vehicleCatalog.js";

export const BODY_TYPES = ["sedan", "hatchback", "suv", "van", "pickup"] as const;

/** "make|model" (normalised) -> body type, from the CSV next to this file. */
function bodyTypes(): Map<string, string> {
  const csv = readFileSync(new URL("./vehicle-body-types.csv", import.meta.url), "utf8");
  const map = new Map<string, string>();
  for (const line of csv.split(/\r?\n/).slice(1)) {
    const [make, model, body] = line.split(",").map((x) => x?.trim() ?? "");
    if (make && model && (BODY_TYPES as readonly string[]).includes(body)) map.set(`${normVehicle(make)}|${normVehicle(model)}`, body);
  }
  return map;
}

export async function seedVehicles() {
  const existing=await prisma.vehicle.count();if(existing)return {n:existing,missing:0}; // Managed catalog is authoritative after bootstrap.
  const bodies = bodyTypes();
  let n = 0;
  let missing = 0;
  for (const mk of VEHICLE_CATALOG)
    for (const [model, modelAr, yearFrom, yearTo] of mk.models) {
      const key = { makeNormalized: normVehicle(mk.make), modelNormalized: normVehicle(model) };
      const bodyType = bodies.get(`${key.makeNormalized}|${key.modelNormalized}`) ?? null;
      if (!bodyType) missing++;
      const normalizedBrand=mk.make.toLowerCase().replace(/[^a-z0-9]/g,"");
      const brand=await prisma.vehicleBrand.upsert({where:{normalizedName:normalizedBrand==="mercedes"?"mercedesbenz":normalizedBrand},create:{name:mk.make==="Mercedes"?"Mercedes-Benz":mk.make,nameAr:mk.makeAr,normalizedName:normalizedBrand==="mercedes"?"mercedesbenz":normalizedBrand,aliases:[normalizedBrand]},update:{}});
      const data = {brandId:brand.id,catalogNormalizedName:model.toLowerCase().replace(/[^a-z0-9]/g,""), make: mk.make, makeAr: mk.makeAr, model, modelAr, yearFrom, yearTo, bodyType, ...key };
      await prisma.vehicle.upsert({ where: { makeNormalized_modelNormalized: key }, update: data, create: data });
      n++;
    }
  return { n, missing };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  seedVehicles()
    .then(({ n, missing }) => console.log(`Vehicle list: ${n} models upserted, ${n - missing} with a body type${missing ? `, ${missing} without` : ""}.`))
    .catch((e) => {
      console.error(e);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
